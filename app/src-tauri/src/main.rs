// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;

use engine::{Action, Effect, Engine, Kind, Mode, Persisted};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WindowEvent, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

#[derive(Clone)]
struct TrayItems {
    toggle: MenuItem<Wry>,
    remaining: MenuItem<Wry>,
    timer: MenuItem<Wry>,
    overlay: MenuItem<Wry>,
}

struct AppState {
    engine: Mutex<Engine>,
    path: PathBuf,
    dirty: AtomicBool,
    /// The overlay stays hidden until its webview has positioned itself.
    overlay_ready: AtomicBool,
    tray: Mutex<Option<TrayItems>>,
}

type ShortcutBinding = (&'static str, fn() -> Action);

const SHORTCUTS: [ShortcutBinding; 5] = [
    ("ctrl+alt+p", || Action::Toggle),
    ("ctrl+alt+s", || Action::Skip),
    ("ctrl+alt+o", || Action::ToggleOverlay),
    ("ctrl+alt+m", || Action::ToggleMinimal),
    ("ctrl+alt+l", || Action::ToggleClick),
];

fn wall_ms() -> i64 {
    chrono::Local::now().timestamp_millis()
}

fn clock(secs: u32) -> String {
    format!("{:02}:{:02}", secs / 60, secs % 60)
}

fn load(path: &PathBuf) -> Persisted {
    let Ok(text) = std::fs::read_to_string(path) else { return Persisted::default() };
    serde_json::from_str(&text).unwrap_or_else(|err| {
        eprintln!("cozyfocus: could not read {}: {err}; starting fresh", path.display());
        let _ = std::fs::rename(path, path.with_extension("json.bak"));
        Persisted::default()
    })
}

fn save(state: &AppState) {
    let data = state.engine.lock().unwrap().persisted();
    if let Some(dir) = state.path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let tmp = state.path.with_extension("json.tmp");
    let written = serde_json::to_vec_pretty(&data).is_ok_and(|bytes| std::fs::write(&tmp, bytes).is_ok());
    if !written || std::fs::rename(&tmp, &state.path).is_err() {
        eprintln!("cozyfocus: failed to save {}", state.path.display());
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn apply_overlay(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Some(w) = app.get_webview_window("overlay") else { return };
    let s = state.engine.lock().unwrap().settings.clone();
    let _ = w.set_always_on_top(s.on.on_top);
    let _ = w.set_ignore_cursor_events(s.click);
    if s.on.overlay && state.overlay_ready.load(Ordering::SeqCst) {
        let _ = w.show();
    } else {
        let _ = w.hide();
    }
}

fn emit_state(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (json, left, running, mode, idle, on_overlay) = {
        let e = state.engine.lock().unwrap();
        let snap = e.snapshot(Instant::now(), wall_ms());
        let idle = snap.left == snap.total;
        (serde_json::to_value(&snap).unwrap(), snap.left, snap.running, snap.mode, idle, e.settings.on.overlay)
    };
    let _ = app.emit("state", json);

    let main_visible = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false);
    let label = if running {
        "Pause"
    } else if !idle {
        "Resume"
    } else if mode == Mode::Focus {
        "Start focus"
    } else {
        "Start break"
    };
    // Clone the handles out: set_text hops to the main thread, which may itself be
    // waiting on this mutex (e.g. while handling a global shortcut).
    let tray = state.tray.lock().unwrap().clone();
    if let Some(t) = tray {
        let _ = t.toggle.set_text(label);
        let _ = t.remaining.set_text(format!("{} remaining", clock(left)));
        let _ = t.timer.set_text(if main_visible { "Hide timer" } else { "Show timer" });
        let _ = t.overlay.set_text(if on_overlay { "Hide overlay" } else { "Show overlay" });
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(format!("CozyFocus · {}", clock(left))));
    }
}

fn run_effects(app: &AppHandle, effects: Vec<Effect>) {
    let state = app.state::<AppState>();
    for fx in effects {
        match fx {
            Effect::ShowMain => show_main(app),
            Effect::HideMain => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Effect::ToggleMain => {
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        show_main(app);
                    }
                }
            }
            Effect::Navigate(tab) => {
                let _ = app.emit_to("main", "navigate", tab);
            }
            Effect::Notify(title, body) => {
                let _ = app.notification().builder().title(title).body(body).show();
            }
            Effect::Chime(kind) => {
                let _ = app.emit("chime", if kind == Kind::Focus { "focus" } else { "break" });
            }
            Effect::LogChanged => {
                let _ = app.emit("log", ());
            }
            Effect::Save => state.dirty.store(true, Ordering::SeqCst),
            Effect::Overlay => apply_overlay(app),
            Effect::Quit => {
                save(&state);
                app.exit(0);
            }
        }
    }
    emit_state(app);
}

