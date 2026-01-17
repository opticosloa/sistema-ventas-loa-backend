import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';

export class CrystalSettingsController {
    private static instance: CrystalSettingsController;

    private constructor() { }

    public static getInstance(): CrystalSettingsController {
        if (!CrystalSettingsController.instance) {
            CrystalSettingsController.instance = new CrystalSettingsController();
        }
        return CrystalSettingsController.instance;
    }

    public async getMaterials(req: Request, res: Response) {
        try {
            const db = PostgresDB.getInstance();
            const result = await db.callStoredProcedure('sp_cristal_materiales_listar');
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error('Error getting materials:', error);
            res.status(500).json({ message: 'Error retrieving materials' });
        }
    }

    public async getTreatments(req: Request, res: Response) {
        try {
            const db = PostgresDB.getInstance();
            const result = await db.callStoredProcedure('sp_cristal_tratamientos_listar');
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error('Error getting treatments:', error);
            res.status(500).json({ message: 'Error retrieving treatments' });
        }
    }

    public async createMaterial(req: Request, res: Response) {
        try {
            const { nombre } = req.body;
            if (!nombre) {
                return res.status(400).json({ message: 'Nombre is required' });
            }
            const db = PostgresDB.getInstance();
            const query = 'INSERT INTO cristal_materiales (nombre) VALUES ($1) RETURNING *';
            const result = await db.executeQuery(query, [nombre]);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creating material:', error);
            res.status(500).json({ message: 'Error creating material' });
        }
    }

    public async createTreatment(req: Request, res: Response) {
        try {
            const { nombre } = req.body;
            if (!nombre) {
                return res.status(400).json({ message: 'Nombre is required' });
            }
            const db = PostgresDB.getInstance();
            const query = 'INSERT INTO cristal_tratamientos (nombre) VALUES ($1) RETURNING *';
            const result = await db.executeQuery(query, [nombre]);
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creating treatment:', error);
            res.status(500).json({ message: 'Error creating treatment' });
        }
    }
}
