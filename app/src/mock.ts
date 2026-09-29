// Browser-only stand-in for the Rust engine (src-tauri/src/engine.rs), used when the UI
// runs outside Tauri. Query params: ?speed=120 speeds up time, ?demo seeds sample history,
// ?mode=short|long starts on a break, ?tab=stats|history|settings opens a tab.

import type { Backend } from './backend';
import type { Action, Entry, Mode, Settings, Snapshot, Tab } from './types';

const DEFAULTS: Settings = {
  dur: { focus: 25, short: 5, long: 15, cycle: 4, custom: 35 },
  on: { autoBreak: true, autoFocus: false, hideOnFocus: true, overlay: true, onTop: true, showTask: true, sound: true, notify: true },
  ovSize: 'compact', opacity: 92, click: false, theme: 'light', accent: 'terracotta', preset: 'Normal', task: '', ovPos: null,
};

function demoLog(): Entry[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = (dayOffset: number, h: number, m: number) => today.getTime() - dayOffset * 86_400_000 + (h * 60 + m) * 60_000;
  const f = (ts: number, task: string, min = 25): Entry => ({ ts, kind: 'focus', task, min });
  const b = (ts: number): Entry => ({ ts, kind: 'break', task: '', min: 5 });
  return [
    f(t(4, 9, 0), 'Write the onboarding copy', 50), f(t(4, 14, 0), 'Fix flaky CI job'), f(t(3, 10, 0), 'Sketch the settings screen', 50),
    f(t(2, 9, 30), 'Plan next week'), f(t(1, 14, 20), 'Plan next week', 50), f(t(1, 15, 10), 'Outline the launch email'),
    f(t(0, 9, 10), 'Build authentication API'), b(t(0, 9, 35)), f(t(0, 9, 40), 'Build authentication API'), b(t(0, 10, 5)),
    f(t(0, 10, 10), 'Review pull requests'),
  ];
}

export function createMock(): Backend {
  const q = new URLSearchParams(location.search);
  const speed = Number(q.get('speed')) || 1;
  const settings: Settings = structuredClone(DEFAULTS);
  const log: Entry[] = q.has('demo') ? demoLog() : [];
  if (q.has('demo')) settings.task = 'Build authentication API';
  if (q.get('theme') === 'evening') settings.theme = 'evening';
  let mode: Mode = (q.get('mode') as Mode) || 'focus';
  let running = false;
  const mins = (m: Mode) => settings.dur[m];
  let left = mins(mode) * 60;

  const stateSubs = new Set<(s: Snapshot) => void>();
  const logSubs = new Set<() => void>();
  const navSubs = new Set<(t: Tab) => void>();
  const chimeSubs = new Set<(k: 'focus' | 'break') => void>();

  const doneToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return log.filter(e => e.kind === 'focus' && e.ts >= d.getTime()).length;
  };
  const snap = (): Snapshot => ({ mode, running, left, total: mins(mode) * 60, done: doneToday(), settings: structuredClone(settings) });
  const emit = () => { const s = snap(); stateSubs.forEach(cb => cb(s)); };
  const nextBreak = (done: number): Mode => (done > 0 && done % settings.dur.cycle === 0 ? 'long' : 'short');
  const reset = (m: Mode) => { mode = m; running = false; left = mins(m) * 60; };
  const nav = (t: Tab) => navSubs.forEach(cb => cb(t));

  const complete = () => {
    const wasFocus = mode === 'focus';
    log.push({ ts: Date.now() - (mins(mode) * 60_000) / speed, kind: wasFocus ? 'focus' : 'break', task: wasFocus ? settings.task.trim() : '', min: mins(mode) });
    logSubs.forEach(cb => cb());
    if (settings.on.sound) chimeSubs.forEach(cb => cb(wasFocus ? 'focus' : 'break'));
    if (wasFocus) { reset(nextBreak(doneToday())); running = settings.on.autoBreak; }
    else { reset('focus'); running = settings.on.autoFocus; }
    nav('home');
  };

  setInterval(() => { if (!running) return; if (left > 1) left--; else complete(); emit(); }, 1000 / speed);

  const apply = (a: Action) => {
    const s = settings;
    switch (a.type) {
      case 'toggle': if (running) running = false; else { if (!left) left = mins(mode) * 60; running = true; } break;
      case 'skip': reset(mode === 'focus' ? nextBreak(doneToday() + 1) : 'focus'); nav('home'); break;
      case 'pick': reset(a.mode); break;
      case 'setTask': s.task = a.task; break;
      case 'setPreset': {
        const min = ({ Deep: 50, Normal: 25, Custom: s.dur.custom } as Record<string, number>)[a.name];
        if (!min) return;
        s.preset = a.name; s.dur.focus = min;
        if (mode === 'focus' && !running) reset('focus');
        break;
      }
      case 'setDur': {
        const [lo, hi] = ({ focus: [1, 120], short: [1, 30], long: [1, 60], custom: [5, 120], cycle: [2, 8] } as const)[a.key];
        const v = Math.min(hi, Math.max(lo, a.value));
        s.dur[a.key] = v;
        if (a.key === 'custom' && s.preset === 'Custom') s.dur.focus = v;
        const affects = mode === 'focus' ? a.key === 'focus' || a.key === 'custom' : a.key === mode;
        if (affects && !running) reset(mode);
        break;
      }
      case 'setFlag': s.on[a.key] = a.value; break;
      case 'setOvSize': s.ovSize = a.size; break;
      case 'cycleOvSize': s.ovSize = ({ minimal: 'compact', compact: 'expanded', expanded: 'minimal' } as const)[s.ovSize]; break;
      case 'toggleMinimal': s.ovSize = s.ovSize === 'minimal' ? 'compact' : 'minimal'; break;
      case 'setOpacity': s.opacity = Math.min(100, Math.max(40, a.value)); break;
      case 'toggleClick': s.click = !s.click; break;
      case 'toggleOverlay': s.on.overlay = !s.on.overlay; break;
      case 'setTheme': s.theme = a.value; break;
      case 'setAccent': s.accent = a.value; break;
      case 'setOverlayPos': s.ovPos = [a.x, a.y]; break;
      case 'openSettings': nav('settings'); break;
      default: break;
    }
    emit();
  };

  const add = <T,>(set: Set<T>, cb: T) => { set.add(cb); return () => { set.delete(cb); }; };
  let initialTab = q.get('tab') as Tab | null;

  return {
    getState: async () => snap(),
    getLog: async () => [...log],
    dispatch: apply,
    overlayReady: () => {},
    onState: cb => add(stateSubs, cb),
    onLog: cb => add(logSubs, cb),
    onNavigate: cb => {
      if (initialTab) { const t = initialTab; initialTab = null; setTimeout(() => cb(t), 0); }
      return add(navSubs, cb);
    },
    onChime: cb => add(chimeSubs, cb),
  };
}
