import { useEffect, useState } from 'react';
import { BreakIllustration } from '../BreakIllustration';
import { clock } from '../stats';
import { SERIF } from '../theme';
import { toggleLabel, type Ctx } from '../ui';

const MESSAGES = ['Grab some water.', 'Look outside for a minute.', 'Relax your shoulders.', 'Your work will still be here.', 'Stretch your legs.', 'Look away from the screen.'];

export function Break({ snap, p, accent, go }: Ctx) {
  // One breath every 8s (4s in, 4s out); the message changes after each full breath.
  const [breath, setBreath] = useState({ inhale: false, msg: 0 });
  useEffect(() => {
    const iv = setInterval(() => setBreath(b => ({ inhale: !b.inhale, msg: b.inhale ? b.msg + 1 : b.msg })), 4000);
    const first = setTimeout(() => setBreath(b => ({ ...b, inhale: true })), 50);
    return () => { clearInterval(iv); clearTimeout(first); };
  }, []);

  return (
    <div className="noscroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 28px 16px', gap: 12, background: p.breakBg, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ fontFamily: SERIF, fontSize: 28, marginTop: 6 }}>{snap.mode === 'long' ? 'Take a proper rest' : 'Take a little break'}</div>
      <div style={{ position: 'relative', flex: 'none', width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: p.breath, transition: 'transform 4s ease-in-out', transform: `scale(${breath.inhale ? 1 : 0.82})` }} />
        <div style={{ position: 'relative', fontFamily: SERIF, fontSize: 64, fontVariantNumeric: 'tabular-nums' }}>{clock(snap.left)}</div>
      </div>
      <div style={{ fontSize: 12, color: p.muted, marginTop: -4 }}>{breath.inhale ? 'breathe in' : 'breathe out'}</div>
      <div key={breath.msg} className="cf-fade" style={{ fontSize: 17, textAlign: 'center', minHeight: 26 }}>{MESSAGES[breath.msg % MESSAGES.length]}</div>
      <BreakIllustration p={p} accent={accent} evening={snap.settings.theme === 'evening'} />
      <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button onClick={() => go({ type: 'toggle' })} style={{ width: 100, height: 48, borderRadius: 999, border: `1px solid ${p.line}`, background: 'transparent', fontSize: 15, cursor: 'pointer' }}>{toggleLabel(snap)}</button>
        <button onClick={() => go({ type: 'skip' })} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, background: p.sage, color: p.onAccent, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Skip break</button>
      </div>
    </div>
  );
}
