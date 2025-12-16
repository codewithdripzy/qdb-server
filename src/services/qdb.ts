import QDBConfig from "../config/setup";
import QDBQueries from "../database/queries";
import { QDBOptions } from "../interfaces/qdb";
import { Password } from "auth-validify";
import { QDBQueryResult, QDBTable, QDBTableData, QDBInsertData, QDBDeleteData, QDBDeleteTableData, QDBDeleteDbData } from "../interfaces/tables";
import { Database } from "sqlite3/lib/sqlite3";
import { TableColumnConstraints, TableConflictOptions, TableColumnType } from "../core/enums";
import { DataLogger } from "./logger";

class QDB {
    name: string;
    options: QDBOptions;
    db: Database;
    tables: QDBTable[];
    config: QDBConfig;
    private queries: QDBQueries;
    private psw: Password;

    private logger: DataLogger;
    private cleanerInterval: NodeJS.Timeout | null = null;

    constructor(name: string, options: QDBOptions) {
        this.name = name;
        this.options = options;
        this.db = new Database(`db/${this.name}/${this.name}.db`);
        this.config = new QDBConfig(this.name);
        this.queries = new QDBQueries(this.db);
        this.psw = new Password();
        this.tables = [];
        this.logger = new DataLogger(this.name);

        this.init();
    }

    async init() {
        this.config.setup();
        await this.createInternalTables();
        await this.getTables();
        await this.auth();
    }

    async query(sql: string) {
        return await this.queries.execute(sql);
    }

    enableDataLifetime(intervalMs: number = 60000) {
        if (this.cleanerInterval) clearInterval(this.cleanerInterval);
        this.cleanerInterval = setInterval(() => {
            this.logger.cleanExpired(async (table, id) => {
                // Find table to get PK column
                const tableRef = this.tables.find(t => t.name === table);
                if (tableRef) {
                    const pkCol = tableRef.columns.find(c => c.constraints?.includes(TableColumnConstraints.PRIMARY_KEY));
                    if (pkCol) {
                        try {
                            await this.deleteDataByPrimaryKey({
                                name: table,
                                primaryKey: { key: pkCol.name, value: id }
                            });
                        } catch (e) {
                            console.error(`Cleaner failed for ${table}:${id}`, e);
                        }
                    }
                }
            });
        }, intervalMs);
    }

