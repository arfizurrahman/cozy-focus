//! The Pomodoro state machine. It knows nothing about windows or the OS: every
//! call returns a list of `Effect`s that the Tauri glue in `main.rs` carries out.

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Focus,
    Short,
    Long,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum OvSize {
    Minimal,
    #[default]
    Compact,
    Expanded,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Focus,
    Break,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum DurKey {
    Focus,
    Short,
    Long,
    Cycle,
    Custom,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Durations {
    pub focus: u32,
    pub short: u32,
    pub long: u32,
    pub cycle: u32,
    pub custom: u32,
}

impl Default for Durations {
    fn default() -> Self {
        Self { focus: 25, short: 5, long: 15, cycle: 4, custom: 35 }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Toggles {
    pub auto_break: bool,
    pub auto_focus: bool,
    pub hide_on_focus: bool,
    pub overlay: bool,
    pub on_top: bool,
    pub show_task: bool,
    pub sound: bool,
    pub notify: bool,
}

impl Default for Toggles {
    fn default() -> Self {
        Self {
            auto_break: true,
            auto_focus: false,
            hide_on_focus: true,
            overlay: true,
            on_top: true,
            show_task: true,
            sound: true,
            notify: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub dur: Durations,
    pub on: Toggles,
    pub ov_size: OvSize,
    pub opacity: u32,
    pub click: bool,
    pub theme: String,
    pub accent: String,
    pub preset: String,
    pub task: String,
    /// Physical top-left of the overlay window, once the user has placed it.
    pub ov_pos: Option<[i32; 2]>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            dur: Durations::default(),
            on: Toggles::default(),
            ov_size: OvSize::Compact,
            opacity: 92,
            click: false,
            theme: "light".into(),
            accent: "terracotta".into(),
            preset: "Normal".into(),
            task: String::new(),
            ov_pos: None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Entry {
    /// Wall-clock start of the session, in Unix milliseconds.
    pub ts: i64,
    pub kind: Kind,
    pub task: String,
    pub min: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Persisted {
    pub settings: Settings,
    pub log: Vec<Entry>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Action {
    Toggle,
    Skip,
    Pick { mode: Mode },
    SetTask { task: String },
    SetPreset { name: String },
    SetDur { key: DurKey, value: u32 },
    SetFlag { key: String, value: bool },
    SetOvSize { size: OvSize },
    CycleOvSize,
    ToggleMinimal,
    SetOpacity { value: u32 },
    ToggleClick,
    ToggleOverlay,
    SetTheme { value: String },
    SetAccent { value: String },
    SetOverlayPos { x: i32, y: i32 },
    ShowMain,
    HideMain,
    ToggleMain,
    OpenSettings,
    Quit,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    ShowMain,
    HideMain,
    ToggleMain,
    /// Switch the main window to a tab ("home", "settings", …).
    Navigate(&'static str),
    Notify(String, String),
    Chime(Kind),
    LogChanged,
    Save,
    /// Overlay window properties (visibility, on-top, click-through) changed.
    Overlay,
    Quit,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot<'a> {
    pub mode: Mode,
    pub running: bool,
    pub left: u32,
    pub total: u32,
    pub done: u32,
    pub settings: &'a Settings,
}

pub struct Engine {
    pub settings: Settings,
    pub log: Vec<Entry>,
    pub mode: Mode,
    pub running: bool,
    /// Seconds left while paused. While running, `deadline` is authoritative.
    left: u32,
    deadline: Option<Instant>,
    session_start: Option<i64>,
    /// Demo multiplier (COZYFOCUS_SPEED) so a full cycle can be watched quickly.
    speed: f64,
}

impl Engine {
    pub fn new(p: Persisted, speed: f64) -> Self {
        let left = p.settings.dur.focus * 60;
        Self {
            settings: p.settings,
            log: p.log,
            mode: Mode::Focus,
            running: false,
            left,
            deadline: None,
            session_start: None,
            speed: if speed > 0.0 { speed } else { 1.0 },
        }
    }

    pub fn persisted(&self) -> Persisted {
        Persisted { settings: self.settings.clone(), log: self.log.clone() }
    }

    fn mins(&self, mode: Mode) -> u32 {
        let d = &self.settings.dur;
        match mode {
            Mode::Focus => d.focus,
            Mode::Short => d.short,
            Mode::Long => d.long,
        }
    }

    pub fn total(&self) -> u32 {
        self.mins(self.mode) * 60
    }

    pub fn left(&self, now: Instant) -> u32 {
        match self.deadline {
            Some(d) if self.running => {
                let real = d.saturating_duration_since(now).as_secs_f64();
                (real * self.speed).ceil() as u32
            }
            _ => self.left,
        }
    }

    pub fn done_today(&self, wall_ms: i64) -> u32 {
        let day = |ms: i64| Local.timestamp_millis_opt(ms).single().map(|t| t.date_naive());
        let today = day(wall_ms);
        self.log.iter().filter(|e| e.kind == Kind::Focus && day(e.ts) == today).count() as u32
    }

    fn next_break(&self, done: u32) -> Mode {
        let cycle = self.settings.dur.cycle.max(1);
        if done > 0 && done.is_multiple_of(cycle) { Mode::Long } else { Mode::Short }
    }

    pub fn snapshot(&self, now: Instant, wall_ms: i64) -> Snapshot<'_> {
        Snapshot {
            mode: self.mode,
            running: self.running,
            left: self.left(now),
            total: self.total(),
            done: self.done_today(wall_ms),
            settings: &self.settings,
        }
    }

    fn arm(&mut self, now: Instant) {
        let real = self.left as f64 / self.speed;
        self.deadline = Some(now + Duration::from_secs_f64(real));
    }

    /// Stop and load a fresh session of `mode`.
    fn reset_to(&mut self, mode: Mode) {
        self.mode = mode;
        self.running = false;
        self.deadline = None;
        self.session_start = None;
        self.left = self.total();
    }

    pub fn tick(&mut self, now: Instant, wall_ms: i64) -> Vec<Effect> {
        if self.running && self.left(now) == 0 {
            self.complete(now, wall_ms)
        } else {
            vec![]
        }
    }

    fn complete(&mut self, now: Instant, wall_ms: i64) -> Vec<Effect> {
        let min = self.mins(self.mode);
        let was_focus = self.mode == Mode::Focus;
        let task = if was_focus { self.settings.task.trim().to_string() } else { String::new() };
        let ts = self.session_start.unwrap_or(wall_ms - (min as f64 * 60_000.0 / self.speed) as i64);
        self.log.push(Entry { ts, kind: if was_focus { Kind::Focus } else { Kind::Break }, task, min });

        let on = self.settings.on.clone();
        let mut fx = vec![Effect::LogChanged, Effect::Save];
        let auto;
        if was_focus {
            let next = self.next_break(self.done_today(wall_ms));
            self.reset_to(next);
            auto = on.auto_break;
            fx.extend([Effect::ShowMain, Effect::Navigate("home")]);
            if on.notify {
                fx.push(Effect::Notify(
                    "Focus session complete".into(),
                    format!("Nice work. Take a {}-minute break.", self.mins(next)),
                ));
            }
            if on.sound {
                fx.push(Effect::Chime(Kind::Focus));
            }
        } else {
            self.reset_to(Mode::Focus);
            auto = on.auto_focus;
            if !(on.auto_focus && on.hide_on_focus) {
                fx.extend([Effect::ShowMain, Effect::Navigate("home")]);
            }
            if on.notify {
                fx.push(Effect::Notify("Break finished".into(), "Ready for another focus session?".into()));
            }
            if on.sound {
                fx.push(Effect::Chime(Kind::Break));
            }
        }
        if auto {
            self.running = true;
            self.session_start = Some(wall_ms);
            self.arm(now);
        }
        fx
    }

    pub fn apply(&mut self, action: Action, now: Instant, wall_ms: i64) -> Vec<Effect> {
        use Effect::*;
        let s = &mut self.settings;
        match action {
            Action::Toggle => {
                if self.running {
                    self.left = self.left(now);
                    self.running = false;
                    self.deadline = None;
                    return vec![];
                }
                if self.left == 0 {
                    self.left = self.total();
                }
                self.running = true;
                self.session_start.get_or_insert(wall_ms);
                self.arm(now);
                if self.mode == Mode::Focus && self.settings.on.hide_on_focus {
                    return vec![HideMain];
                }
                vec![]
            }
            Action::Skip => {
                let next = match self.mode {
                    Mode::Focus => self.next_break(self.done_today(wall_ms) + 1),
                    _ => Mode::Focus,
                };
                self.reset_to(next);
                vec![ShowMain, Navigate("home")]
            }
            Action::Pick { mode } => {
                self.reset_to(mode);
                vec![]
            }
            Action::SetTask { task } => {
                s.task = task;
                vec![Save]
            }
            Action::SetPreset { name } => {
                let min = match name.as_str() {
                    "Deep" => 50,
                    "Normal" => 25,
                    "Custom" => s.dur.custom,
                    _ => return vec![],
                };
                s.preset = name;
                s.dur.focus = min;
                if self.mode == Mode::Focus && !self.running {
                    self.reset_to(Mode::Focus);
                }
                vec![Save]
            }
            Action::SetDur { key, value } => {
                let (lo, hi) = match key {
                    DurKey::Focus => (1, 120),
                    DurKey::Short => (1, 30),
                    DurKey::Long => (1, 60),
                    DurKey::Custom => (5, 120),
                    DurKey::Cycle => (2, 8),
                };
                let v = value.clamp(lo, hi);
                let d = &mut s.dur;
                match key {
                    DurKey::Focus => d.focus = v,
                    DurKey::Short => d.short = v,
                    DurKey::Long => d.long = v,
                    DurKey::Cycle => d.cycle = v,
                    DurKey::Custom => {
                        d.custom = v;
                        if s.preset == "Custom" {
                            d.focus = v;
                        }
                    }
                }
                let affects = match self.mode {
                    Mode::Focus => matches!(key, DurKey::Focus | DurKey::Custom),
                    Mode::Short => key == DurKey::Short,
                    Mode::Long => key == DurKey::Long,
                };
                if affects && !self.running {
                    self.reset_to(self.mode);
                }
                vec![Save]
            }
            Action::SetFlag { key, value } => {
                let on = &mut s.on;
                let slot = match key.as_str() {
                    "autoBreak" => &mut on.auto_break,
                    "autoFocus" => &mut on.auto_focus,
                    "hideOnFocus" => &mut on.hide_on_focus,
                    "overlay" => &mut on.overlay,
                    "onTop" => &mut on.on_top,
                    "showTask" => &mut on.show_task,
                    "sound" => &mut on.sound,
                    "notify" => &mut on.notify,
                    _ => return vec![],
                };
                *slot = value;
                vec![Save, Overlay]
            }
            Action::SetOvSize { size } => {
                s.ov_size = size;
                vec![Save]
            }
            Action::CycleOvSize => {
                s.ov_size = match s.ov_size {
                    OvSize::Minimal => OvSize::Compact,
                    OvSize::Compact => OvSize::Expanded,
                    OvSize::Expanded => OvSize::Minimal,
                };
                vec![Save]
            }
            Action::ToggleMinimal => {
                s.ov_size = if s.ov_size == OvSize::Minimal { OvSize::Compact } else { OvSize::Minimal };
                vec![Save]
            }
            Action::SetOpacity { value } => {
                s.opacity = value.clamp(40, 100);
                vec![Save]
            }
            Action::ToggleClick => {
                s.click = !s.click;
                vec![Save, Overlay]
            }
            Action::ToggleOverlay => {
                s.on.overlay = !s.on.overlay;
                vec![Save, Overlay]
            }
            Action::SetTheme { value } => {
                s.theme = value;
                vec![Save]
            }
            Action::SetAccent { value } => {
                s.accent = value;
                vec![Save]
            }
            Action::SetOverlayPos { x, y } => {
                s.ov_pos = Some([x, y]);
                vec![Save]
            }
            Action::ShowMain => vec![ShowMain],
            Action::HideMain => vec![HideMain],
            Action::ToggleMain => vec![ToggleMain],
            Action::OpenSettings => vec![ShowMain, Navigate("settings")],
            Action::Quit => vec![Quit],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> Engine {
        Engine::new(Persisted::default(), 1.0)
    }

    fn wall() -> i64 {
        chrono::Local::now().timestamp_millis()
    }

    #[test]
    fn starts_idle_on_a_full_focus_session() {
        let e = engine();
        let now = Instant::now();
        assert_eq!(e.mode, Mode::Focus);
        assert!(!e.running);
        assert_eq!(e.left(now), 25 * 60);
    }

    #[test]
    fn start_hides_window_and_pause_keeps_remaining_time() {
        let mut e = engine();
        let t0 = Instant::now();
        assert_eq!(e.apply(Action::Toggle, t0, wall()), vec![Effect::HideMain]);
        let t1 = t0 + Duration::from_secs(90);
        assert_eq!(e.left(t1), 25 * 60 - 90);
        assert!(e.apply(Action::Toggle, t1, wall()).is_empty());
        assert!(!e.running);
        assert_eq!(e.left(t1 + Duration::from_secs(500)), 25 * 60 - 90);
    }

    #[test]
    fn focus_completion_logs_task_and_moves_to_break() {
        let mut e = engine();
        e.apply(Action::SetTask { task: "  Build authentication API ".into() }, Instant::now(), wall());
        let t0 = Instant::now();
        let w0 = wall();
        e.apply(Action::Toggle, t0, w0);
        let fx = e.tick(t0 + Duration::from_secs(25 * 60), w0 + 25 * 60_000);
        assert_eq!(e.log.len(), 1);
        assert_eq!(e.log[0].task, "Build authentication API");
        assert_eq!(e.log[0].ts, w0);
        assert_eq!(e.log[0].min, 25);
        assert_eq!(e.mode, Mode::Short);
        assert!(e.running, "auto-start breaks is on by default");
        assert!(fx.contains(&Effect::ShowMain));
        assert!(fx.contains(&Effect::Chime(Kind::Focus)));
        assert!(fx.iter().any(|f| matches!(f, Effect::Notify(t, b) if t == "Focus session complete" && b.contains("5-minute"))));
    }

    #[test]
    fn every_fourth_focus_session_earns_a_long_break() {
        let mut e = engine();
        let w = wall();
        for i in 0..3 {
            e.log.push(Entry { ts: w - (i + 1) * 60_000, kind: Kind::Focus, task: String::new(), min: 25 });
        }
        let t0 = Instant::now();
        e.apply(Action::Toggle, t0, w);
        let t1 = t0 + Duration::from_secs(25 * 60);
        e.tick(t1, w);
        assert_eq!(e.mode, Mode::Long);
        assert_eq!(e.left(t1), 15 * 60);
    }

    #[test]
    fn break_completion_returns_to_idle_focus_and_shows_window() {
        let mut e = engine();
        e.apply(Action::Pick { mode: Mode::Short }, Instant::now(), wall());
        let t0 = Instant::now();
        e.apply(Action::Toggle, t0, wall());
        let fx = e.tick(t0 + Duration::from_secs(5 * 60), wall());
        assert_eq!(e.mode, Mode::Focus);
        assert!(!e.running);
        assert!(fx.contains(&Effect::ShowMain));
        assert_eq!(e.log[0].kind, Kind::Break);
        assert_eq!(e.log[0].task, "");
    }

    #[test]
    fn skip_from_focus_goes_to_break_without_logging() {
        let mut e = engine();
        let fx = e.apply(Action::Skip, Instant::now(), wall());
        assert_eq!(e.mode, Mode::Short);
        assert!(e.log.is_empty());
        assert_eq!(fx, vec![Effect::ShowMain, Effect::Navigate("home")]);
    }

    #[test]
    fn presets_set_focus_length() {
        let mut e = engine();
        e.apply(Action::SetPreset { name: "Deep".into() }, Instant::now(), wall());
        assert_eq!(e.settings.dur.focus, 50);
        assert_eq!(e.left(Instant::now()), 50 * 60);
        e.apply(Action::SetPreset { name: "Custom".into() }, Instant::now(), wall());
        e.apply(Action::SetDur { key: DurKey::Custom, value: 40 }, Instant::now(), wall());
        assert_eq!(e.settings.dur.focus, 40);
        assert_eq!(e.left(Instant::now()), 40 * 60);
    }

    #[test]
    fn durations_are_clamped() {
        let mut e = engine();
        e.apply(Action::SetDur { key: DurKey::Cycle, value: 99 }, Instant::now(), wall());
        e.apply(Action::SetDur { key: DurKey::Short, value: 0 }, Instant::now(), wall());
        assert_eq!(e.settings.dur.cycle, 8);
        assert_eq!(e.settings.dur.short, 1);
    }

    #[test]
    fn overlay_size_cycles_and_minimal_toggles() {
        let mut e = engine();
        e.apply(Action::CycleOvSize, Instant::now(), wall());
        assert_eq!(e.settings.ov_size, OvSize::Expanded);
        e.apply(Action::CycleOvSize, Instant::now(), wall());
        assert_eq!(e.settings.ov_size, OvSize::Minimal);
        e.apply(Action::ToggleMinimal, Instant::now(), wall());
        assert_eq!(e.settings.ov_size, OvSize::Compact);
    }

    #[test]
    fn actions_deserialize_from_frontend_json() {
        let a: Action = serde_json::from_str(r#"{"type":"setDur","key":"short","value":7}"#).unwrap();
        assert!(matches!(a, Action::SetDur { key: DurKey::Short, value: 7 }));
        let a: Action = serde_json::from_str(r#"{"type":"setOverlayPos","x":-10,"y":20}"#).unwrap();
        assert!(matches!(a, Action::SetOverlayPos { x: -10, y: 20 }));
        let a: Action = serde_json::from_str(r#"{"type":"toggle"}"#).unwrap();
        assert!(matches!(a, Action::Toggle));
    }

    #[test]
    fn persisted_state_tolerates_missing_fields() {
        let p: Persisted = serde_json::from_str(r#"{"settings":{"dur":{"focus":30}}}"#).unwrap();
        assert_eq!(p.settings.dur.focus, 30);
        assert_eq!(p.settings.dur.short, 5);
        assert!(p.settings.on.auto_break);
        assert!(p.log.is_empty());
    }
}
