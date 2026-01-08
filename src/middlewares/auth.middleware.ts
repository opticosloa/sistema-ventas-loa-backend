import { NextFunction, Request, Response } from 'express';
import Jwt from 'jsonwebtoken';
import { envs } from '../helpers/envs';
import { UserPayload } from '../types/userPayload';


export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const parts = authHeader.split(' ');
        if (parts.length > 1) {
            token = parts[1];
        }
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token no proporcionado' });
    }

    try {
        const decoded = Jwt.verify(token, envs.JWT_SECRET) as UserPayload;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Token no valido' });
    }
}