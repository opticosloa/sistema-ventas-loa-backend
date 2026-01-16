import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PDFDocument from 'pdfkit';

export class SalesPdfController {
    private static instance: SalesPdfController;

    private constructor() { }

    public static getInstance(): SalesPdfController {
        if (!SalesPdfController.instance) {
            SalesPdfController.instance = new SalesPdfController();
        }
        return SalesPdfController.instance;
    }

    public async generateLaboratoryOrder(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const db = PostgresDB.getInstance();

            // 1. Datos de la Venta
            const ventaResult = await db.callStoredProcedure('sp_venta_get_by_id', [id]);
            const venta = ventaResult.rows[0];

            if (!venta) return res.status(404).json({ success: false, error: 'Venta no encontrada' });

            // 2. Items y Pagos
            const [itemsRes, pagosRes] = await Promise.all([
                db.callStoredProcedure('sp_venta_items_get', [id]),
                db.callStoredProcedure('sp_pago_get_by_venta', [id])
            ]);

            const items = itemsRes.rows || [];
            const pagos = pagosRes.rows || [];

            const total = Number(venta.total) || 0;
            const abonado = pagos.reduce((acc: number, p: any) => acc + Number(p.monto), 0);
            const saldo = total - abonado;

            // 3. Receta (Buscamos la última del cliente)
            let receta: any = null;
            if (venta.cliente_id) {
                const recetaResult = await db.callStoredProcedure('sp_prescripcion_get_ultima', [venta.cliente_id]);
                receta = recetaResult.rows[0];
            }

            // Configurar PDF
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                autoFirstPage: true
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Orden_Taller_${id}.pdf`);

            doc.pipe(res);

            // Helpers de datos
            const data = { venta, items, receta, total, abonado, saldo };

            // Dibujar Original (Parte Superior)
            this.drawTalon(doc, 40, 'ORIGINAL', data);

            // Línea de corte
            this.drawCutLine(doc, 420);

            // Dibujar Copia (Parte Inferior)
            this.drawTalon(doc, 460, 'COPIA TALLER', data);

            doc.end();

        } catch (error: any) {
            console.error("Error generando PDF:", error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }

    private drawTalon(doc: PDFKit.PDFDocument, startY: number, label: string, data: any) {
        const { venta, items, receta, total, abonado, saldo } = data;
        const val = (v: any) => v ?? '';
        const money = (v: number) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

        const clienteNombre = `${venta.cliente_apellido || ''} ${venta.cliente_nombre || ''}`.trim();
        const fechaRecibido = new Date(venta.created_at).toLocaleDateString('es-AR');
        const armazonNombre = items.find((i: any) =>
            (i.categoria === 'ARMAZON') || (i.producto_nombre || '').toLowerCase().includes('armaz')
        )?.producto_nombre || '---';

        let y = startY;

        // --- HEADER ---
        // Col 1: Cliente Info
        doc.fontSize(10).font('Helvetica-Bold').text(`Cliente: ${clienteNombre}`, 40, y);
        y += 15;
        doc.fontSize(8).font('Helvetica').text(`Domicilio: ${val(venta.cliente_direccion)}`, 40, y);
        y += 12;
        doc.text(`Fecha Recibido: ${fechaRecibido}`, 40, y);

        // Col 2: Logo (Centro)
        const logoY = startY;
        doc.fontSize(16).font('Helvetica-Bold').text('LOA', 0, logoY, { align: 'center', width: 595 });
        doc.fontSize(7).font('Helvetica').text('Laboratorio Óptico Acuña', 0, logoY + 20, { align: 'center', width: 595 });

        // Col 3: Datos Venta (Derecha)
        const col3X = 400;
        let yRight = startY;
        doc.fontSize(8).font('Helvetica').text(`Tel: ${val(venta.cliente_telefono)}`, col3X, yRight, { align: 'right', width: 155 });
        yRight += 12;
        doc.font('Helvetica-Bold').text(`Prometido: ${val(venta.fecha_entrega_estimada)}`, col3X, yRight, { align: 'right', width: 155 });

        y = Math.max(y, logoY + 35) + 10;

        // Línea separadora header
        doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).stroke();
        y += 10;

        // --- SUBHEADER: Receta N y Totales ---
        const recetaNum = venta.venta_id?.split('-')[0].toUpperCase() || '---';
        doc.fontSize(10).font('Helvetica-Bold').text(`Receta Nº: ${recetaNum}`, 40, y);

        // Tabla de Totales (simulada a la derecha)
        const totalsX = 400;
        const totalsWidth = 155;
        let totalsY = y;

        doc.fontSize(9).font('Helvetica');
        this.drawRow(doc, totalsX, totalsY, 'Total', money(total), totalsWidth, false);
        totalsY += 12;
        this.drawRow(doc, totalsX, totalsY, 'Seña', money(abonado), totalsWidth, false);
        totalsY += 12;
        this.drawRow(doc, totalsX, totalsY, 'Saldo', money(saldo), totalsWidth, true);

        y = totalsY + 20;

        // --- TABLA DE GRADUACIÓN ---
        this.drawGraduationTable(doc, y, receta);

        y += 90; // Espacio que ocupa la tabla aprox

        // --- INFO ADICIONAL ---
        doc.fontSize(9).font('Helvetica-Bold').text('Armazón: ', 40, y, { continued: true })
            .font('Helvetica').text(`${armazonNombre}`);
        y += 15;

        doc.font('Helvetica-Bold').text('Multifocal: ', 40, y, { continued: true })
            .font('Helvetica').text(`${val(receta?.multifocal?.tipo)} | Altura: ${val(receta?.multifocal?.altura)}`);
        y += 20;

        doc.fontSize(8).font('Helvetica-Oblique').text(`Observaciones: ${val(venta.observaciones)}`, 40, y);

        // Label Tipo (Original/Copia)
        doc.fontSize(6).font('Helvetica').text(label, 40, startY + 380, { align: 'right', width: 515 });
    }

    private drawRow(doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, width: number, isBold: boolean) {
        const font = isBold ? 'Helvetica-Bold' : 'Helvetica';
        doc.font(font).text(label, x, y);
        doc.text(value, x, y, { align: 'right', width: width });
    }

    private drawCutLine(doc: PDFKit.PDFDocument, y: number) {
        doc.moveTo(20, y).lineTo(575, y).dash(5, { space: 3 }).lineWidth(0.5).strokeColor('#ccc').stroke();
        doc.undash().strokeColor('black'); // Reset
    }

    private drawGraduationTable(doc: PDFKit.PDFDocument, startY: number, receta: any) {
        const val = (v: any) => v ?? '';

        // Configuración de columnas
        const xLejosCerca = 40;
        const xOjo = 90;
        const xEsf = 120;
        const xCil = 180;
        const xEje = 240;
        const xTipo = 300;
        const xDNPLabel = 480;
        const xDNPVal = 510;

        const rowHeight = 20;
        let currentY = startY;

        // Headers implícitos o bordes
        // Dibujamos el borde exterior
        // Lejos Row 1 (OD)
        this.drawGradCell(doc, xLejosCerca, currentY, 'Lejos', true, true);
        this.drawGradCell(doc, xOjo, currentY, 'O.D.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.lejos?.OD?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.lejos?.OD?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.lejos?.OD?.eje)}°`);

