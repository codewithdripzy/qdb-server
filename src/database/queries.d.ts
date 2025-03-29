export interface CreateTableOptions {
    name: string;
    columns: Array<{
        name: string;
        type: string;
        constraints?: string[];
    }>;
}

export interface InsertTableOptions {
    table: string;
    data: Record<string, any>;
}

export interface SelectTableOptions {
    table: string;
    columns: string[];
}

export interface UpdateTableOptions {
    table: string;
    data: Record<string, any>;
    where: string;
}

export interface DeleteTableOptions {
    table: string;
    where: string;
}

declare class DbQueries {
    constructor();
    
    /**
     * Creates a table in the database
     * @param options - Table creation options
     */
    createTable(options: CreateTableOptions): Promise<string>;

    /**
     * Inserts data into a table
     * @param options - Insert options
     */
    insert(options: InsertTableOptions): Promise<string>;

    /**
     * Selects data from a table
     * @param options - Select options
     */
    select(options: SelectTableOptions): Promise<string>;

    /**
     * Updates data in a table
     * @param options - Update options
     */
    update(options: UpdateTableOptions): Promise<string>;

    /**
     * Deletes data from a table
     * @param options - Delete options
     */
    delete(options: DeleteTableOptions): Promise<string>;
}

export default DbQueries; 