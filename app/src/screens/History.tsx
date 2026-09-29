import { historyGroups, timeOfDay } from '../stats';
import type { Entry } from '../types';
import type { Ctx } from '../ui';

export function History({ p, accent, log, now }: Ctx & { log: Entry[]; now: number }) {
  const groups = historyGroups(log, now);
  return (
    <div style={{ flex: 1, padding: '18px 24px', overflow: 'auto' }}>
      {groups.length === 0 && (
        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 14, color: p.muted, lineHeight: 1.5 }}>
          No sessions yet.<br />Finished sessions will show up here.
        </div>
      )}
      {groups.map(g => (
        <div key={g.day} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.muted, marginBottom: 4 }}>{g.day}</div>
          {g.items.map(e => (
            <div key={e.ts + e.kind} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${p.line}`, fontSize: 14 }}>
              <span style={{ width: 42, fontVariantNumeric: 'tabular-nums', color: p.muted }}>{timeOfDay(e.ts)}</span>
              <span style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: e.kind === 'focus' ? accent : p.sage }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kind === 'focus' ? e.task || 'Focus' : 'Break'}</span>
              <span style={{ color: p.muted }}>{e.min} min</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
