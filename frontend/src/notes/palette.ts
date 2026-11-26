export const NOTE_COLOURS: Record<string, string> = {
  yellow: '#FFF3B0',
  blue: '#BFE3FF',
  pink: '#FFD6E8',
  green: '#D7F5D0',
  orange: '#FFDAB3',
  purple: '#E3D6FF',
  white: '#FFFFFF',
  grey: '#E5E7EB',
};

export function resolveNoteColour(name: string): string {
  return NOTE_COLOURS[name] ?? NOTE_COLOURS.yellow!;
}
