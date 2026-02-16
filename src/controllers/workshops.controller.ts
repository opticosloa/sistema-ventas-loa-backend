import { Request, Response } from 'express';
import { WorkshopsService } from '../service/workshops.service';

export class WorkshopsController {
    private static instance: WorkshopsController;

    private constructor() { }

    public static getInstance(): WorkshopsController {
        if (!WorkshopsController.instance) {
            WorkshopsController.instance = new WorkshopsController();
        }
        return WorkshopsController.instance;
    }

    public async upsert(req: Request, res: Response) {
        try {
            const id = await WorkshopsService.getInstance().upsert(req.body);
            res.json({ success: true, id });
        } catch (error: any) {
            console.error("Error upserting workshop:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getActive(req: Request, res: Response) {
        try {
            const workshops = await WorkshopsService.getInstance().getAll(true);
            res.json({ success: true, result: workshops });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    public async getAll(req: Request, res: Response) {
        try {
            const workshops = await WorkshopsService.getInstance().getAll(false);
            res.json({ success: true, result: workshops });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
