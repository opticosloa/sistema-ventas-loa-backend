import { Request, Response } from "express";
import { PostgresDB } from "../database/postgres";
import fs from "fs";
import sharp from "sharp";
import { Prescription } from "../types/prescription";
import { PrescriptionValidator } from "../helpers/prescriptionValidator";
import { cloudinaryUploader } from "../helpers/cloudinaryUploader";
import { CrystalsController } from "./crystals.controller";

export class PrescriptionController {

  private static instance: PrescriptionController;

  private constructor() { }

  public static getInstance(): PrescriptionController {
    if (!PrescriptionController.instance) {
      PrescriptionController.instance = new PrescriptionController();
    }
    return PrescriptionController.instance;
  }

  public async uploadPrescription(req: Request, res: Response) {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const tempPath = `temp_${Date.now()}.jpg`;

    try {
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .grayscale()
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(tempPath);

      const uploadResult = await cloudinaryUploader({ path: tempPath });

      return res.json({
        success: true,
        imageUrl: uploadResult.url,
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    } finally {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    }
  }


  public async createPrescription(req: Request, res: Response) {

    const {
      cliente_id,
      cliente,
      doctor_id,
      matricula,
      fecha,
      lejos,
      cerca,
      multifocal,
      observaciones,
      image_url,
      obraSocial,
      descuento // Extract discount
    } = req.body;

    try {
      let finalClienteId = cliente_id;

      console.log(req.body);
      // 1. Resolver cliente
      if (!finalClienteId) {
        if (!cliente || !cliente.dni) {
          return res.status(400).json({
            success: false,
            error: 'Debe enviar cliente_id o datos completos del cliente'
          });
        }

        // Buscar cliente por DNI
        const existingClient = await PostgresDB
          .getInstance()
          .callStoredProcedure('sp_cliente_get_by_dni', [cliente.dni]);

        if (existingClient.rows.length > 0) {
          finalClienteId = existingClient.rows[0].cliente_id;
        } else {
          const capitalize = (str: string) =>
            (str || '')
              .toLowerCase()
              .replace(/(^|[\s-])(\S)/g, (_, sep, char) => sep + char.toUpperCase());

          const clienteResult = await PostgresDB
            .getInstance()
            .callStoredProcedure('sp_cliente_crear', [
              capitalize(cliente.nombre),
              capitalize(cliente.apellido),
              cliente.telefono ?? null,
              cliente.email ?? null,
              cliente.dni,
              cliente.direccion ? capitalize(cliente.direccion) : null,
              cliente.fecha_nacimiento ?? null,
              0
            ]);

          finalClienteId = clienteResult.rows[0].cliente_id;
        }
      }

      // 2. Resolver Doctor (si viene matricula y no doctor_id)
      let finalDoctorId = doctor_id;
      if (!finalDoctorId && matricula) {
        const doctorResult = await PostgresDB.getInstance().callStoredProcedure('sp_doctor_get_by_matricula', [matricula]);
        if (doctorResult.rows.length > 0) {
          finalDoctorId = doctorResult.rows[0].doctor_id;
        } else if (doctorResult.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Doctor no encontrado con esa matricula'
          });
        }
      }

      // Let's stick closer to the user request about inputs
      if (finalDoctorId === "") finalDoctorId = null;
      if (finalClienteId === "") finalClienteId = null;

      if (!finalDoctorId) {
        return res.status(400).json({
          success: false,
          error: 'Doctor no encontrado'
        });
      }

      // 3. Crear prescripción
      const prescripcionResult = await PostgresDB
        .getInstance()
        .callStoredProcedure('sp_prescripcion_crear', [
          finalClienteId,
          finalDoctorId,
          fecha ? fecha.split('T')[0] : null,
          JSON.stringify(lejos || {}),
          JSON.stringify(cerca || {}),
          JSON.stringify(multifocal || {}),
          observaciones,
          image_url,
          obraSocial || null
        ]);

      const prescripcion_id = prescripcionResult.rows[0].prescripcion_id;

      // 3b. Descontar Stock de Cristales (Async)
      const crystalCtrl = CrystalsController.getInstance();

      const deductEye = async (section: any, ojoKey: 'OD' | 'OI') => {
        if (section && section[ojoKey] && section[ojoKey].esfera && section[ojoKey].cilindro) {
          const esf = section[ojoKey].esfera;
          const cil = section[ojoKey].cilindro;
          const mat = section.tipo || '';
          const trat = section.color || 'Blanco';

          // Try deduct
          await crystalCtrl.deductStock(esf, cil, mat, trat, 1);
        }
      };

      // Lejos
      if (lejos) {
        await deductEye(lejos, 'OD');
        await deductEye(lejos, 'OI');
      }
      // Cerca
      if (cerca) {
        await deductEye(cerca, 'OD');
        await deductEye(cerca, 'OI');
      }

      // 4. Crear Venta Automáticamente
      const vendedor_id = req.user?.id;
      const sucursal_id = req.user?.sucursal_id;

      if (!vendedor_id || !sucursal_id) {
        console.error("Missing user context for auto-sale creation");
      } else {
        // sp_venta_crear(vendedor, cliente, sucursal, urgente, descuento)
        const ventaResult: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_crear', [
          vendedor_id,
          finalClienteId,
          sucursal_id,
          false,
          descuento || 0
        ]);

        // Extract ID securely
        const ventaData = ventaResult[0]?.sp_venta_crear || ventaResult[0] || {};
        const venta_id = ventaData.venta_id;

        return res.json({
          success: true,
          prescripcion_id,
          venta_id
        });
      }

      res.json({
        success: true,
        prescripcion_id
      });

    } catch (error: any) {
      console.error("ERROR EN CREATE_PRESCRIPTION:", error.message, error.stack);
      res.status(500).json({ success: false, error });
    }
  }

  public async getPrescription(req: Request, res: Response) {
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get', []);
      res.json({ success: true, result: result.rows });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }



  public async getPrescriptionById(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get_by_id', [id]);
      res.json({ success: true, result: result.rows[0] });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public async getPrescriptionsByClientId(req: Request, res: Response) {
    const { cliente_id } = req.params;
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get_by_cliente', [cliente_id]);
      res.json({ success: true, result: result.rows });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public async getPrescriptionsByClientDni(req: Request, res: Response) {
    const { cliente_id } = req.params;
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get_by_cliente_dni', [cliente_id]);
      res.json({ success: true, result: result.rows });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public async getLastPrescriptionByClient(req: Request, res: Response) {
    const { cliente_id } = req.params;
    try {
      // Use sp_prescripcion_get_ultima as requested
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get_ultima', [cliente_id]);

      if (result.rows && result.rows.length > 0) {
        res.json({ success: true, result: result.rows[0] });
      } else {
        res.json({ success: true, result: null });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public async associateProduct(req: Request, res: Response) {
    const { id } = req.params; // prescription_id
    const { producto_id } = req.body;
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_asociar_producto', [id, producto_id]);
      res.json({ success: true, result: result.rows[0] });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public async getPrescriptionProducts(req: Request, res: Response) {
    const { id } = req.params; // prescription_id
    try {
      const result = await PostgresDB.getInstance().callStoredProcedure('sp_prescripcion_get_productos', [id]);
      res.json({ success: true, result: result.rows });
    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error });
    }
  }

  public pruebaGet(req: Request, res: Response) {
    res.json({
      ok: true,
      message: "crearProducto",
    });
  };
}