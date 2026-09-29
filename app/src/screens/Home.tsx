import { useEffect, useRef, useState } from 'react';
import { clock, streak } from '../stats';
import { SERIF } from '../theme';
import type { Entry, Mode } from '../types';
import { toggleLabel, type Ctx } from '../ui';

const MODES: [Mode, string][] = [['focus', 'Deep Work'], ['short', 'Short Break'], ['long', 'Long Break']];

export function Home({ snap, p, accent, go, log }: Ctx & { log: Entry[] }) {
  const { settings: s, mode, running, left, total, done } = snap;
  const pct = `${100 * (1 - left / total)}%`;
  const idle = !running && left === total;
  const presets: [string, number][] = [['Deep', 50], ['Normal', 25], ['Custom', s.dur.custom]];
  const days = streak(log, Date.now());

  // Keep typing local so the caret never jumps while the value round-trips through Rust.
  const [task, setTask] = useState(s.task);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTask(s.task); }, [s.task]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 0 }}>
      <div className="noscroll" style={{ flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 28px 6px', gap: 14 }}>
        <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
          {MODES.map(([k, label]) => (
            <button key={k} onClick={() => go({ type: 'pick', mode: k })} style={{
              border: 0, background: 'transparent', padding: '4px 0', cursor: 'pointer', fontSize: 13, letterSpacing: '0.02em',
              borderBottom: `2px solid ${mode === k ? accent : 'transparent'}`, fontWeight: mode === k ? 600 : 400, color: mode === k ? p.ink : p.muted,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 96, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{clock(left)}</div>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: p.track, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99, background: accent, width: pct }} />
            <div style={{ position: 'absolute', top: '50%', width: 12, height: 12, margin: '-6px 0 0 -6px', borderRadius: '50%', background: accent, left: pct }} />
          </div>
          <span style={{ display: 'flex', gap: 4 }} title={`${done} sessions today`}>
            {Array.from({ length: s.dur.cycle }, (_, i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i + 1 <= (done > 0 ? ((done - 1) % s.dur.cycle) + 1 : 0) ? accent : p.track }} />
            ))}
          </span>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: p.muted }}>Working on</span>
          <input
            value={task}
            placeholder="What are you working on?"
            onFocus={() => { focused.current = true; }}
            onBlur={() => { focused.current = false; }}
            onChange={e => { setTask(e.target.value); go({ type: 'setTask', task: e.target.value }); }}
            onKeyDown={e => { if (e.key === 'Enter' && idle && mode === 'focus') go({ type: 'toggle' }); }}
            style={{ height: 40, borderRadius: 10, border: `1px solid ${p.line}`, background: p.field, padding: '0 14px', fontSize: 15, outline: 'none', userSelect: 'text' }}
          />
        </div>
        {idle && (
          <div style={{ width: '100%', display: 'flex', gap: 8 }}>
            {presets.map(([label, min]) => {
              const on = s.preset === label;
              return (
                <button key={label} onClick={() => go({ type: 'setPreset', name: label })} style={{
                  flex: 1, height: 34, borderRadius: 99, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  fontSize: 13, whiteSpace: 'nowrap', border: `1.5px solid ${on ? accent : p.line}`, background: on ? p.field : 'transparent',
                }}>
                  <span style={{ fontWeight: 600 }}>{label}</span><span style={{ color: p.muted }}>{min}m</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', width: '100%', boxSizing: 'border-box', padding: '10px 28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: '100%', display: 'flex', gap: 8 }}>
          <button onClick={() => go({ type: 'toggle' })} style={{ flex: 1, height: 52, borderRadius: 999, border: 0, background: accent, color: p.onAccent, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{toggleLabel(snap)}</button>
          {running && <button onClick={() => go({ type: 'skip' })} style={{ width: 88, height: 52, borderRadius: 999, border: `1px solid ${p.line}`, background: 'transparent', fontSize: 15, cursor: 'pointer' }}>Skip</button>}
        </div>
        <div style={{ fontSize: 13, color: p.muted }}>
          {done} {done === 1 ? 'session' : 'sessions'} today{days > 0 && ` · ${days}-day streak`}
        </div>
      </div>
    </div>
  );
}
