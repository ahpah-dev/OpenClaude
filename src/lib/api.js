export async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function consumeSSE(path, { method = 'POST', body, signal, onEvent }) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error || `Request failed (HTTP ${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const event = JSON.parse(jsonStr);
        onEvent?.(event);
      } catch {
        // ignore partial
      }
    }
  }
}
