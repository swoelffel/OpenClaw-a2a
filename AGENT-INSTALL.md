# Installation Guide for OpenClaw Agents

This guide is intended for OpenClaw agents that need to automatically install the A2A extension.

## Overview

The A2A extension adds the Agent-to-Agent (A2A) protocol to OpenClaw, enabling P2P communication between AI agents.

**Files generated after build:**
- `dist/index.js` - Main entry point
- `dist/*.js` - Compiled modules (models, rpc-handler, task-manager, integration, client)
- `openclaw.plugin.json` - Plugin configuration
- `package.json` - Metadata and dependencies

## Automatic Installation (Recommended)

### Method 1: Quick Install Script

```bash
# Install from latest release
curl -fsSL https://raw.githubusercontent.com/swoelffel/OpenClaw-a2a/main/scripts/install-a2a.sh | bash

# Or with specific version
curl -fsSL https://raw.githubusercontent.com/swoelffel/OpenClaw-a2a/main/scripts/install-a2a.sh | bash -s v0.1.0
```

The script automatically performs:
1. Download of the release
2. Extraction to `~/.openclaw/extensions/a2a/`
3. Installation verification
4. Gateway restart

### Method 2: Programmatic Installation via GitHub API

```bash
#!/bin/bash
set -e

REPO="swoelffel/OpenClaw-a2a"
VERSION="${1:-latest}"
INSTALL_DIR="$HOME/.openclaw/extensions/a2a"

# Get latest version if not specified
if [ "$VERSION" = "latest" ]; then
    VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
fi

# Download and install
mkdir -p "$INSTALL_DIR"
curl -L "https://github.com/$REPO/releases/download/$VERSION/openclaw-a2a-extension.tar.gz" | tar -xz -C "$INSTALL_DIR"

# Verify
if [ ! -f "$INSTALL_DIR/dist/index.js" ]; then
    echo "ERROR: Installation failed"
    exit 1
fi

# Restart
echo "Installation complete. Restarting gateway..."
openclaw gateway restart
```

## Installation from Source (Local Build)

If you need to compile from the source repository:

```bash
# 1. Clone and build
git clone https://github.com/swoelffel/OpenClaw-a2a.git /tmp/a2a-build
cd /tmp/a2a-build
npm ci
npm run build:clean

# 2. Copy to extensions directory
mkdir -p ~/.openclaw/extensions/a2a
cp -r dist openclaw.plugin.json package.json ~/.openclaw/extensions/a2a/

# 3. Clean up
rm -rf /tmp/a2a-build

# 4. Restart
openclaw gateway restart
```

## Configuration

Ensure `~/.openclaw/config.json` contains:

```json
{
  "version": 1,
  "plugins": {
    "a2a": {
      "enabled": true,
      "port": 0,
      "authToken": null,
      "agentName": "OpenClaw Agent",
      "agentDescription": "Agent with A2A protocol support",
      "skills": [
        {
          "id": "general",
          "name": "General Assistance",
          "description": "Provides general assistance"
        }
      ]
    }
  }
}
```

## Post-Installation Verification

Run these commands to validate:

```bash
# 1. Verify files
ls -la ~/.openclaw/extensions/a2a/dist/index.js

# 2. Verify configuration
grep -q '"enabled": true' ~/.openclaw/config.json && echo "✓ A2A enabled"

# 3. Test endpoint (after restart)
sleep 5  # Wait for startup
curl -s http://localhost:18789/.well-known/agent.json | grep -q '"name"' && echo "✓ A2A endpoint working"

# 4. Check logs
tail -20 /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -i "a2a\|extension"
```

## Automated Troubleshooting

### If the extension does not load:

```bash
# Check entry point
cat ~/.openclaw/extensions/a2a/openclaw.plugin.json

# Verify dist/index.js exists
[ -f ~/.openclaw/extensions/a2a/dist/index.js ] || echo "ERROR: Main file missing"

# Check dependencies
ls ~/.openclaw/extensions/a2a/node_modules/zod 2>/dev/null || echo "WARNING: zod not installed"

# Force reload
openclaw gateway restart
```

### If TypeScript errors persist:

```bash
# Clean and reinstall
rm -rf ~/.openclaw/extensions/a2a
curl -fsSL https://raw.githubusercontent.com/swoelffel/OpenClaw-a2a/main/scripts/install-a2a.sh | bash
```

## Key Points for Agents

1. **Compiled extension required**: OpenClaw loads `.js` files, not `.ts`
2. **`dist/` folder**: Must contain all compiled modules
3. **Entry point**: `dist/index.js` (specified in `openclaw.plugin.json`)
4. **Dependencies**: `zod` must be available (included in the release)
5. **Restart required**: Gateway must restart to load the extension

## API and Endpoints

After successful installation:

- **AgentCard**: `GET http://localhost:18789/.well-known/agent.json`
- **A2A RPC**: `POST http://localhost:18789/a2a`

Test example:

```bash
curl -X POST http://localhost:18789/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/send",
    "params": {
      "id": "test-task",
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Hello"}]
      }
    },
    "id": 1
  }'
```

## Resources

- **Repository**: https://github.com/swoelffel/OpenClaw-a2a
- **Releases**: https://github.com/swoelffel/OpenClaw-a2a/releases
- **Technical Documentation**: See `README.md`
- **Report an Issue**: https://github.com/swoelffel/OpenClaw-a2a/issues

---

**Note for agents**: This file is optimized for automatic execution. Each code block can be run sequentially without human intervention.
