// 9Router Gateway Service — OpenAI-compatible /v1 proxy + documented dashboard key provisioning

function normalizeBaseUrl(url = 'http://127.0.0.1:20128') {
  return String(url || 'http://127.0.0.1:20128').trim().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
}

function extractAuthCookie(headers) {
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') || ''];
  for (const c of list) {
    const m = /(?:^|,\s*)auth_token=([^;]+)/.exec(c);
    if (m) return `auth_token=${m[1]}`;
  }
  return null;
}

export async function listNineRouterModels({ baseUrl, apiKey }) {
  const root = normalizeBaseUrl(baseUrl);
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${root}/v1/models`, {
    headers,
    signal: AbortSignal.timeout(6000),
  });

  if (res.status === 401) {
    return {
      models: [],
      requiresAuth: true,
      error: '9Router requires an API key to list models on this instance.',
    };
  }
  if (!res.ok) {
    throw new Error(`9Router /v1/models returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawModels = Array.isArray(data?.data) ? data.data : [];

  const models = rawModels.map((m) => {
    const caps = m.capabilities || {};
    const isCombo = m.owned_by === 'combo' || !String(m.id).includes('/');
    return {
      id: m.id,
      name: m.id,
      backend: '9router',
      provider: m.owned_by || (String(m.id).includes('/') ? String(m.id).split('/')[0] : 'combo'),
      isCombo,
      contextWindow: m.context_length || caps.contextWindow || 128000,
      maxOutput: m.max_completion_tokens || caps.maxOutput || 16384,
      capabilities: {
        vision: !!caps.vision,
        reasoning: !!caps.reasoning,
        tools: caps.tools !== false,
        pdf: !!caps.pdf,
      },
    };
  });

  // Sort combos first, then Claude/Sonnet/Opus/Free/DeepSeek/Qwen models prominently
  models.sort((a, b) => {
    if (a.isCombo !== b.isCombo) return a.isCombo ? -1 : 1;
    const score = (id) => {
      const s = id.toLowerCase();
      if (s === 'free') return 100;
      if (s.includes('claude')) return 90;
      if (s.includes('sonnet') || s.includes('opus')) return 85;
      if (s.includes('deepseek') || s.includes('qwen') || s.includes('glm') || s.includes('gemma')) return 75;
      return 10;
    };
    const diff = score(b.id) - score(a.id);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  return {
    models,
    requiresAuth: false,
    hasApiKey: !!apiKey,
  };
}

/**
 * Provision or fetch an OpenClaude API key from 9Router using the documented
 * dashboard auth API (`/api/auth/login` + `/api/keys`), matching `9router connect`.
 */
export async function provisionNineRouterKey({ baseUrl, password = '', keyName = 'openclaude-app' }) {
  const root = normalizeBaseUrl(baseUrl);
  let cookie = null;

  // First try without login in case dashboard password protection is not enabled on fresh install
  if (!password) {
    const openTry = await fetch(`${root}/api/keys`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (openTry.ok) {
      const json = await openTry.json();
      const active = (json?.keys || []).filter((k) => k.isActive !== false);
      const existing = active.find((k) => k.name === keyName) || active[0];
      if (existing?.key) return { apiKey: existing.key, reused: true };

      const createOpen = await fetch(`${root}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: keyName }),
      });
      if (createOpen.ok) {
        const created = await createOpen.json();
        if (created?.key) return { apiKey: created.key, reused: false };
      }
    }
    throw new Error('Dashboard password required. Enter your 9Router dashboard password or paste an API key from http://localhost:20128/dashboard.');
  }

  // Authenticate with user-provided dashboard password
  const loginRes = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password }),
    redirect: 'manual',
    signal: AbortSignal.timeout(6000),
  });

  let loginData = {};
  try {
    loginData = await loginRes.json();
  } catch {
    // ignore
  }

  if (!loginRes.ok || !loginData?.success) {
    throw new Error(loginData?.error || `Login failed (HTTP ${loginRes.status})`);
  }

  cookie = extractAuthCookie(loginRes.headers);
  if (!cookie) {
    throw new Error('Login succeeded but 9Router did not return a session cookie.');
  }

  const keysRes = await fetch(`${root}/api/keys`, {
    headers: { Accept: 'application/json', Cookie: cookie },
    signal: AbortSignal.timeout(6000),
  });
  if (!keysRes.ok) {
    throw new Error(`Failed to read API keys (HTTP ${keysRes.status})`);
  }
  const keysJson = await keysRes.json();
  const activeKeys = (keysJson?.keys || []).filter((k) => k.isActive !== false);
  const match = activeKeys.find((k) => k.name === keyName) || activeKeys[0];
  if (match?.key) {
    return { apiKey: match.key, name: match.name, reused: true };
  }

  const createRes = await fetch(`${root}/api/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ name: keyName }),
    signal: AbortSignal.timeout(6000),
  });
  const createdJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createdJson?.key) {
    throw new Error(createdJson?.error || `Failed to create API key (HTTP ${createRes.status})`);
  }
  return { apiKey: createdJson.key, name: keyName, reused: false };
}

function formatOpenAIMessages(messages) {
  return messages.map((msg) => {
    const images = (msg.attachments || []).filter((a) => a.kind === 'image' && a.dataUrl);
    const textAttachments = (msg.attachments || []).filter((a) => a.kind !== 'image' && a.content);

    let fullText = msg.content || '';
    if (textAttachments.length > 0) {
      const blocks = textAttachments
        .map((a) => `<document title="${a.name || 'attachment'}">\n${a.content}\n</document>`)
        .join('\n\n');
      fullText = fullText ? `${blocks}\n\n${fullText}` : blocks;
    }

    if (images.length > 0 && msg.role === 'user') {
      const parts = [];
      for (const img of images) {
        parts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
      if (fullText) {
        parts.push({ type: 'text', text: fullText });
      }
      return { role: msg.role, content: parts };
    }

    return { role: msg.role, content: fullText };
  });
}

/**
 * Stateful splitter for inline <think>...</think> blocks inside content deltas
 */
export function createThinkTagSplitter(emit) {
  let buffer = '';
  let inThink = false;

  return {
    push(text) {
      if (!text) return;
      buffer += text;

      while (buffer.length > 0) {
        if (!inThink) {
          const startIdx = buffer.indexOf('<think>');
          if (startIdx === -1) {
            // Hold back partial prefix of "<think>" at end of buffer
            let hold = 0;
            const tag = '<think>';
            for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
              if (buffer.endsWith(tag.slice(0, k))) {
                hold = k;
                break;
              }
            }
            const safe = buffer.slice(0, buffer.length - hold);
            if (safe) emit('content', safe);
            buffer = buffer.slice(buffer.length - hold);
            break;
          } else {
            const before = buffer.slice(0, startIdx);
            if (before) emit('content', before);
            buffer = buffer.slice(startIdx + 7);
            inThink = true;
          }
        } else {
          const endIdx = buffer.indexOf('</think>');
          if (endIdx === -1) {
            let hold = 0;
            const tag = '</think>';
            for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
              if (buffer.endsWith(tag.slice(0, k))) {
                hold = k;
                break;
              }
            }
            const safe = buffer.slice(0, buffer.length - hold);
            if (safe) emit('thinking', safe);
            buffer = buffer.slice(buffer.length - hold);
            break;
          } else {
            const thought = buffer.slice(0, endIdx);
            if (thought) emit('thinking', thought);
            buffer = buffer.slice(endIdx + 8);
            // Trim leading newline right after </think>
            buffer = buffer.replace(/^\r?\n/, '');
            inThink = false;
          }
        }
      }
    },
    flush() {
      if (buffer) {
        emit(inThink ? 'thinking' : 'content', buffer);
        buffer = '';
      }
    },
  };
}

