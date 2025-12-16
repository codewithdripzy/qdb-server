import QDB from "./qdb";
import { QDBTable } from "../interfaces/tables";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Service
 * Handles database schema migrations and data archival.
 */
export class MigrationService {
    private db: QDB;

    constructor(db: QDB) {
        this.db = db;
    }

    /**
     * Archive data from a table to a JSONL file.
     * Use this to keep the primary database lean.
     */
    async archiveTable(tableName: string, cutoffDate: number, timeColumn: string = 'created_at') {
        const dateStr = new Date(cutoffDate).toISOString();
        console.log(`Archiving table ${tableName} data older than ${dateStr}...`);

        try {
            // 1. Fetch old data
            // We use raw query because queries.select is limited
            // Assuming SQLite date comparison works with string ISO format (it does if stored as such)
            const selectQuery = `SELECT * FROM ${tableName} WHERE ${timeColumn} < '${dateStr}'`;
            // We need to access 'execute' from queries but it's part of QDB private queries? 
            // QDB exposes 'queries' property? NO, it's private in QDB.
            // But QDB class in services/qdb.ts:15 is 'private queries: QDBQueries;'.
            // I cannot access 'db.queries' from outside.
            // I should add 'executeQuery' public method to QDB or expose 'queries'.
            // For now, let's assume I'll add 'execute(query: string)' to QDB class.

            // Wait, QDB has 'tables'. I can find table, generic select? No where clause support in generic select.

            // I will add `execute(query: string)` to QDB to allow raw access for admin tasks like migration.
            // Or I use `(this.db as any).queries.execute`. Ideally proper access.

            // Let's rely on QDB having an execute method or similar usage.
            // "src/services/qdb.ts" needs update to expose query execution for plugins/services.

            // For this step, I will write the code assuming 'db.query(sql)' exists, and then add it to QDB.
            const rows = await (this.db as any).query(selectQuery) as any[];

            if (rows.length === 0) {
                console.log("No data to archive.");
                return;
            }

            // 2. Append to log/archive file
            const archiveDir = path.join('db', this.db.name, 'archive');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }
            const archiveFile = path.join(archiveDir, `${tableName}.jsonl`);

            const stream = fs.createWriteStream(archiveFile, { flags: 'a' });
            rows.forEach(row => {
                stream.write(JSON.stringify(row) + '\n');
            });
            stream.end();

            // 3. Delete from DB
            const deleteQuery = `DELETE FROM ${tableName} WHERE ${timeColumn} < '${dateStr}'`;
            await (this.db as any).query(deleteQuery);

            console.log(`Archived ${rows.length} rows from ${tableName}.`);
        } catch (error) {
            console.error("Archival failed:", error);
        }
    }

    /**
     * Run migration scripts.
     */
    async migrate(migrationsPath: string) {
        console.log(`Running migrations from ${migrationsPath}`);
        // Load migration files and execute
    }
}
