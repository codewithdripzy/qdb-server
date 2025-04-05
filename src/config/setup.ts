// this file will be used to setup default tables, permissions, roles, etc.
import fs from "fs";
import QDBQueries from "../database/queries";
import { Database } from "sqlite3/lib/sqlite3";
import { TableColumnConstraints, TableColumnType, TableConflictOptions } from "../core/enums";

class QDBConfig{
    dbName: string;
    queries: QDBQueries;

    constructor(dbName: string){
        this.dbName = dbName;

        // make the db directory if it doesn't exist
        if (!fs.existsSync("../db")) {
            fs.mkdirSync("../db");
        }

        if (!fs.existsSync(`../db/${this.dbName}`)) {
            fs.mkdirSync(`../db/${this.dbName}`);
        }

        // create the config db
        this.queries = new QDBQueries(new Database(`../db/${this.dbName}/${this.dbName}.config.db`));
    }

    async setup(){
        // First create all tables
        await this.createClientTable();
        await this.createPermissionsTable();
        await this.createRolesTable();
        await this.createClientPermissionsTable();

        // Then populate tables in order of dependencies
        // 1. First populate permissions (no dependencies)
        await this.createDefaultPermissions();

        // 2. Then populate roles (no dependencies)
        await this.createDefaultRoles();

        // 3. Then populate clients (no dependencies)
        await this.createDefaultClient();

        // 4. Finally populate client_permissions (depends on both clients and permissions)
        await this.createDefaultClientPermissions();
    }

