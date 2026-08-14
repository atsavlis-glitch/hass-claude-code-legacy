# Claude Code for Home Assistant

A Home Assistant add-on that runs [Claude Code](https://claude.ai/code) in a full-featured web terminal, directly inside your Home Assistant instance. Includes pre-configured Home Assistant MCP so Claude can read and control your smart home.

## Requirements

- An [Anthropic account](https://console.anthropic.com/) with an active Claude Pro subscription or API credits
- Home Assistant OS or Supervised installation

## Installation

1. In Home Assistant, go to **Settings → Apps → Install App**
2. Click the menu (⋮) in the top right and choose **Repositories**
3. Add the following URL and click **Add**:
   ```
   https://github.com/pujux/hass-claude-code
   ```
4. Find **Claude Code** in the store and click **Install**
5. Start the add-on and open the web UI via the sidebar

## First run

After the add-on starts, open the web UI from the sidebar. You will be greeted with a bash terminal. Type `claude` and press Enter to launch Claude Code. On first launch it will prompt you to log in with your Anthropic account — click the authentication link in the terminal and follow the flow. Your credentials are stored in persistent add-on storage and survive restarts.

## Features

### Multiple sessions

Click `+` in the tab bar to open additional named sessions. Each session runs independently. Double-click a tab to rename it without interrupting the running session. Press `Ctrl+\`` to hide/show the tab bar.

### Image paste

Copy any screenshot or image to your clipboard and paste (`Ctrl+V` / `Cmd+V`) into the terminal. The image is saved locally and inserted as `[Image: /path]` — Claude reads and analyzes it automatically.

### Home Assistant MCP

The Home Assistant MCP is pre-configured on every start. Claude can query entity states, control devices, check automations, and more — no manual setup required.

### Supervisor CLI (`ha`)

The Home Assistant Supervisor CLI is installed and ready to use. Claude (or you) can run `ha` commands directly in the terminal to manage the system — for example `ha core restart`, `ha supervisor logs`, `ha addons`, or `ha backups`. It's authenticated automatically, so no setup is required.

To add additional MCP servers:

```sh
claude mcp add-json my-mcp '{"command": "my-mcp-server"}'
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `terminal_font_size` | `14` | Font size in the terminal (10–24) |
| `terminal_theme` | `dark` | Color theme: `dark` or `light` |
| `auto_update_claude` | `true` | Auto-update Claude Code on add-on start |
