import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { envs } from '../helpers/envs';

dotenv.config();

export class PostgresDB {
    private static instance: PostgresDB;
    private pool: Pool;

    private constructor() {
        this.pool = new Pool({
            user: envs.POSTGRES_USER,
            host: envs.POSTGRES_HOST,
            database: envs.POSTGRES_DB,
            password: envs.POSTGRES_PASSWORD,
            port: envs.POSTGRES_PORT,
        });
    }

    public static getInstance(): PostgresDB {
        if (!PostgresDB.instance) {
            PostgresDB.instance = new PostgresDB();
        }
        return PostgresDB.instance;
    }

    public async executeQuery(text: string, params?: any[]): Promise<QueryResult> {
        const start = Date.now();
        const res = await this.pool.query(text, params);
        const duration = Date.now() - start;
        console.log('executed query', { text, duration, rows: res.rowCount });
        return res;
    }

    public async callStoredProcedure(procName: string, params: any[] = []): Promise<QueryResult> {
        // Generate placeholders like $1, $2, etc.
        const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
        const query = `SELECT * FROM ${procName}(${placeholders})`;

        return await this.executeQuery(query, params);
    }

    public async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }
}

