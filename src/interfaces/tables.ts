import { TableColumnConstraints, TableColumnType, TableConflictOptions } from "@/core/enums";

export interface ForeignKeyReference {
    table: string;
    column: string;
}

interface CreateTableOptions {
    name: string;
    columns: Array<{
        name: string;
        type: TableColumnType;
        constraints?: TableColumnConstraints[];
        foreignKey?: ForeignKeyReference;
    }>;
    data?: Record<string, any>[];
}

interface InsertTableOptions {
    table: string;
    data: Record<string, any>;
    onConflict?: TableConflictOptions;
}

interface GetTablesOptions {
    dbName: string;
}

interface InsertManyTableOptions {
    table: string;
    data: Record<string, any>[];
    onConflict?: TableConflictOptions;
}

interface SelectTableOptions {
    table: string;
    columns: string[];
}

interface UpdateTableOptions {
    table: string;
    data: Record<string, any>;
    where: string;
}

interface DeleteTableOptions {
    table: string;
    where: string;
}

interface QDBExecuteOptions{
    query: string;
    timeout?: number;
}

interface WhereOptions{
    [key: string]: string | number | boolean;
}

interface QDBTable{
    name: string;
    columns: QDBTableColumn[];
    data: Record<string, any>[];
}

interface QDBTableColumn{
    name: string;
    type: TableColumnType;
    constraints?: TableColumnConstraints[];
    foreignKey?: ForeignKeyReference;
}

interface QDBInsertData{
    name: string;
    data: Record<string, any>[];
    onConflict?: TableConflictOptions;
}

interface QDBQueryResult{
    success: boolean;
    data: any;
    error?: any;
}

interface QDBTableData{
    primaryKey: string;
    data: Record<string, any>[];
}

export type { 
    CreateTableOptions,
    InsertTableOptions,
    InsertManyTableOptions,
    SelectTableOptions,
    UpdateTableOptions,
    DeleteTableOptions,
    QDBExecuteOptions,
    WhereOptions,
    QDBTable,
    QDBTableColumn,
    GetTablesOptions,
    QDBQueryResult,
    QDBTableData,
    QDBInsertData
};