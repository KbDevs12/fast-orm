import { Connection } from './Connection';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { QueryBuilder } from './QueryBuilder';

export interface BaseData {
    [key: string]: any;
}

export interface Identifiable extends BaseData {
    id?: number;
}

export type ModelHook<T extends Identifiable> = (
    instance: T,
    connection?: Connection
) => Promise<void>;

interface ModelHooks<T extends Identifiable> {
    beforeCreate?: ModelHook<T>[];
    afterCreate?: ModelHook<T>[];
    beforeUpdate?: ModelHook<T>[];
    afterUpdate?: ModelHook<T>[];
    beforeDelete?: ModelHook<T>[];
    afterDelete?: ModelHook<T>[];
}

export abstract class Model<T extends Identifiable> {
    protected tableName: string;
    private _connection: Connection | null = null;
    private hooks: ModelHooks<T> = {};

    constructor(tableName: string) {
        if (!tableName) {
            throw new Error('Model requires a table name.');
        }
        this.tableName = tableName;
    }

    public setConnection(connection: Connection): void {
        this._connection = connection;
    }

    protected get connection(): Connection {
        if (!this._connection) {
            throw new Error(
                'Database connection has not been set for this model. Ensure you instantiate your models via MySqlOrm.'
            );
        }
        return this._connection;
    }

    public query(): QueryBuilder<T> {
        return new QueryBuilder<T>(this.tableName, this.connection);
    }

    public addHook(type: keyof ModelHooks<T>, hook: ModelHook<T>): void {
        if (!this.hooks[type]) {
            this.hooks[type] = [];
        }
        this.hooks[type]?.push(hook);
    }

    private async runHooks(
        type: keyof ModelHooks<T>,
        instance: T,
        connection?: Connection
    ): Promise<void> {
        if (this.hooks[type]) {
            for (const hook of this.hooks[type]!) {
                await hook(instance, connection);
            }
        }
    }

    async findById(id: number): Promise<T | null> {
        const result = await this.query().where('id', '=', id).first();
        return result as T | null;
    }

    async findAll(): Promise<T[]> {
        return (await this.query().get()) as T[];
    }

    async create(data: Omit<T, 'id'>): Promise<T> {
        const newInstance = { ...data } as T;
        await this.runHooks('beforeCreate', newInstance);

        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data)
            .map(() => '?')
            .join(', ');
        const values = Object.values(data);
        const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
        const result = await this.connection.query<ResultSetHeader>(sql, values);

        newInstance.id = result.insertId;
        await this.runHooks('afterCreate', newInstance);
        return newInstance;
    }

    async update(id: number, data: Partial<Omit<T, 'id'>>): Promise<boolean> {
        const existingInstance = await this.findById(id);
        if (!existingInstance) {
            return false;
        }
        const updatedInstance = { ...existingInstance, ...data } as T;
        await this.runHooks('beforeUpdate', updatedInstance);

        const setClauses = Object.keys(data)
            .map((key) => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(data), id];
        const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`;
        const result = await this.connection.query<ResultSetHeader>(sql, values);

        if (result.affectedRows > 0) {
            await this.runHooks('afterUpdate', updatedInstance);
            return true;
        }
        return false;
    }

    async delete(id: number): Promise<boolean> {
        const instanceToDelete = await this.findById(id);
        if (!instanceToDelete) {
            return false;
        }
        await this.runHooks('beforeDelete', instanceToDelete);

        const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
        const result = await this.connection.query<ResultSetHeader>(sql, [id]);

        if (result.affectedRows > 0) {
            await this.runHooks('afterDelete', instanceToDelete);
            return true;
        }
        return false;
    }
}
