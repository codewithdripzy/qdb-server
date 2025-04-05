import QDB from "./services/qdb";
import { QDBServerOptions, QDBServerQuery, QDBServerResponse } from "./interfaces/server";
import { createServer, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { QDBServerRequestType, QDBServerType, TableConflictOptions } from "./core/enums";
import { QDBRoute } from "./interfaces/qdb";
import { TABLE_NAMES_NOTALLOWED } from "./core/values";
import { QDBTableData } from "./interfaces/tables";

class QDBServer {
    private name: string;
    private port: number;
    private dbs: { path: string; db: QDB, routes: QDBRoute[] }[];
    private server: Server;
    private clients: Set<WebSocket>;
    private conn: WebSocketServer;
    private interceptors: { path: string; handler: (data: QDBServerQuery) => Promise<QDBServerResponse | any>, next?: boolean }[];

    constructor(name: string, options: QDBServerOptions) {
        this.name = name;
        this.port = options.port ?? 3000;
        this.dbs = [];
        this.server = options.server ?? createServer();
        this.conn = new WebSocketServer({ server: this.server });
        this.clients = new Set();
        this.interceptors = [];

        this.setupConnection();
    }

    private setupConnection() {
        this.conn.on('connection', (ws: WebSocket, request) => {
            this.clients.add(ws);
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
                console.log('Client disconnected');
            });

            ws.on('error', (error) => {
                console.error('Connection error:', error);
                this.clients.delete(ws);
            });
        });
    }

    private async handleRequests(ws: WebSocket, data: QDBServerQuery, url: string) {
        try {
            // const extract the queries seperated by ? in the url
            const options = url.split("?");

            // get the route of the ws connection we only need this `ws://localhost:3000/${db_name}/${table_name}` or `ws://localhost:3000/${db_name}/${table_name}/${primary_key_value}`
            const requestRoutes = url.split("/").slice(1, url.split("/").length);
            
            if(requestRoutes.length < 1) {
                ws.send(JSON.stringify({ error: `Invalid Query, Query must be like this: 'ws://localhost:3000/{db_name}/{table_name}' or 'ws://localhost:3000/{db_name}/{table_name}/{primary_key_value}'` }));
                return;
            }

            // check if there's an interceptor for the request
            const interceptor = this.interceptors.find(interceptor => interceptor.path === requestRoutes[0]);
            if(interceptor) {
                const response = await interceptor.handler(data);
                if(response) {
                    if(!interceptor.next) {
                        ws.send(JSON.stringify(response));
                        return;
                    }
                }
            }

            // Map of HTTP methods to their handlers
            const methodHandlers: Partial<Record<QDBServerRequestType, (ws: WebSocket, routes: string[], data: QDBServerQuery) => Promise<QDBServerResponse>>> = {
                [QDBServerRequestType.GET]: this.handleGet.bind(this),
                [QDBServerRequestType.POST]: this.handlePost.bind(this),
                [QDBServerRequestType.DELETE]: this.handleDelete.bind(this),
                [QDBServerRequestType.PATCH]: this.handlePatch.bind(this),
                [QDBServerRequestType.PUT]: this.handlePut.bind(this), // PUT is handled the same as POST
                [QDBServerRequestType.ALL]: this.handleGet.bind(this)   // ALL defaults to GET behavior
            };

            const handler = methodHandlers[data.method];
            if (!handler) {
                ws.send(JSON.stringify({
                    success: false,
                    error: 'Unsupported method type, try using GET, POST, PUT, DELETE, PATCH or ALL',
                    data: {}
                }));
                return;
            }

            if (data.type === QDBServerType.SUBSCRIBE) {
                const interval = data.interval ?? 1000;
                const intervalId = setInterval(async () => {
                    const response = await handler(ws, requestRoutes, data);
                    ws.send(JSON.stringify(response));

                    if(data.throwOnError && response.success === false) {
                        clearInterval(intervalId);
                    }
                }, interval)

                if (data.timeout) {
                    setTimeout(() => {
                        clearInterval(intervalId);
                    }, data.timeout);
                }
            } else {
                const response = await handler(ws, requestRoutes, data);
                ws.send(JSON.stringify(response));
            }
            
        } catch (error) {
            console.log(error);
            ws.send(JSON.stringify({ error: 'Invalid Request: ' + error }));
        }
    }

    private async handleGet(ws: WebSocket, routes: string[], data: QDBServerQuery) : Promise<QDBServerResponse>{
        const requestedDb = routes[0];

        // check if there's any mounted db with the requested db name
        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if(!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        if(routes.length > 1) {
            const requestedRoute = routes[1];

            // check if method is GET
            // if(data.method === QdbServerRequestType.GET) {
            const tableExists = mountedDb.db.tables.find(table => table.name === requestedRoute);
            const tableAlias = mountedDb.routes.find(route => route.path === requestedRoute);

            // if table does not exist, check if there's an alias that carries the requested route name
            if(tableExists) {
                // get the data from the table
                const tableData: QDBTableData = await mountedDb.db.getTableData(tableExists);
                
                // check if there's a primary key value
                if(routes.length > 2) {
                    const requestedPrimaryKeyID = routes[2];

                    if(tableData.data.length > 0) {
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
            } else if(tableAlias) {
                // get the data from the alias
                return {
                    success: true,
                    data: {}
                };
            }else {
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

    private async handlePost(ws: WebSocket, routes: string[], data: QDBServerQuery) : Promise<QDBServerResponse>{
        // check if the table exists
        const requestedDb = routes[0];
        const requestedTable = routes[1];

        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if(!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        const tableExists = mountedDb.db.tables.find(table => table.name === requestedTable);
        if(!tableExists) {
            return {
                success: false,
                error: `Table '${requestedTable}' does not exist, Please create the table first`,
                data: {}
            };
        }

        // if no data is included in the request, return an error
        if(!data.data) {
            return {
                success: false,
                error: `No data provided, Please provide data to insert into the table`,
                data: {}
            };
        }

        // check if the table name is not in the list of not allowed table names
        data.data.forEach((item: any) => {
            if(TABLE_NAMES_NOTALLOWED.includes(item.name)) {
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

        if(!insertedData.success) {
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

    private async handlePut(ws: WebSocket, routes: string[], data: QDBServerQuery) : Promise<QDBServerResponse>{
        // check if the table exists
        const requestedDb = routes[0];
        const requestedTable = routes[1];

        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if(!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        const tableExists = mountedDb.db.tables.find(table => table.name === requestedTable);
        if(tableExists) {
            return {
                success: false,
                error: `Table '${requestedTable}' already exists`,
                data: {}
            };
        }

        // create the table if the table name is not in the list of not allowed table names
        if(TABLE_NAMES_NOTALLOWED.includes(requestedTable)) {
            return {
                success: false,
                error: `Table name '${requestedTable}' is not allowed, Please use a different name`,
                data: {}
            };
        }

        // check if the table name is not in the list of not allowed table names
        if(data.data) {
            data.data.forEach((item: any) => {
                if(TABLE_NAMES_NOTALLOWED.includes(item.name)) {
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

        if(!createdTable.success) {
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

    private async handleDelete(ws: WebSocket, routes: string[], data: QDBServerQuery) : Promise<QDBServerResponse>{
        const requestedDb = routes[0];

        // check if there's any mounted db with the requested db name
        const mountedDb = this.dbs.find(db => db.path === requestedDb);
        if(!mountedDb) {
            return {
                success: false,
                error: `Database '${requestedDb}' not found`,
                data: {}
            };
        }

        if(routes.length > 1) {
            const requestedRoute = routes[1];

            // check if method is GET
            // if(data.method === QdbServerRequestType.GET) {
            const tableExists = mountedDb.db.tables.find(table => table.name === requestedRoute);
            const tableAlias = mountedDb.routes.find(route => route.path === requestedRoute);

            // if table does not exist, check if there's an alias that carries the requested route name
            if(tableExists) {
                // get the data from the table
                const tableData: QDBTableData = await mountedDb.db.getTableData(tableExists);
                
                // check if there's a primary key value
                if(routes.length > 2) {
                    const requestedPrimaryKeyID = routes[2];

                    const deletedData = await mountedDb.db.deleteDataByPrimaryKey({
                        name: requestedRoute,
                        primaryKey: {
                            key: tableData.primaryKey,
                            value: requestedPrimaryKeyID
                        }
                    });

                    if(deletedData.success) {
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

                if(tableIndex !== -1) {
                    this.dbs.find(db => db.path === requestedDb)?.db.tables.splice(tableIndex, 1);
                }

                return {
                    success: true,
                    data: deletedTable.data,
                };
            } else if(tableAlias) {
                // get the data from the alias
                return {
                    success: true,
                    data: {}
                };
            }else {
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

        if(deletedDb.success) {
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

    private async handlePatch(ws: WebSocket, routes: string[], data: QDBServerQuery) : Promise<QDBServerResponse>{
        return {
            success: true,
            data: {}
        }
    }
    
    private handleBroadcast(){

    }

    public broadcast(message: any) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    public mountDb(db: QDB, alias?: string, routes?: QDBRoute[]) {
        this.dbs.push({ path: alias || db.name, db, routes: routes || [] });
    }

    public intercept(path: string, handler: (data: QDBServerQuery) => Promise<QDBServerResponse | any>, next?: boolean) {
        this.interceptors.push({ path, handler, next });
    }

    async listen() {
        // check if the server is already listening
        if(this.server.listening) {
            console.log(`QDB Server is listening on port ${this.port}`);
            return;
        }

        this.server.listen(this.port, () => {
            console.log(`QDB Server is running on port ${this.port}`);
        });
    }
}

export default QDBServer;