import { currentMonitor, getCurrentWindow, primaryMonitor, type Monitor } from '@tauri-apps/api/window';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { backend, isTauri } from './backend';
import { useColors, useSnapshot } from './hooks';
import { clock } from './stats';
import { SERIF } from './theme';
import type { Snapshot } from './types';
import { go, toggleLabel } from './ui';

/** Transparent margin around the widget inside its window, so the drop shadow isn't clipped. */
const PAD = 16;
/** Visible gap from the screen edge once snapped, and how close counts as "near" an edge. */
const MARGIN = 16;
const SNAP = 80;
/** Default spot: top-right, low enough to stay clear of maximised windows' caption buttons. */
const DEFAULT_TOP = 70;

const win = isTauri ? getCurrentWindow() : null;

async function monitor(): Promise<Monitor | null> {
  return (await currentMonitor()) ?? (await primaryMonitor());
}

/**
 * Places the window so the widget (w×h logical px) sits inside the work area, pinned to
 * any edge it is within SNAP of. `anchor` keeps the right/bottom edge fixed across resizes.
 */
async function place(el: HTMLElement, opts: { first?: boolean; saved?: [number, number] | null; anchor?: boolean }) {
  if (!win) return;
  const mon = await monitor();
  if (!mon) return;
  const k = mon.scaleFactor;
  const wa = mon.workArea;
  const L = wa.position.x, T = wa.position.y, R = L + wa.size.width, B = T + wa.size.height;
  const w = Math.ceil(el.offsetWidth * k), h = Math.ceil(el.offsetHeight * k), pad = PAD * k, m = MARGIN * k, near = SNAP * k;

  const pos = await win.outerPosition();
  const size = await win.outerSize();
  // Current widget rect in physical px.
  let x = pos.x + pad, y = pos.y + pad;
  const oldW = size.width - 2 * pad, oldH = size.height - 2 * pad;

  if (opts.first) {
    if (opts.saved) [x, y] = [opts.saved[0] + pad, opts.saved[1] + pad];
    else [x, y] = [R - w - m, T + DEFAULT_TOP * k];
  } else if (opts.anchor) {
    if (R - (x + oldW) < near) x += oldW - w;
    if (B - (y + oldH) < near) y += oldH - h;
  }

  x = Math.min(Math.max(x, L + m), R - w - m);
  y = Math.min(Math.max(y, T + m), B - h - m);
  // Only a finished drag pins to nearby edges; first placement and resizes just stay on-screen.
  if (!opts.first && !opts.anchor) {
    if (x - L < near) x = L + m;
    if (R - (x + w) < near) x = R - w - m;
    if (y - T < near) y = T + m;
    if (B - (y + h) < near) y = B - h - m;
  }

  const nx = Math.round(x - pad), ny = Math.round(y - pad);
  ignoreMovesUntil = Date.now() + 400;
  await win.setSize(new LogicalSize(el.offsetWidth + 2 * PAD, el.offsetHeight + 2 * PAD));
  await win.setPosition(new PhysicalPosition(nx, ny));
  if (nx !== opts.saved?.[0] || ny !== opts.saved?.[1]) go({ type: 'setOverlayPos', x: nx, y: ny });
}

let ignoreMovesUntil = 0;
let queue = Promise.resolve();
const enqueue = (job: () => Promise<void>) => { queue = queue.then(job).catch(err => console.error('overlay placement', err)); };

export function Overlay() {
  const snap = useSnapshot();
  return snap ? <Widget snap={snap} /> : null;
}

function Widget({ snap }: { snap: Snapshot }) {
  const { p, accent } = useColors(snap);
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  const s = snap.settings;

  // First placement, then keep the window hugging the widget whenever its size changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!placed.current) {
      placed.current = true;
      enqueue(async () => { await place(el, { first: true, saved: s.ovPos }); backend.overlayReady(); });
    }
    const ro = new ResizeObserver(() => enqueue(() => place(el, { anchor: true })));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap once the user stops dragging (the OS drag loop only reports moves).
  useEffect(() => {
    if (!win) return;
    let timer: ReturnType<typeof setTimeout>;
    const off = win.onMoved(() => {
      if (Date.now() < ignoreMovesUntil) return;
      clearTimeout(timer);
      timer = setTimeout(() => ref.current && enqueue(() => place(ref.current!, {})), 250);
    });
    return () => { clearTimeout(timer); off.then(f => f()); };
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    const move = (ev: globalThis.PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      done();
      win?.startDragging();
    };
    const up = () => { done(); go({ type: 'cycleOvSize' }); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const isBreak = snap.mode !== 'focus';
  const dot = isBreak ? p.sage : accent;
  const time = clock(snap.left);
  const pct = `${100 * (1 - snap.left / snap.total)}%`;
  const sub = (isBreak ? (snap.mode === 'long' ? 'Long Break' : 'Short Break') : (s.on.showTask && s.task.trim() ? s.task.trim() : 'Deep Work'))
    + (snap.running ? '' : ' · paused');

  const card = 'oklch(0.2 0.02 55/0.9)';
  const shadow = '0 6px 18px oklch(0 0 0/0.3)';
  const Dot = <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />;
  const stop = (e: PointerEvent) => e.stopPropagation();
  const btn: CSSProperties = { flex: 1, height: 32, borderRadius: 99, border: 0, background: 'oklch(1 0 0/0.16)', cursor: 'pointer', fontSize: 13 };

  return (
    <div ref={ref} onPointerDown={onPointerDown} title={`${time} · click to resize, drag to move`} style={{
      position: 'absolute', left: PAD, top: PAD, width: 'max-content', cursor: 'grab', opacity: s.opacity / 100,
      color: 'oklch(0.97 0.01 80)', fontVariantNumeric: 'tabular-nums', touchAction: 'none', fontFamily: "'DM Sans', sans-serif",
    }}>
      {s.ovSize === 'minimal' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, background: card, boxShadow: shadow, fontSize: 17, fontWeight: 500 }}>
          {Dot}{time}
        </div>
      )}
      {s.ovSize === 'compact' && (
        <div style={{ minWidth: 130, maxWidth: 190, boxSizing: 'border-box', padding: '10px 16px', borderRadius: 14, background: card, boxShadow: shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 500 }}>{Dot}{time}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        </div>
      )}
      {s.ovSize === 'expanded' && (
        <div style={{ width: 220, boxSizing: 'border-box', padding: '14px 16px 16px', borderRadius: 16, background: card, boxShadow: '0 10px 26px oklch(0 0 0/0.35)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.78, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          <div style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.1 }}>{time}</div>
          <div style={{ height: 4, borderRadius: 9, background: 'oklch(1 0 0/0.15)', margin: '8px 0 12px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: dot, width: pct }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onPointerDown={stop} onClick={() => go({ type: 'toggle' })} style={btn}>{toggleLabel(snap).startsWith('Start') ? 'Start' : toggleLabel(snap)}</button>
            <button onPointerDown={stop} onClick={() => go({ type: 'skip' })} style={btn}>Skip</button>
            <button onPointerDown={stop} onClick={() => go({ type: 'showMain' })} style={btn}>Open</button>
          </div>
        </div>
      )}
    </div>
  );
}
