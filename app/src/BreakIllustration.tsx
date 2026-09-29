import type { Palette } from './theme';

/** Cat dozing on a sunny windowsill, with a plant and a steaming mug. Colours follow the theme. */
export function BreakIllustration({ p, accent, evening }: { p: Palette; accent: string; evening: boolean }) {
  const glass = evening ? 'oklch(0.32 0.04 70)' : 'oklch(0.94 0.045 85)';
  const frame = evening ? 'oklch(0.42 0.03 60)' : 'oklch(0.86 0.03 70)';
  const wood = evening ? 'oklch(0.45 0.05 55)' : 'oklch(0.74 0.06 60)';
  const sun = evening ? 'oklch(0.8 0.11 75)' : 'oklch(0.86 0.12 85)';
  const cat = evening ? 'oklch(0.2 0.02 55)' : 'oklch(0.36 0.03 50)';
  return (
    <svg viewBox="0 0 324 64" preserveAspectRatio="xMidYMax slice" role="img" aria-label="A cat dozing on a sunny windowsill"
      style={{ width: '100%', height: 64, display: 'block', borderRadius: 12, flex: 'none' }}>
      <rect width="324" height="64" fill={frame} />
      <rect x="18" y="6" width="138" height="44" rx="3" fill={glass} />
      <rect x="168" y="6" width="138" height="44" rx="3" fill={glass} />
      <circle className="cf-sun-halo" cx="262" cy="24" r="15" fill={sun} opacity="0.35" />
      <circle cx="262" cy="24" r="8" fill={sun} />
      <path d="M190 50 q10 -12 22 -6 q10 -10 22 0" fill="none" stroke={p.sage} strokeWidth="1.5" opacity="0.5" />
      <rect x="0" y="48" width="324" height="16" fill={wood} />
      <rect x="0" y="48" width="324" height="3" fill={cat} opacity="0.12" />

      {/* mug */}
      <g transform="translate(44 34)">
        <path className="cf-steam" d="M5 -2 q-3 -4 0 -8 M10 -2 q-3 -4 0 -8" fill="none" stroke={p.muted} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="0" y="0" width="15" height="14" rx="3" fill={p.field} />
        <path d="M15 3 h2.5 a3.5 3.5 0 0 1 0 7 H15" fill="none" stroke={p.field} strokeWidth="2" />
      </g>

      {/* cat, curled up asleep */}
      <g transform="translate(112 30)">
        <path className="cf-tail" d="M44 16 q14 2 10 -8 q-2 -5 -6 -3" fill="none" stroke={cat} strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="26" cy="11" rx="22" ry="8" fill={cat} />
        <circle cx="8" cy="7" r="8" fill={cat} />
        <path d="M2 2 L3 -6 L8 0 Z M9 0 L14 -6 L15 2 Z" fill={cat} />
        <path d="M4 8 q2 1.5 4 0 M9.5 8 q2 1.5 4 0" fill="none" stroke={p.field} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      </g>

      {/* plant */}
      <g transform="translate(196 22)">
        <ellipse cx="8" cy="10" rx="5" ry="10" fill={p.sage} transform="rotate(-28 8 18)" />
        <ellipse cx="15" cy="8" rx="5" ry="11" fill={p.sage} opacity="0.85" />
        <ellipse cx="22" cy="11" rx="5" ry="9" fill={p.sage} transform="rotate(30 22 18)" />
        <path d="M4 16 h22 l-3 12 h-16 z" fill={accent} />
      </g>
    </svg>
  );
}
