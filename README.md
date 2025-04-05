# QueueDB

A lightweight and fast queue database server with WebSocket support for real-time data streaming.

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg)](https://www.buymeacoffee.com/thecodeguyy)

## Installation

```bash
npm install queuedb
```

## Quick Start

```typescript
import { QDB, QDBServer } from 'queuedb';

// Create a new QDB server
const server = new QDBServer("MyApp", {
    port: 3000,
});

// Create a new database instance
const db = new QDB("mydb", {
    username: "root",
    password: "",
});

// use interceptors (Optional)
server.intercept("/mydb", (data) => {
    // do something
})

// Mount the database to the server
server.mountDb(db);

// Start the server
server.listen();
```

## Interceptors

QDB provides a powerful interceptor system that allows you to intercept and modify database operations before they are executed. This is useful for implementing middleware-like functionality such as authentication, logging, data validation, and more.

### Basic Usage

```typescript
// Create a new QDB server
const server = new QDBServer("MyApp", {
    port: 3000,
});

// Create a new database instance
const db = new QDB("mydb", {
    username: "root",
    password: "",
});

// Add an interceptor for all operations on the "mydb" database
server.intercept("/mydb", (operation) => {
    // Log the operation
    console.log(`Operation on mydb: ${operation.method}`);
    
    // You can modify the operation before it's executed
    if (operation.method === "POST") {
        // Add a timestamp to all new records
        operation.data = operation.data.map(record => ({
            ...record,
            createdAt: new Date().toISOString()
        }));
    }
    
    // Return the modified operation
    return operation;
});

// Mount the database to the server
server.mountDb(db);
```

### Interceptor Function Parameters

The interceptor function receives an operation object with the following properties:

- `method`: The HTTP method being used (GET, POST, PUT, DELETE)
- `type`: The operation type (query or subscribe)
- `data`: The data being sent (for POST/PUT operations)
- `columns`: The table schema (for PUT operations)
- `throwOnError`: Whether errors should be thrown
- `interval`: The subscription interval (for subscribe operations)

### Multiple Interceptors

You can add multiple interceptors for the same database. They will be executed in the order they were added:

```typescript
// First interceptor - Authentication
server.intercept("/mydb", (operation) => {
    // Check authentication
    if (!isAuthenticated(operation)) {
        throw new Error("Unauthorized");
    }
    return operation;
});

// Second interceptor - Logging
server.intercept("/mydb", (operation) => {
    // Log the operation
    console.log(`Authenticated operation: ${operation.method}`);
    return operation;
});
```

### Error Handling

You can throw errors in interceptors to prevent operations from being executed:

```typescript
server.intercept("/mydb", (operation) => {
    if (operation.method === "DELETE") {
        throw new Error("Delete operations are not allowed");
    }
    return operation;
});
```

### Best Practices

1. **Keep interceptors lightweight**: Interceptors are executed for every operation, so they should be as efficient as possible.
2. **Chain modifications**: Return the modified operation object to allow other interceptors to process it.
3. **Use for cross-cutting concerns**: Interceptors are perfect for implementing features that need to be applied across multiple operations.
4. **Handle errors appropriately**: Use throwOnError to control error behavior.

## WebSocket API Documentation

QDB provides a powerful WebSocket API that allows direct communication with the database server. You can connect to the WebSocket server using the following URL format:

```
ws://localhost:3000/{db_name}/{table_name}
```

or

```
ws://localhost:3000/{db_name}/{table_name}/{primary_key_value}
```

### Message Types

There are two main types of messages:

1. `query` - One-time operations that execute and return results
2. `subscribe` - Continuous operations that listen for changes based on an interval

### HTTP Methods

The API supports the following HTTP methods:

- `PUT` - Creates a new table and can load initial data
- `GET` - Retrieves data from a table or a single row based on the route
- `DELETE` - Deletes a row, table, or database based on the route
- `POST` - Used to populate data into an existing table
- `PATCH` - (Reserved for future use)

### Message Format Examples

#### 1. Creating a Table (PUT)

```json
{
    "type": "query",
    "method": "PUT",
    "throwOnError": true,
    "columns": [
        { "name": "uid", "type": "INTEGER", "constraints": [ "PRIMARY KEY" ] },
        { "name": "model", "type": "TEXT" },
        { "name": "name", "type": "TEXT" }
    ],
    "data": [
        {
            "uid": 1,
            "model": "Genesys",
            "name": "Brian"
        }
    ]
}
```

#### 2. Subscribing to Updates (GET)

```json
{
    "type": "subscribe",
    "method": "GET",
    "throwOnError": false,
    "interval": 1000,  // Optional: polling interval in milliseconds
    "timeout": 60000   // Optional: subscription timeout in milliseconds
}
```

#### 3. Adding Data (POST)

```json
{
    "type": "query",
    "method": "POST",
    "throwOnError": true,
    "data": [
        {
            "uid": 1,
            "model": "Genesys",
            "name": "Brian"
        }
    ],
    "onConflict": "REPLACE"  // Optional: conflict resolution strategy
}
```

#### 4. Deleting Data (DELETE)

```json
{
    "type": "query",
    "method": "DELETE",
    "throwOnError": true
}
```

### Testing the API

1. **Using WebSocket Client**
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/mydb/users');

   ws.onopen = () => {
     // Create a new table
     ws.send(JSON.stringify({
       type: 'query',
       method: 'PUT',
       throwOnError: true,
       columns: [
         { "name": "id", "type": "INTEGER", "constraints": [ "PRIMARY KEY" ] },
         { "name": "name", "type": "TEXT" }
       ]
     }));
   };

   ws.onmessage = (event) => {
     const response = JSON.parse(event.data);
     console.log('Received:', response);
   };
   ```

### Route Examples

1. **Get All Records**

   ```
   ws://localhost:3000/mydb/users
   ```
2. **Get Single Record**

   ```
   ws://localhost:3000/mydb/users/1
   ```
3. **Delete Record**

   ```
   ws://localhost:3000/mydb/users/1
   ```
4. **Delete Table**

   ```
   ws://localhost:3000/mydb/users
   ```
5. **Delete Database**

   ```
   ws://localhost:3000/mydb
   ```

### Best Practices

1. **Error Handling**

   - Set `throwOnError: true` for critical operations
   - Set `throwOnError: false` for subscription operations to prevent connection drops
   - Always check the response's `success` field and handle `error` messages
2. **Subscriptions**

   - Use subscriptions for real-time updates
   - Set appropriate `interval` values (default: 1000ms)
   - Use `timeout` to automatically clean up long-running subscriptions
   - Clean up subscriptions when no longer needed
3. **Data Operations**

   - Use PUT for table creation and initial data
   - Use POST for adding data to existing tables
   - Use DELETE with caution, especially for table/database deletion
   - Use `onConflict` option to handle duplicate entries
4. **Performance**

   - Batch operations when possible
   - Use appropriate indexes for frequently queried columns
   - Monitor subscription intervals
   - Clean up unused subscriptions

### Response Format

All responses follow this general format:

```json
{
    "success": true/false,
    "data": {}, // or [] for multiple results
    "error": null // or error message if success is false
}
```

### Error Messages

Common error messages you might encounter:

- `Database '{db_name}' not found`
- `Table '{table_name}' does not exist`
- `Table '{table_name}' already exists`
- `No data provided`
- `Column name '{name}' is not allowed`
- `Route of '{route}' is not associated with any table or alias`

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
{
    "type": "query",
    "method": "PUT",
    "throwOnError": true,
    "columns": [
        { "name": "uid", "type": "INTEGER", "constraints": [ "PRIMARY KEY" ] },
        { "name": "model", "type": "TEXT" },
        { "name": "name", "type": "TEXT" }
    ],
    "data": [
        {
            "uid": 1,
            "model": "Genesys",
            "name": "Brian"
        },
        {
            "uid": 2,
            "model": "Exodus",
            "name": "Brian"
        },
        {
            "uid": 3,
            "model": "Neo",
            "name": "Brian"
        }
    ]
}# Install dependencies
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
