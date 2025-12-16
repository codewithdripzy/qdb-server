#!/usr/bin/env node
import { program } from 'commander';
import QDB from './services/qdb';
import QDBServer from './server';
import { MigrationService } from './services/migration';
import * as path from 'path';

program
    .name('qdb')
    .description('QDB CLI - Manage your Realtime Queuing Database')
    .version('2.0.0');

program.command('init')
    .description('Initialize a new QDB database in the current directory')
    .argument('<name>', 'Name of the database')
    .action(async (name) => {
        console.log(`Initializing QDB: ${name}...`);
        const db = new QDB(name, {});
        await db.init();
        console.log(`Database '${name}' initialized successfully.`);
        // db.disconnect(); // If init keeps connection open
        process.exit(0);
    });

program.command('start')
    .description('Start the QDB Server')
    .argument('<name>', 'Name of the database/project')
    .option('-p, --port <number>', 'Port to run on', '3000')
    .action(async (name, options) => {
        const port = parseInt(options.port);
        console.log(`Starting QDB Server for '${name}' on port ${port}...`);

        const qdb = new QDB(name, {});
        // await qdb.init(); // Init handled in constructor/async properly? QDB constructor calls init but async...
        // Server will mount it.

        const server = new QDBServer("main", { port, server: undefined }); // undefined server means create new
        server.mountDb(qdb);
        server.listen();
    });

program.command('migrate')
    .description('Run database migrations')
    .argument('<name>', 'Name of the database')
    .action(async (name) => {
        const db = new QDB(name, {});
        await db.init();
        const migrationService = new MigrationService(db);
        await migrationService.migrate('./migrations'); // Default path
        console.log("Migrations completed.");
        process.exit(0);
    });

program.command('archive')
    .description('Archive old data')
    .argument('<name>', 'Name of the database')
    .argument('<table_name>', 'Table to archive')
    .argument('<days>', 'Archive data older than N days')
    .action(async (name, tableName, days) => {
        const db = new QDB(name, {});
        await db.init();
        const migrationService = new MigrationService(db);
        const cutoff = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
        await migrationService.archiveTable(tableName, cutoff);
        process.exit(0);
    });

program.parse();
