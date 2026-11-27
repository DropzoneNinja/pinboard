/** Rewrites image `src` attrs in a (already-sanitized) TipTap doc from old attachment ids to new ones. */

type JsonNode = { type?: unknown; attrs?: Record<string, unknown>; content?: unknown };

const ATTACHMENT_SRC_PATTERN = /^\/api\/v1\/attachments\/([0-9a-f-]{36})$/;

function remapNode(node: unknown, idMap: Map<string, string>): unknown {
  if (typeof node !== 'object' || node === null) return node;
  const n = node as JsonNode;
  const result: JsonNode = { ...n };

  if (n.type === 'image' && typeof n.attrs?.src === 'string') {
    const match = ATTACHMENT_SRC_PATTERN.exec(n.attrs.src);
    const newId = match ? idMap.get(match[1]!) : undefined;
    if (newId) result.attrs = { ...n.attrs, src: `/api/v1/attachments/${newId}` };
  }

  if (Array.isArray(n.content)) {
    result.content = n.content.map((child) => remapNode(child, idMap));
  }

  return result;
}

export function remapAttachmentIds(content: unknown, idMap: Map<string, string>): unknown {
  return remapNode(content, idMap);
}
