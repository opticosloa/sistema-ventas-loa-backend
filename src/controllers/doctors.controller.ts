import { Request, Response } from "express";
import { PostgresDB } from "../database/postgres";
import { Doctor } from "../types/doctors";

export class DoctorController {

    private static instance: DoctorController;

    private constructor() { }

    public static getInstance(): DoctorController {
        if (!DoctorController.instance) {
            DoctorController.instance = new DoctorController();
        }
        return DoctorController.instance;
    }

    public async createDoctor(req: Request, res: Response) {
        const { nombre, matricula, especialidad, telefono, email }: Doctor = req.body;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_crear', [
                nombre,
                matricula,
                especialidad,
                telefono,
                email
            ]);
            // Assuming the SP returns the ID as the first row/column or similar. 
            // Based on generic SP behavior, it usually returns a table.
            // The SP returns "RETURNING doctor_id INTO v_doctor_id; RETURN v_doctor_id;" 
            // calling via `SELECT * FROM sp_doctor_crear(...)` should return one row with `doctor_id`.
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getDoctorById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_get_by_id', [id]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getDoctors(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_listar');
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateDoctor(req: Request, res: Response) {
        const { id } = req.params; // doctor_id
        const { nombre, especialidad, telefono, email }: Doctor = req.body;

        // Note: matricula is not updated in sp_doctor_editar
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_editar', [
                id,
                nombre,
                especialidad,
                telefono,
                email
            ]);
            // Returns boolean
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deactivateDoctor(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_desactivar', [id]);
            res.json({ success: true, result: result.rows[0] });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getDoctorByMatricula(req: Request, res: Response) {
        const { matricula } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_get_by_matricula', [matricula]);
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
    public async searchDoctors(req: Request, res: Response) {
        const { q } = req.query;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_get_by_nombre', [q]);
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }
}
