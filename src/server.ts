import QDB from "./services/qdb";
import { QDBServerOptions, QDBServerQuery, QDBServerResponse } from "./interfaces/server";
import { createServer, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { QDBServerRequestType, QDBServerType, TableConflictOptions } from "./core/enums";
import { QDBRoute } from "./interfaces/qdb";
import { TABLE_NAMES_NOTALLOWED } from "./core/values";
import { QDBTableData } from "./interfaces/tables";
import { dbManager } from "./middleware/dbManager";

class QDBServer {
    private name: string;
    private port: number;
    private dbs: { path: string; db: QDB, routes: QDBRoute[] }[];
    private server: Server;
    private clients: Set<WebSocket>;
    private subs: Map<WebSocket, { topic: string, route: string }[]> = new Map();
    private conn: WebSocketServer;
    private interceptors: { path: string; handler: (data: QDBServerQuery) => Promise<QDBServerResponse | any>, next?: boolean }[];
    private options: QDBServerOptions;

    constructor(name: string, options: QDBServerOptions) {
        this.name = name;
        this.port = options.port ?? 3000;
        this.options = options;
        this.dbs = [];
        this.server = options.server ?? createServer();
        this.conn = new WebSocketServer({ server: this.server });
        this.clients = new Set();
        this.interceptors = [];
        this.subs = new Map();

        this.setupConnection();
    }

    private setupConnection() {
        // Integrate Admin UI Middleware
        this.server.on('request', (req, res) => {
            const handled = dbManager(req, res);
            if (!handled && !this.options.server) {
                // If we own the server and UI didn't handle it, and it's not a WS upgrade (handled separately?), return 404?
                // actually WS upgrade doesn't fire 'request' event usually?
                // Wait, 'request' is for HTTP.
                // If I own the server (created it), I should 404.
                // If user passed server, I probably shouldn't close response if not handled.
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        this.conn.on('connection', (ws: WebSocket, request) => {
            this.clients.add(ws);
            this.subs.set(ws, []); // Initialize subscriptions for this client
            console.log(`New client connected to QDB from ${request.socket.remoteAddress} 🚀`);

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message);
                    this.handleRequests(ws, data, request.url ?? "");
                } catch (error) {
                    console.error('Error parsing message:', error);
                    ws.send(JSON.stringify({ error: 'Invalid Query format' }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                this.subs.delete(ws);
                console.log('Client disconnected');
            });

            ws.on('error', (error) => {
                console.error('Connection error:', error);
                this.clients.delete(ws);
                this.subs.delete(ws);
            });
        });
    }

    private async handleRequests(ws: WebSocket, data: QDBServerQuery, url: string) {
        try {
            const options = url.split("?");
            const requestRoutes = url.split("/").slice(1, url.split("/").length);

            if (requestRoutes.length < 1) {
                ws.send(JSON.stringify({ error: `Invalid Query...` })); // Truncated for brevity, keeping original logic if preferred but cleaning up
                return;
            }

            // Interceptors logic...
            const interceptor = this.interceptors.find(interceptor => interceptor.path === requestRoutes[0]);
            if (interceptor) {
                const response = await interceptor.handler(data);
                if (response) {
                    if (!interceptor.next) {
                        ws.send(JSON.stringify(response));
                        return;
                    }
                }
            }

            const methodHandlers: Partial<Record<QDBServerRequestType, (ws: WebSocket, routes: string[], data: QDBServerQuery) => Promise<QDBServerResponse>>> = {
                [QDBServerRequestType.GET]: this.handleGet.bind(this),
                [QDBServerRequestType.POST]: this.handlePost.bind(this),
                [QDBServerRequestType.DELETE]: this.handleDelete.bind(this),
                [QDBServerRequestType.PATCH]: this.handlePatch.bind(this),
                [QDBServerRequestType.PUT]: this.handlePut.bind(this),
                [QDBServerRequestType.ALL]: this.handleGet.bind(this)
            };

            const handler = methodHandlers[data.method];
            if (!handler) {
                ws.send(JSON.stringify({
                    success: false,
                    error: 'Unsupported method type...',
                    data: {}
                }));
                return;
            }

            // Handle SUBSCRIBE
            if (data.type === QDBServerType.SUBSCRIBE) {
                // Register subscription
                const topic = requestRoutes[1] || "*"; // Default to all if no table specified? Or specific syntax?
                // Assuming route structure: /db/table
                const route = requestRoutes.join("/");

                const currentSubs = this.subs.get(ws) || [];
                currentSubs.push({ topic, route }); // Detailed filtering logic can be added
                this.subs.set(ws, currentSubs);

                ws.send(JSON.stringify({ success: true, message: `Subscribed to ${route}` }));
                return;
            }

            // Handle Normal Requests
            const response = await handler(ws, requestRoutes, data);

            // If the request was a POST/PUT/DELETE, we should broadcast the change
            if (data.method === QDBServerRequestType.POST || data.method === QDBServerRequestType.PUT || data.method === QDBServerRequestType.DELETE) {
                // Determine topic/route affected
                const route = requestRoutes.join("/");
                // Broadcast the new data or the event
                this.broadcast(route, { type: 'update', method: data.method, data: response.data, route });
            }

            ws.send(JSON.stringify(response));

        } catch (error) {
            console.log(error);
            ws.send(JSON.stringify({ error: 'Invalid Request: ' + error }));
        }
    }

    private async handleGet(ws: WebSocket, routes: string[], data: QDBServerQuery): Promise<QDBServerResponse> {
        const requestedDb = routes[0];

        // check if there's any mounted db with the requested db name
        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if (!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        if (routes.length > 1) {
            const requestedRoute = routes[1];

            // check if method is GET
            // if(data.method === QdbServerRequestType.GET) {
            const tableExists = mountedDb.db.tables.find(table => table.name === requestedRoute);
            const tableAlias = mountedDb.routes.find(route => route.path === requestedRoute);

            // if table does not exist, check if there's an alias that carries the requested route name
            if (tableExists) {
                // get the data from the table
                const tableData: QDBTableData = await mountedDb.db.getTableData(tableExists);

                // check if there's a primary key value
                if (routes.length > 2) {
                    const requestedPrimaryKeyID = routes[2];

                    if (tableData.data.length > 0) {
                        // check if the table has the requested primary key
                        const filteredData = tableData.data.filter((item: any) => item[tableData.primaryKey].toString() === requestedPrimaryKeyID.toString());

                        return {
                            success: true,
                            data: filteredData
                        };
                    } else {
                        return {
                            success: false,
                            error: `Table '${requestedRoute}' is empty`,
                            data: {}
                        };
                    }
                }
                return {
                    success: true,
                    data: tableData.data
                };
            } else if (tableAlias) {
                // get the data from the alias
                return {
                    success: true,
                    data: {}
                };
            } else {
                return {
                    success: false,
                    error: `Route of '${requestedRoute}' is not associated with any table or alias, Try creating a table or alias for '${requestedRoute}'`,
                    data: {}
                };
            }
        }

        return {
            success: true,
            data: {}
        }
    }

    private async handlePost(ws: WebSocket, routes: string[], data: QDBServerQuery): Promise<QDBServerResponse> {
        // check if the table exists
        const requestedDb = routes[0];
        const requestedTable = routes[1];

        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if (!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        const tableExists = mountedDb.db.tables.find(table => table.name === requestedTable);
        if (!tableExists) {
            return {
                success: false,
                error: `Table '${requestedTable}' does not exist, Please create the table first`,
                data: {}
            };
        }

        // if no data is included in the request, return an error
        if (!data.data) {
            return {
                success: false,
                error: `No data provided, Please provide data to insert into the table`,
                data: {}
            };
        }

        // check if the table name is not in the list of not allowed table names
        data.data.forEach((item: any) => {
            if (TABLE_NAMES_NOTALLOWED.includes(item.name)) {
                return {
                    success: false,
                    error: `Column name '${item.name}' is not allowed, Please use a different name`,
                    data: {}
                };
            }
        });

        // if columns are not provided, use the columns from the request
        // if data is not provided, use the data from the request
        const insertedData = await mountedDb.db.insertData({
            name: requestedTable,
            data: data.data ?? [],
            onConflict: data.onConflict ?? TableConflictOptions.REPLACE
        });

        if (!insertedData.success) {
            return {
                success: false,
                error: insertedData.error,
                data: {}
            };
        }

        return {
            success: true,
            data: insertedData.data
        }
    }

    private async handlePut(ws: WebSocket, routes: string[], data: QDBServerQuery): Promise<QDBServerResponse> {
        // check if the table exists
        const requestedDb = routes[0];
        const requestedTable = routes[1];

        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if (!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        const tableExists = mountedDb.db.tables.find(table => table.name === requestedTable);
        if (tableExists) {
            return {
                success: false,
                error: `Table '${requestedTable}' already exists`,
                data: {}
            };
        }

        // create the table if the table name is not in the list of not allowed table names
        if (TABLE_NAMES_NOTALLOWED.includes(requestedTable)) {
            return {
                success: false,
                error: `Table name '${requestedTable}' is not allowed, Please use a different name`,
                data: {}
            };
        }

        // check if the table name is not in the list of not allowed table names
        if (data.data) {
            data.data.forEach((item: any) => {
                if (TABLE_NAMES_NOTALLOWED.includes(item.name)) {
                    return {
                        success: false,
                        error: `Column name '${item.name}' is not allowed, Please use a different name`,
                        data: {}
                    };
                }
            });
        }

        // if columns are not provided, use the columns from the request
        // if data is not provided, use the data from the request
        const createdTable = await mountedDb.db.createTable({
            name: requestedTable,
            columns: data.columns ?? [],
            data: data.data ?? [],
        });

        if (!createdTable.success) {
            return {
                success: false,
                error: createdTable.error,
                data: {}
            };
        }

        return {
            success: true,
            data: {}
        }
    }

    private async handleDelete(ws: WebSocket, routes: string[], data: QDBServerQuery): Promise<QDBServerResponse> {
        const requestedDb = routes[0];

        // check if there's any mounted db with the requested db name
        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if (!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        if (routes.length > 1) {
            const requestedRoute = routes[1];

            // check if method is GET
            // if(data.method === QdbServerRequestType.GET) {
            const tableExists = mountedDb.db.tables.find(table => table.name === requestedRoute);
            const tableAlias = mountedDb.routes.find(route => route.path === requestedRoute);

            // if table does not exist, check if there's an alias that carries the requested route name
            if (tableExists) {
                // get the data from the table
                const tableData: QDBTableData = await mountedDb.db.getTableData(tableExists);

                // check if there's a primary key value
                if (routes.length > 2) {
                    const requestedPrimaryKeyID = routes[2];

                    const deletedData = await mountedDb.db.deleteDataByPrimaryKey({
                        name: requestedRoute,
                        primaryKey: {
                            key: tableData.primaryKey,
                            value: requestedPrimaryKeyID
                        }
                    });

                    if (deletedData.success) {
                        return {
                            success: true,
                            data: deletedData.data
                        };
                    }

                    return {
                        success: false,
                        error: deletedData.error,
                        data: {}
                    };
                }

                // delete the table
                const deletedTable = await mountedDb.db.deleteTable({
                    name: requestedRoute
                });

                // remove the table from the list of tables in the qdb
                const tableIndex = mountedDb.db.tables.findIndex((item) => item.name === requestedRoute);

                if (tableIndex !== -1) {
                    this.dbs.find(db => db.path === requestedDb)?.db.tables.splice(tableIndex, 1);
                }

                return {
                    success: true,
                    data: deletedTable.data,
                };
            } else if (tableAlias) {
                // get the data from the alias
                return {
                    success: true,
                    data: {}
                };
            } else {
                return {
                    success: false,
                    error: `Route of '${requestedRoute}' is not associated with any table or alias, Try creating a table or alias for '${requestedRoute}'`,
                    data: {}
                };
            }
        }

        // delete the db
        const deletedDb = await mountedDb.db.deleteDb({
            name: requestedDb
        });

        if (deletedDb.success) {
            return {
                success: true,
                data: deletedDb.data
            };
        }

        return {
            success: false,
            error: deletedDb.error,
            data: {}
        }
    }

    private async handlePatch(ws: WebSocket, routes: string[], data: QDBServerQuery): Promise<QDBServerResponse> {
        return {
            success: true,
            data: {}
        }
    }

    public broadcast(route: string, message: any) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                const subscriptions = this.subs.get(client);
                if (subscriptions) {
                    // Check if client is subscribed to this route or parent
                    // Simple implementation: exact match or prefix match
                    const isSubscribed = subscriptions.some(sub => route.startsWith(sub.route));
                    if (isSubscribed) {
                        client.send(messageStr);
                    }
                }
            }
        });
    }

    public mountDb(db: QDB, alias?: string, routes?: QDBRoute[]) {
        this.dbs.push({ path: alias || db.name, db, routes: routes || [] });
    }

    public intercept(path: string, handler: (data: QDBServerQuery) => Promise<QDBServerResponse | any>, next?: boolean) {
        this.interceptors.push({ path, handler, next });
    }

    async listen(callback?: () => void) {
        if (this.server.listening) {
            if (callback) {
                callback();
                return;
            }
            console.log(`QDB Server is active on main port`);
            return;
        }

        this.server.listen(this.port, () => {
            if (callback) {
                callback();
                return;
            }
            console.log(`QDB Server is running on port ${this.port}`);
        });
    }
}

export default QDBServer;