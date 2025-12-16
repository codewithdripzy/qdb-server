import { CreateTableOptions, DeleteTableOptions, InsertTableOptions, InsertManyTableOptions, QDBExecuteOptions, SelectTableOptions, UpdateTableOptions, WhereOptions, GetTablesOptions, DeleteByPrimaryKeyOptions } from "../interfaces/tables";
import { Database } from "sqlite3/lib/sqlite3";
import { TableColumnConstraints, TableConflictOptions } from "../core/enums";

class QDBQueries {
    db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    async createTable({ name, columns }: CreateTableOptions) {
        const columnDefs = columns.map(column => {
            let columnDef = `${column.name} ${column.type}`;

            if (column.constraints) {
                columnDef += ' ' + column.constraints.filter(c => c !== TableColumnConstraints.FOREIGN_KEY && c !== TableColumnConstraints.REFERENCES).join(' ');
            }

            return columnDef;
        });

        const foreignKeys = columns
            .filter(column => column.foreignKey)
            .map(column => `FOREIGN KEY (${column.name}) REFERENCES ${column.foreignKey!.table}(${column.foreignKey!.column})`);

        const query = `CREATE TABLE IF NOT EXISTS ${name} (
            ${[...columnDefs, ...foreignKeys].join(', ')}
        )`;

        return query;
    }

    private escapeString(value: string): string {
        return `'${value.replace(/'/g, "''")}'`;
    }

    async insert({ table, data, onConflict }: InsertTableOptions) {
        const values = Object.values(data).map(value =>
            typeof value === 'string' ? this.escapeString(value) : value
        );
        const query = `INSERT OR ${onConflict || 'ABORT'} INTO ${table} (${Object.keys(data).join(', ')}) VALUES (${values.join(', ')})`;
        return query;
    }

    async insertMany({ table, data, onConflict }: InsertManyTableOptions) {
        const columns = Object.keys(data[0]);
        const values = data.map(row =>
            `(${Object.values(row).map(value =>
                typeof value === 'string' ? this.escapeString(value) : value
            ).join(', ')})`
        );
        const query = `INSERT OR ${onConflict || 'ABORT'} INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}`;
        return query;
    }

    async getTables() {
        const query = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`; //  AND name NOT LIKE '${this}_%'
        return query;
    }

    async select({ table, columns }: SelectTableOptions) {
        const query = `SELECT ${columns.join(', ')} FROM ${table}`;
        return query;
    }

    async getPrimaryKey(table: string) {
        const query = `SELECT name FROM pragma_table_info('${table}') WHERE pk = 1`;
        return query;
    }

    async update({ table, data, where }: UpdateTableOptions) {
        const query = `UPDATE ${table} SET ${Object.keys(data).join(', ')} WHERE ${where}`;
        return query;
    }

    async delete({ table, where }: DeleteTableOptions) {
        const query = `DELETE FROM ${table} WHERE ${where}`;
        return query;
    }

    async deleteByPrimaryKey({ table, primaryKey }: DeleteByPrimaryKeyOptions) {
        const query = `DELETE FROM ${table} WHERE ${primaryKey.key} = ${primaryKey.value}`;
        return query;
    }

    async deleteTable(table: string) {
        const query = `DROP TABLE IF EXISTS ${table}`;
        return query;
    }

    async deleteDb(db: string) {
        const query = `DROP DATABASE IF EXISTS ${db}`;
        return query;
    }

    async get(table: string, where: WhereOptions) {
        const whereQuery = Object.keys(where).map(key => `${key} = ${where[key]}`).join(' AND ');
        const query = `SELECT * FROM ${table} WHERE ${whereQuery}`;
        return query;
    }

    async execute(query: string) {
        if (query.trim().toUpperCase().startsWith('SELECT') || query.trim().toUpperCase().includes('RETURNING')) {
            return new Promise((resolve, reject) => {
                this.db.all(query, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } else if (query.trim().toUpperCase().startsWith('CREATE TABLE')) {
            return new Promise((resolve, reject) => {
                this.db.run(query, function (err: any) {
                    if (err) reject(err);
                    else {
                        // const lastID = t./his.lastID;
                        resolve(this);
                    };
                });
            });
        }

        return new Promise((resolve, reject) => {
            this.db.run(query, (err: any) => {
                if (err) reject(err);
                else resolve(undefined);
            });
        });
    }

    async exequete(queries: QDBExecuteOptions[]) {
        const results: any[] = [];

        await Promise.all(queries.map(async (query) => {
            if (query.timeout) {
                setTimeout(async () => {
                    results.push(await this.execute(query.query));
                }, query.timeout);
            } else {
                results.push(await this.execute(query.query));
            }
        }));

        return results;
    }
    async enqueue({ table, data }: { table: string, data: any }) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`; // Note: Value binding should be handled by execute if possible, but for current pattern:
        // Re-using insert pattern but specifically for queue items which might need unique handling later.
        // For now, standard insert is fine, effectively alias.
        return this.insert({ table, data, onConflict: TableConflictOptions.FAIL });
    }

    async dequeue({ table, clientId }: { table: string, clientId: string }) {
        // This is complex in SQLite. Pseudo-code for expected SQL:
        // UPDATE queue SET status='processing', updated_at=NOW() WHERE id = (SELECT id FROM queue WHERE status='pending' ORDER BY priority DESC, created_at ASC LIMIT 1) RETURNING *;
        // SQLite support for RETURNING is available in newer versions.
        const query = `UPDATE ${table} SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM ${table} WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1) RETURNING *`;
        return query;
    }

    async ack({ table, id }: { table: string, id: string }) {
        const query = `UPDATE ${table} SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;
        return query;
    }

    async fail({ table, id, reason }: { table: string, id: string, reason: string }) {
        // reason should be stored in a 'result' or 'error' column if it exists.
        // Assuming 'payload' might need update or a flexible column.
        // For now just status.
        const query = `UPDATE ${table} SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;
        return query;
    }
}

export default QDBQueries;