import { Request, Response } from "express";
import { PostgresDB } from "../database/postgres";
import fs from "fs";
import sharp from "sharp";
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
      fecha_entrega,
      lejos,
      cerca,
      multifocal,
      observaciones,
      image_url,
      obraSocial,
      descuento,
      items
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
      if (finalDoctorId === "") finalDoctorId = null;
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
          fecha ? fecha.toString().split('T')[0] : null,
          lejos || {},
          cerca || {},
          multifocal || {},
          observaciones,
          image_url,
          obraSocial || null
        ]);

      const prescripcion_id = prescripcionResult.rows[0].prescripcion_id;

      // 3b. Descontar Stock de Cristales (Async)
      const crystalCtrl = CrystalsController.getInstance();

      const hasValue = (v: any) => v !== null && v !== undefined && v !== '';

      const deductEye = async (section: any, ojoKey: 'OD' | 'OI') => {
        if (
          section &&
          section[ojoKey] &&
          hasValue(section[ojoKey].esfera) &&
          hasValue(section[ojoKey].cilindro)
        ) {
          const esf = section[ojoKey].esfera;
          const cil = section[ojoKey].cilindro;
          const mat = section.tipo || '';
          const trat = section.color || 'Blanco';

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
        // A. [NUEVO] Resolver el UUID de la Obra Social si viene un nombre (ej: 'PAMI')
        let finalObraSocialId = null;
        if (obraSocial) {
          const osResult = await PostgresDB.getInstance()
            .callStoredProcedure('sp_obra_social_get_by_nombre', [obraSocial]);
          console.log(osResult);
          finalObraSocialId = osResult.rows[0]?.obra_social_id || null;
        }

        // B. [ACTUALIZADO] Llamada a sp_venta_crear con 7 parámetros
        const ventaResult: any = await PostgresDB.getInstance().callStoredProcedure('sp_venta_crear', [
          vendedor_id,
          finalClienteId,
          sucursal_id,
          false,            // urgente
          descuento || 0,   // descuento
          JSON.stringify(items || []), // 6. items (el SP ahora los procesa internamente)
          finalObraSocialId // 7. obra_social_id (UUID)
        ]);
        console.log(ventaResult);
        // C. [LIMPIEZA] Ya no necesitas el bucle 'for' de sp_venta_item_agregar 
        // porque el SP 'sp_venta_crear' ya calculó el total e insertó el ticket.

        const ventaData = ventaResult.rows?.[0] || {};
        const venta_id = ventaData.venta_id;

        console.log("Venta y Ticket creados automáticamente. ID:", venta_id);

        // D. [NUEVO] Actualizar fecha de entrega en el ticket si existe
        if (fecha_entrega) {
          await PostgresDB.getInstance().executeQuery(
            'UPDATE tickets SET fecha_entrega_estimada = $1 WHERE venta_id = $2',
            [fecha_entrega, venta_id]
          );
        }

        // 5. Verificar Total (Esto se mantiene igual para confirmar el cálculo de la DB)
        const totalResult = await PostgresDB.getInstance().callStoredProcedure('sp_venta_get_by_id', [venta_id]);
        const total_confirmado = totalResult.rows[0]?.total || 0;

        return res.json({
          success: true,
          prescripcion_id,
          venta_id,
          total_confirmado
        });
      }

      res.json({
        success: true,
        prescripcion_id
      });

    } catch (error: any) {
      console.error("DB ERROR:", error.message);
      if (error.detail) console.error("👉 DETAIL:", error.detail);
      if (error.hint) console.error("💡 HINT:", error.hint);
      res.status(500).json({ success: false, error: error.message, detail: error.detail });
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