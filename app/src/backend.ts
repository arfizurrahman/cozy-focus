// Talks to the Rust core. Outside Tauri (plain `npm run dev` in a browser) it falls
// back to an in-page mock so the UI can be previewed and screenshotted.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createMock } from './mock';
import type { Action, Entry, Snapshot, Tab } from './types';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Unlisten = () => void;

export interface Backend {
  getState(): Promise<Snapshot>;
  getLog(): Promise<Entry[]>;
  dispatch(action: Action): void;
  overlayReady(): void;
  onState(cb: (s: Snapshot) => void): Unlisten;
  onLog(cb: () => void): Unlisten;
  onNavigate(cb: (tab: Tab) => void): Unlisten;
  onChime(cb: (kind: 'focus' | 'break') => void): Unlisten;
}

function sub<T>(event: string, cb: (payload: T) => void): Unlisten {
  const p = listen<T>(event, e => cb(e.payload));
  return () => { p.then(off => off()); };
}

const tauriBackend: Backend = {
  getState: () => invoke<Snapshot>('get_state'),
  getLog: () => invoke<Entry[]>('get_log'),
  dispatch: action => { invoke('dispatch', { action }).catch(err => console.error('dispatch failed', action, err)); },
  overlayReady: () => { invoke('overlay_ready'); },
  onState: cb => sub('state', cb),
  onLog: cb => sub('log', cb),
  onNavigate: cb => sub('navigate', cb),
  onChime: cb => sub('chime', cb),
};

export const backend: Backend = isTauri ? tauriBackend : createMock();
