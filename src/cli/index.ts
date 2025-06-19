#!/usr/bin/env node
import { Command } from "commander";
import { FastOrm, Connection } from "../orm";
import { DatabaseIntrospector } from "../utils/DatabaseIntrospector";
import { ModelGenerator } from "../utils/ModelGenerator";
import { SchemaFileReader } from "../utils/SchemaFileReader";
import { MigrationRunner } from "../migrations/MigrationRunner";
import { PoolOptions } from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const program = new Command();

program
  .name("fastorm")
  .description(
    "CLI tool for FastOrm - MySQL ORM model generation, schema management, and migrations."
  )
  .version("1.0.0");

// --- Helper untuk mendapatkan konfigurasi DB ---
function getDbConfig(
  configFile?: string,
  options?: { host?: string; user?: string; password?: string; dbName?: string }
): PoolOptions {
  let config: PoolOptions = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  if (configFile) {
    try {
      const configPath = path.resolve(process.cwd(), configFile);
      const fileContent = fs.readFileSync(configPath, "utf-8");
      const fileConfig = JSON.parse(fileContent);
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.error(
        `Error: Could not read or parse config file ${configFile}. Details: ${
          (error as Error).message
        }`
      );
      process.exit(1);
    }
  }

  if (options) {
    if (options.host) config.host = options.host;
    if (options.user) config.user = options.user;
    if (options.password) config.password = options.password;
    if (options.dbName) config.database = options.dbName;
  }

  if (!config.database) {
    console.error(
      "Error: Database name is not provided. Use --db-name, specify in config file (-c), or set DB_NAME in .env."
    );
    process.exit(1);
  }
  return config;
}
// --- Akhir Helper ---

// --- Perintah generate:from-db ---
program
  .command("generate:from-db <outputDir>")
  .description(
    "Generates TypeScript models from an existing MySQL database schema."
  )
  .option(
    "-c, --config <file>",
    "Path to a JSON configuration file for database connection."
  )
  .option("--host <host>", "Database host.")
  .option("--user <user>", "Database user.")
  .option("--password <password>", "Database password.")
  .option("--db-name <database>", "Database name.")
  .action(async (outputDir: string, options: any) => {
    let orm: FastOrm | undefined;
    try {
      const dbConfig = getDbConfig(options.config, options);

      console.log(
        `Connecting to database: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}...`
      );
      orm = new FastOrm(dbConfig);
      const connection = orm.connection;

      const introspector = new DatabaseIntrospector(connection);
      const modelGenerator = new ModelGenerator();

      console.log(
        `Generating models from database '${dbConfig.database}' into '${outputDir}'...`
      );

      const tableNames = await introspector.getAllTableNames(
        dbConfig.database!
      );
      if (tableNames.length === 0) {
        console.warn(`No tables found in database '${dbConfig.database}'.`);
        return;
      }

      const generatedFiles: string[] = [];
      for (const tableName of tableNames) {
        try {
          const columns = await introspector.getTableColumns(
            dbConfig.database!,
            tableName
          );
          if (columns.length === 0) {
            console.warn(`Skipping table '${tableName}' (no columns found).`);
            continue;
          }
          const filePath = await modelGenerator.writeModelFile(
            tableName,
            columns,
            outputDir
          );
          generatedFiles.push(filePath);
        } catch (error) {
          console.error(
            `Error generating model for table '${tableName}': ${
              (error as Error).message
            }`
          );
        }
      }

      console.log("\n--- Generation Complete ---");
      if (generatedFiles.length > 0) {
        console.log(
          `Successfully generated ${generatedFiles.length} model files:`
        );
        generatedFiles.forEach((file) => console.log(`- ${file}`));
      } else {
        console.log(
          "No models were successfully generated. Please check for errors above."
        );
      }
    } catch (error) {
      console.error("\n--- Error during model generation from database ---");
      console.error((error as Error).message);
      process.exit(1);
    } finally {
      if (orm) {
        await orm.disconnect();
        console.log("Database connection closed.");
      }
    }
  });
// --- Akhir perintah generate:from-db ---

