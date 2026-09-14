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
#
# build-base is required because node-pty contains native code and may
# need to compile against the CPU/runtime used by this Home Assistant host.
#
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
#
# hass-mcp requires a newer Python environment than some HA base images
# provide. uv manages that environment automatically.
#
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

RUN uv tool install hass-mcp

# -------------------------------------------------------------------
# Claude Code
# -------------------------------------------------------------------
#
# Do NOT use Anthropic's native installer here.
# The native Claude binary produced "Illegal instruction" on the
# AMD Phenom host.
#
# Install the npm/Node distribution instead.
#
RUN npm install -g @anthropic-ai/claude-code

# -------------------------------------------------------------------
# Node/TypeScript terminal server
# -------------------------------------------------------------------
#
# The original add-on used Bun.
# Our legacy-CPU fork runs the server using Node instead.
#
# Install tsx globally because the s6 startup script launches:
#
#   /usr/local/bin/tsx /app/server.ts
#
RUN npm install -g tsx

# -------------------------------------------------------------------
# Application dependencies
# -------------------------------------------------------------------
#
# Install package.json directly into /app so runtime dependencies such as
# ws and node-pty remain available when the add-on is running.
#
WORKDIR /app

COPY rootfs/app/package.json /app/package.json

RUN npm install

# -------------------------------------------------------------------
# Browser-side xterm assets
# -------------------------------------------------------------------
#
# These files are loaded by the browser UI.
#
RUN mkdir -p /app/assets \
    && cp node_modules/@xterm/xterm/lib/xterm.js /app/assets/ \
    && cp node_modules/@xterm/xterm/css/xterm.css /app/assets/ \
    && cp node_modules/@xterm/addon-fit/lib/addon-fit.js /app/assets/ \
    && cp node_modules/@xterm/addon-web-links/lib/addon-web-links.js /app/assets/

# -------------------------------------------------------------------
# Copy add-on files
# -------------------------------------------------------------------
#
# This copies server.ts, session.ts, assets.ts, upload.ts, index.html,
# the s6 service files, and the rest of the add-on root filesystem.
#
COPY rootfs/ /

# Ensure the s6 server startup script is executable.
RUN chmod a+x /etc/s6-overlay/s6-rc.d/server/run

WORKDIR /root
