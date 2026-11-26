import type { ContentType } from '../services/types';

const ICONS: Record<ContentType, string> = {
  text: '📝',
  image: '🖼',
  table: '▦',
  mixed: '🧩',
};

export function contentTypeIcon(type: ContentType): string {
  return ICONS[type] ?? ICONS.text;
}
