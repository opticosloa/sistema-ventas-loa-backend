import { NextFunction, Request, Response } from "express";
import { User } from "../types/user";


export const tenantMiddleware = (req: Request & { user?: User, sucursal_id?: string }, res: Response, next: NextFunction) => {
    if (!req.user?.sucursal_id) return res.status(403).json({ success: false, error: 'Sucursal no definida' });

    req.sucursal_id = req.user.sucursal_id;
    next();
}