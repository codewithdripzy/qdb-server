import * as fs from 'fs';
import * as path from 'path';

/**
 * DataLogger
 * Handles logging of data creation and expiration.
 * Uses JSONL format for performance (append-only).
 */
export class DataLogger {
    private logFile: string;
    private dbName: string;

    constructor(dbName: string) {
        this.dbName = dbName;
        // Ensure log directory exists inside db folder
        const logDir = path.join('db', dbName, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logFile = path.join(logDir, 'data.jsonl');
    }

    log(id: string, table: string, expiresAt: number) {
        const entry = JSON.stringify({ id, table, expiresAt }) + '\n';
        fs.appendFile(this.logFile, entry, (err) => {
            if (err) console.error("Failed to log data expiration:", err);
        });
    }

    async cleanExpired(deleteCallback: (table: string, id: string) => Promise<void>) {
        if (!fs.existsSync(this.logFile)) return;

        // Read log line by line. 
        // For large logs, streams are better. 
        // We will read entire file, filter, and rewrite. 
        // Note: Use a lock or temp file for safety in production.

        try {
            const content = fs.readFileSync(this.logFile, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            const now = Date.now();
            const keep: string[] = [];

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    if (entry.expiresAt <= now) {
                        try {
                            await deleteCallback(entry.table, entry.id);
                            // console.log(`Expired data cleaned: ${entry.table}/${entry.id}`);
                        } catch (e) {
                            console.error(`Failed to delete expired data ${entry.id}:`, e);
                            keep.push(line); // Keep if delete failed? Or remove to retry? Better remove from log if we want to avoid retry loop, or keep. Let's keep for safety.
                        }
                    } else {
                        keep.push(line);
                    }
                } catch (e) {
                    // Invalid line, drop it
                }
            }

            // Write back remaining
            fs.writeFileSync(this.logFile, keep.join('\n') + (keep.length > 0 ? '\n' : ''));

        } catch (error) {
            console.error("Error cleaning expired data:", error);
        }
    }
}
