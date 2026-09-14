ARG BUILD_FROM
FROM ${BUILD_FROM}

# HA add-on base images are Alpine-based.

# Extend PATH for:
# /root/.local/bin — uv / Python tool installation target
ENV \
    LANG="C.UTF-8" \
    PATH="/root/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
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
    unzip \
    nodejs \
    npm

# Install the Home Assistant Supervisor CLI (`ha`)
# BUILD_ARCH is injected by the Home Assistant add-on builder.
ARG BUILD_ARCH
ARG HA_CLI_VERSION=5.3.0

RUN curl -fsSL \
    "https://github.com/home-assistant/cli/releases/download/${HA_CLI_VERSION}/ha_${BUILD_ARCH}" \
    -o /usr/bin/ha \
    && chmod +x /usr/bin/ha

# Install uv.
# hass-mcp requires a newer Python version than the HA base image provides;
# uv manages the required Python environment automatically.
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

RUN uv tool install hass-mcp

# Install Claude Code using npm rather than Anthropic's native installer.
# This avoids the native Claude installer that produced "Illegal instruction"
# on the AMD Phenom CPU.
RUN npm install -g @anthropic-ai/claude-code

# Install browser-side xterm dependencies using npm.
# These files are copied into /app/assets for the web terminal UI.
WORKDIR /tmp/xterm-build

COPY rootfs/app/package.json /tmp/xterm-build/

RUN npm install && \
    mkdir -p /app/assets && \
    cp node_modules/@xterm/xterm/lib/xterm.js /app/assets/ && \
    cp node_modules/@xterm/xterm/css/xterm.css /app/assets/ && \
    cp node_modules/@xterm/addon-fit/lib/addon-fit.js /app/assets/ && \
    cp node_modules/@xterm/addon-web-links/lib/addon-web-links.js /app/assets/ && \
    cd / && \
    rm -rf /tmp/xterm-build

# Copy the add-on application, s6 services, and supporting files.
COPY rootfs/ /

# Ensure the s6 service startup script is executable.
RUN chmod a+x /etc/s6-overlay/s6-rc.d/server/run

WORKDIR /root
