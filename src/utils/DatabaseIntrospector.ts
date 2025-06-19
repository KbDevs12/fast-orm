import { Connection } from '../orm/Connection';
import { RowDataPacket } from 'mysql2/promise';
export interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: 'YES' | 'NO';
    columnKey: string;
    // defaultKey: string;
    defaultValue: string | null;
    extra: string;
}

export class DatabaseIntrospector {
    constructor(private connection: Connection) {}

    async getTableColumns(databaseName: string, tableName: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT
                COLUMN_NAME as columnName,
                DATA_TYPE as dataType,
                IS_NULLABLE as isNullable,
                COLUMN_KEY as columnKey,
                COLUMN_DEFAULT as defaultValue,
                EXTRA as extra
            FROM
                INFORMATION_SCHEMA.COLUMNS
            WHERE
                TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION;
        `;
        const rows = await this.connection.query<RowDataPacket[]>(sql, [databaseName, tableName]);
        return rows as ColumnInfo[];
    }

    /**
     * Mengambil semua nama tabel dari database yang diberikan.
     * @param databaseName Nama database.
     * @returns Promise yang resolve dengan array string nama tabel.
     */
    async getAllTableNames(databaseName: string): Promise<string[]> {
        const sql = `
            SELECT TABLE_NAME as tableName
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE';
        `;
        const rows = await this.connection.query<RowDataPacket[]>(sql, [databaseName]);
        return rows.map((row) => (row as { tableName: string }).tableName);
    }
}
