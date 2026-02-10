import { PostgresDB } from "../database/postgres";
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from "../types/user";
import { envs } from "../helpers/envs";

export class UsersController {
    private static instance: UsersController;

    private constructor() { }

    public static getInstance(): UsersController {
        if (!UsersController.instance) {
            UsersController.instance = new UsersController();
        }
        return UsersController.instance;
    }

    private getCookieOptions() {
        return {
            httpOnly: true,
            secure: true,
            sameSite: 'none' as const,
            maxAge: 16 * 60 * 60 * 1000, // 16 hours
        };
    }

    public async createUser(req: Request, res: Response) {
        const {
            nombre,
            apellido,
            email,
            password_hash,
            rol,
            is_active,
            sucursal_id,
            cuit,
            telefono,
            direccion,
            fecha_nacimiento,
            cuenta_corriente,
            max_descuento
        }: User = req.body;

        try {
            let emailUpper = email.toUpperCase();
            let rolUpper = rol.toUpperCase();
            const password = bcrypt.hashSync(password_hash, envs.BCRYPT_SALT_ROUNDS);

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_crear', [
                nombre,
                apellido,
                emailUpper,
                password,
                rolUpper,
                is_active ?? true,
                sucursal_id,
                cuit,
                telefono,
                direccion,
                fecha_nacimiento,
                cuenta_corriente || 0,
                max_descuento || 0
            ]);

            const user = result.rows[0];
            // const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol, nombre: user.nombre, apellido: user.apellido, sucursal_id: user.sucursal_id }, envs.JWT_SECRET, { expiresIn: '16h' });

