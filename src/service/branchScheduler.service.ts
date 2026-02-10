
import { PostgresDB } from '../database/postgres';
import cron from 'node-cron';

export class BranchSchedulerService {
    private static instance: BranchSchedulerService;

    private constructor() { }

    public static getInstance(): BranchSchedulerService {
        if (!BranchSchedulerService.instance) {
            BranchSchedulerService.instance = new BranchSchedulerService();
        }
        return BranchSchedulerService.instance;
    }

    public initScheduledJobs() {
        console.log('Initializing Branch Scheduler...');
        // Run every day at midnight (00:00)
        // Adjust timezone as needed, e.g., 'America/Argentina/Buenos_Aires'
        cron.schedule('0 0 * * *', async () => {
            console.log('Running daily branch synchronization...');
            await this.syncDailyBranches();
        }, {
            timezone: "America/Argentina/Buenos_Aires"
        });

        console.log('Branch Scheduler initialized: 0 0 * * *');
    }

    public async syncDailyBranches() {
        try {
            // Postgres DOW: 0=Sunday, 1=Monday, ..., 6=Saturday
            const query = `
                UPDATE usuarios u
                SET sucursal_id = uc.sucursal_id
                FROM usuario_cronograma uc
                WHERE u.usuario_id = uc.usuario_id
                  AND uc.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)::int;
            `;

            const result = await PostgresDB.getInstance().executeQuery(query);
            console.log(`Daily branch sync completed. Updated rows: ${result.rowCount}`);
        } catch (error) {
            console.error('Error executing daily branch sync:', error);
        }
    }
}
