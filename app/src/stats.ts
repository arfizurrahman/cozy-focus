import type { Entry } from './types';

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const clock = (secs: number) => pad2(Math.floor(secs / 60)) + ':' + pad2(secs % 60);
export const hm = (min: number) => Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
export const timeOfDay = (ts: number) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `n` days after `ts`'s midnight; safe across DST changes. */
function addDays(ts: number, n: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ts: number): number {
  const dow = (new Date(ts).getDay() + 6) % 7; // Monday = 0
  return addDays(ts, -dow);
}

const focus = (log: Entry[]) => log.filter(e => e.kind === 'focus');
const sum = (log: Entry[]) => log.reduce((a, e) => a + e.min, 0);

export interface DayBar { d: string; min: number; best: boolean }

export interface WeekStats {
  totalMin: number; sessions: number; bars: DayBar[];
  streak: number; productive: string; todayMin: number;
}

/** "9–11 am", "11 am–1 pm", "2–4 pm" */
export function hourRange(h: number): string {
  const fmt = (x: number) => { const h12 = x % 12 || 12; return { n: h12, ap: x % 24 < 12 ? 'am' : 'pm' }; };
  const a = fmt(h), b = fmt(h + 2);
  return a.ap === b.ap ? `${a.n}–${b.n} ${b.ap}` : `${a.n} ${a.ap}–${b.n} ${b.ap}`;
}

/** Consecutive days with a focus session, ending today (or yesterday if today has none yet). */
export function streak(log: Entry[], now: number): number {
  const days = new Set(focus(log).map(e => startOfDay(e.ts)));
  let day = startOfDay(now);
  if (!days.has(day)) day = addDays(day, -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/** The 2-hour window with the most focus minutes over the last 30 days. */
export function productiveWindow(log: Entry[], now: number): string {
  const since = addDays(now, -30);
  const buckets = new Array(12).fill(0);
  for (const e of focus(log)) if (e.ts >= since) buckets[Math.floor(new Date(e.ts).getHours() / 2)] += e.min;
  const max = Math.max(...buckets);
  return max > 0 ? hourRange(buckets.indexOf(max) * 2) : '—';
}

export function weekStats(log: Entry[], now: number): WeekStats {
  const wk = startOfWeek(now);
  const week = focus(log).filter(e => e.ts >= wk && e.ts < addDays(wk, 7));
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mins = names.map((_, i) => sum(week.filter(e => e.ts >= addDays(wk, i) && e.ts < addDays(wk, i + 1))));
  const max = Math.max(...mins);
  const today = startOfDay(now);
  return {
    totalMin: sum(week),
    sessions: week.length,
    bars: names.map((d, i) => ({ d, min: mins[i], best: max > 0 && mins[i] === max })),
    streak: streak(log, now),
    productive: productiveWindow(log, now),
    todayMin: sum(focus(log).filter(e => e.ts >= today && e.ts < addDays(today, 1))),
  };
}

export interface HistoryGroup { day: string; items: Entry[] }

export function historyGroups(log: Entry[], now: number, maxDays = 30): HistoryGroup[] {
  const today = startOfDay(now);
  const groups = new Map<number, Entry[]>();
  for (const e of [...log].sort((a, b) => b.ts - a.ts)) {
    const day = startOfDay(e.ts);
    if (!groups.has(day)) { if (groups.size >= maxDays) break; groups.set(day, []); }
    groups.get(day)!.push(e);
  }
  return [...groups].map(([day, items]) => ({
    day: day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday'
      : new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    items,
  }));
}
