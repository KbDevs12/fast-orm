export function mapMySQLTypeToTypeScriptType(mysqlType: string, isNullable: 'YES' | 'NO'): string {
    let tsType: string;
    switch (mysqlType.toLowerCase()) {
        case 'int':
        case 'tinyint':
        case 'smallint':
        case 'mediumint':
        case 'bigint':
        case 'float':
        case 'double':
        case 'decimal':
            tsType = 'number';
            break;
        case 'char':
        case 'varchar':
        case 'text':
        case 'tinytext':
        case 'mediumtext':
        case 'longtext':
        case 'enum':
        case 'set':
            tsType = 'string';
            break;
        case 'date':
        case 'datetime':
        case 'timestamp':
            tsType = 'Date';
            break;
        case 'boolean':
        case 'bool':
            tsType = 'boolean';
            break;
        case 'json':
            tsType = 'any';
            break;
        default:
            tsType = 'any';
    }
    return isNullable === 'YES' ? `${tsType} | null` : tsType;
}
