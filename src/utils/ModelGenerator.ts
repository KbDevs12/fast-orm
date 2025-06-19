import fs from 'fs/promises';
import path from 'path';
import { ColumnInfo } from './DatabaseIntrospector';
import { mapMySQLTypeToTypeScriptType } from './TypeMapper';
import { TableSchema, ColumnDefinition } from '../interfaces/OrmSchema';

function toPascalCase(str: string): string {
    return str.replace(/_(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase());
}

export class ModelGenerator {
    constructor() {}

    private generateModelContent(
        tableName: string,
        columns: (ColumnInfo | ColumnDefinition)[]
    ): string {
        const className = toPascalCase(tableName);
        let interfaceProperties = '';
        let classProperties = '';
        let constructorAssignments = '';

        columns.forEach((col) => {
            let colName: string;
            let tsType: string;
            let isOptional: boolean;

            if ('columnName' in col) {
                colName = col.columnName;
                tsType = mapMySQLTypeToTypeScriptType(col.dataType, col.isNullable);
                isOptional =
                    col.isNullable === 'YES' ||
                    col.defaultValue !== null ||
                    col.extra.includes('auto_increment');
            } else {
                colName = col.name;
                tsType = col.type;
                isOptional =
                    col.nullable === true ||
                    col.default !== undefined ||
                    col.autoIncrement === true;
            }

            interfaceProperties += `    ${colName}${isOptional ? '?' : ''}: ${tsType};\n`;
            classProperties += `    public ${colName}${isOptional ? '?' : ''}: ${tsType};\n`;
            constructorAssignments += `        if (data && data.${colName} !== undefined) this.${colName} = data.${colName};\n`;
        });

        // Template
        const modelContent = `
import { Model, Identifiable } from 'fast-orm'; // Import dari package FastOrm

export interface I${className} extends Identifiable {
${interfaceProperties.trim()}
}

export class ${className} extends Model<I${className}> implements I${className} {
${classProperties.trim()}

    constructor(data?: Partial<I${className}>) {
        super('${tableName}'); // Nama tabel di MySQL

        if (data) {
${constructorAssignments.trim()}
        }
    }
}
        `.trim();
        return modelContent;
    }

    async writeModelFile(
        tableName: string,
        columns: (ColumnInfo | ColumnDefinition)[],
        outputPath: string
    ): Promise<string> {
        const className = toPascalCase(tableName);
        const modelContent = this.generateModelContent(tableName, columns);
        const filePath = path.join(outputPath, `${className}.ts`);
        await fs.mkdir(outputPath, { recursive: true });
        await fs.writeFile(filePath, modelContent);
        return filePath;
    }
}