            res.json({
                success: true,
                message: "Empleado creado exitosamente",
                result: user
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getUsers(req: Request, res: Response) {
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get');
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getUserById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_id', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateUser(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, apellido, email, password_hash, rol, is_active }: User = req.body;
        try {
            let emailUpper = email.toUpperCase();
            let rolUpper = rol.toUpperCase();
            const password = bcrypt.hashSync(password_hash, envs.BCRYPT_SALT_ROUNDS);

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_editar', [
                id,
                nombre,
                apellido,
                emailUpper,
                password,
                rolUpper,
                is_active
            ]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteUser(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_eliminar', [id]);
            res.json({ success: true, result });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async loginUser(req: Request, res: Response) {

        const { email, password } = req.body;

        try {
            let emailUpper = email.toUpperCase();
            const user = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_email', [emailUpper]);

            if (!user.rows || user.rows.length === 0) {
                return res.status(400).json({ success: false, error: 'Usuario o contraseña incorrectos' });
            }

            const userData = user.rows[0];
            // console.log(userData)
            const isPasswordValid = bcrypt.compareSync(password, userData.password_hash);
            if (!isPasswordValid) {
                return res.status(400).json({ success: false, error: 'Usuario o contraseña incorrectos' });
            }

            if (!userData.is_active) {
                return res.status(400).json({ success: false, error: 'Usuario inactivo' });
            }

            // Calculate current branch based on schedule
            const branchResult = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_calcular_sucursal_actual', [userData.usuario_id]);
            const currentSucursalId = branchResult.rows[0]?.sp_usuario_calcular_sucursal_actual; // Adjust key if necessary based on SP return

            if (!currentSucursalId) {
                return res.status(400).json({ success: false, error: 'Usuario sin sucursal asignada asignada. Contacte al administrador.' });
            }

            const { password_hash, ...userWithoutPassword } = userData;
            userWithoutPassword.sucursal_id = currentSucursalId;

            const token = jwt.sign({
                id: userData.usuario_id,
                email: userData.email,
                rol: userData.rol,
                nombre: userData.nombre,
                apellido: userData.apellido,
                sucursal_id: currentSucursalId,
                max_descuento: userData.max_descuento
            },
                envs.JWT_SECRET, { expiresIn: '16h' });

            res.cookie('token', token, this.getCookieOptions());

            res.json({ success: true, user: userWithoutPassword, token });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async logoutUser(req: Request, res: Response) {
        try {
            res.clearCookie('token', this.getCookieOptions());
            res.json({ success: true });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async changePassword(req: Request, res: Response) {
        const { email, password, currentPassword } = req.body;

        try {
            let emailUpper = email.toUpperCase();

            // 1. Get user to verify current password
            const userResult = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_email', [emailUpper]);

            if (!userResult.rows || userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const userData = userResult.rows[0];

            // 2. Verify current password
            const isPasswordValid = bcrypt.compareSync(currentPassword, userData.password_hash);

            if (!isPasswordValid) {
                return res.status(400).json({ success: false, error: 'La contraseña actual es incorrecta' });
            }

            // 3. Update to new password
            const password_hash = bcrypt.hashSync(password, envs.BCRYPT_SALT_ROUNDS);
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_actualizar_password', [emailUpper, password_hash]);

            res.status(200).json({ success: true, result: result.rows });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async handlerRol(req: Request, res: Response) {
        const { email, rol } = req.body;

        try {

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_editar_rol', [email, rol])

            res.status(200).json({ success: true, result: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async validateToken(req: Request, res: Response) {
        try {
            const token =
                req.cookies?.token ||
                req.headers.authorization?.split(' ')[1];

            if (!token) {
                return res.status(401).json({ success: false });
            }

            const decoded = jwt.verify(token, envs.JWT_SECRET) as any;

            // 1. Fetch fresh user data to ensure role/status/branch are up to date
            const userResult = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_id', [decoded.id]);

            if (!userResult.rows || userResult.rows.length === 0) {
                res.clearCookie('token', this.getCookieOptions());
                return res.status(401).json({ success: false });
            }

            const currentUser = userResult.rows[0];

            if (!currentUser.is_active) {
                res.clearCookie('token', this.getCookieOptions());
                return res.status(401).json({ success: false, error: 'Usuario inactivo' });
            }

            // 2. Check if branch changed
            // If branch in token != branch in DB, issue NEW token
            let newToken = null;
            if (currentUser.sucursal_id !== decoded.sucursal_id) {
                newToken = jwt.sign({
                    id: currentUser.usuario_id,
                    email: currentUser.email,
                    rol: currentUser.rol,
                    nombre: currentUser.nombre,
                    apellido: currentUser.apellido,
                    sucursal_id: currentUser.sucursal_id,
                    max_descuento: currentUser.max_descuento
                },
                    envs.JWT_SECRET, { expiresIn: '16h' });

                res.cookie('token', newToken, this.getCookieOptions());
            }

            res.json({
                success: true,
                user: {
                    id: currentUser.usuario_id,
                    email: currentUser.email,
                    rol: currentUser.rol,
                    nombre: currentUser.nombre,
                    apellido: currentUser.apellido,
                    sucursal_id: currentUser.sucursal_id,
                    max_descuento: currentUser.max_descuento
                },
                token: newToken // Frontend can check if this exists and update storage
            });
        } catch (error) {
            res.clearCookie('token', this.getCookieOptions());
            return res.status(401).json({ success: false });
        }
    }


    public async getAdmins(req: Request, res: Response) {
        try {
            // Retrieve users with ADMIN or SUPERADMIN role
            // Since we don't have a specific SP for this, we can filter in code or use a generic query if possible.
            // Assuming sp_usuario_get returns all users or we use a direct query for simplicity if needed, 
            // but let's try to reuse sp_usuario_get and filter, or use a new simple query.
            // "SELECT id, nombre, apellido, rol FROM usuarios WHERE rol IN ('ADMIN', 'SUPERADMIN') AND is_active = true"

            const query = "SELECT usuario_id as id, nombre, apellido, rol FROM usuarios WHERE rol IN ('ADMIN', 'SUPERADMIN') AND is_active = true";
            const result = await PostgresDB.getInstance().executeQuery(query);

            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async verifySupervisor(req: Request, res: Response) {
        const { admin_id, pin } = req.body;

        try {
            if (!admin_id || !pin) {
                return res.status(400).json({ success: false, error: 'Faltan datos (admin_id, pin)' });
            }

            // Get user by ID to check PIN and Role
            const userResult = await PostgresDB.getInstance().executeQuery(
                'SELECT * FROM usuarios WHERE usuario_id = $1',
                [admin_id]
            );

            if (userResult.rowCount === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const user = userResult.rows[0];

            // Verify Role
            if (!['ADMIN', 'SUPERADMIN'].includes(user.rol)) {
                return res.status(403).json({ success: false, error: 'El usuario no tiene privilegios de supervisor' });
            }

            // Verify PIN (Bcrypt only)
            if (!user.security_pin) {
                // Returns false/error instead of throwing exception if null, per verification requirement
                return res.status(400).json({ success: false, error: 'El usuario no tiene PIN de seguridad configurado' });
            }

            const isPinValid = await bcrypt.compare(pin, user.security_pin);

            if (!isPinValid) {
                return res.status(401).json({ success: false, error: 'PIN incorrecto' });
            }

            res.json({
                success: true,
                supervisor_name: `${user.nombre} ${user.apellido}`
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updatePin(req: Request, res: Response) {
        const { id } = req.params;
        const { pin } = req.body;

        try {
            if (!pin || pin.length < 4) {
                return res.status(400).json({ success: false, error: 'El PIN debe tener al menos 4 dígitos' });
            }

            const pinHash = bcrypt.hashSync(pin, envs.BCRYPT_SALT_ROUNDS);

            await PostgresDB.getInstance().callStoredProcedure('sp_usuario_actualizar_pin', [
                id,
                pinHash
            ]);

            res.json({ success: true, message: 'PIN actualizado correctamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async updateProfile(req: Request, res: Response) {
        const { email } = req.params;
        const { nombre, apellido, telefono, direccion, fecha_nacimiento } = req.body;

        try {
            if (!email || email === 'undefined') {
                return res.status(400).json({ success: false, error: 'Email no válido' });
            }
            const userResult = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_email', [email]);
            if (!userResult.rows || userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const currentUser = userResult.rows[0];

            // 2. Ejecutar la edición 
            // Nota: Asegúrate de que el orden de los parámetros coincida con tu SP SQL
            await PostgresDB.getInstance().callStoredProcedure('sp_usuario_editar', [
                currentUser.usuario_id,
                nombre || currentUser.nombre,
                apellido || currentUser.apellido,
                currentUser.email,
                currentUser.rol,
                currentUser.is_active,
                currentUser.sucursal_id,
                currentUser.cuit || null, // Manejo de nulos
                telefono || currentUser.telefono,
                direccion || currentUser.direccion,
                fecha_nacimiento || currentUser.fecha_nacimiento,
                currentUser.cuenta_corriente
            ]);

            res.json({ success: true, message: 'Perfil actualizado correctamente' });

        } catch (error: any) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno al actualizar perfil'
            });
        }
    }

    public async getUserByEmail(req: Request, res: Response) {
        const { email } = req.params;
        try {
            if (!email || email === 'undefined') {
                return res.status(400).json({ success: false, error: 'Email no válido' });
            }
            const userResult = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_by_email', [email]);
            if (!userResult.rows || userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }
            res.json({ success: true, result: userResult.rows[0] });
        } catch (error: any) {
            console.error('Error getting user by email:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno al obtener usuario'
            });
        }
    }
    public async updateMaxDescuento(req: Request, res: Response) {
        const { id } = req.params;
        const { max_descuento } = req.body;

        try {
            await PostgresDB.getInstance().callStoredProcedure('sp_usuario_max_descuento', [
                id,
                max_descuento
            ]);

            res.json({ success: true, message: 'Max descuento actualizado correctamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async moveUser(req: Request, res: Response) {
        const { usuario_id, sucursal_id } = req.body;
        const user = (req as any).user;
        const admin_id = user?.id;
        const admin_role = user?.rol;

        try {
            if (!admin_id || !['ADMIN', 'SUPERADMIN'].includes(admin_role)) {
                return res.status(403).json({ success: false, error: 'No autorizado. Requiere premisos de Administrador.' });
            }

            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_cambiar_sucursal', [usuario_id, sucursal_id, admin_id]);

            // The SP returns a JSON object directly
            const response = result.rows[0]?.sp_usuario_cambiar_sucursal;

            if (response && response.success) {
                res.json({ success: true, message: response.message });
            } else {
                res.status(400).json({ success: false, error: response?.message || 'Error al mover usuario' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async setSchedule(req: Request, res: Response) {
        const { usuario_id, dia, sucursal_id } = req.body;
        try {
            await PostgresDB.getInstance().callStoredProcedure('sp_usuario_set_cronograma', [usuario_id, dia, sucursal_id]);
            res.json({ success: true, message: 'Cronograma actualizado' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async deleteScheduleRule(req: Request, res: Response) {
        const { usuario_id, dia } = req.params;
        try {
            if (!dia) return res.status(400).json({ success: false, error: 'Dia no válido' });
            if (!usuario_id) return res.status(400).json({ success: false, error: 'Usuario no válido' });

            await PostgresDB.getInstance().callStoredProcedure('sp_usuario_del_cronograma', [usuario_id, parseInt(dia)]);

            res.json({ success: true, message: 'Regla eliminada' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }

    public async getSchedule(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const result = await PostgresDB.getInstance().callStoredProcedure('sp_usuario_get_cronograma', [id]);
            res.json({ success: true, result: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error });
        }
    }
}
