import { Connection } from './Connection';
import { Model, Identifiable, BaseData, ModelHook } from './Model';
import { QueryBuilder } from './QueryBuilder';
import { PoolOptions } from 'mysql2/promise';
import { PoolConnection } from 'mysql2/promise';

export class FastOrm {
    public readonly connection: Connection;

    public readonly Model: new <T extends Identifiable>(tableName: string) => Model<T>;

    constructor(config: PoolOptions) {
        this.connection = new Connection(config);
        const sharedConnection = this.connection;

        this.Model = class<T extends Identifiable> extends Model<T> {
            constructor(tableName: string) {
                super(tableName);
                this.setConnection(sharedConnection);
            }
        };
    }

    public async transaction<TResult>(
        callback: (
            trxConnection: Connection,
            ModelTrx: new <T extends Identifiable>(tableName: string) => Model<T>
        ) => Promise<TResult>
    ): Promise<TResult> {
        let connection: PoolConnection | undefined;
        try {
            connection = await this.connection.beginTransaction();

            const trxConnection = new Connection(connection);

            const ModelTrx = class<T extends Identifiable> extends Model<T> {
                constructor(tableName: string) {
                    super(tableName);
                    this.setConnection(trxConnection);
                }
            };

            const result = await callback(trxConnection, ModelTrx);
            await this.connection.commitTransaction(connection);
            return result;
        } catch (error) {
            if (connection) {
                await this.connection.rollbackTransaction(connection);
            }
            throw error;
        } finally {
            if (connection) {
                // Penting: Rilis PoolConnection kembali ke pool, terlepas dari apakah itu komit atau rollback
                this.connection.releaseConnection(connection);
            }
        }
    }

    async disconnect(): Promise<void> {
        await this.connection.end();
    }
}

export { Identifiable, BaseData, Connection, Model, QueryBuilder, ModelHook };
