/**
 * Server-side allowlist sanitiser for TipTap's JSON document format.
 *
 * TipTap renders through ProseMirror's own DOM layer rather than innerHTML, so the realistic
 * XSS surface is narrow — mainly `href`/`src` attribute values — but this still strips any
 * node/mark type or attribute we don't explicitly support, rather than trusting the client.
 * It also doubles as the "no external image hosting" enforcement point for image `src` (Phase 4).
 */

type JsonNode = {
  type?: unknown;
  attrs?: unknown;
  content?: unknown;
  marks?: unknown;
  text?: unknown;
};

const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify']);
const ATTACHMENT_SRC_PATTERN = /^\/api\/v1\/attachments\/[0-9a-f-]{36}$/;

function isSafeHref(href: unknown): href is string {
  if (typeof href !== 'string') return false;
  return /^(https?:|mailto:)/i.test(href);
}

function sanitizeMark(mark: unknown): JsonNode | null {
  if (typeof mark !== 'object' || mark === null) return null;
  const m = mark as JsonNode;
  switch (m.type) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return { type: m.type };
    case 'link': {
      const attrs = m.attrs as Record<string, unknown> | undefined;
      if (!isSafeHref(attrs?.href)) return null;
      return {
        type: 'link',
        attrs: { href: attrs!.href, rel: 'noopener noreferrer', target: '_blank' },
      };
    }
    default:
      return null;
  }
}

function sanitizeAttrs(nodeType: string, attrs: unknown): Record<string, unknown> | undefined {
  if (typeof attrs !== 'object' || attrs === null) return undefined;
  const a = attrs as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if ('textAlign' in a && ALLOWED_TEXT_ALIGN.has(a.textAlign as string)) {
    out.textAlign = a.textAlign;
  }

  switch (nodeType) {
    case 'heading':
      out.level = [1, 2, 3].includes(a.level as number) ? a.level : 2;
      break;
    case 'orderedList':
      if (typeof a.start === 'number') out.start = a.start;
      break;
    case 'taskItem':
      out.checked = a.checked === true;
      break;
    case 'image':
      if (typeof a.src === 'string' && ATTACHMENT_SRC_PATTERN.test(a.src)) {
        out.src = a.src;
        if (typeof a.alt === 'string') out.alt = a.alt.slice(0, 300);
        if (typeof a.width === 'number') out.width = a.width;
        if (typeof a.height === 'number') out.height = a.height;
      } else {
        return undefined; // caller drops the node entirely when src is missing
      }
      break;
    case 'tableCell':
    case 'tableHeader':
      if (typeof a.colspan === 'number') out.colspan = a.colspan;
      if (typeof a.rowspan === 'number') out.rowspan = a.rowspan;
      if (typeof a.backgroundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(a.backgroundColor)) {
        out.backgroundColor = a.backgroundColor;
      }
      break;
  }

  return out;
}

const ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'horizontalRule',
  'hardBreak',
  'image',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
]);

function sanitizeNode(node: unknown): JsonNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as JsonNode;
  if (typeof n.type !== 'string' || !ALLOWED_NODES.has(n.type)) return null;

  const result: JsonNode = { type: n.type };

  if (n.type === 'text') {
    if (typeof n.text !== 'string') return null;
    result.text = n.text;
    if (Array.isArray(n.marks)) {
      const marks = n.marks.map(sanitizeMark).filter((m): m is JsonNode => m !== null);
      if (marks.length > 0) result.marks = marks;
    }
    return result;
  }

  const attrs = sanitizeAttrs(n.type, n.attrs);
  if (n.type === 'image' && attrs === undefined) return null; // dropped: unsafe/missing src
  if (attrs && Object.keys(attrs).length > 0) result.attrs = attrs;

  if (Array.isArray(n.content)) {
    const children = n.content.map(sanitizeNode).filter((c): c is JsonNode => c !== null);
    if (children.length > 0) result.content = children;
  }

  return result;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function sanitizeContent(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) return EMPTY_DOC;
  const doc = input as JsonNode;
  if (doc.type !== 'doc') return EMPTY_DOC;
  const sanitized = sanitizeNode(doc);
  return (sanitized as Record<string, unknown>) ?? EMPTY_DOC;
}

export type ContentType = 'text' | 'image' | 'table' | 'mixed';

function collectNodeTypes(node: JsonNode, found: Set<string>): void {
  if (typeof node.type === 'string') found.add(node.type);
  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) {
    found.add('__text__');
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) collectNodeTypes(child as JsonNode, found);
    }
  }
}

export function classifyContent(content: Record<string, unknown>): ContentType {
  const found = new Set<string>();
  collectNodeTypes(content as JsonNode, found);
  const hasText = found.has('__text__');
  const hasImage = found.has('image');
  const hasTable = found.has('table');

  const typeCount = [hasText, hasImage, hasTable].filter(Boolean).length;
  if (typeCount >= 2) return 'mixed';
  if (hasImage) return 'image';
  if (hasTable) return 'table';
  return 'text';
}

function collectText(node: JsonNode, parts: string[]): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    parts.push(node.text);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) collectText(child as JsonNode, parts);
    }
  }
}

/** Plain-text extraction of a sanitized TipTap doc, for full-text search indexing. */
export function extractPlainText(content: Record<string, unknown>): string {
  const parts: string[] = [];
  collectText(content as JsonNode, parts);
  return parts.join(' ').slice(0, 20000);
}
