import { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { PostgresDB } from "../database/postgres";

export class CurrencyController {
    private static instance: CurrencyController;
    private readonly CLAVE_DOLAR = 'cotizacion_dolar';

    private constructor() {
        // Programar para que corra de Lunes a Viernes a las 10:30 AM
        cron.schedule('30 10 * * 1-5', () => {
            console.log("Iniciando actualización automática de divisa...");
            this.updateRateInternal().catch(console.error);
        });
    }

    public static getInstance(): CurrencyController {
        if (!CurrencyController.instance) {
            CurrencyController.instance = new CurrencyController();
        }
        return CurrencyController.instance;
    }

    private async updateRateInternal(): Promise<number> {
        try {
            const { data } = await axios.get('https://dolarapi.com/v1/dolares/blue');
            const rate = Number(data.venta);

            await PostgresDB.getInstance().callStoredProcedure('sp_config_global_upsert', [
                this.CLAVE_DOLAR,
                rate
            ]);
            return rate;
        } catch (error: any) {
            console.error("Error en updateRateInternal:", error.message);
            throw error;
        }
    }

    public async getDolarRate(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_config_global_get', [
                this.CLAVE_DOLAR
            ]);

            const rate = result.rows[0]?.valor || 0;
            const updatedAt = result.rows[0]?.updated_at;

            res.json({
                success: true,
                result: { rate: Number(rate), updatedAt }
            });
        } catch (error: any) {
            console.error("ERROR DETALLADO:", error.message, error.stack);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async updateDolarRate(req: Request, res: Response) {
        try {
            const { manualRate } = req.body;
            let rate: number;

            if (manualRate) {
                rate = Number(manualRate);
                await PostgresDB.getInstance().callStoredProcedure('sp_config_global_upsert', [
                    this.CLAVE_DOLAR,
                    rate
                ]);
            } else {
                rate = await this.updateRateInternal();
            }

            res.json({ success: true, result: rate });
        } catch (error: any) {
            console.error("ERROR DETALLADO:", error.message, error.stack);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}