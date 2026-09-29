import type { ReactNode } from 'react';
import { MONO, SERIF } from '../theme';
import type { AccentKey, DurKey, FlagKey, OvSize, Theme } from '../types';
import { seg, type Ctx } from '../ui';

export function Settings({ snap, p, accent, go, onBack }: Ctx & { onBack: () => void }) {
  const s = snap.settings;

  const track = (on: boolean) => ({
    marginLeft: 'auto', width: 42, height: 24, borderRadius: 99, border: 0, padding: 3, cursor: 'pointer', display: 'flex',
    justifyContent: on ? 'flex-end' : 'flex-start', background: on ? accent : p.track,
  } as const);
  const knob = <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'oklch(0.99 0.005 80)' }} />;
  const circle = { width: 28, height: 28, borderRadius: '50%', border: `1px solid ${p.line}`, background: 'transparent', cursor: 'pointer' } as const;

  const row = (label: string, control: ReactNode) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, borderBottom: `1px solid ${p.line}`, fontSize: 14 }}>
      <span>{label}</span>{control}
    </div>
  );
  const step = (label: string, key: DurKey, unit: string) => row(label, (
    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button aria-label={`Decrease ${label}`} onClick={() => go({ type: 'setDur', key, value: s.dur[key] - 1 })} style={circle}>−</button>
      <span style={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{s.dur[key]}{unit}</span>
      <button aria-label={`Increase ${label}`} onClick={() => go({ type: 'setDur', key, value: s.dur[key] + 1 })} style={circle}>+</button>
    </span>
  ));
  const toggle = (label: string, on: boolean, flip: () => void) => row(label, (
    <button role="switch" aria-checked={on} aria-label={label} onClick={flip} style={track(on)}>{knob}</button>
  ));
  const flag = (label: string, key: FlagKey) => toggle(label, s.on[key], () => go({ type: 'setFlag', key, value: !s.on[key] }));
  const segRow = <T extends string>(label: string, opts: [T, string][], cur: T, pick: (v: T) => void) => row(label, (
    <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, padding: 3, borderRadius: 99, background: p.panel }}>
      {opts.map(([v, l]) => <button key={v} onClick={() => pick(v)} style={seg(p, cur === v)}>{l}</button>)}
    </span>
  ));
  const key = (label: string, keys: string) => row(label, (
    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, padding: '4px 8px', borderRadius: 6, background: p.panel }}>{keys}</span>
  ));

  const sections: [string, ReactNode[]][] = [
    ['Timer', [
      step('Focus', 'focus', ' min'), step('Short break', 'short', ' min'), step('Long break', 'long', ' min'),
      step('Custom preset', 'custom', ' min'), step('Sessions before long break', 'cycle', ''),
      flag('Auto-start breaks', 'autoBreak'), flag('Auto-start focus', 'autoFocus'), flag('Hide window during focus', 'hideOnFocus'),
    ]],
    ['Overlay', [
      flag('Show overlay', 'overlay'), flag('Always on top', 'onTop'),
      segRow<OvSize>('Size', [['minimal', 'Min'], ['compact', 'Compact'], ['expanded', 'Full']], s.ovSize, size => go({ type: 'setOvSize', size })),
      row('Opacity', (
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="range" min={40} max={100} value={s.opacity} aria-label="Overlay opacity"
            onChange={e => go({ type: 'setOpacity', value: +e.target.value })} style={{ width: 110, accentColor: accent }} />
          <span style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.opacity}%</span>
        </span>
      )),
      flag('Show task name', 'showTask'),
      toggle('Click-through', s.click, () => go({ type: 'toggleClick' })),
    ]],
    ['Appearance', [
      segRow<Theme>('Theme', [['light', 'Light'], ['evening', 'Evening']], s.theme, value => go({ type: 'setTheme', value })),
      segRow<AccentKey>('Accent', [['terracotta', 'Clay'], ['sage', 'Sage'], ['amber', 'Honey']], s.accent, value => go({ type: 'setAccent', value })),
    ]],
    ['Notifications', [flag('Sound', 'sound'), flag('Windows notification', 'notify')]],
    ['Shortcuts', [
      key('Start / Pause', 'Ctrl+Alt+P'), key('Skip', 'Ctrl+Alt+S'), key('Show / hide overlay', 'Ctrl+Alt+O'),
      key('Minimal overlay', 'Ctrl+Alt+M'), key('Click-through', 'Ctrl+Alt+L'),
    ]],
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px' }}>
        <button onClick={onBack} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, padding: '6px 4px' }}>← Back</button>
        <span style={{ fontFamily: SERIF, fontSize: 22 }}>Settings</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
        {sections.map(([title, rows]) => (
          <div key={title} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.muted, marginBottom: 2 }}>{title}</div>
            {rows}
          </div>
        ))}
      </div>
    </div>
  );
}