    private async createInternalTables() {
        // __qdb_meta
        const metaTable: QDBTable = {
            name: "__qdb_meta",
            columns: [
                { name: "id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.PRIMARY_KEY, TableColumnConstraints.AUTOINCREMENT] },
                { name: "key", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.UNIQUE, TableColumnConstraints.NOT_NULL] },
                { name: "value", type: TableColumnType.TEXT }
            ]
        };
        await this.createTable(metaTable);

        // __qdb_queue
        const queueTable: QDBTable = {
            name: "__qdb_queue",
            columns: [
                { name: "id", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.PRIMARY_KEY] }, // UUID
                { name: "topic", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.NOT_NULL] },
                { name: "payload", type: TableColumnType.TEXT }, // JSON
                { name: "status", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT], default: "'pending'" }, // pending, processing, done, failed
                { name: "priority", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.DEFAULT], default: "0" },
                { name: "created_at", type: TableColumnType.DATETIME, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                { name: "updated_at", type: TableColumnType.DATETIME, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] }
            ]
        };
        await this.createTable(queueTable);
    }

    private async auth() {
        // use the auth service which is connected to the drone.config.db
        // if(this.options.username && this.options.password) {
        //    const user = await this.queries.get("users", {
        //     username: this.options.username
        //    }) as unknown as { username: string, password: string };

        //    if(!user) {
        //     throw new Error("Invalid username or password");
        //    }

        //    // verify the password
        //    const isValid = this.psw.verify(this.options.password, user.password);
        //    if (!isValid) {
        //     throw new Error("Invalid username or password");
        //    }
        // }
    }

    private async getTables(): Promise<any> { // QDBTable[]
        const tables = await this.queries.execute(await this.queries.getTables()) as QDBTable[];
        this.tables = tables;

        // console.log(tables);
    }

    async getTableData(table: QDBTable): Promise<QDBTableData> {
        const tableQuery = await this.queries.select({
            table: table.name,
            columns: ["*"],
        });

        const primaryKey = await this.queries.getPrimaryKey(table.name);
        const [tableData, primaryKeyData] = await this.queries.exequete([
            { query: tableQuery },
            { query: primaryKey }
        ]);

        return {
            primaryKey: primaryKeyData[0].name,
            data: tableData
        };
    }

    async createTable(table: QDBTable): Promise<QDBQueryResult> {
        try {
            const createQuery = await this.queries.createTable(table);
            const data = await this.queries.execute(createQuery);

            // if the table is created, add it to the tables array
            this.tables.push(table);

            // populate the table with the provided default data
            if (table.data) {
                const insertQuery = await this.queries.insertMany({
                    table: table.name,
                    data: table.data,
                    onConflict: TableConflictOptions.REPLACE
                });
                const insertData = await this.queries.execute(insertQuery);

                // check for the column with the primary key constraint
                const primaryKeyColumn = table.columns.find(column => column.constraints?.includes(TableColumnConstraints.PRIMARY_KEY));
                console.log(primaryKeyColumn);

                return {
                    success: true,
                    data: insertData,
                    // primaryKey: primaryKeyColumn?.name ?? ""
                };
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.log(error);

            return {
                success: false,
                error: error,
                data: null
            };
        }
    }

    async insertData(data: QDBInsertData): Promise<QDBQueryResult> {
        try {
            const insertQuery = await this.queries.insertMany({
                table: data.name,
                data: data.data,
                onConflict: data.onConflict ?? TableConflictOptions.REPLACE
            });

            const insertData = await this.queries.execute(insertQuery);

            // Log data expiration if present
            data.data.forEach(item => {
                if (item._expiresAt && typeof item._expiresAt === 'number') {
                    // Try to resolve ID. If provided in item, use it.
                    // If not, we might fail to expire unless we fetch it. 
                    // Assumption: User provides ID or primary key equivalent if they want exact expiration.
                    // Or we check if 'id' exists.
                    if (item.id) {
                        this.logger.log(item.id.toString(), data.name, item._expiresAt);
                    }
                }
            });

            return {
                success: true,
                data: insertData
            };
        } catch (error) {
            console.log(error);

            return {
                success: false,
                error: error,
                data: null
            };
        }
    }

    async deleteDataByPrimaryKey(data: QDBDeleteData): Promise<QDBQueryResult> {
        try {
            const deleteQuery = await this.queries.deleteByPrimaryKey({
                table: data.name,
                primaryKey: {
                    key: data.primaryKey.key,
                    value: data.primaryKey.value
                }
            });

            const deleteData = await this.queries.execute(deleteQuery);

            return {
                success: true,
                data: deleteData
            };
        } catch (error) {
            console.log(error);

            return {
                success: false,
                error: error,
                data: null
            };
        }
    }

    async deleteTable(data: QDBDeleteTableData): Promise<QDBQueryResult> {
        try {
            const deleteQuery = await this.queries.deleteTable(data.name);
            const deleteData = await this.queries.execute(deleteQuery);

            return {
                success: true,
                data: deleteData
            };
        } catch (error) {
            console.log(error);

            return {
                success: false,
                error: error,
                data: null
            };
        }
    }

    async enqueue(topic: string, payload: any, priority: number = 0): Promise<QDBQueryResult> {
        try {
            const data = {
                id: (globalThis as any).crypto ? (globalThis as any).crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
                topic,
                payload: JSON.stringify(payload),
                priority,
                status: 'pending'
            };
            const query = await this.queries.enqueue({ table: "__qdb_queue", data });
            const result = await this.queries.execute(query);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error, data: null };
        }
    }

    async dequeue(clientId: string): Promise<QDBQueryResult> {
        try {
            const query = await this.queries.dequeue({ table: "__qdb_queue", clientId });
            const result = await this.queries.execute(query);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error, data: null };
        }
    }

    async ack(id: string): Promise<QDBQueryResult> {
        try {
            const query = await this.queries.ack({ table: "__qdb_queue", id });
            await this.queries.execute(query);
            return { success: true, data: { id, status: 'done' } };
        } catch (error) {
            return { success: false, error, data: null };
        }
    }

    async fail(id: string, reason: string): Promise<QDBQueryResult> {
        try {
            const query = await this.queries.fail({ table: "__qdb_queue", id, reason });
            await this.queries.execute(query);
            return { success: true, data: { id, status: 'failed', reason } };
        } catch (error) {
            return { success: false, error, data: null };
        }
    }

    async deleteDb(data: QDBDeleteDbData): Promise<QDBQueryResult> {
        try {
            const deleteQuery = await this.queries.deleteDb(data.name);
            const deleteData = await this.queries.execute(deleteQuery);

            return {
                success: true,
                data: deleteData
            };
        } catch (error) {
            console.log(error);

            return {
                success: false,
                error: error,
                data: null
            };
        }
    }
    // async deleteData(data: QDBDeleteData): Promise<QDBQueryResult>{
    //     try {
    //         const deleteQuery = await this.queries.delete({
    //             table: data.name,
    //             primaryKey: data.primaryKey
    //         });

    //         const deleteData = await this.queries.execute(deleteQuery);

    //         return {
    //             success: true,
    //             data: deleteData
    //         };
    //     } catch (error) {
    //         console.log(error);
    //     }
    // }

    async connect() {
        // this.db.open();
    }

    async disconnect() {
        this.db.close();
    }
}

export default QDB;