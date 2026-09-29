import { describe, expect, it } from 'vitest';
import { clock, historyGroups, hm, hourRange, productiveWindow, startOfWeek, streak, weekStats } from './stats';
import type { Entry } from './types';

// Thursday 2026-09-24, 14:00 local time.
const NOW = new Date(2026, 8, 24, 14, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).getTime();
const f = (ts: number, min = 25, task = ''): Entry => ({ ts, kind: 'focus', task, min });
const b = (ts: number, min = 5): Entry => ({ ts, kind: 'break', task: '', min });

describe('formatting', () => {
  it('formats clock and durations like the design', () => {
    expect(clock(1500)).toBe('25:00');
    expect(clock(272)).toBe('04:32');
    expect(hm(755)).toBe('12h 35m');
  });
  it('formats two-hour windows', () => {
    expect(hourRange(9)).toBe('9–11 am');
    expect(hourRange(10)).toBe('10 am–12 pm');
    expect(hourRange(14)).toBe('2–4 pm');
  });
});

describe('weekStats', () => {
  it('starts weeks on Monday', () => {
    expect(new Date(startOfWeek(NOW)).getDate()).toBe(21);
  });
  it('counts only focus sessions in the current week', () => {
    const log = [f(at(20, 9)), f(at(21, 9)), b(at(21, 9, 25)), f(at(22, 10), 50), f(at(24, 9)), f(at(24, 10))];
    const s = weekStats(log, NOW);
    expect(s.sessions).toBe(4);
    expect(s.totalMin).toBe(125);
    expect(s.bars.map(x => x.min)).toEqual([25, 50, 0, 50, 0, 0, 0]);
    expect(s.bars.filter(x => x.best).map(x => x.d)).toEqual(['Tue', 'Thu']);
    expect(s.todayMin).toBe(50);
  });
});

describe('streak', () => {
  it('counts back from today', () => {
    expect(streak([f(at(22, 9)), f(at(23, 9)), f(at(24, 9))], NOW)).toBe(3);
  });
  it('still counts when today has no session yet', () => {
    expect(streak([f(at(22, 9)), f(at(23, 9))], NOW)).toBe(2);
  });
  it('breaks on a gap and ignores breaks', () => {
    expect(streak([f(at(20, 9)), b(at(23, 9)), f(at(24, 9))], NOW)).toBe(1);
    expect(streak([], NOW)).toBe(0);
  });
});

describe('productiveWindow', () => {
  it('picks the busiest two-hour bucket', () => {
    expect(productiveWindow([f(at(23, 9)), f(at(23, 10)), f(at(22, 15))], NOW)).toBe('8–10 am');
    expect(productiveWindow([], NOW)).toBe('—');
  });
});

describe('historyGroups', () => {
  it('groups newest first under Today and Yesterday', () => {
    const g = historyGroups([f(at(23, 14, 20), 50), f(at(24, 9, 10)), b(at(24, 9, 35)), f(at(24, 9, 40))], NOW);
    expect(g.map(x => x.day)).toEqual(['Today', 'Yesterday']);
    expect(g[0].items.map(e => e.ts)).toEqual([at(24, 9, 40), at(24, 9, 35), at(24, 9, 10)]);
  });
});
