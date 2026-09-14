ARG BUILD_FROM
FROM ${BUILD_FROM}

ENV \
    LANG="C.UTF-8" \
    PATH="/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    CLAUDE_CONFIG_DIR="/data/.claudecode"

# ------------------------------------------------------------
# System dependencies
# ------------------------------------------------------------

RUN apk add --no-cache \
    bash \
    curl \
    git \
    jq \
    python3 \
    py3-pip \
    ca-certificates \
    tzdata \
    unzip \
    nodejs \
    npm \
    build-base

# ------------------------------------------------------------
# Home Assistant CLI
# ------------------------------------------------------------

ARG BUILD_ARCH
ARG HA_CLI_VERSION=5.3.0

RUN curl -fsSL \
    "https://github.com/home-assistant/cli/releases/download/${HA_CLI_VERSION}/ha_${BUILD_ARCH}" \
    -o /usr/bin/ha \
    && chmod +x /usr/bin/ha

# ------------------------------------------------------------
# uv + Home Assistant MCP
# ------------------------------------------------------------

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

RUN uv tool install hass-mcp

# ------------------------------------------------------------
# Remove any existing Claude global/native installation
# ------------------------------------------------------------

RUN npm uninstall -g @anthropic-ai/claude-code >/dev/null 2>&1 || true \
    && rm -f /usr/local/bin/claude \
    && rm -rf /usr/local/lib/node_modules/@anthropic-ai/claude-code

# ------------------------------------------------------------
# Claude Code legacy Node-only installation
# ------------------------------------------------------------
#
# IMPORTANT:
# The AMD Phenom CPU cannot run the newer native Claude/Bun binary.
# We therefore extract Claude Code 2.1.108 and run cli.js directly
# through Node.js.
#

RUN mkdir -p /opt/claude-node \
    && cd /tmp \
    && npm pack @anthropic-ai/claude-code@2.1.108 \
    && tar -xzf anthropic-ai-claude-code-2.1.108.tgz \
    && cp -a package/. /opt/claude-node/ \
    && rm -rf /tmp/package \
    && rm -f /tmp/anthropic-ai-claude-code-2.1.108.tgz

# ------------------------------------------------------------
# Claude launcher
# ------------------------------------------------------------
#
# Start Claude Code with permission prompts bypassed.
#
# This means Claude can use its tools without stopping to ask
# for confirmation on every operation.
#
# WARNING:
# Claude has broad access to the Home Assistant configuration.
#

RUN printf '%s\n' \
    '#!/bin/sh' \
    'exec node /opt/claude-node/cli.js --dangerously-skip-permissions "$@"' \
    > /usr/local/bin/claude \
    && chmod 755 /usr/local/bin/claude

# Build marker so we can verify which image is running.
RUN printf '%s\n' \
    'SolarShade Claude Legacy CPU' \
    'Node cli.js wrapper build' \
    'Claude package: 2.1.108' \
    'Permissions: bypass enabled' \
    > /LEGACY_CLAUDE_BUILD

# ------------------------------------------------------------
# Node / TypeScript web terminal
# ------------------------------------------------------------

RUN npm install -g tsx

# ------------------------------------------------------------
# Application dependencies
# ------------------------------------------------------------

WORKDIR /app

COPY rootfs/app/package.json /app/package.json

RUN npm install

# ------------------------------------------------------------
# Browser xterm assets
# ------------------------------------------------------------

RUN mkdir -p /app/assets \
    && cp node_modules/@xterm/xterm/lib/xterm.js /app/assets/ \
    && cp node_modules/@xterm/xterm/css/xterm.css /app/assets/ \
    && cp node_modules/@xterm/addon-fit/lib/addon-fit.js /app/assets/ \
    && cp node_modules/@xterm/addon-web-links/lib/addon-web-links.js /app/assets/

# ------------------------------------------------------------
# Copy add-on files
# ------------------------------------------------------------

COPY rootfs/ /

RUN chmod a+x /etc/s6-overlay/s6-rc.d/server/run

WORKDIR /root
