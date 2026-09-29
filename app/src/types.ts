// Mirrors the serde types in src-tauri/src/engine.rs.

export type Mode = 'focus' | 'short' | 'long';
export type OvSize = 'minimal' | 'compact' | 'expanded';
export type DurKey = 'focus' | 'short' | 'long' | 'cycle' | 'custom';
export type Theme = 'light' | 'evening';
export type AccentKey = 'terracotta' | 'sage' | 'amber';
export type Tab = 'home' | 'stats' | 'history' | 'settings';

export interface Durations { focus: number; short: number; long: number; cycle: number; custom: number }

export interface Toggles {
  autoBreak: boolean; autoFocus: boolean; hideOnFocus: boolean; overlay: boolean;
  onTop: boolean; showTask: boolean; sound: boolean; notify: boolean;
}
export type FlagKey = keyof Toggles;

export interface Settings {
  dur: Durations; on: Toggles; ovSize: OvSize; opacity: number; click: boolean;
  theme: Theme; accent: AccentKey; preset: string; task: string; ovPos: [number, number] | null;
}

export interface Snapshot { mode: Mode; running: boolean; left: number; total: number; done: number; settings: Settings }

export interface Entry { ts: number; kind: 'focus' | 'break'; task: string; min: number }

export type Action =
  | { type: 'toggle' } | { type: 'skip' } | { type: 'pick'; mode: Mode }
  | { type: 'setTask'; task: string } | { type: 'setPreset'; name: string }
  | { type: 'setDur'; key: DurKey; value: number } | { type: 'setFlag'; key: FlagKey; value: boolean }
  | { type: 'setOvSize'; size: OvSize } | { type: 'cycleOvSize' } | { type: 'toggleMinimal' }
  | { type: 'setOpacity'; value: number } | { type: 'toggleClick' } | { type: 'toggleOverlay' }
  | { type: 'setTheme'; value: Theme } | { type: 'setAccent'; value: AccentKey }
  | { type: 'setOverlayPos'; x: number; y: number }
  | { type: 'showMain' } | { type: 'hideMain' } | { type: 'toggleMain' } | { type: 'openSettings' } | { type: 'quit' };
