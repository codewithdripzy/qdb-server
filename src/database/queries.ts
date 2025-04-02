import { CreateTableOptions, DeleteTableOptions, InsertTableOptions, InsertManyTableOptions, QDBExecuteOptions, SelectTableOptions, UpdateTableOptions, WhereOptions, GetTablesOptions, DeleteByPrimaryKeyOptions } from "../interfaces/tables";
import { Database } from "sqlite3/lib/sqlite3";
import { TableColumnConstraints } from "../core/enums";

class QDBQueries{
    db: Database;

    constructor(db: Database){
        this.db = db;
    }
    
    async createTable({ name, columns } : CreateTableOptions){
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

    async insert({ table, data, onConflict } : InsertTableOptions){
        const values = Object.values(data).map(value => 
            typeof value === 'string' ? this.escapeString(value) : value
        );
        const query = `INSERT OR ${onConflict || 'ABORT'} INTO ${table} (${Object.keys(data).join(', ')}) VALUES (${values.join(', ')})`;
        return query;
    }

    async insertMany({ table, data, onConflict } : InsertManyTableOptions){
        const columns = Object.keys(data[0]);
        const values = data.map(row => 
            `(${Object.values(row).map(value => 
                typeof value === 'string' ? this.escapeString(value) : value
            ).join(', ')})`
        );
        const query = `INSERT OR ${onConflict || 'ABORT'} INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}`;
        return query;
    }

    async getTables(){
        const query = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`; //  AND name NOT LIKE '${this}_%'
        return query;
    }

    async select({ table, columns } : SelectTableOptions){
        const query = `SELECT ${columns.join(', ')} FROM ${table}`;
        return query;
    }

    async getPrimaryKey(table: string){
        const query = `SELECT name FROM pragma_table_info('${table}') WHERE pk = 1`;
        return query;
    }

    async update({ table, data, where } : UpdateTableOptions){
        const query = `UPDATE ${table} SET ${Object.keys(data).join(', ')} WHERE ${where}`;
        return query;
    }

    async delete({ table, where } : DeleteTableOptions){
        const query = `DELETE FROM ${table} WHERE ${where}`;
        return query;
    }

    async deleteByPrimaryKey({ table, primaryKey } : DeleteByPrimaryKeyOptions){
        const query = `DELETE FROM ${table} WHERE ${primaryKey.key} = ${primaryKey.value}`;
        return query;
    }

    async deleteTable(table: string){
        const query = `DROP TABLE IF EXISTS ${table}`;
        return query;
    }

    async deleteDb(db: string){
        const query = `DROP DATABASE IF EXISTS ${db}`;
        return query;
    }

    async get(table: string, where: WhereOptions){
        const whereQuery = Object.keys(where).map(key => `${key} = ${where[key]}`).join(' AND ');
        const query = `SELECT * FROM ${table} WHERE ${whereQuery}`;
        return query;
    }

    async execute(query: string){
        if (query.trim().toUpperCase().startsWith('SELECT')) {
            return new Promise((resolve, reject) => {
                this.db.all(query, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }else if (query.trim().toUpperCase().startsWith('CREATE TABLE')) {
            return new Promise((resolve, reject) => {
                this.db.run(query, function(err: any) {
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

    async exequete(queries: QDBExecuteOptions[]){
        const results: any[] = [];
        
        await Promise.all(queries.map(async (query) => {
            if(query.timeout) {
                setTimeout(async () => {
                    results.push(await this.execute(query.query));
                }, query.timeout);
            }else{
                results.push(await this.execute(query.query));
            }
        }));
        
        return results;
    }
}

export default QDBQueries;