export async function streamNineRouterChat({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  messages,
  options = {},
  signal,
  onChunk,
}) {
  const root = normalizeBaseUrl(baseUrl);
  const formattedMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
  }
  formattedMessages.push(...formatOpenAIMessages(messages));

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body = {
    model,
    messages: formattedMessages,
    stream: true,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };
  if (options.topP !== undefined) body.top_p = options.topP;
  if (options.extendedThinking) {
    body.reasoning_effort = 'medium';
  }

  const startTime = Date.now();
  let tokenCount = 0;

  const res = await fetch(`${root}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let parsedErr = errText;
    try {
      const j = JSON.parse(errText);
      parsedErr = j?.error?.message || j?.error || errText;
    } catch {
      // keep raw
    }
    if (res.status === 401) {
      throw new Error(
        '9Router API Key required or invalid (HTTP 401). Open Settings → 9Router Gateway to connect with your dashboard password or paste an API key from http://localhost:20128/dashboard (or switch to a Local Ollama model right in the model selector!).'
      );
    }
    throw new Error(`9Router error (${res.status}): ${parsedErr || res.statusText}`);
  }

  const splitter = createThinkTagSplitter((kind, text) => {
    tokenCount += Math.max(1, Math.ceil(text.length / 4));
    onChunk({ type: kind, text });
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let finalUsage = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) {
          throw new Error(parsed.error.message || JSON.stringify(parsed.error));
        }
        if (parsed.usage) {
          finalUsage = parsed.usage;
        }
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta || choice.message || {};

        const reasoning = delta.reasoning_content || delta.reasoning || delta.thinking;
        if (reasoning) {
          tokenCount += Math.max(1, Math.ceil(reasoning.length / 4));
          onChunk({ type: 'thinking', text: reasoning });
        }

        if (typeof delta.content === 'string' && delta.content) {
          splitter.push(delta.content);
        }
      } catch (err) {
        if (err.message && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }
  }

  splitter.flush();

  const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
  const completionTokens = finalUsage?.completion_tokens || tokenCount;
  onChunk({
    type: 'usage',
    usage: {
      promptTokens: finalUsage?.prompt_tokens || null,
      completionTokens,
      tokPerSec: Number((completionTokens / elapsedSec).toFixed(1)),
      totalDurationMs: Date.now() - startTime,
    },
  });
}
