# Claude Code for Home Assistant

Runs [Claude Code](https://claude.ai/code) in a full-featured web terminal inside
Home Assistant, with pre-configured Home Assistant MCP so Claude can read and
control your smart home.

## First run

After the add-on starts, open the web UI from the sidebar. You will be greeted
with a bash terminal. Type `claude` and press Enter to launch Claude Code. On
first launch it will prompt you to log in with your Anthropic account — click
the authentication link in the terminal and follow the flow. Your credentials
are stored in persistent add-on storage and survive restarts.

## Features

### Multiple sessions

Click `+` in the tab bar to open additional named sessions. Each session runs
independently and keeps running while you switch tabs. Double-click a tab to
rename it — the running session is not interrupted. Press ``Ctrl+` `` to
hide/show the tab bar.

### Image paste

Copy any screenshot or image to your clipboard and paste (`Ctrl+V` / `Cmd+V`)
into the terminal. The image is saved locally and inserted as `[Image: /path]`
— Claude reads and analyzes it automatically.

### Clickable links

URLs printed in the terminal (for example the login link on first run) are
clickable.

### Home Assistant MCP

The Home Assistant MCP is pre-configured on every start. Claude can query
entity states, control devices, check automations, and more — no manual setup
required.

To add additional MCP servers:

```sh
claude mcp add-json my-mcp '{"command": "my-mcp-server"}'
```

### Supervisor CLI (`ha`)

The Home Assistant Supervisor CLI is installed and ready to use. Claude (or
you) can run `ha` commands directly in the terminal to manage the system — for
example `ha core restart`, `ha supervisor logs`, `ha addons`, or `ha backups`.
It's authenticated automatically, so no setup is required.

## Configuration

| Option | Default | Description |
|---|---|---|
| `terminal_font_size` | `14` | Font size in the terminal (10–24) |
| `terminal_theme` | `dark` | Color theme: `dark` or `light` |
| `auto_update_claude` | `true` | Auto-update Claude Code on add-on start |
