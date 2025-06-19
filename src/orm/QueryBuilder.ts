import { Connection } from './Connection';
import { Identifiable } from './Model';
import { RowDataPacket } from 'mysql2/promise';

// --- Interfaces & Types for QueryBuilder ---

type WhereClause = {
    type: 'basic' | 'nested' | 'raw';
    column?: string;
    operator?: string;
    value?: any;
    clauses?: (WhereClause | WhereGroup)[];
    sql?: string;
    params?: any[];
    boolean?: 'AND' | 'OR';
};

type WhereGroup = {
    type: 'group';
    boolean: 'AND' | 'OR';
    clauses: (WhereClause | WhereGroup)[];
};

type OrderByCondition = [string, 'ASC' | 'DESC'];

type JoinType = 'INNER' | 'LEFT' | 'RIGHT';

// Callback untuk kondisi join yang lebih kompleks
type JoinCallback = (join: QueryBuilder<any>) => void;

// --- QueryBuilder Class ---

export class QueryBuilder<T extends Identifiable> {
    private tableName: string;
    private connection: Connection;
    private selectColumns: string[] = ['*'];
    private whereClauses: (WhereClause | WhereGroup)[] = [];
    private limitValue: number | null = null;
    private offsetValue: number | null = null;
    private orderByConditions: OrderByCondition[] = [];
    private groupByColumns: string[] = [];
    private havingConditions: WhereClause[] = [];
    private joinClauses: {
        type: JoinType;
        table: string;
        on: string;
        params: any[];
    }[] = [];

    private currentWhereGroup: (WhereClause | WhereGroup)[] | null = null;

    constructor(tableName: string, connection: Connection) {
        this.tableName = tableName;
        this.connection = connection;
    }

    // --- Query Modifiers ---

    select(...columns: string[]): QueryBuilder<T> {
        this.selectColumns = columns.length ? columns : ['*'];
        return this;
    }

    // --- WHERE Conditions ---

    private addWhere(clause: WhereClause | WhereGroup): QueryBuilder<T> {
        if (this.currentWhereGroup) {
            this.currentWhereGroup.push(clause);
        } else {
            this.whereClauses.push(clause);
        }
        return this;
    }

    where(column: string, operator: string, value: any): QueryBuilder<T>;
    where(callback: (query: QueryBuilder<T>) => void): QueryBuilder<T>;
    where(
        columnOrCallback: string | ((query: QueryBuilder<T>) => void),
        operator?: string,
        value?: any
    ): QueryBuilder<T> {
        if (typeof columnOrCallback === 'function') {
            const nestedBuilder = new QueryBuilder<T>(this.tableName, this.connection);
            nestedBuilder.currentWhereGroup = [];
            columnOrCallback(nestedBuilder);
            if (nestedBuilder.currentWhereGroup!.length > 0) {
                this.addWhere({
                    type: 'group',
                    boolean: 'AND',
                    clauses: nestedBuilder.currentWhereGroup!,
                });
            }
            nestedBuilder.currentWhereGroup = null;
        } else if (
            typeof columnOrCallback === 'string' &&
            operator !== undefined &&
            value !== undefined
        ) {
            this.addWhere({
                type: 'basic',
                boolean: 'AND',
                column: columnOrCallback,
                operator: operator,
                value: value,
            });
        }
        return this;
    }

    orWhere(column: string, operator: string, value: any): QueryBuilder<T>;
    orWhere(callback: (query: QueryBuilder<T>) => void): QueryBuilder<T>;
    orWhere(
        columnOrCallback: string | ((query: QueryBuilder<T>) => void),
        operator?: string,
        value?: any
    ): QueryBuilder<T> {
        if (typeof columnOrCallback === 'function') {
            const nestedBuilder = new QueryBuilder<T>(this.tableName, this.connection);
            nestedBuilder.currentWhereGroup = [];
            columnOrCallback(nestedBuilder);
            if (nestedBuilder.currentWhereGroup!.length > 0) {
                this.addWhere({
                    type: 'group',
                    boolean: 'OR',
                    clauses: nestedBuilder.currentWhereGroup!,
                });
            }
            nestedBuilder.currentWhereGroup = null;
        } else if (
            typeof columnOrCallback === 'string' &&
            operator !== undefined &&
            value !== undefined
        ) {
            this.addWhere({
                type: 'basic',
                boolean: 'OR',
                column: columnOrCallback,
                operator: operator,
                value: value,
            });
        }
        return this;
    }

