# QDB v2: Real-time Queuing Database

QDB is a lightweight, local-first Real-time Queuing Database designed to be a "Firebase-lite" for your Node.js projects. It combines a JSON-based database, a robust job queue, real-time WebSocket subscriptions, and an admin UI into a single zero-dependency (almost) package.

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg)](https://www.buymeacoffee.com/thecodeguyy)

## Features

- **Store**: Simple JSON-based tables with SQL-like queries (powered by SQLite).
- **Queue**: Built-in job queue with atomic `enqueue`, `dequeue`, `ack`, and `fail` operations.
- **Real-time**: WebSocket subscriptions to tables or specific topics. No polling required.
- **Data Lifetime**: Auto-expire data with a built-in TTL system.
- **Migration**: Tools to migrate schema and archive old data to keep things fast.
- **UI Hosting**: Serve your own React-based Admin UI directly from the database server.
- **CLI**: Native CLI for management (`qdb init`, `qdb migrate`, `qdb start`).

## Installation

```bash
npm install queuedb
```

## Quick Start (CLI)

Initialize and run QDB in seconds:

```bash
# Initialize a new database
npx qdb init my_project

# Start the server
npx qdb start my_project --port 3000
```

## Core Usage (SDK)

```typescript
import { QDB, QDBServer } from 'queuedb';

// 1. Setup Database
const db = new QDB("my_project", {});
await db.init(); // Creates tables and queue system

// 2. Queue Operations
await db.enqueue('email_notifications', { userId: 1, type: 'welcome' });

// 3. Worker / Consumer
const job = await db.dequeue('worker_client_1');
if (job.success && job.data) {
    console.log("Processing:", job.data);
    // ... work ...
    await db.ack(job.data.id);
}

// 4. Start Server for Realtime Access
const server = new QDBServer("main", { port: 3000 });
server.mountDb(db);
server.listen();
```

## Real-time Subscriptions (WebSocket)

Clients can connect via WebSocket to receive updates instantly.

**Connect:**
`ws://localhost:3000`

**Subscribe:**
Send a JSON message:
```json
{
    "type": "subscribe",
    "method": "GET",
    "route": "/my_project/users"
}
```

**Receive Updates:**
You will receive a message whenever data changes in the subscribed route.

## Admin UI

QDB can host a web-based Admin UI (e.g., a React app).
By default, the middleware serves files from `dist/ui` at the `/admin` route.

## CLI Commands

- `qdb init <name>`: Create new DB structure.
- `qdb start <name>`: Start the QDB server.
- `qdb migrate <name>`: Run schema migrations.
- `qdb archive <name> <table> <days>`: Move old data to archive files.

## License

MIT
