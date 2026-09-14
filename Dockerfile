ARG BUILD_FROM
FROM ${BUILD_FROM}

# HA add-on base images are Alpine-based.
# Extend PATH for:
#   /root/.local/bin  — Claude Code native installer target
#   /root/.bun/bin    — Bun installer target
ENV \
    LANG="C.UTF-8" \
    PATH="/root/.local/bin:/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    CLAUDE_CONFIG_DIR="/data/.claudecode"

# System dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    jq \
    python3 \
    py3-pip \
    ca-certificates \
    tzdata \
    unzip

# Install the Home Assistant Supervisor CLI (`ha`)
# Static binary from home-assistant/cli; BUILD_ARCH (amd64/aarch64) is injected
# by the add-on builder and maps 1:1 to the release asset names.
# Works with zero config: it reads SUPERVISOR_TOKEN (granted by hassio_api: true)
# and defaults to the `supervisor` endpoint.
ARG BUILD_ARCH
ARG HA_CLI_VERSION=5.3.0
RUN curl -fsSL "https://github.com/home-assistant/cli/releases/download/${HA_CLI_VERSION}/ha_${BUILD_ARCH}" \
      -o /usr/bin/ha && chmod +x /usr/bin/ha

# Install Bun (minimum v1.3.5 for Bun.spawn({ terminal }) PTY API)
RUN curl -fsSL https://bun.sh/install | bash

# Install uv — fast Python package manager that handles Python version requirements
# hass-mcp requires Python >=3.13 but HA base images ship 3.12; uv resolves this automatically
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN uv tool install hass-mcp

# Install Node.js/npm for legacy CPU-compatible Claude Code install
RUN apk add --no-cache nodejs npm

# Install Claude Code via npm instead of native installer
RUN npm install -g @anthropic-ai/claude-code

# Extract xterm.js browser assets from npm packages
# These run in the browser only — not imported by server.ts
WORKDIR /tmp/xterm-build
COPY rootfs/app/package.json /tmp/xterm-build/
RUN bun install && \
    mkdir -p /app/assets && \
    cp node_modules/@xterm/xterm/lib/xterm.js /app/assets/ && \
    cp node_modules/@xterm/xterm/css/xterm.css /app/assets/ && \
    cp node_modules/@xterm/addon-fit/lib/addon-fit.js /app/assets/ && \
    cp node_modules/@xterm/addon-web-links/lib/addon-web-links.js /app/assets/ && \
    cd / && rm -rf /tmp/xterm-build

# Copy all rootfs files (app source, s6 services, etc.)
COPY rootfs/ /

# Ensure s6 run script is executable (git may not preserve +x across platforms)
RUN chmod a+x /etc/s6-overlay/s6-rc.d/server/run

WORKDIR /root
