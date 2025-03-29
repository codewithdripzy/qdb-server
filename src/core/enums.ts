enum TableColumnType{
    INTEGER = 'INTEGER',
    TEXT = 'TEXT',
    REAL = 'REAL',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    TIME = 'TIME',
    DATETIME = 'DATETIME',
    BLOB = 'BLOB',
    FLOAT = 'FLOAT',
    DOUBLE = 'DOUBLE',
    DECIMAL = 'DECIMAL',
    VARCHAR = 'VARCHAR',
    CHAR = 'CHAR',
}

enum TableColumnConstraints{
    PRIMARY_KEY = 'PRIMARY KEY',
    UNIQUE = 'UNIQUE',
    NOT_NULL = 'NOT NULL',
    AUTOINCREMENT = 'AUTOINCREMENT',
    DEFAULT = "DEFAULT",
    FOREIGN_KEY = "FOREIGN KEY",
    REFERENCES = "REFERENCES",
    CURRENT_TIMESTAMP = "CURRENT_TIMESTAMP",
    ON_UPDATE_CURRENT_TIMESTAMP = "ON UPDATE CURRENT_TIMESTAMP",
}

enum TableConflictOptions{
    IGNORE = "IGNORE",
    REPLACE = "REPLACE",
    ROLLBACK = "ROLLBACK",
    ABORT = "ABORT",
    FAIL = "FAIL",
}

enum QDBServerType{
    QUERY = "query",
    SUBSCRIBE = "subscribe",
}

enum QDBServerRequestType{
    ALL = "ALL",
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
}

export { TableColumnType, TableColumnConstraints, TableConflictOptions, QDBServerType, QDBServerRequestType };
