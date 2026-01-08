import { DoctorController } from '../../controllers/doctors.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';

// Mock PostgresDB
jest.mock('../../database/postgres', () => {
    return {
        PostgresDB: {
            getInstance: jest.fn().mockReturnValue({
                callStoredProcedure: jest.fn(),
            }),
        },
    };
});

describe('DoctorController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        req = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = {
            json: jsonMock,
            status: statusMock,
        };
        jest.clearAllMocks();
    });

    it('should create a doctor', async () => {
        req.body = { nombre: 'Dr Who', matricula: '999', especialidad: 'Time', telefono: '000', email: 'dr@who.com' };
        const mockResult = { rows: [{ doctor_id: 1 }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await DoctorController.getInstance().createDoctor(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_doctor_crear', [
            'Dr Who', '999', 'Time', '000', 'dr@who.com'
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: { doctor_id: 1 } });
    });

    it('should get doctor by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [{ id: 1, nombre: 'Dr Who' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await DoctorController.getInstance().getDoctorById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_doctor_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult.rows[0] });
    });

    it('should list doctors', async () => {
        const mockResult = { rows: [{ id: 1 }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await DoctorController.getInstance().getDoctors(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_doctor_listar');
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult.rows });
    });

    it('should update doctor', async () => {
        req.params = { id: '1' };
        req.body = { nombre: 'Dr Updated' };
        const mockResult = { rows: [true] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await DoctorController.getInstance().updateDoctor(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_doctor_editar', [
            '1', 'Dr Updated', undefined, undefined, undefined
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: true });
    });

    it('should deactivate doctor', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [true] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await DoctorController.getInstance().deactivateDoctor(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_doctor_desactivar', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: true });
    });
});
