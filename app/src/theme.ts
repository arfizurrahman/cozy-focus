import type { AccentKey, Theme } from './types';

export interface Palette {
  bg: string; panel: string; field: string; ink: string; muted: string; line: string; frame: string;
  track: string; onAccent: string; breakBg: string; breath: string; sage: string; stripe: string;
}

const LIGHT: Palette = {
  bg: 'oklch(0.975 0.012 80)', panel: 'oklch(0.935 0.02 75)', field: 'oklch(0.995 0.005 80)', ink: 'oklch(0.28 0.03 50)',
  muted: 'oklch(0.47 0.03 55)', line: 'oklch(0.88 0.02 70)', frame: 'oklch(0.82 0.02 70)', track: 'oklch(0.9 0.02 70)',
  onAccent: 'oklch(0.99 0.01 80)', breakBg: 'oklch(0.955 0.025 145)', breath: 'oklch(0.9 0.05 145)', sage: 'oklch(0.52 0.08 145)',
  stripe: 'oklch(0.85 0.02 70)',
};

const EVENING: Palette = {
  bg: 'oklch(0.25 0.018 55)', panel: 'oklch(0.3 0.02 55)', field: 'oklch(0.21 0.015 55)', ink: 'oklch(0.93 0.02 75)',
  muted: 'oklch(0.76 0.02 70)', line: 'oklch(0.37 0.02 55)', frame: 'oklch(0.36 0.02 55)', track: 'oklch(0.36 0.02 55)',
  onAccent: 'oklch(0.2 0.02 55)', breakBg: 'oklch(0.26 0.025 145)', breath: 'oklch(0.34 0.04 145)', sage: 'oklch(0.74 0.08 145)',
  stripe: 'oklch(0.4 0.02 60)',
};

const ACCENTS: Record<Theme, Record<AccentKey, string>> = {
  light: { terracotta: 'oklch(0.58 0.13 40)', sage: 'oklch(0.52 0.08 145)', amber: 'oklch(0.6 0.11 65)' },
  evening: { terracotta: 'oklch(0.72 0.12 45)', sage: 'oklch(0.74 0.08 145)', amber: 'oklch(0.8 0.11 75)' },
};

export function palette(theme: Theme): Palette {
  return theme === 'evening' ? EVENING : LIGHT;
}

export function accentColor(theme: Theme, key: AccentKey): string {
  return ACCENTS[theme === 'evening' ? 'evening' : 'light'][key] ?? ACCENTS.light.terracotta;
}

export const SERIF = "'Newsreader Variable', 'Newsreader', serif";
export const MONO = "'JetBrains Mono', monospace";
