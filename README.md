# DroneQ

A lightweight and fast queue database server with WebSocket support for real-time data streaming.

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg)](https://www.buymeacofffee.com/thecodeguyy)

## Installation

```bash
npm install droneq
```

## Quick Start

```typescript
import { QDB, QDBServer } from 'droneq';

// Create a new QDB server
const server = new QDBServer("MyApp", {
    port: 3000,
});

// Create a new database instance
const db = new QDB("mydb", {
    username: "root",
    password: "",
});

// Mount the database to the server
server.mountDb(db);

// Start the server
server.listen();
```

## API Documentation

### QDBServer

The main server class that handles WebSocket connections and database management.

#### Constructor

```typescript
new QDBServer(name: string, options: {
    port: number;
    host?: string;
    path?: string;
})
```

- `name`: The name of your application
- `options`: Server configuration options
  - `port`: The port number to listen on
  - `host`: (Optional) The host to bind to (defaults to 'localhost')
  - `path`: (Optional) The WebSocket path (defaults to '/ws')

#### Methods

- `mountDb(db: QDB)`: Mount a database instance to the server
- `listen()`: Start the server and begin accepting connections

### QDB (Queue Database)

The database class that handles queue-based data storage and retrieval.

#### Constructor

```typescript
new QDB(name: string, options: {
    username: string;
    password: string;
})
```

- `name`: The name of your database
- `options`: Database configuration options
  - `username`: Database username
  - `password`: Database password

#### Queue Operations

The QDB class provides methods for queue-based operations:

- `enqueue(queueName: string, data: any)`: Add an item to the end of a queue
- `dequeue(queueName: string)`: Remove and return the first item from a queue
- `peek(queueName: string)`: View the first item in a queue without removing it
- `queueLength(queueName: string)`: Get the current length of a queue
- `clearQueue(queueName: string)`: Clear all items from a queue

## Features

- Queue-based data storage and retrieval
- WebSocket-based real-time communication
- SQLite backend for reliable data persistence
- TypeScript support with full type definitions
- Authentication support
- Event-based architecture
- Real-time queue updates to connected clients

## Use Cases

- Message queues
- Task processing systems
- Real-time data streaming
- Event logging
- Job scheduling
- Data buffering

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build the project
npm run build

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.