import { PrescriptionController } from '../../controllers/prescription.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';
import { PrescriptionValidator } from '../../helpers/prescriptionValidator';
import sharp from 'sharp';
import fs from 'fs';
import { extractText } from '../../service/vision.service';
import { parsePrescription } from '../../service/parce.service';
import { cloudinaryUploader } from '../../helpers/cloudinaryUploader';

// Mock everything
jest.mock('../../database/postgres', () => ({
    PostgresDB: {
        getInstance: jest.fn().mockReturnValue({
            callStoredProcedure: jest.fn(),
        }),
    },
}));
jest.mock('../../helpers/prescriptionValidator', () => ({
    PrescriptionValidator: {
        getInstance: jest.fn().mockReturnValue({
            validatePrescription: jest.fn().mockReturnValue({ valid: true }),
        }),
    },
}));
jest.mock('sharp', () => jest.fn());
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn().mockResolvedValue(Buffer.from('')),
        unlink: jest.fn().mockResolvedValue(undefined),
    },
    existsSync: jest.fn().mockReturnValue(true),
}));
jest.mock('../../service/vision.service', () => ({
    extractText: jest.fn().mockResolvedValue('raw text'),
}));
jest.mock('../../service/parce.service', () => ({
    parsePrescription: jest.fn().mockReturnValue({ parsed: true }),
}));
jest.mock('../../helpers/cloudinaryUploader', () => ({
    cloudinaryUploader: jest.fn().mockResolvedValue({ url: 'http://url.com' }),
}));

describe('PrescriptionController', () => {
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

        // Mock sharp chain
        const sharpMock = {
            grayscale: jest.fn().mockReturnThis(),
            normalize: jest.fn().mockReturnThis(),
            threshold: jest.fn().mockReturnThis(),
            resize: jest.fn().mockReturnThis(),
            toFile: jest.fn().mockResolvedValue(undefined),
        };
        (sharp as unknown as jest.Mock).mockReturnValue(sharpMock);
    });

    it('should create prescription', async () => {
        req.body = { cliente_id: 1, doctor_id: 1, fecha: '2023-01-01', lejos: {}, cerca: {}, multifocal: {}, observaciones: '' };
        const mockResult = { rows: [{ id: 1 }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await PrescriptionController.getInstance().createPrescription(req as Request, res as Response);

        expect(PrescriptionValidator.getInstance().validatePrescription).toHaveBeenCalled();
        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_prescripcion_crear', [
            1, 1, '2023-01-01', {}, {}, {}, ''
        ]);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult.rows[0] });
    });

    it('should upload prescription', async () => {
        req.file = { buffer: Buffer.from('test') } as any;

        await PrescriptionController.getInstance().uploadPrescription(req as Request, res as Response);

        expect(sharp).toHaveBeenCalled();
        expect(cloudinaryUploader).toHaveBeenCalled();
        expect(extractText).toHaveBeenCalled();
        expect(parsePrescription).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            parsed: { parsed: true },
            rawText: 'raw text',
            imageUrl: 'http://url.com'
        });
    });

    it('should get prescription by id', async () => {
        req.params = { id: '1' };
        const mockResult = { rows: [{ id: 1 }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await PrescriptionController.getInstance().getPrescriptionById(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_prescripcion_get_by_id', ['1']);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult.rows[0] });
    });
});
