// Parser for OpenClaude Vibe Coding <ocAction> blocks (streaming & complete)

function parseAttrs(raw = '') {
  const out = {};
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = m[2] ?? m[3] ?? '';
  }
  return out;
}

export function parseVibeResponse(text = '', isStreaming = false) {
  if (!text) return { parts: [], actions: [] };

  const parts = [];
  const actions = [];
  let cursor = 0;
  let idx = 0;

  while (cursor < text.length) {
    const start = text.indexOf('<ocAction', cursor);
    if (start === -1) {
      const rem = text.slice(cursor);
      if (rem.trim()) parts.push({ kind: 'prose', text: rem });
      break;
    }

    if (start > cursor) {
      const before = text.slice(cursor, start);
      if (before.trim()) parts.push({ kind: 'prose', text: before });
    }

    const gt = text.indexOf('>', start);
    if (gt === -1) {
      parts.push({
        kind: 'action',
        action: {
          index: idx,
          type: 'write_file',
          path: '...',
          body: '',
          complete: false,
        },
      });
      break;
    }

    const attrs = parseAttrs(text.slice(start + 9, gt));
    const closeTag = '</ocAction>';
    const end = text.indexOf(closeTag, gt + 1);

    let body = '';
    let complete = false;
    if (end === -1) {
      body = text.slice(gt + 1).replace(/^\r?\n/, '');
      complete = !isStreaming && false;
      cursor = text.length;
    } else {
      body = text.slice(gt + 1, end).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      complete = true;
      cursor = end + closeTag.length;
    }

    // Strip accidental markdown code fences if a model wrapped content inside <ocAction>
    body = body
      .replace(/^```[a-zA-Z0-9_-]*\r?\n/, '')
      .replace(/\r?\n```\s*$/, '');

    let search = '';
    let replace = '';
    if (attrs.type === 'edit_file') {
      const sMatch = body.match(/<search>\r?\n?([\s\S]*?)\r?\n?<\/search>/);
      const rMatch = body.match(/<replace>\r?\n?([\s\S]*?)\r?\n?<\/replace>/);
      search = sMatch ? sMatch[1] : '';
      replace = rMatch ? rMatch[1] : '';
    }

    const action = {
      index: idx,
      type: attrs.type || 'write_file',
      path: attrs.path || '',
      body,
      search,
      replace,
      complete,
    };

    actions.push(action);
    parts.push({ kind: 'action', action });
    idx++;
  }

  return { parts, actions };
}
