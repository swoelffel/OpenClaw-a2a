# OpenClaw A2A Protocol Extension

OpenClaw extension for agent-to-agent communication using the Google A2A Protocol.

## Installation

### Prerequisites

- OpenClaw installed and configured (v2026.1.0+)
- curl (for the install script)
- tar (to extract the archive)

> **For OpenClaw agents**: See [AGENT-INSTALL.md](AGENT-INSTALL.md) for instructions optimized for automated installation.

### Quick Install (Recommended)

Automatically install from the latest GitHub release:

```bash
curl -fsSL https://raw.githubusercontent.com/swoelffel/OpenClaw-a2a/main/scripts/install-a2a.sh | bash
```

Or with a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/swoelffel/OpenClaw-a2a/main/scripts/install-a2a.sh | bash -s v0.1.0
```

### Install from Release (Manual)

1. **Download the latest release** from [GitHub Releases](https://github.com/swoelffel/OpenClaw-a2a/releases)

2. **Extract the archive** to the OpenClaw extensions directory:

```bash
# Create the extensions directory
mkdir -p ~/.openclaw/extensions/a2a

# Extract the archive
tar -xzf openclaw-a2a-extension.tar.gz -C ~/.openclaw/extensions/a2a/
```

3. **Enable the extension** in your OpenClaw configuration (see Configuration section).

4. **Restart OpenClaw gateway**:

```bash
openclaw gateway restart
```

### Install from Source (Development)

For developers or if you want to modify the extension:

```bash
# Clone the repository
git clone https://github.com/swoelffel/OpenClaw-a2a.git
cd OpenClaw-a2a

# Install dependencies
npm install

# Build the extension
npm run build

# Copy to OpenClaw extensions
cp -r dist openclaw.plugin.json package.json ~/.openclaw/extensions/a2a/

# Restart the gateway
openclaw gateway restart
```

### Verify Installation

Check that the A2A endpoint is available:

```bash
# Get AgentCard
curl http://localhost:18789/.well-known/agent.json

# Should return JSON with agent information
```

## Configuration

Add to your OpenClaw configuration (`~/.openclaw/config.json` or via UI):

```json
{
  "plugins": {
    "a2a": {
      "enabled": true,
      "port": 0,
      "authToken": null,
      "agentName": "OpenClaw Agent",
      "agentDescription": "OpenClaw AI Agent with A2A support",
      "skills": [
        {
          "id": "general",
          "name": "General Assistance",
          "description": "Provides general assistance and answers questions"
        }
      ]
    }
  }
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable/disable the A2A extension |
| `port` | integer | Port for A2A server (0 = same as gateway) |
| `authToken` | string | Bearer token for authentication (optional) |
| `agentName` | string | Agent name displayed in AgentCard |
| `agentDescription` | string | Agent description |
| `skills` | array | List of skills exposed via A2A |

## Endpoints

The extension exposes the following endpoints on the OpenClaw gateway:

### AgentCard (Discovery)

```
GET /.well-known/agent.json
```

Response:
```json
{
  "name": "OpenClaw Agent",
  "description": "OpenClaw AI Agent with A2A support",
  "url": "https://gateway.example.com/a2a",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "skills": [...]
}
```

### A2A RPC

```
POST /a2a
```

#### tasks/send

Send a task to the agent:

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-123",
    "sessionId": "session-456",
    "message": {
      "role": "user",
      "parts": [{ "type": "text", "text": "Hello!" }]
    }
  },
  "id": "req-1"
}
```

#### tasks/get

Get task status:

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/get",
  "params": { "id": "task-123" },
  "id": "req-2"
}
```

#### tasks/cancel

Cancel a task:

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/cancel",
  "params": { "id": "task-123" },
  "id": "req-3"
}
```

## Usage Examples

### Using curl

```bash
# Get AgentCard
curl https://gateway.example.com/.well-known/agent.json

# Send a task
curl -X POST https://gateway.example.com/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/send",
    "params": {
      "id": "my-task-1",
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Hello!"}]
      }
    },
    "id": "1"
  }'

# Get task status
curl -X POST https://gateway.example.com/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/get",
    "params": {"id": "my-task-1"},
    "id": "2"
  }'
```

### Using the A2A Client

```typescript
import { createA2AClient } from '@openclaw/a2a';

const client = createA2AClient('https://gateway.example.com');

// Send a task
const task = await client.sendTask({
  id: 'task-1',
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Hello, agent!' }]
  }
});

// Get task status
const status = await client.getTask('task-1');
```

## Development

### Project Structure

```
extensions/a2a/
├── openclaw.plugin.json   # Plugin manifest
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Test configuration
├── index.ts               # Plugin entry point
├── src/
│   ├── models.ts          # Zod schemas for A2A
│   ├── rpc-handler.ts     # JSON-RPC handler
│   ├── task-manager.ts    # Task lifecycle management
│   ├── client.ts          # A2A HTTP client
│   └── integration.ts     # OpenClaw integration
└── tests/
    ├── models.test.ts     # Model tests
    ├── rpc-handler.test.ts # RPC handler tests
    ├── task-manager.test.ts # Task manager tests
    └── integration.test.ts # Integration tests
```

### Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build (compile TypeScript to JavaScript)
pnpm build
```

### Development & Testing Workflow

The development workspace is separate from the OpenClaw extensions directory.

#### 1. Development (in workspace)

```bash
cd ~/Projects/a2a

# Make changes to TypeScript files
# Run tests
pnpm test

# Build to generate .js files
pnpm build

# Commit and push
git add .
git commit -m "fix: description"
git push origin main
```

#### 2. Testing (in OpenClaw extensions)

```bash
# Remove old version
rm -rf ~/.npm-global/lib/node_modules/openclaw/extensions/a2a

# Clone fresh from GitHub
cd ~/.npm-global/lib/node_modules/openclaw/extensions
git clone https://github.com/swoelffel/OpenClaw-a2a.git a2a

# Install dependencies
cd a2a
pnpm install

# Build the extension
pnpm build

# Restart OpenClaw gateway
openclaw gateway restart

# Test
curl http://localhost:18789/.well-known/agent.json
```

## Testing

74 tests covering:
- **39 tests**: Models and Zod validation
- **11 tests**: RPC handler
- **15 tests**: Task Manager
- **9 tests**: Integration

Run tests:
```bash
cd extensions/a2a
pnpm test
```

Test output:
```
✓ tests/models.test.ts (39 tests)
✓ tests/rpc-handler.test.ts (11 tests)
✓ tests/task-manager.test.ts (15 tests)
✓ tests/integration.test.ts (9 tests)

Test Files 4 passed (4)
Tests 74 passed (74)
```

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please ensure:
- Tests pass (`pnpm test`)
- Code follows existing style
- Documentation is updated

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/swoelffel/OpenClaw-a2a/issues).