        // Tipo Lejos (spans 2 rows)
        doc.fontSize(8).text(`Tipo: ${val(receta?.lejos?.tipo)}`, xTipo, currentY + 12);

        // DNP Lejos (spans 2 rows)
        doc.fontSize(7).text('DNP', xDNPLabel, currentY + 12, { align: 'center', width: 30 });
        doc.fontSize(9).text(val(receta?.lejos?.dnp), xDNPVal, currentY + 12, { align: 'center', width: 40 });

        currentY += rowHeight;

        // Lejos Row 2 (OI)
        // Lejos label continues (visual only needed if not spanning, but here simpler to leave blank or center vertically)
        this.drawGradCell(doc, xOjo, currentY, 'O.I.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.lejos?.OI?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.lejos?.OI?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.lejos?.OI?.eje)}°`);

        currentY += rowHeight + 5; // spacing

        // Cerca Row 1 (OD)
        this.drawGradCell(doc, xLejosCerca, currentY, 'Cerca', true, true);
        this.drawGradCell(doc, xOjo, currentY, 'O.D.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.cerca?.OD?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.cerca?.OD?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.cerca?.OD?.eje)}°`);

        // Tipo Cerca (spans 2 rows)
        doc.fontSize(8).font('Helvetica').text(`Tipo: ${val(receta?.cerca?.tipo)}`, xTipo, currentY + 12);

        // DNP Cerca (spans 2 rows)
        doc.fontSize(7).text('DNP', xDNPLabel, currentY + 12, { align: 'center', width: 30 });
        doc.fontSize(9).text(val(receta?.cerca?.dnp), xDNPVal, currentY + 12, { align: 'center', width: 40 });

        currentY += rowHeight;

        // Cerca Row 2 (OI)
        this.drawGradCell(doc, xOjo, currentY, 'O.I.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.cerca?.OI?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.cerca?.OI?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.cerca?.OI?.eje)}°`);

        // Líneas horizontales de separación (simplificado)
        doc.lineWidth(0.5).strokeColor('#aaa');
        doc.moveTo(xLejosCerca, startY).lineTo(550, startY).stroke(); // Top
        doc.moveTo(xLejosCerca, startY + rowHeight * 2).lineTo(550, startY + rowHeight * 2).stroke(); // Mid (after Lejos)
        doc.moveTo(xLejosCerca, startY + rowHeight * 4 + 5).lineTo(550, startY + rowHeight * 4 + 5).stroke(); // Bottom (after Cerca)
    }

    private drawGradCell(doc: PDFKit.PDFDocument, x: number, y: number, text: string, bold = false, big = false) {
        doc.fontSize(big ? 10 : 9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(text, x, y + 5);
    }
}