// --- Perintah generate:from-schema ---
program
  .command("generate:from-schema <schemaFile> <outputDir>")
  .description(
    "Generates TypeScript models from a custom schema definition file (JSON/TS/JS)."
  )
  .action(async (schemaFile: string, outputDir: string) => {
    try {
      const schemaReader = new SchemaFileReader();
      const modelGenerator = new ModelGenerator();

      console.log(`Reading schema from '${schemaFile}'...`);
      const schema = await schemaReader.readSchemaFile(schemaFile);

      console.log(
        `Generating model for table '${schema.tableName}' into '${outputDir}'...`
      );
      const filePath = await modelGenerator.writeModelFile(
        schema.tableName,
        schema.columns,
        outputDir
      );

      console.log("\n--- Generation Complete ---");
      console.log(`Successfully generated model file: ${filePath}`);
    } catch (error) {
      console.error("\n--- Error during model generation from schema file ---");
      console.error((error as Error).message);
      process.exit(1);
    }
  });
// --- Akhir perintah generate:from-schema ---

// --- Perintah make:migration ---
program
  .command("make:migration <name>")
  .description("Creates a new migration file.")
  .option("--dir", "Directory for migration files (default: src/migrations)")
  .action(async (name: string, options: any) => {
    try {
      // Kita tidak perlu koneksi DB untuk membuat file migrasi
      const migrationRunner = new MigrationRunner(null as any, options.dir); // Paksa null, tidak digunakan
      const filePath = await migrationRunner.createMigrationFile(name);
      console.log(`Migration file created: ${filePath}`);
    } catch (error) {
      console.error("\n--- Error creating migration file ---");
      console.error((error as Error).message);
      process.exit(1);
    }
  });
// --- Akhir perintah make:migration ---

// --- Perintah migrate:up ---
program
  .command("migrate:up")
  .description("Runs all pending migrations.")
  .option(
    "-c, --config <file>",
    "Path to a JSON configuration file for database connection."
  )
  .option("--host <host>", "Database host.")
  .option("--user <user>", "Database user.")
  .option("--password <password>", "Database password.")
  .option("--db-name <database>", "Database name.")
  .option(
    "--dir <directory>",
    "Directory for migration files (default: src/migrations)",
    "src/migrations"
  )
  .action(async (options: any) => {
    let orm: FastOrm | undefined;
    try {
      const dbConfig = getDbConfig(options.config, options);
      console.log(
        `Connecting to database for migrations: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}...`
      );
      orm = new FastOrm(dbConfig);
      const migrationRunner = new MigrationRunner(orm.connection, options.dir);

      await migrationRunner.migrateUp();
      console.log("\nMigrations UP complete.");
    } catch (error) {
      console.error("\n--- Error during migrations UP ---");
      console.error((error as Error).message);
      process.exit(1);
    } finally {
      if (orm) {
        await orm.disconnect();
        console.log("Database connection closed.");
      }
    }
  });
// --- Akhir perintah migrate:up ---

// --- Perintah migrate:down ---
program
  .command("migrate:down")
  .description("Rolls back the last N migrations (default: 1).")
  .option("-s, --steps <number>", "Number of migration steps to rollback", "1")
  .option(
    "-c, --config <file>",
    "Path to a JSON configuration file for database connection."
  )
  .option("--host <host>", "Database host.")
  .option("--user <user>", "Database user.")
  .option("--password <password>", "Database password.")
  .option("--db-name <database>", "Database name.")
  .option(
    "--dir <directory>",
    "Directory for migration files (default: src/migrations)",
    "src/migrations"
  )
  .action(async (options: any) => {
    let orm: FastOrm | undefined;
    try {
      const dbConfig = getDbConfig(options.config, options);
      console.log(
        `Connecting to database for migrations: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}...`
      );
      orm = new FastOrm(dbConfig);
      const migrationRunner = new MigrationRunner(orm.connection, options.dir);

      const steps = parseInt(options.steps, 10);
      if (isNaN(steps) || steps <= 0) {
        console.error("Error: --steps must be a positive number.");
        process.exit(1);
      }

      await migrationRunner.migrateDown(steps);
      console.log(`\nMigrations DOWN for ${steps} step(s) complete.`);
    } catch (error) {
      console.error("\n--- Error during migrations DOWN ---");
      console.error((error as Error).message);
      process.exit(1);
    } finally {
      if (orm) {
        await orm.disconnect();
        console.log("Database connection closed.");
      }
    }
  });
program.parse(process.argv);
