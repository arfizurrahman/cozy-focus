import type { CSSProperties } from 'react';
import { backend } from './backend';
import type { Palette } from './theme';
import type { Action, Snapshot } from './types';

export interface Ctx {
  snap: Snapshot;
  p: Palette;
  accent: string;
  go: (a: Action) => void;
}

export const go = (a: Action) => backend.dispatch(a);

/** Pill in a segmented control (tabs, settings segments). */
export const seg = (p: Palette, active: boolean): CSSProperties => ({
  border: 0, borderRadius: 99, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  background: active ? p.bg : 'transparent', fontWeight: active ? 600 : 400,
  boxShadow: active ? '0 1px 3px oklch(0.2 0.03 50/0.2)' : 'none',
});

export function toggleLabel(snap: Snapshot): string {
  if (snap.running) return 'Pause';
  if (snap.left !== snap.total) return 'Resume';
  return snap.mode === 'focus' ? 'Start focus' : 'Start break';
}