    // create the client table
    private async createClientTable(){
        try {
            // create the users table
            const usersTable = await this.queries.createTable({
                name: "clients",
                columns: [
                    { name: "id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.PRIMARY_KEY, TableColumnConstraints.AUTOINCREMENT] },
                    { name: "username", type: TableColumnType.TEXT },
                    { name: "password", type: TableColumnType.TEXT },
                    { name: "created_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                    { name: "updated_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                ]
            });

            await this.queries.execute(usersTable);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the permissions table
    private async createPermissionsTable(){
        try {
            const permissionsTable = await this.queries.createTable({
                name: "permissions",
                columns: [
                    { name: "id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.PRIMARY_KEY, TableColumnConstraints.AUTOINCREMENT] },
                    { name: "name", type: TableColumnType.TEXT },
                    { name: "description", type: TableColumnType.TEXT },
                    { name: "created_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                    { name: "updated_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                ]
            });

            await this.queries.execute(permissionsTable);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the roles table
    private async createRolesTable(){
        try {
            const rolesTable = await this.queries.createTable({
                name: "roles",
                columns: [
                    { name: "id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.PRIMARY_KEY, TableColumnConstraints.AUTOINCREMENT] },
                    { name: "name", type: TableColumnType.TEXT },
                    { name: "description", type: TableColumnType.TEXT },
                    { name: "created_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                    { name: "updated_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                ]
            });

            await this.queries.execute(rolesTable);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the client_permissions table
    private async createClientPermissionsTable(){
        try {
            const clientPermissionsTable = await this.queries.createTable({
                name: "client_permissions",
                columns: [
                    { name: "id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.PRIMARY_KEY, TableColumnConstraints.AUTOINCREMENT] },
                    { name: "permission_id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.FOREIGN_KEY, TableColumnConstraints.REFERENCES], foreignKey: { table: "permissions", column: "id" } },
                    { name: "client_id", type: TableColumnType.INTEGER, constraints: [TableColumnConstraints.FOREIGN_KEY, TableColumnConstraints.REFERENCES], foreignKey: { table: "clients", column: "id" } },
                    { name: "created_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                    { name: "updated_at", type: TableColumnType.TEXT, constraints: [TableColumnConstraints.DEFAULT, TableColumnConstraints.CURRENT_TIMESTAMP] },
                ]
            });

            await this.queries.execute(clientPermissionsTable);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the default permissions
    private async createDefaultPermissions(){
        try {
            const defaultPermissions = await this.queries.insertMany({
                table: "permissions",
                data: [
                    { name: "SELECT", description: "Read data from tables or views" },
                    { name: "INSERT", description: "Add new rows to tables" },
                    { name: "UPDATE", description: "Modify existing rows in tables" },
                    { name: "DELETE", description: "Remove rows from tables" },
                    { name: "CREATE", description: "Create new tables, indexes, or other objects" },
                    { name: "ALTER", description: "Modify the structure of a database object" },
                    { name: "DROP", description: "Delete database objects like tables, views, indexes" },
                    { name: "TRUNCATE", description: "Remove all rows from a table without logging individual deletions" },
                    { name: "RENAME", description: "Change the name of database objects" },
                    { name: "GRANT", description: "Assign specific privileges to a user or role" },
                    { name: "REVOKE", description: "Remove previously granted privileges from a user or role" },
                    { name: "CREATE USER", description: "Add new users to the database" },
                    { name: "ALTER USER", description: "Modify existing users, such as passwords" },
                    { name: "DROP USER", description: "Remove users from the database" },
                    { name: "CREATE ROLE", description: "Create new roles for user permission grouping" },
                    { name: "DROP ROLE", description: "Delete roles from the database" },
                    { name: "SUPERUSER", description: "Full administrative rights over the entire database" },
                    { name: "CREATE DATABASE", description: "Create a new database" },
                    { name: "DROP DATABASE", description: "Delete an existing database" },
                    { name: "BACKUP", description: "Perform backups of the database" },
                    { name: "RESTORE", description: "Restore a database from a backup" },
                    { name: "REPLICATION", description: "Set up replication or replicate data" },
                    { name: "LOCK TABLES", description: "Explicitly lock a table for exclusive access" },
                    { name: "EXECUTE", description: "Run stored procedures or functions" },
                    { name: "CREATE INDEX", description: "Create indexes on tables for performance optimization" },
                    { name: "DROP INDEX", description: "Remove indexes" },
                    { name: "CREATE VIEW", description: "Create new views" },
                    { name: "DROP VIEW", description: "Remove views" },
                    { name: "COMMIT", description: "Finalize a transaction, making all changes permanent" },
                    { name: "ROLLBACK", description: "Revert changes of a transaction before it's committed" },
                    { name: "EXECUTE PROCEDURE", description: "Run stored procedures/functions" },
                    { name: "CREATE SEQUENCE", description: "Create a sequence object for generating unique numbers" },
                    { name: "ALTER SEQUENCE", description: "Modify sequence properties" },
                    { name: "DROP SEQUENCE", description: "Remove a sequence object" },
                    { name: "CREATE SCHEMA", description: "Create new schema namespaces" },
                    { name: "ALTER SCHEMA", description: "Modify existing schema namespaces" },
                    { name: "DROP SCHEMA", description: "Delete schemas" },
                    { name: "READ", description: "Access database files for reading" },
                    { name: "WRITE", description: "Access database files for writing" },
                    { name: "FILE", description: "Access to read and write to the file system" }
                ],
                onConflict: TableConflictOptions.IGNORE
            });

            await this.queries.execute(defaultPermissions);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the default roles
    private async createDefaultRoles(){
        try {
            const defaultRoles = await this.queries.insertMany({
                table: "roles",
                data: [
                    { name: "DBA", description: "Database Administrator with broad privileges for managing the entire database." },
                    { name: "BACKUP_ADMIN", description: "Responsible for managing database backups." },
                    { name: "CLONE_ADMIN", description: "Manages clone operations in the database (introduced in MySQL 8.0.17)." },
                    { name: "REPLICATION_SLAVE_ADMIN", description: "Handles replication operations for managing replication slaves." },
                    { name: "REPLICATION_APPLIER", description: "Applies binary log events, mainly for replication environments." },
                    { name: "REPLICATION_REPLICA_ADMIN", description: "Manages replication replicas, specifically controlling replica instances." },
                    { name: "AUDIT_ADMIN", description: "Provides access to configure and manage audit logs." },
                    { name: "PROXY_ADMIN", description: "Manages proxy users and proxy roles." },
                    { name: "ROLE_ADMIN", description: "Allows the management and creation of roles, including assigning and revoking roles." },
                    { name: "USER_ADMIN", description: "Responsible for managing user accounts and their privileges." },
                    { name: "SYSTEM_VARIABLES_ADMIN", description: "Manages system variables and dynamic server configurations." },
                    { name: "RESOURCE_GROUP_ADMIN", description: "Manages resource groups for controlling resource allocation (CPU, memory, etc.)." }
                ],
                onConflict: TableConflictOptions.IGNORE
            });

            await this.queries.execute(defaultRoles);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // populate the client table with the default credentials root
    private async createDefaultClient(){
        try {
            const rootClient = await this.queries.insert({
                table: "clients",
                data: {
                    username: "root",
                    password: "root"
                },
                onConflict: TableConflictOptions.IGNORE
            });

            await this.queries.execute(rootClient);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // create the default client_permissions
    private async createDefaultClientPermissions(){
        try {
            // Get all permissions
            const permissionsQuery = await this.queries.select({
                table: "permissions",
                columns: ["id", "name"]
            });

            const permissionsData = await this.queries.execute(permissionsQuery) as Array<{ id: number; name: string }>;

            // Get the root client
            const rootClientQuery = await this.queries.select({
                table: "clients",
                columns: ["id"]
            });
            const rootClientData = await this.queries.execute(rootClientQuery) as Array<{ id: number }>;

            if (!permissionsData || !rootClientData || rootClientData.length === 0) {
                throw new Error("Failed to fetch required data for client permissions");
            }

            const rootClientId = rootClientData[0].id;
            
            // Create client permissions for each permission
            const clientPermissionsData = permissionsData.map(permission => ({
                permission_id: permission.id,
                client_id: rootClientId
            }));

            const defaultClientPermissions = await this.queries.insertMany({
                table: "client_permissions",
                data: clientPermissionsData,
                onConflict: TableConflictOptions.IGNORE
            });

            await this.queries.execute(defaultClientPermissions);
        } catch (error) {
            console.error("Error creating default client permissions:", error);
            throw error;
        }
    }

}

export default QDBConfig;