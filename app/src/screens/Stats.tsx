import { hm, weekStats } from '../stats';
import { SERIF } from '../theme';
import type { Entry } from '../types';
import type { Ctx } from '../ui';

export function Stats({ p, accent, log, now }: Ctx & { log: Entry[]; now: number }) {
  const w = weekStats(log, now);
  const kpis = [
    { v: String(w.sessions), l: 'Sessions' },
    { v: `${w.streak} ${w.streak === 1 ? 'day' : 'days'}`, l: 'Current streak' },
    { v: w.productive, l: 'Most productive' },
    { v: hm(w.todayMin), l: 'Focused today' },
  ];
  const max = Math.max(1, ...w.bars.map(b => b.min));
  return (
    <div style={{ flex: 1, padding: '22px 24px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: p.muted }}>This week</div>
        <div style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1.1 }}>{hm(w.totalMin)}</div>
        <div style={{ fontSize: 13, color: p.muted }}>focus time</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {w.bars.map(b => (
          <div key={b.d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 30, color: p.muted }}>{b.d}</span>
            <div style={{ flex: 1, height: 14, borderRadius: 99, background: p.track }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${(100 * b.min) / max}%`, background: b.best ? accent : p.sage }} />
            </div>
            <span style={{ width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{hm(b.min)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.l} style={{ padding: '12px 14px', borderRadius: 12, background: p.panel }}>
            <div style={{ fontFamily: SERIF, fontSize: 24 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: p.muted }}>{k.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
