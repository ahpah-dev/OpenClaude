// Local Ollama Engine Service — Native /api/tags, /api/ps, /api/pull, /api/delete, /api/chat
import { createThinkTagSplitter } from './nineRouterService.js';

function normalizeOllamaUrl(url = 'http://127.0.0.1:11434') {
  return String(url || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
}

export async function listOllamaModels({ baseUrl }) {
  const root = normalizeOllamaUrl(baseUrl);
  const [tagsRes, psRes] = await Promise.allSettled([
    fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(4000) }),
    fetch(`${root}/api/ps`, { signal: AbortSignal.timeout(2500) }),
  ]);

  if (tagsRes.status !== 'fulfilled' || !tagsRes.value.ok) {
    throw new Error('Cannot reach local Ollama server on ' + root);
  }

  const tagsJson = await tagsRes.value.json();
  let runningSet = new Map();
  if (psRes.status === 'fulfilled' && psRes.value.ok) {
    try {
      const psJson = await psRes.value.json();
      for (const rm of psJson?.models || []) {
        runningSet.set(rm.name || rm.model, {
          sizeVram: rm.size_vram || 0,
          expiresAt: rm.expires_at || null,
        });
      }
    } catch {
      // ignore
    }
  }

  const models = (tagsJson?.models || []).map((m) => {
    const caps = Array.isArray(m.capabilities) ? m.capabilities : [];
    const details = m.details || {};
    const vramInfo = runningSet.get(m.name) || runningSet.get(m.model) || null;
    const displayShort = m.name
      .replace(/^hf\.co\/[^/]+\//i, '')
      .replace(/:latest$/i, '');

    return {
      id: m.name,
      name: displayShort,
      fullName: m.name,
      backend: 'ollama',
      provider: 'ollama-local',
      sizeBytes: m.size || 0,
      sizeGb: m.size ? Number((m.size / (1024 ** 3)).toFixed(2)) : null,
      parameterSize: details.parameter_size || '',
      quantization: details.quantization_level || '',
      family: details.family || '',
      contextWindow: details.context_length || 32768,
      modifiedAt: m.modified_at,
      loadedInVram: !!vramInfo,
      vramGb: vramInfo?.sizeVram ? Number((vramInfo.sizeVram / (1024 ** 3)).toFixed(2)) : null,
      capabilities: {
        vision: caps.includes('vision'),
        reasoning: caps.includes('thinking') || /r1|qwq|qwen3|think/i.test(m.name),
        tools: caps.includes('tools'),
      },
    };
  });

  // Loaded VRAM models first, then most recently modified
  models.sort((a, b) => {
    if (a.loadedInVram !== b.loadedInVram) return a.loadedInVram ? -1 : 1;
    return new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0);
  });

  return { models };
}

export async function pullOllamaModel({ baseUrl, model, signal, onProgress }) {
  const root = normalizeOllamaUrl(baseUrl);
  const res = await fetch(`${root}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama pull failed (${res.status}): ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        const percent =
          j.total && j.completed ? Math.round((j.completed / j.total) * 100) : null;
        onProgress?.({
          status: j.status || 'Downloading...',
          completed: j.completed || 0,
          total: j.total || 0,
          percent,
        });
      } catch (err) {
        if (err.message && !err.message.includes('JSON')) throw err;
      }
    }
  }

  onProgress?.({ status: 'success', percent: 100, done: true });
}

export async function deleteOllamaModel({ baseUrl, model }) {
  const root = normalizeOllamaUrl(baseUrl);
  const res = await fetch(`${root}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to delete model (${res.status}): ${txt}`);
  }
  return { success: true };
}

function formatOllamaMessages(messages) {
  return messages.map((msg) => {
    const images = (msg.attachments || [])
      .filter((a) => a.kind === 'image' && a.dataUrl)
      .map((a) => {
        const comma = a.dataUrl.indexOf(',');
        return comma !== -1 ? a.dataUrl.slice(comma + 1) : a.dataUrl;
      });

    const textAttachments = (msg.attachments || []).filter((a) => a.kind !== 'image' && a.content);
    let fullText = msg.content || '';
    if (textAttachments.length > 0) {
      const blocks = textAttachments
        .map((a) => `<document title="${a.name || 'attachment'}">\n${a.content}\n</document>`)
        .join('\n\n');
      fullText = fullText ? `${blocks}\n\n${fullText}` : blocks;
    }

    const out = {
      role: msg.role,
      content: fullText,
    };
    if (images.length > 0) {
      out.images = images;
    }
    return out;
  });
}

export async function streamOllamaChat({
  baseUrl,
  model,
  systemPrompt,
  messages,
  options = {},
  signal,
  onChunk,
}) {
  const root = normalizeOllamaUrl(baseUrl);
  const formatted = [];
  if (systemPrompt && systemPrompt.trim()) {
    formatted.push({ role: 'system', content: systemPrompt.trim() });
  }
  formatted.push(...formatOllamaMessages(messages));

  const buildPayload = (includeThinkFlag) => {
    const payload = {
      model,
      messages: formatted,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.9,
        top_k: options.topK ?? 40,
        num_ctx: options.numCtx ?? 32768,
        num_predict: options.maxTokens ?? 8192,
        repeat_penalty: options.repeatPenalty ?? 1.05,
      },
    };
    if (includeThinkFlag) {
      payload.think = !!options.extendedThinking;
    }
    return payload;
  };

  let res = await fetch(`${root}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(true)),
    signal,
  });

  // Graceful fallback if a non-thinking model rejects the `think` parameter
  if (res.status === 400) {
    const errBody = await res.text().catch(() => '');
    if (/think/i.test(errBody)) {
      res = await fetch(`${root}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(false)),
        signal,
      });
    } else {
      throw new Error(`Ollama error (400): ${errBody}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama error (${res.status}): ${errText || res.statusText}`);
  }

  const startTime = Date.now();
  const splitter = createThinkTagSplitter((kind, text) => {
    onChunk({ type: kind, text });
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let evalCount = 0;
  let promptEvalCount = 0;
  let evalDurationNs = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line);
      if (chunk.error) {
        throw new Error(chunk.error);
      }

      const msg = chunk.message || {};
      if (typeof msg.thinking === 'string' && msg.thinking) {
        onChunk({ type: 'thinking', text: msg.thinking });
      }
      if (typeof msg.content === 'string' && msg.content) {
        splitter.push(msg.content);
      }

      if (chunk.done) {
        evalCount = chunk.eval_count || 0;
        promptEvalCount = chunk.prompt_eval_count || 0;
        evalDurationNs = chunk.eval_duration || 0;
      }
    }
  }

  splitter.flush();

  const elapsedSec = evalDurationNs > 0 ? evalDurationNs / 1e9 : Math.max(0.1, (Date.now() - startTime) / 1000);
  onChunk({
    type: 'usage',
    usage: {
      promptTokens: promptEvalCount || null,
      completionTokens: evalCount || null,
      tokPerSec: evalCount ? Number((evalCount / elapsedSec).toFixed(1)) : null,
      totalDurationMs: Date.now() - startTime,
    },
  });
}
