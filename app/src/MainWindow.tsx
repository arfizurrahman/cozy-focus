import { useEffect, useState, type CSSProperties } from 'react';
import { backend } from './backend';
import { chime } from './chime';
import { useColors, useLog, useNow, useSnapshot } from './hooks';
import { Break } from './screens/Break';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';
import type { Snapshot, Tab } from './types';
import { go, seg } from './ui';

const TABS: [Tab, string][] = [['home', 'Focus'], ['stats', 'Stats'], ['history', 'History']];

export function MainWindow() {
  const snap = useSnapshot();
  return snap ? <Main snap={snap} /> : null;
}

function Main({ snap }: { snap: Snapshot }) {
  const { p, accent } = useColors(snap);
  const log = useLog();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('home');
  useEffect(() => backend.onNavigate(setTab), []);
  useEffect(() => backend.onChime(chime), []);
  useEffect(() => { document.body.style.background = p.bg; }, [p.bg]);

  const isBreak = snap.mode !== 'focus';
  const ctx = { snap, p, accent, go };
  const titleBtn: CSSProperties = { width: 40, border: 0, background: 'transparent', cursor: 'pointer' };
  const vars = { '--cf-accent': accent, '--cf-line': p.line, '--cf-hover': p.panel } as CSSProperties;

  return (
    <div style={{ ...vars, position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: p.bg, color: p.ink, fontFamily: "'DM Sans', sans-serif" }}>
      <div data-tauri-drag-region style={{ height: 38, flex: 'none', display: 'flex', alignItems: 'center', paddingLeft: 14, gap: 8, fontSize: 13 }}>
        <span data-tauri-drag-region style={{ width: 10, height: 10, borderRadius: 3, background: accent }} />
        <span data-tauri-drag-region style={{ fontWeight: 500 }}>CozyFocus</span>
        <span style={{ marginLeft: 'auto', display: 'flex', height: '100%' }}>
          <button className="cf-titlebtn" onClick={() => setTab('settings')} title="Settings" aria-label="Settings" style={{ ...titleBtn, fontSize: 15 }}>⚙</button>
          <button className="cf-titlebtn" onClick={() => go({ type: 'hideMain' })} title="Minimize to overlay" aria-label="Minimize to overlay" style={titleBtn}>–</button>
          <button className="cf-titlebtn" onClick={() => go({ type: 'hideMain' })} title="Close to tray" aria-label="Close to tray" style={titleBtn}>✕</button>
        </span>
      </div>

      {tab !== 'settings' && !(tab === 'home' && isBreak) && (
        <div style={{ flex: 'none', display: 'flex', gap: 4, margin: '2px 16px 0', padding: 4, borderRadius: 99, background: p.panel }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...seg(p, tab === id), flex: 1 }}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'home' && !isBreak && <Home {...ctx} log={log} />}
      {tab === 'home' && isBreak && <Break {...ctx} />}
      {tab === 'stats' && <Stats {...ctx} log={log} now={now} />}
      {tab === 'history' && <History {...ctx} log={log} now={now} />}
      {tab === 'settings' && <Settings {...ctx} onBack={() => setTab('home')} />}
    </div>
  );
}
