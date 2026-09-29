import { useEffect, useState } from 'react';
import { backend } from './backend';
import { accentColor, palette } from './theme';
import type { Entry, Snapshot } from './types';

export function useSnapshot(): Snapshot | null {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    const off = backend.onState(setSnap);
    backend.getState().then(s => setSnap(cur => cur ?? s));
    return off;
  }, []);
  return snap;
}

export function useLog(): Entry[] {
  const [log, setLog] = useState<Entry[]>([]);
  useEffect(() => {
    const load = () => { backend.getLog().then(setLog); };
    load();
    return backend.onLog(load);
  }, []);
  return log;
}

/** Re-renders every `ms` so date-relative labels ("Today") stay correct. */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(iv); }, [ms]);
  return now;
}

export function useColors(snap: Snapshot) {
  const { theme, accent } = snap.settings;
  return { p: palette(theme), accent: accentColor(theme, accent) };
}
