import fs from 'fs';
import path from 'path';
import { PostgresDB } from '../database/postgres';

const run = async () => {
    try {
        const sql1Path = path.join(__dirname, '../../sql/01_liquidaciones.sql');
        const sql2Path = path.join(__dirname, '../../sql/02_liquidaciones_queries.sql');

        console.log(`Reading SQL from: ${sql1Path}`);
        const sql1 = fs.readFileSync(sql1Path, 'utf8');

        console.log(`Reading SQL from: ${sql2Path}`);
        const sql2 = fs.readFileSync(sql2Path, 'utf8');

        console.log("Executing 01_liquidaciones.sql...");
        await PostgresDB.getInstance().executeQuery(sql1);

        console.log("Executing 02_liquidaciones_queries.sql...");
        await PostgresDB.getInstance().executeQuery(sql2);

        console.log("Done!");
        process.exit(0);
    } catch (error) {
        console.error("Error executing scripts:", error);
        process.exit(1);
    }
};

run();
