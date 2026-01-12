import { UsersController } from '../../controllers/users.controller';
import { PostgresDB } from '../../database/postgres';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mocks
jest.mock('../../database/postgres', () => ({
    PostgresDB: {
        getInstance: jest.fn().mockReturnValue({
            callStoredProcedure: jest.fn(),
        }),
    },
}));

jest.mock('bcrypt', () => ({
    hashSync: jest.fn().mockReturnValue('hashed_password'),
    compareSync: jest.fn().mockReturnValue(true),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn().mockReturnValue('mock_token'),
    // Added nombre and apellido to verify mock result
    verify: jest.fn().mockReturnValue({ id: 1, email: 'e', rol: 'r', sucursal_id: 1, nombre: 'N', apellido: 'A' }),
}));

// Mock envs if needed or let it use defaults (dotenv might not be loaded in test if not setup)
jest.mock('../../helpers/envs', () => ({
    envs: {
        BCRYPT_SALT_ROUNDS: 10,
        JWT_SECRET: 'secret',
        NODE_ENV: 'test',
        FRONT_URL: 'http://localhost:3000',
        API_URL: 'http://localhost:4000'
    },
}));

describe('UsersController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let cookieMock: jest.Mock;

    beforeEach(() => {
        req = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        cookieMock = jest.fn();
        res = {
            json: jsonMock,
            status: statusMock,
            cookie: cookieMock,
            clearCookie: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('should create user', async () => {
        req.body = { nombre: 'User', email: 'u@u.com', password_hash: 'pass', rol: 'ADMIN', is_active: true, sucursal_id: 1 };
        // Added nombre and apellido to match expectations if needed, but not strictly required for this test unless create returns them
        const mockResult = { rows: [{ id: 1, email: 'u@u.com', rol: 'ADMIN', sucursal_id: 1, nombre: 'User', apellido: 'Last' }] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await UsersController.getInstance().createUser(req as Request, res as Response);

        expect(bcrypt.hashSync).toHaveBeenCalled();
        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_usuario_crear', [
            'User', undefined, 'U@U.COM', 'hashed_password', 'ADMIN', true, 1
        ]);
        // Note: 'apellido' was missing in req.body in the original test too, so it sends undefined to SP.
        expect(jwt.sign).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult, token: 'mock_token' });
    });

    it('should login user', async () => {
        req.body = { email: 'u@u.com', password: 'pass' };
        const mockUser = { id: 1, email: 'u@u.com', password_hash: 'hash', is_active: true, rol: 'ADMIN', sucursal_id: 1, nombre: 'N', apellido: 'A' };
        const mockResult = { rows: [mockUser] };
        (PostgresDB.getInstance().callStoredProcedure as jest.Mock).mockResolvedValue(mockResult);

        await UsersController.getInstance().loginUser(req as Request, res as Response);

        expect(PostgresDB.getInstance().callStoredProcedure).toHaveBeenCalledWith('sp_usuario_get_by_email', ['U@U.COM']);
        expect(bcrypt.compareSync).toHaveBeenCalledWith('pass', 'hash');
        expect(res.cookie).toHaveBeenCalledWith('token', 'mock_token', expect.any(Object));
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            user: { id: 1, email: 'u@u.com', is_active: true, rol: 'ADMIN', sucursal_id: 1, nombre: 'N', apellido: 'A' },
            token: 'mock_token'
        });
    });

    it('should validate token', async () => {
        req.cookies = { token: 'valid_token' };

        await UsersController.getInstance().validateToken(req as Request, res as Response);

        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'secret');
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            user: { id: 1, email: 'e', rol: 'r', sucursal_id: 1, nombre: 'N', apellido: 'A' }
        });
    });
});
