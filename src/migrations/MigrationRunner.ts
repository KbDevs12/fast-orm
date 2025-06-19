import { Connection } from "../orm/Connection";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import fs from "fs/promises";
import path from "path";

interface Migration {
  name: string;
  up: (connection: Connection) => Promise<void>;
  down: (connection: Connection) => Promise<void>;
}

export class MigrationRunner {
  private connection: Connection;
  private migrationsDir: string;
  private migrationsTable: string = "_fastorm_migrations";

  constructor(connection: Connection, migrationsDir: string) {
    this.connection = connection;
    this.migrationsDir = migrationsDir;
  }

  private async ensureMigrationsTable(): Promise<void> {
    const sql = `
            CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
    await this.connection.query(sql);
  }

  private async loadMigrations(): Promise<Migration[]> {
    const files = await fs.readdir(this.migrationsDir);
    const migrationFiles = files
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
      .sort();

    const migrations: Migration[] = [];
    for (const file of migrationFiles) {
      const filePath = path.join(this.migrationsDir, file);
      let migrationModule: any;
      try {
        if (
          filePath.endsWith(".ts") &&
          process.env.NODE_ENV === "development"
        ) {
          require("ts-node/register");
        }
        if (require.cache[path.resolve(filePath)]) {
          delete require.cache[path.resolve(filePath)];
        }
        migrationModule = require(path.resolve(filePath));
        migrations.push({
          name: path.parse(file).name,
          up: migrationModule.up,
          down: migrationModule.down,
        });
      } catch (error) {
        console.error(
          `Failed to load migration file ${file}: ${(error as Error).message}`
        );
      }
    }
    return migrations;
  }

  private async getRanMigrations(): Promise<string[]> {
    const sql = `SELECT name FROM ${this.migrationsTable} ORDER BY name ASC;`;
    const result = await this.connection.query<RowDataPacket[]>(sql);
    return result.map((row) => (row as { name: string }).name);
  }

  public async migrateUp(): Promise<void> {
    await this.ensureMigrationsTable();
    const availableMigrations = await this.loadMigrations();
    const ranMigrations = await this.getRanMigrations();

    for (const migration of availableMigrations) {
      if (!ranMigrations.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        try {
          await migration.up(this.connection);
          await this.connection.query(
            `INSERT INTO ${this.migrationsTable} (name) VALUES (?)`,
            [migration.name]
          );
          console.log(`Migration ${migration.name} completed.`);
        } catch (error) {
          console.error(
            `Error running migration ${migration.name}: ${
              (error as Error).message
            }`
          );
          throw error;
        }
      }
    }
    console.log("All pending migrations have been run.");
  }

  public async migrateDown(steps: number = 1): Promise<void> {
    await this.ensureMigrationsTable();
    const ranMigrations = await this.getRanMigrations();

    if (ranMigrations.length === 0) {
      console.log("No migrations to rollback.");
      return;
    }

    const migrationsToRollback = ranMigrations
      .slice()
      .reverse()
      .slice(0, steps);
    const availableMigrations = await this.loadMigrations();
    const availableMigrationsMap = new Map(
      availableMigrations.map((m) => [m.name, m])
    );

    for (const migrationName of migrationsToRollback) {
      const migration = availableMigrationsMap.get(migrationName);
      if (migration) {
        console.log(`Rolling back migration: ${migration.name}`);
        try {
          await migration.down(this.connection);
          await this.connection.query(
            `DELETE FROM ${this.migrationsTable} WHERE name = ?`,
            [migration.name]
          );
          console.log(`Migration ${migration.name} rolled back.`);
        } catch (error) {
          console.error(
            `Error rolling back migration ${migration.name}: ${
              (error as Error).message
            }`
          );
          throw error;
        }
      } else {
        console.warn(
          `Migration ${migrationName} found in DB but not in migration files. Skipping rollback.`
        );
      }
    }
    console.log(`Rolled back ${migrationsToRollback.length} migration(s).`);
  }

  public async createMigrationFile(name: string): Promise<string> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.]/g, "")
      .slice(0, 14); // YYYYMMDDHHmmss
    const fileName = `${timestamp}_${name}.ts`;
    const filePath = path.join(this.migrationsDir, fileName);

    const template = `
import { Connection } from 'fast-orm'; // Sesuaikan import jika FastOrm tidak diinstal sebagai package

export async function up(connection: Connection): Promise<void> {
    // Tulis logika SQL UP Anda di sini
    // Contoh:
    // await connection.query(\`CREATE TABLE users (
    //     id INT AUTO_INCREMENT PRIMARY KEY,
    //     name VARCHAR(255) NOT NULL,
    //     email VARCHAR(255) UNIQUE NOT NULL,
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    // );\`);
    console.log('UP migration for ${name} executed.');
}

export async function down(connection: Connection): Promise<void> {
    // Tulis logika SQL DOWN Anda di sini (untuk rollback)
    // Contoh:
    // await connection.query(\`DROP TABLE IF EXISTS users;\`);
    console.log('DOWN migration for ${name} executed.');
}
        `.trim();

    await fs.mkdir(this.migrationsDir, { recursive: true });
    await fs.writeFile(filePath, template);
    return filePath;
  }
}
