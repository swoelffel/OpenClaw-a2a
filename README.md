# OpenClaw A2A Protocol Extension

Extension OpenClaw pour la communication agent-to-agent via le protocole A2A (Google).

## Installation

L'extension est automatiquement chargée avec OpenClaw si elle est activée dans la configuration.

## Configuration

Dans votre configuration OpenClaw (`~/.openclaw/config.json` ou via l'interface UI) :

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

### Options de configuration

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Activer/désactiver l'extension A2A |
| `port` | integer | Port pour le serveur A2A (0 = même que gateway) |
| `authToken` | string | Token Bearer pour l'authentification (optionnel) |
| `agentName` | string | Nom de l'agent affiché dans l'AgentCard |
| `agentDescription` | string | Description de l'agent |
| `skills` | array | Liste des skills exposés via A2A |

## Endpoints

L'extension expose les endpoints suivants sur le gateway OpenClaw :

### AgentCard (Découverte)

```
GET /.well-known/agent.json
```

Réponse :
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

### RPC A2A

```
POST /a2a
```

#### tasks/send

Envoyer une tâche à l'agent :

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

Récupérer le statut d'une tâche :

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/get",
  "params": { "id": "task-123" },
  "id": "req-2"
}
```

#### tasks/cancel

Annuler une tâche :

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/cancel",
  "params": { "id": "task-123" },
  "id": "req-3"
}
```

## Exemple d'utilisation avec curl

```bash
# Récupérer l'AgentCard
curl https://gateway.example.com/.well-known/agent.json

# Envoyer une tâche
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

# Récupérer le statut
curl -X POST https://gateway.example.com/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/get",
    "params": {"id": "my-task-1"},
    "id": "2"
  }'
```

## Développement

### Structure du projet

```
extensions/a2a/
├── openclaw.plugin.json   # Manifest du plugin
├── package.json           # Dépendances
├── tsconfig.json          # Configuration TypeScript
├── vitest.config.ts       # Configuration des tests
├── index.ts               # Point d'entrée du plugin
├── src/
│   ├── models.ts          # Schémas Zod A2A
│   ├── rpc-handler.ts     # Gestionnaire JSON-RPC
│   ├── task-manager.ts    # Gestion du cycle de vie des tâches
│   ├── client.ts          # Client HTTP A2A
│   └── integration.ts     # Intégration avec OpenClaw
└── tests/
    ├── models.test.ts     # Tests des modèles
    ├── rpc-handler.test.ts # Tests du handler RPC
    ├── task-manager.test.ts # Tests du task manager
    └── integration.test.ts # Tests d'intégration
```

### Commandes

```bash
# Installer les dépendances
pnpm install

# Lancer les tests
pnpm test

# Lancer les tests avec couverture
pnpm test:coverage

# Build
pnpm build
```

## Tests

74 tests répartis en :
- **39 tests** : Modèles et validation Zod
- **11 tests** : Handler RPC
- **15 tests** : Task Manager
- **9 tests** : Intégration

Pour lancer les tests :
```bash
cd extensions/a2a
pnpm test
```

## License

MIT
