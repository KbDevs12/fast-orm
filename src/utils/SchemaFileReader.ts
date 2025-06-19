import fs from 'fs/promises';
import path from 'path';
import { TableSchema } from '../interfaces/OrmSchema';

export class SchemaFileReader {
    async readSchemaFile(filePath: string): Promise<TableSchema> {
        const fileExtension = path.extname(filePath).toLowerCase();
        let fileContent: string;

        try {
            fileContent = await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            throw new Error(
                `Failed to read schema file '${filePath}': ${(error as Error).message}`
            );
        }

        switch (fileExtension) {
            case '.json':
                return JSON.parse(fileContent) as TableSchema;
            case '.ts':
            case '.js':
                try {
                    if (fileExtension === '.ts' && process.env.NODE_ENV === 'development') {
                        require('ts-node/register');
                    }
                    const resolvedPath = path.resolve(filePath);
                    if (require.cache[resolvedPath]) {
                        delete require.cache[resolvedPath];
                    }
                    const schemaModule = require(resolvedPath);
                    if (schemaModule.default) {
                        return schemaModule.default as TableSchema;
                    } else {
                        return schemaModule as TableSchema;
                    }
                } catch (err) {
                    throw new Error(
                        `Failed to load schema from JS/TS file '${filePath}': ${
                            (err as Error).message
                        }`
                    );
                }
            default:
                throw new Error(
                    `Unsupported schema file extension: ${fileExtension}. Only .json, .ts, .js are supported.`
                );
        }
    }
}
