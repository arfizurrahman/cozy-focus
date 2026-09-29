# CozyFocus

A small, cozy Pomodoro companion for Windows, built from the `CozyFocus v2` design in
`../project/`. Built with Tauri 2 (Rust), React and TypeScript.

- **Main window** (380×548, frameless): Focus/Home with the task field and presets inline,
  a Break screen with a breathing circle and rotating messages, Stats, History and Settings.
- **Floating overlay**: a separate transparent, always-on-top window. Click it to cycle
  Minimal → Compact → Expanded. Drag it anywhere and it snaps to nearby screen edges.
  Opacity, click-through and "show task name" live in Settings. It remembers its position.
- **Focus Mode**: starting a focus session hides the main window so only the overlay
  stays on screen. When the session ends, the window comes back on the break screen.
- **Tray menu**: Start/Pause, Skip, time remaining, Show/Hide timer, Show/Hide overlay,
  Settings, Quit. Closing or minimising the window sends it to the tray.
- **Global shortcuts** (they work while other apps have focus): Ctrl+Alt+P start/pause, S skip,
  O show/hide overlay, M minimal overlay, L click-through.
- **Windows notifications** and a soft chime when a session ends.
- **Local data**: settings and every finished session are saved to
  `%APPDATA%\com.cozyfocus.app\state.json`. Stats (week total, per-day bars, streak, most
  productive two-hour window) and History are computed from that log.

## Develop

Prerequisites: Node 20+, Rust (stable), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
(on Windows: WebView2 and the MSVC build tools).

```sh
npm install
npm run tauri dev        # run the desktop app
npm run tauri build      # NSIS + MSI installers in src-tauri/target/release/bundle
```

Set `COZYFOCUS_SPEED=120` to make time pass 120× faster, so you can watch a full cycle quickly.

### Browser preview

`npm run dev` and open http://localhost:1420 to see the UI without Tauri. An in-page mock
(`src/mock.ts`) stands in for the Rust core. Query parameters: `?demo` (sample history),
`?speed=120`, `?mode=short|long`, `?tab=stats|history|settings`, `?theme=evening`.
`/overlay.html` previews the overlay.

### Tests

```sh
npm test                          # stats/history maths (vitest)
cd src-tauri && cargo test        # timer state machine
```

## Layout

- `src-tauri/src/engine.rs`: the Pomodoro state machine (pure, unit-tested). It returns
  effects instead of touching windows.
- `src-tauri/src/main.rs`: Tauri glue. It runs the ticker thread, carries out effects,
  manages the tray, shortcuts, notifications and persistence.
- `src/MainWindow.tsx`, `src/screens/*`: the main window.
- `src/Overlay.tsx`: the overlay widget, including drag/snap and self-sizing.
- `src/stats.ts`: Stats and History derived from the session log.
- `src/theme.ts`: the light and evening palettes and accents, copied from the design.
