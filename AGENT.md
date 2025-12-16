# QueueDB v2 — Features & Fixes Breakdown

## 1. Core Fixes (Stability First)

### 1.1 Initialization & DB Auto-Creation (Must-have)

**Problem**

* DB errors when file or tables don’t exist.

**Fix**

* On `new QueueDB(config)`:

  * Check if DB file exists
  * If not → create DB
  * Auto-run internal schema setup

**Behavior**

```ts
const qdb = new QueueDB({
  path: "./data/qdb.sqlite"
});
```

No setup scripts. Zero friction.

---

### 1.2 Schema Consistency & Corruption Protection

**Fix**

* Internal `__qdb_meta` table:

```sql
id | key | value
```

Used for:

* schema_version
* created_at
* last_migration
* data_lifetime_enabled

This prevents silent corruption and enables migrations.

---

## 2. Real Queue System (This is the heart)

### 2.1 Queue Table Design

```sql
__qdb_queue
- id (uuid)
- topic
- payload (json/text)
- status (pending | processing | done | failed)
- priority
- created_at
- updated_at
```

### 2.2 Atomic Queue Operations

* `enqueue(topic, payload)`
* `dequeue(topic, clientId)`
* `ack(id)`
* `fail(id, reason)`

**Critical detail**

* Use transactions + row locking
* One consumer gets one job
* No double-processing

This makes QueueDB usable for:

* background jobs
* realtime sync
* offline-first apps

---

## 3. Subscription System (Realtime-first)

### 3.1 Subscription Model (Socket-based)

You already chose the right approach.

**In-memory registry**

```ts
Map<
  socketId,
  {
    topics: string[]
    routes: string[]
  }
>
```

### 3.2 Subscribe API

```ts
qdb.subscribe(socket, {
  topic: "orders",
  route: "/orders/live"
});
```

### 3.3 Emit Logic

When data changes:

* Only emit to sockets subscribed to:

  * that topic
  * that route

This avoids broadcast spam and keeps it **fast**.

---

## 4. Data Lifetime & Expiration (Clean & Smart)

### 4.1 Data Log File (Excellent call)

Instead of bloating DB, you use a log.

**Example:**

```json
{
  "id": "data-id",
  "table": "orders",
  "createdAt": 1730000000,
  "expiresAt": 1730864000
}
```

Stored as:

* JSONL (append-only)
* OR SQLite lightweight log table (optional)

### 4.2 Cron-based Cleaner

* Internal scheduler (node-cron or setInterval)
* Reads log
* Deletes expired data
* Cleans log entry after delete

```ts
qdb.enableDataLifetime({
  defaultTTL: "7d",
  checkInterval: "1h"
});
```

No runtime DB scanning. Very efficient.

---

## 5. Data Migration (DB Size Control)

### 5.1 Migration Goals

* Prevent massive SQLite files
* Allow safe upgrades
* Allow partial data offloading

### 5.2 Migration Engine

```ts
qdb.migrate({
  fromVersion: 1,
  toVersion: 2,
  up(db) {},
  down(db) {}
});
```

### 5.3 Data Archival Strategy (v2)

* Move old data → archive DB file
* Keep primary DB lean
* Optional gzip archive

```ts
qdb.archive({
  olderThan: "30d",
  to: "./archive/"
});
```

This alone is a **huge differentiator**.

---

## 6. UI Hosting Feature (Flagship Feature)

This is your **killer feature**.

### 6.1 Middleware API

```ts
app.use(
  "/db/management",
  qdb.dbManager({
    auth: {
      table: "admins",
      usernameField: "username",
      passwordField: "password",
      hash: "bcrypt"
    }
  })
);
```

---

### 6.2 Auth Model (User-defined Tables)

* You do NOT own auth
* You just read it

Supports:

* Any table
* Any field names
* Any hashing algorithm

Optional:

```ts
auth: {
  users: [
    { username: "admin", password: "hashed" }
  ]
}
```

---

### 6.3 UI Capabilities (v2 Scope)

* Login screen (phpMyAdmin-like)
* Tables list
* Row viewer
* JSON editor
* Queue inspector
* Live updates (via socket)
* Delete / truncate / export

**No SQL console in v2** (security)

---

### 6.4 UI Tech Choice

Best options:

* Vite + React
* Embedded static build
* Served internally by QueueDB

No external hosting required.

---

## 7. Existing DB Driver Compatibility (Lite Version)

Since full multi-DB is v3, v2 should do this:

### 7.1 Adapter Interface

```ts
interface QDBAdapter {
  query(sql, params)
  transaction(fn)
}
```

### 7.2 Default Adapter

* SQLite adapter (current)

### 7.3 Custom Adapter Hook

```ts
new QueueDB({
  adapter: myAdapter
});
```

Enough to prepare for v3 without overengineering.

---

## 8. DX Improvements (Extremely Important)

### 8.1 CLI Tool

```bash
npx queuedb init
npx queuedb migrate
npx queuedb ui
```

### 8.2 Types & IntelliSense

* Strong TS types for payloads
* Topic-based generics:

```ts
qdb.enqueue<"orders">({ id, amount })
```

---

## 9. Groundbreaking Improvements (Real Value)

### 9.1 Embedded DB Hosting Vision

QueueDB becomes:

> “Firebase-lite but local”

* DB
* Queue
* Realtime
* Admin UI
* Auth bridge

On **one server**, zero vendor lock-in.

---

### 9.2 Zero-Config Realtime Sync

```ts
qdb.sync("orders").toSockets();
```

You’re basically building:

* SQLite + Redis + Firebase
* in one package

That’s not common. At all.

---

## 10. Suggested Versioning

### v2.0

* Real queue
* UI hosting
* Auth tables
* Subscriptions
* Data lifetime
* Migrations

### v2.1

* UI permissions
* Export/import
* Metrics

### v3.0

* Multi-DB adapters
* Distributed queues