// Conversation DAG / Tree Manager — enables authentic Claude.ai < 1 / 2 > message branching

export function createEmptyConversation({ projectId = null, styleId = 'normal', backend = 'ollama', model = '' } = {}) {
  return {
    id: `chat_${crypto.randomUUID()}`,
    title: 'New chat',
    starred: false,
    projectId,
    backend,
    model,
    systemPromptOverride: '',
    styleId,
    nodes: {},
    rootIds: [],
    currentLeafId: null,
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function addMessageNode(conv, { parentId = null, role, content = '', thinking = '', attachments = [], model = '', backend = '' }) {
  const id = `msg_${crypto.randomUUID()}`;
  const nodes = { ...(conv.nodes || {}) };
  let rootIds = [...(conv.rootIds || [])];

  const node = {
    id,
    parentId,
    childrenIds: [],
    selectedChildId: null,
    role,
    content,
    thinking,
    thinkingDurationSec: null,
    attachments,
    model,
    backend,
    usage: null,
    feedback: null,
    createdAt: new Date().toISOString(),
  };

  nodes[id] = node;

  if (parentId && nodes[parentId]) {
    const parent = { ...nodes[parentId] };
    parent.childrenIds = [...(parent.childrenIds || []), id];
    parent.selectedChildId = id;
    nodes[parentId] = parent;
  } else {
    rootIds.push(id);
  }

  return {
    ...conv,
    nodes,
    rootIds,
    currentLeafId: id,
    selectedRootId: parentId ? conv.selectedRootId || rootIds[0] : id,
  };
}

export function updateMessageNode(conv, nodeId, patch) {
  if (!conv?.nodes?.[nodeId]) return conv;
  return {
    ...conv,
    nodes: {
      ...conv.nodes,
      [nodeId]: {
        ...conv.nodes[nodeId],
        ...(typeof patch === 'function' ? patch(conv.nodes[nodeId]) : patch),
      },
    },
  };
}

/**
 * Computes the active linear message path + sibling branch info (< index / total >)
 */
export function getActiveThread(conv) {
  if (!conv || !conv.nodes) return [];
  const nodes = conv.nodes;
  const rootIds = conv.rootIds || [];
  if (rootIds.length === 0) return [];

  // If currentLeafId exists, walk upwards from leaf to root to guarantee consistency,
  // or walk downwards following selectedChildId
  let activeRootId = conv.selectedRootId && nodes[conv.selectedRootId] ? conv.selectedRootId : rootIds[rootIds.length - 1];

  if (conv.currentLeafId && nodes[conv.currentLeafId]) {
    let cursor = nodes[conv.currentLeafId];
    while (cursor?.parentId && nodes[cursor.parentId]) {
      cursor = nodes[cursor.parentId];
    }
    if (cursor) activeRootId = cursor.id;
  }

  const thread = [];
  let currentId = activeRootId;
  const visited = new Set();

  while (currentId && nodes[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes[currentId];
    const siblings = node.parentId && nodes[node.parentId]
      ? nodes[node.parentId].childrenIds || [node.id]
      : rootIds;
    const siblingIndex = Math.max(0, siblings.indexOf(node.id));

    thread.push({
      ...node,
      branchIndex: siblingIndex + 1,
      branchTotal: siblings.length,
      siblingIds: siblings,
    });

    if (node.childrenIds?.length > 0) {
      const nextId =
        node.selectedChildId && node.childrenIds.includes(node.selectedChildId)
          ? node.selectedChildId
          : node.childrenIds[node.childrenIds.length - 1];
      currentId = nextId;
    } else {
      currentId = null;
    }
  }

  return thread;
}

/**
 * Switch sibling branch (< prev | next >) on any message node
 */
export function switchNodeBranch(conv, nodeId, targetSiblingId) {
  const nodes = { ...(conv.nodes || {}) };
  const node = nodes[nodeId];
  if (!node || !nodes[targetSiblingId]) return conv;

  let selectedRootId = conv.selectedRootId;
  if (node.parentId && nodes[node.parentId]) {
    nodes[node.parentId] = {
      ...nodes[node.parentId],
      selectedChildId: targetSiblingId,
    };
  } else {
    selectedRootId = targetSiblingId;
  }

  // Descend down targetSiblingId's preferred children to find new leaf
  let cursor = nodes[targetSiblingId];
  const seen = new Set();
  while (cursor?.childrenIds?.length > 0 && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    const nextId =
      cursor.selectedChildId && cursor.childrenIds.includes(cursor.selectedChildId)
        ? cursor.selectedChildId
        : cursor.childrenIds[cursor.childrenIds.length - 1];
    cursor = nodes[nextId];
  }

  return {
    ...conv,
    nodes,
    selectedRootId,
    currentLeafId: cursor?.id || targetSiblingId,
  };
}
