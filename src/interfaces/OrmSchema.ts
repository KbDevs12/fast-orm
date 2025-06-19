export type TypeScriptDataType = 'string' | 'number' | 'boolean' | 'Date' | 'Buffer' | 'any';

export type MySQLColumnType =
    | 'INT'
    | 'TINYINT'
    | 'SMALLINT'
    | 'MEDIUMINT'
    | 'BIGINT'
    | 'FLOAT'
    | 'DOUBLE'
    | 'DECIMAL'
    | 'CHAR'
    | 'VARCHAR'
    | 'TINYTEXT'
    | 'TEXT'
    | 'MEDIUMTEXT'
    | 'LONGTEXT'
    | 'DATE'
    | 'DATETIME'
    | 'TIMESTAMP'
    | 'BOOLEAN'
    | 'JSON'
    | 'BLOB'
    | 'TINYBLOB'
    | 'MEDIUMBLOB'
    | 'LONGBLOB'
    | 'ENUM'
    | 'SET'
    | string;

export interface ColumnDefinition {
    name: string;
    type: TypeScriptDataType;
    mysqlType?: MySQLColumnType;
    maxLength?: number;
    primaryKey?: boolean;
    autoIncrement?: boolean;
    nullable?: boolean;
    unique?: boolean;
    default?: string | number | boolean | null;
    enumValues?: string[];
    comment?: string;
    // validation?: { min?: number, max?: number, regex?: string, custom?: string };
    // hidden?: boolean; // Untuk menyembunyikan properti dari output JSON
}

// --- Index Definition ---
export type IndexType = 'INDEX' | 'UNIQUE' | 'FULLTEXT' | 'SPATIAL';

export interface IndexDefinition {
    name?: string;
    columns: string[];
    type?: IndexType;
    algorithm?: 'BTREE' | 'HASH';
    comment?: string;
}

// --- Relation Definition ---
export type RelationType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

export interface RelationDefinition {
    type: RelationType;
    model: string;
    foreignKey?: string;
    otherKey?: string;
    through?: string;
    pivotForeignKey?: string;
    pivotOtherKey?: string;
    eagerLoad?: boolean;
}

// --- Table Schema ---
export interface TableSchema {
    tableName: string;
    columns: ColumnDefinition[];
    relations?: { [key: string]: RelationDefinition };
    indices?: IndexDefinition[];
    comment?: string;
}
