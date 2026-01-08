import { Request, Response } from "express";
import { PostgresDB } from "../database/postgres";



export const getStockAlerts = async (req: Request, res: Response) => {


    try {
        const result = await PostgresDB
            .getInstance()
            .callStoredProcedure('sp_alertas_stock_pendientes');

        res.json({ success: true, result: result.rows });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, error });
    }
}