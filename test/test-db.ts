import { executeQuery, callStoredProcedure, getClient } from './database/postgres';

const run = async () => {
    try {
        console.log('Testing connection...');
        const res = await executeQuery('SELECT NOW() as now');
        console.log('Connection successful:', res.rows[0]);

        console.log('Creating test procedure...');
        await executeQuery(`
      CREATE OR REPLACE PROCEDURE test_proc(a int, b int)
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE NOTICE 'Test procedure called with % and %', a, b;
      END;
      $$;
    `);

        console.log('Calling test procedure...');
        await callStoredProcedure('test_proc', [10, 20]);
        console.log('Procedure called successfully.');

        console.log('Cleaning up...');
        await executeQuery('DROP PROCEDURE test_proc(int, int)');
        console.log('Cleanup done.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        // We need to close the pool or exit the process
        process.exit(0);
    }
};

run();
