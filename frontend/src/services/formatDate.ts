type DateTimeFormat = 'auto' | '12h' | '24h';

function hour12Option(format: DateTimeFormat | undefined): boolean | undefined {
  if (format === '12h') return true;
  if (format === '24h') return false;
  return undefined; // 'auto' (or unset) — let the browser's locale decide
}

export function formatDateTime(iso: string, format?: DateTimeFormat): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: hour12Option(format),
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
