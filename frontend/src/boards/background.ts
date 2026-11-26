import type { CSSProperties } from 'react';
import type { Board } from '../services/types';

export function boardBackgroundStyle(board: Board | null): CSSProperties {
  const base = board?.backgroundColour ?? '#ffffff';
  switch (board?.backgroundStyle) {
    case 'grey':
      return { background: '#f3f4f6' };
    case 'grid':
      return {
        background: base,
        backgroundImage:
          'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      };
    case 'dotted':
      return {
        background: base,
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.12) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
      };
    default:
      return { background: base };
  }
}
