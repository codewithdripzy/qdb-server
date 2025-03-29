import QDBConfig from "@/config/setup";
import QDBQueries from "@/database/queries";
import { QDBOptions } from "@/interfaces/qdb";
import { Password } from "auth-validify";
import { QDBQueryResult, QDBTable, QDBTableData, QDBInsertData } from "@/interfaces/tables";
import { Database } from "sqlite3/lib/sqlite3";
import { TableColumnConstraints, TableConflictOptions } from "@/core/enums";

class QDB{
    name: string;
    options: QDBOptions;
    db: Database;
    tables: QDBTable[];
    private config: QDBConfig;
    private queries: QDBQueries;
    private psw: Password;

    constructor(name: string, options: QDBOptions) {
        this.name = name;
        this.options = options;
        this.db = new Database(`db/${this.name}/${this.name}.db`);
        this.config = new QDBConfig(this.name);
        this.queries = new QDBQueries(this.db);
        this.psw = new Password();
        this.tables = [];

        this.config.setup();
        this.auth();
        this.getTables();
    }

    private async auth(){
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

    private async getTables() : Promise<any>{ // QDBTable[]
        const tables = await this.queries.execute(await this.queries.getTables()) as QDBTable[]; 
        this.tables = tables;

        // console.log(tables);
    }

    async getTableData(table: QDBTable) : Promise<QDBTableData>{
        const tableQuery = await this.queries.select({
            table: table.name,
            columns: ["*"],
        });

        const primaryKey = await this.queries.getPrimaryKey(table.name);
        const [ tableData, primaryKeyData ] = await this.queries.exequete([
            { query: tableQuery },
            { query: primaryKey }
        ]);

        return {
            primaryKey: primaryKeyData[0].name,
            data: tableData
        };      
    }

    async createTable(table: QDBTable) : Promise<QDBQueryResult>{
        try {
            const createQuery = await this.queries.createTable(table);
            const data = await this.queries.execute(createQuery);

            // if the table is created, add it to the tables array
            this.tables.push(table);

            // populate the table with the provided default data
            if(table.data) {
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

    async insertData(data: QDBInsertData): Promise<QDBQueryResult>{
        try {
            const insertQuery = await this.queries.insertMany({
                table: data.name,
                data: data.data,
                onConflict: data.onConflict ?? TableConflictOptions.REPLACE
            });
    
            const insertData = await this.queries.execute(insertQuery);
    
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

    async connect(){
        // this.db.open();
    }

    async disconnect(){
        this.db.close();
    }
}

export default QDB;