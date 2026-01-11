import { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { PostgresDB } from "../database/postgres";

export class CurrencyController {
    private static instance: CurrencyController;

    private constructor() {
        // Programar para que corra de Lunes a Viernes a las 10:30 AM
        cron.schedule('30 10 * * 1-5', () => {
            this.updateRateInternal();
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
            const rate = data.venta;
            await PostgresDB.getInstance().executeQuery(
                "UPDATE config_global SET valor = $1, updated_at = now() WHERE clave = 'cotizacion_dolar'",
                [rate]
            );
            return rate;
        } catch (error) {
            console.error("Error actualizando dólar:", error);
            throw error;
        }
    }

    public async getDolarRate(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().executeQuery(
                "SELECT valor, updated_at FROM config_global WHERE clave = 'cotizacion_dolar'"
            );
            const rate = result.rows[0]?.valor || 0;
            const updatedAt = result.rows[0]?.updated_at;
            res.json({ success: true, result: { rate, updatedAt } });
        } catch (error) {
            res.status(500).json({ success: false, error });
        }
    }

    public async updateDolarRate(req: Request, res: Response) {
        try {
            // Check if manual value is provided
            const { manualRate } = req.body;

            let rate;
            if (manualRate) {
                rate = parseFloat(manualRate);
                await PostgresDB.getInstance().executeQuery(
                    "UPDATE config_global SET valor = $1, updated_at = now() WHERE clave = 'cotizacion_dolar'",
                    [rate]
                );
            } else {
                rate = await this.updateRateInternal();
            }

            res.json({ success: true, result: rate });
        } catch (error) {
            res.status(500).json({ success: false, error });
        }
    }
}