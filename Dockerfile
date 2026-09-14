ARG BUILD_FROM
FROM ${BUILD_FROM}

# Home Assistant add-on base images are Alpine-based.

ENV \
    LANG="C.UTF-8" \
    PATH="/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    CLAUDE_CONFIG_DIR="/data/.claudecode"

# -------------------------------------------------------------------
# System and build dependencies
# -------------------------------------------------------------------

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

# -------------------------------------------------------------------
# Home Assistant Supervisor CLI
# -------------------------------------------------------------------

ARG BUILD_ARCH
ARG HA_CLI_VERSION=5.3.0

RUN curl -fsSL \
    "https://github.com/home-assistant/cli/releases/download/${HA_CLI_VERSION}/ha_${BUILD_ARCH}" \
    -o /usr/bin/ha \
    && chmod +x /usr/bin/ha

# -------------------------------------------------------------------
# uv + Home Assistant MCP
# -------------------------------------------------------------------

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

RUN uv tool install hass-mcp

# -------------------------------------------------------------------
# Claude Code - legacy CPU Node.js installation
# -------------------------------------------------------------------
#
# IMPORTANT:
# Do NOT use Anthropic's native installer.
# Do NOT use npm install -g @anthropic-ai/claude-code.
#
# The AMD Phenom CPU cannot run the newer native/Bun Claude launcher.
#
# Instead we download the older Node-based Claude Code npm package,
# extract it manually, and create our own launcher that directly runs
# cli.js using Node.
#

RUN mkdir -p /opt/claude-node \
    && cd /tmp \
    && npm pack @anthropic-ai/claude-code@2.1.108 \
    && tar -xzf anthropic-ai-claude-code-2.1.108.tgz \
    && cp -r package/* /opt/claude-node/ \
    && printf '#!/bin/sh\nexec node /opt/claude-node/cli.js "$@"\n' > /usr/local/bin/claude \
    && chmod +x /usr/local/bin/claude \
    && rm -rf /tmp/package \
    && rm -f /tmp/anthropic-ai-claude-code-2.1.108.tgz

# -------------------------------------------------------------------
# Node / TypeScript terminal server
# -------------------------------------------------------------------

RUN npm install -g tsx

# -------------------------------------------------------------------
# Application dependencies
# -------------------------------------------------------------------

WORKDIR /app

COPY rootfs/app/package.json /app/package.json

RUN npm install

# -------------------------------------------------------------------
# Browser-side xterm assets
# -------------------------------------------------------------------

RUN mkdir -p /app/assets \
    && cp node_modules/@xterm/xterm/lib/xterm.js /app/assets/ \
    && cp node_modules/@xterm/xterm/css/xterm.css /app/assets/ \
    && cp node_modules/@xterm/addon-fit/lib/addon-fit.js /app/assets/ \
    && cp node_modules/@xterm/addon-web-links/lib/addon-web-links.js /app/assets/

# -------------------------------------------------------------------
# Copy add-on files
# -------------------------------------------------------------------

COPY rootfs/ /

# Ensure the s6 startup script is executable
RUN chmod a+x /etc/s6-overlay/s6-rc.d/server/run

WORKDIR /root