    whereIn(column: string, values: any[]): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'IN',
            value: values,
        });
        return this;
    }

    orWhereIn(column: string, values: any[]): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'IN',
            value: values,
        });
        return this;
    }

    whereNotIn(column: string, values: any[]): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'NOT IN',
            value: values,
        });
        return this;
    }

    orWhereNotIn(column: string, values: any[]): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'NOT IN',
            value: values,
        });
        return this;
    }

    whereNull(column: string): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'IS NULL',
            value: null,
        });
        return this;
    }

    orWhereNull(column: string): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'IS NULL',
            value: null,
        });
        return this;
    }

    whereNotNull(column: string): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'IS NOT NULL',
            value: null,
        });
        return this;
    }

    orWhereNotNull(column: string): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'IS NOT NULL',
            value: null,
        });
        return this;
    }

    whereBetween(column: string, min: any, max: any): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'BETWEEN',
            value: [min, max],
        });
        return this;
    }

    orWhereBetween(column: string, min: any, max: any): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'BETWEEN',
            value: [min, max],
        });
        return this;
    }

    whereNotBetween(column: string, min: any, max: any): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'AND',
            column,
            operator: 'NOT BETWEEN',
            value: [min, max],
        });
        return this;
    }

    orWhereNotBetween(column: string, min: any, max: any): QueryBuilder<T> {
        this.addWhere({
            type: 'basic',
            boolean: 'OR',
            column,
            operator: 'NOT BETWEEN',
            value: [min, max],
        });
        return this;
    }

    whereRaw(sql: string, params: any[] = []): QueryBuilder<T> {
        this.addWhere({ type: 'raw', boolean: 'AND', sql, params });
        return this;
    }

    orWhereRaw(sql: string, params: any[] = []): QueryBuilder<T> {
        this.addWhere({ type: 'raw', boolean: 'OR', sql, params });
        return this;
    }

    // --- JOINs ---
    private addJoin(
        type: JoinType,
        table: string,
        onCondition: string | JoinCallback,
        onParams: any[] = []
    ): QueryBuilder<T> {
        let conditionSql: string;
        let conditionParams: any[] = [];

        if (typeof onCondition === 'string') {
            conditionSql = onCondition;
            conditionParams = onParams;
        } else {
            const joinBuilder = new QueryBuilder<any>(table, this.connection);
            joinBuilder.currentWhereGroup = [];
            onCondition(joinBuilder);
            const { sql: innerSql, params: innerParams } = this.buildWhereClause(
                joinBuilder.currentWhereGroup!
            );
            conditionSql = innerSql;
            conditionParams = innerParams;
            joinBuilder.currentWhereGroup = null; // Reset
        }

        this.joinClauses.push({
            type,
            table,
            on: conditionSql,
            params: conditionParams,
        });
        return this;
    }

    innerJoin(
        table: string,
        firstColumn: string | JoinCallback,
        operator?: string,
        secondColumn?: string
    ): QueryBuilder<T> {
        if (typeof firstColumn === 'function') {
            return this.addJoin('INNER', table, firstColumn);
        }
        if (!operator || !secondColumn) {
            throw new Error('For string-based join, operator and secondColumn are required.');
        }
        return this.addJoin('INNER', table, `${firstColumn} ${operator} ${secondColumn}`);
    }

    leftJoin(
        table: string,
        firstColumn: string | JoinCallback,
        operator?: string,
        secondColumn?: string
    ): QueryBuilder<T> {
        if (typeof firstColumn === 'function') {
            return this.addJoin('LEFT', table, firstColumn);
        }
        if (!operator || !secondColumn) {
            throw new Error('For string-based join, operator and secondColumn are required.');
        }
        return this.addJoin('LEFT', table, `${firstColumn} ${operator} ${secondColumn}`);
    }

    rightJoin(
        table: string,
        firstColumn: string | JoinCallback,
        operator?: string,
        secondColumn?: string
    ): QueryBuilder<T> {
        if (typeof firstColumn === 'function') {
            return this.addJoin('RIGHT', table, firstColumn);
        }
        if (!operator || !secondColumn) {
            throw new Error('For string-based join, operator and secondColumn are required.');
        }
        return this.addJoin('RIGHT', table, `${firstColumn} ${operator} ${secondColumn}`);
    }

    limit(count: number): QueryBuilder<T> {
        this.limitValue = count;
        return this;
    }

    offset(count: number): QueryBuilder<T> {
        this.offsetValue = count;
        return this;
    }

    orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder<T> {
        this.orderByConditions.push([column, direction]);
        return this;
    }

    groupBy(...columns: string[]): QueryBuilder<T> {
        this.groupByColumns = columns;
        return this;
    }

    having(column: string, operator: string, value: any): QueryBuilder<T> {
        this.havingConditions.push({
            type: 'basic',
            boolean: 'AND',
            column,
            operator,
            value,
        });
        return this;
    }

    // --- Aggregation Methods ---

    async count(column: string = '*'): Promise<number> {
        this.selectColumns = [`COUNT(${column}) as count`];
        const result = await this.getRaw<any[]>();
        return result[0]?.count || 0;
    }

    async sum(column: string): Promise<number> {
        this.selectColumns = [`SUM(${column}) as sum`];
        const result = await this.getRaw<any[]>();
        return result[0]?.sum || 0;
    }

    async avg(column: string): Promise<number> {
        this.selectColumns = [`AVG(${column}) as avg`];
        const result = await this.getRaw<any[]>();
        return result[0]?.avg || 0;
    }

    async first(): Promise<T | null> {
        this.limit(1);
        const results = await this.get();
        return results[0] || null;
    }

    async get(): Promise<T[]> {
        const { sql, params } = this.buildSql();
        const result = await this.connection.query<RowDataPacket[]>(sql, params);
        return result as T[];
    }

    async getRaw<R extends RowDataPacket[]>(): Promise<R> {
        const { sql, params } = this.buildSql();
        return await this.connection.query<R>(sql, params);
    }

    // --- Internal SQL Building ---

    private buildWhereClause(clauses: (WhereClause | WhereGroup)[]): {
        sql: string;
        params: any[];
    } {
        const parts: string[] = [];
        const params: any[] = [];

        clauses.forEach((clause, index) => {
            const boolean = index === 0 ? '' : clause.boolean + ' '; // Hanya menambahkan AND/OR jika bukan klausa pertama

            if (clause.type === 'basic') {
                let operatorPart = clause.operator!;
                if (clause.operator === 'IN' || clause.operator === 'NOT IN') {
                    const placeholders = clause.value.map(() => '?').join(', ');
                    operatorPart = `${clause.operator} (${placeholders})`;
                    params.push(...clause.value);
                } else if (clause.operator === 'BETWEEN' || clause.operator === 'NOT BETWEEN') {
                    operatorPart = `${clause.operator} ? AND ?`;
                    params.push(clause.value[0], clause.value[1]);
                } else if (clause.operator === 'IS NULL' || clause.operator === 'IS NOT NULL') {
                    // Tidak perlu push value untuk IS NULL/IS NOT NULL
                    params.push(); // Push dummy to keep array length consistent
                } else {
                    params.push(clause.value);
                }
                parts.push(`${boolean}${clause.column} ${operatorPart}`);
            } else if (clause.type === 'group') {
                const nested = this.buildWhereClause(clause.clauses!);
                parts.push(`${boolean}(${nested.sql})`);
                params.push(...nested.params);
            } else if (clause.type === 'raw') {
                parts.push(`${boolean}(${clause.sql})`);
                params.push(...(clause.params || []));
            }
        });

        return { sql: parts.join(' '), params };
    }

    private buildSql(): { sql: string; params: any[] } {
        let sql = `SELECT ${this.selectColumns.join(', ')} FROM ${this.tableName}`;
        const params: any[] = [];

        // JOINs
        if (this.joinClauses.length > 0) {
            this.joinClauses.forEach((join) => {
                sql += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
                params.push(...join.params);
            });
        }

        // WHERE clauses
        if (this.whereClauses.length > 0) {
            const { sql: whereSql, params: whereParams } = this.buildWhereClause(this.whereClauses);
            sql += ` WHERE ${whereSql}`;
            params.push(...whereParams);
        }

        // GROUP BY
        if (this.groupByColumns.length > 0) {
            sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
        }

        // HAVING clauses (sementara masih sederhana)
        if (this.havingConditions.length > 0) {
            const havingParts: string[] = [];
            this.havingConditions.forEach((h) => {
                params.push(h.value);
                havingParts.push(`${h.column} ${h.operator} ?`);
            });
            sql += ` HAVING ${havingParts.join(' AND ')}`;
        }

        // ORDER BY
        if (this.orderByConditions.length > 0) {
            const orderByParts = this.orderByConditions.map((o) => `${o[0]} ${o[1]}`);
            sql += ` ORDER BY ${orderByParts.join(', ')}`;
        }

        // LIMIT & OFFSET
        if (this.limitValue !== null) {
            sql += ` LIMIT ?`;
            params.push(this.limitValue);
        }
        if (this.offsetValue !== null) {
            sql += ` OFFSET ?`;
            params.push(this.offsetValue);
        }

        return { sql, params };
    }
}
