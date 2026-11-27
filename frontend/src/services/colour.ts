/** Picks black or white text for readability against an arbitrary hex background colour. */
export function contrastingTextColour(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return '#000000';
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((part) => parseInt(part, 16));
  // Perceived brightness (YIQ), a simple and widely-used heuristic for this exact choice.
  const brightness = (r! * 299 + g! * 587 + b! * 114) / 1000;
  return brightness >= 128 ? '#000000' : '#ffffff';
}
