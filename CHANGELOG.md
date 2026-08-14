# Changelog

## 1.0.8

- Fix: the startup script no longer overwrites the global `CLAUDE.md` memory file on every start — memories saved via `/memory` now survive restarts
- Fix: renaming a tab (double-click) no longer kills the running session — the session is re-keyed server-side and keeps running
- Fix: reconnecting no longer duplicates the terminal history
- URLs printed in the terminal are now clickable (e.g. the login link on first run)
- Add Supervisor watchdog — the add-on is restarted automatically if the terminal server hangs
- Add documentation tab content (`DOCS.md`) and friendly config option descriptions
- Update Home Assistant CLI to 5.3.0, xterm.js to 6.0.0

## 1.0.7

- Grant the add-on the `manager` Supervisor role so the `ha` CLI can read logs (`ha core/supervisor/host logs`, add-on logs) and manage add-ons, backups, and the store. Previously the default role only allowed `*/info` endpoints, so log commands returned 403 Forbidden.

## 1.0.6

- Bundle the Home Assistant Supervisor CLI (`ha`). Claude can now manage the system directly — restart Core, view Supervisor/add-on logs, manage backups, and more. Works out of the box with no configuration.

## 1.0.5

- Remove tmux: terminal sessions are now managed directly by the server. This fixes scroll wheel, text selection, and garbage characters — all were caused by tmux's terminal multiplexing layer conflicting with xterm.js

## 1.0.4

- Fix scrolling: wheel/trackpad now scrolls through full terminal history via tmux copy mode (scroll up to browse history, scroll down to return to live output)
- Fix text selection: works natively again — click and drag to highlight, browser copy (Ctrl+C / Cmd+C) to copy

## 1.0.3

- Fix scroll wheel not working after 1.0.2 — intercept wheel event before xterm.js to ensure scrollback is driven correctly

## 1.0.2

- Fix text selection/copy broken by mouse mode — scroll wheel now handled by xterm.js directly, preserving native browser text selection

## 1.0.1

- Fix garbage characters (`1;2c`, `0;276;0c`) appearing on terminal open — tmux no longer probes the PTY for terminal capabilities
- Fix scroll wheel / trackpad sending unwanted arrow keys instead of scrolling — tmux mouse mode enabled

## 1.0.0

- Initial release
