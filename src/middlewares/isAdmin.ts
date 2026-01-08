import { NextFunction, Request, Response } from 'express'



export const isAdmin = (req: Request & { user?: any }, res: Response, next: NextFunction) => {

    if (!req.user) return res.status(401).json({ success: false, error: 'Usuario no autenticado' });

    const allowedRoles = ['ADMIN', 'SUPERADMIN'];

    if (!allowedRoles.includes(req.user.rol)) return res.status(401).json({ success: false, error: 'Usuario no autorizado' });

    next();
}