fn dispatch_action(app: &AppHandle, action: Action) {
    let effects = {
        let state = app.state::<AppState>();
        let mut e = state.engine.lock().unwrap();
        e.apply(action, Instant::now(), wall_ms())
    };
    run_effects(app, effects);
}

#[tauri::command]
fn get_state(state: tauri::State<AppState>) -> serde_json::Value {
    let e = state.engine.lock().unwrap();
    serde_json::to_value(e.snapshot(Instant::now(), wall_ms())).unwrap()
}

#[tauri::command]
fn get_log(state: tauri::State<AppState>) -> Vec<engine::Entry> {
    state.engine.lock().unwrap().log.clone()
}

#[tauri::command]
fn dispatch(app: AppHandle, action: Action) {
    dispatch_action(&app, action);
}

#[tauri::command]
fn overlay_ready(app: AppHandle) {
    app.state::<AppState>().overlay_ready.store(true, Ordering::SeqCst);
    apply_overlay(&app);
}

fn build_tray(app: &AppHandle) -> tauri::Result<TrayItems> {
    let item = |id: &str, text: &str, enabled: bool| MenuItem::with_id(app, id, text, enabled, None::<&str>);
    let header = item("header", "CozyFocus", false)?;
    let toggle = item("toggle", "Start focus", true)?;
    let skip = item("skip", "Skip", true)?;
    let remaining = item("remaining", "25:00 remaining", false)?;
    let timer = item("timer", "Hide timer", true)?;
    let overlay = item("overlay", "Hide overlay", true)?;
    let settings = item("settings", "Settings", true)?;
    let quit = item("quit", "Quit", true)?;
    let menu = Menu::with_items(
        app,
        &[
            &header,
            &toggle,
            &skip,
            &PredefinedMenuItem::separator(app)?,
            &remaining,
            &PredefinedMenuItem::separator(app)?,
            &timer,
            &overlay,
            &settings,
            &quit,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("CozyFocus")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let action = match event.id().as_ref() {
                "toggle" => Action::Toggle,
                "skip" => Action::Skip,
                "timer" => Action::ToggleMain,
                "overlay" => Action::ToggleOverlay,
                "settings" => Action::OpenSettings,
                "quit" => Action::Quit,
                _ => return,
            };
            dispatch_action(app, action);
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(TrayItems { toggle, remaining, timer, overlay })
}

fn spawn_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last: Option<(u32, bool)> = None;
        let mut quiet = Instant::now();
        loop {
            std::thread::sleep(Duration::from_millis(200));
            let state = app.state::<AppState>();
            let (effects, key) = {
                let mut e = state.engine.lock().unwrap();
                let now = Instant::now();
                let fx = e.tick(now, wall_ms());
                (fx, (e.left(now), e.running))
            };
            if !effects.is_empty() {
                run_effects(&app, effects);
            } else if last != Some(key) || quiet.elapsed() > Duration::from_secs(30) {
                // Refresh at least every 30s so "sessions today" rolls over at midnight.
                emit_state(&app);
                quiet = Instant::now();
            }
            last = Some(key);
            if state.dirty.swap(false, Ordering::SeqCst) {
                save(&state);
            }
        }
    });
}

fn main() {
    let speed = std::env::var("COZYFOCUS_SPEED").ok().and_then(|v| v.parse().ok()).unwrap_or(1.0);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    for (keys, action) in SHORTCUTS {
                        if keys.parse::<Shortcut>().is_ok_and(|s| &s == shortcut) {
                            dispatch_action(app, action());
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let path = app.path().app_data_dir()?.join("state.json");
            let engine = Engine::new(load(&path), speed);
            app.manage(AppState {
                engine: Mutex::new(engine),
                path,
                dirty: AtomicBool::new(false),
                overlay_ready: AtomicBool::new(false),
                tray: Mutex::new(None),
            });

            let handle = app.handle().clone();
            let items = build_tray(&handle)?;
            *app.state::<AppState>().tray.lock().unwrap() = Some(items);

            // Shortcuts can already be taken by another app; that must not stop CozyFocus.
            for (keys, _) in SHORTCUTS {
                if let Err(err) = app.global_shortcut().register(keys) {
                    eprintln!("cozyfocus: could not register {keys}: {err}");
                }
            }

            if let Some(main) = app.get_webview_window("main") {
                let h = handle.clone();
                main.on_window_event(move |event| match event {
                    // Closing the window sends CozyFocus to the tray instead of quitting.
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        if let Some(w) = h.get_webview_window("main") {
                            let _ = w.hide();
                        }
                        emit_state(&h);
                    }
                    WindowEvent::Focused(_) => emit_state(&h),
                    _ => {}
                });
            }

            apply_overlay(&handle);
            spawn_ticker(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_state, get_log, dispatch, overlay_ready])
        .run(tauri::generate_context!())
        .expect("error while running CozyFocus");
}
