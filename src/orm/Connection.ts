import mysql, {
    Pool,
    PoolOptions,
    ResultSetHeader,
    RowDataPacket,
    PoolConnection,
} from 'mysql2/promise';

export type QueryResult = RowDataPacket[] | ResultSetHeader;

export class Connection {
    private pool: Pool | null = null;
    private transactionalConnection: PoolConnection | null = null;
    private _isTransactionConnection: boolean = false;

    constructor(configOrConnection: PoolOptions | PoolConnection) {
        if ('execute' in configOrConnection) {
            this.transactionalConnection = configOrConnection;
            this._isTransactionConnection = true;
        } else {
            const poolConfig: PoolOptions = {
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                ...configOrConnection,
            };
            this.pool = mysql.createPool(poolConfig);
        }
    }

    private async getActiveConnection(): Promise<PoolConnection> {
        if (this._isTransactionConnection && this.transactionalConnection) {
            return this.transactionalConnection;
        }
        if (this.pool) {
            return await this.pool.getConnection();
        }
        throw new Error('No active database connection or pool available.');
    }

    public releaseConnection(connection: PoolConnection | undefined): void {
        if (!this._isTransactionConnection && connection) {
            connection.release();
        }
    }

    public async query<T extends QueryResult>(sql: string, params?: any[]): Promise<T> {
        let connection: PoolConnection | undefined;
        try {
            connection = await this.getActiveConnection();
            const [rows] = await connection.execute(sql, params);
            return rows as T;
        } finally {
            if (!this._isTransactionConnection) {
                this.releaseConnection(connection);
            }
        }
    }

    public async beginTransaction(): Promise<PoolConnection> {
        if (this._isTransactionConnection) {
            throw new Error('Cannot begin a transaction from a transactional connection.');
        }
        const connection = await this.getActiveConnection();
        await connection.beginTransaction();
        return connection;
    }

    public async commitTransaction(connection: PoolConnection): Promise<void> {
        await connection.commit();
    }

    public async rollbackTransaction(connection: PoolConnection): Promise<void> {
        await connection.rollback();
    }

    public async end(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}
