import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

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
            let cliente: any = null;
            let ticket: any = null;

            if (venta.cliente_id) {
                const recetaResult = await db.callStoredProcedure('sp_prescripcion_get_ultima', [venta.cliente_id]);
                receta = recetaResult.rows[0];

                const clienteResult = await db.callStoredProcedure('sp_cliente_get_by_id', [venta.cliente_id]);
                cliente = clienteResult.rows[0];
            }

            // Buscar Ticket
            const ticketResult = await db.executeQuery('SELECT * FROM tickets WHERE venta_id = $1 LIMIT 1', [id]);
            ticket = ticketResult.rows[0];

            // 4. Obra Social Logic
            let obraSocial: any = null;
            let obraSocialId = venta.obra_social_id;

            // If not in sale, check payments for reference "ID_OS: ..."
            if (!obraSocialId && pagos.length > 0) {
                const osPayment = pagos.find((p: any) => p.metodo === 'OBRA_SOCIAL');
                if (osPayment && osPayment.referencia) {
                    const match = osPayment.referencia.match(/ID_OS:\s*([^\s|]+)/);
                    if (match && match[1]) {
                        obraSocialId = match[1];
                    }
                }
            }

            if (obraSocialId) {
                const obraSocialRow = await PostgresDB.getInstance().callStoredProcedure('sp_obra_social_get_by_id', [obraSocialId]);
                obraSocial = obraSocialRow.rows[0].nombre;
            } else if (receta && receta.obra_social) {
                // Fallback to text in prescription if available
                obraSocial = { nombre: receta.obra_social };
            }

            // 5. Taller Info
            let taller: any = null;
            if (venta.taller_id) {
                const tallerRes = await db.executeQuery('SELECT * FROM talleres WHERE taller_id = $1', [venta.taller_id]);
                taller = tallerRes.rows[0];
            }

            // 6. Generar QR
            const qrCodeDataUrl = await QRCode.toDataURL(venta.venta_id || id);

            // Configurar PDF
            const doc = new PDFDocument({
                size: 'A4',
                margin: 30, // Reduced from 40
                autoFirstPage: true
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Orden_Taller_${id}.pdf`);

            doc.pipe(res);

            // Helpers de datos
            const data = { venta, items, receta, total, abonado, saldo, obraSocial, qrCodeDataUrl, cliente, ticket, taller };

            // Dibujar Original (Parte Superior)
            // Reduced start Y from 40 to 30
            this.drawTalon(doc, 30, 'ORIGINAL', data);

            // Línea de corte
            // Moved up from 420 to 410
            this.drawCutLine(doc, 410);

            // Dibujar Copia (Parte Inferior)
            // Moved up from 460 to 440
            this.drawTalon(doc, 440, 'COPIA TALLER', data);

            doc.end();

        } catch (error: any) {
            console.error("Error generando PDF:", error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }

    private async drawTalon(doc: PDFKit.PDFDocument, startY: number, label: string, data: any) {
        const { venta, items, receta, total, abonado, saldo, obraSocial, qrCodeDataUrl, cliente, ticket, taller } = data;
        const val = (v: any) => v ?? '';
        const money = (v: number) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

        const clienteNombre = `${venta.cliente_apellido || ''} ${venta.cliente_nombre || ''}`.trim();
        const fechaRecibido = new Date(venta.created_at).toLocaleDateString('es-AR');
        const fechaPrometido = ticket?.fecha_entrega_estimada ? new Date(ticket.fecha_entrega_estimada).toLocaleDateString('es-AR') : '---';

        let y = startY;

        // --- HEADER ---
        // Col 1: Cliente Info
        doc.fontSize(10).font('Helvetica-Bold').text(`Cliente: ${clienteNombre}`, 40, y);
        y += 14;

        if (label !== 'ORIGINAL') {
            doc.fontSize(8).font('Helvetica').text(`Domicilio: ${val(cliente?.direccion || venta.cliente_direccion)}`, 40, y);
            y += 11;
        }

        doc.fontSize(8).font('Helvetica').text(`Fecha Recibido: ${fechaRecibido}`, 40, y);

        // QR Code
        if (qrCodeDataUrl) {
            doc.image(qrCodeDataUrl, 200, startY, { width: 50 });
        }

        // Col 2: Logo (Centro)
        const logoY = startY;
        doc.fontSize(16).font('Helvetica-Bold').text('LOA', 0, logoY, { align: 'center', width: 595 });
        doc.fontSize(7).font('Helvetica').text('Laboratorio Óptico Acuña', 0, logoY + 20, { align: 'center', width: 595 });

        // Col 3: Datos Venta (Derecha)
        const col3X = 400;
        let yRight = startY;
        doc.fontSize(8).font('Helvetica').text(`Tel: ${val(cliente?.telefono || venta.cliente_telefono)}`, col3X, yRight, { align: 'right', width: 155 });
        yRight += 11;
        doc.font('Helvetica-Bold').text(`Prometido: ${fechaPrometido}`, col3X, yRight, { align: 'right', width: 155 });
        doc.font('Helvetica-Bold').text(`DNI: ${val(cliente?.dni || venta.cliente_dni)}`, col3X, yRight + 11, { align: 'right', width: 155 });
        yRight += 11; // Add extra space for DNI

        yRight += 11;
        doc.font('Helvetica').text(`Obra Social: ${val(obraSocial?.nombre || 'Sin obra social')}`, col3X, yRight, { align: 'right', width: 155 });

        // Calculate Y based on content AND QR code height (50)
        // Ensure we have at least startY + 50 + padding
        const qrHeight = qrCodeDataUrl ? 55 : 0;
        y = Math.max(y, logoY + 30, startY + qrHeight) + 8;

        // Línea separadora header
        doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).stroke();
        y += 8; // Reduced from 10

        // --- SUBHEADER: Receta N y Totales ---
        const recetaNum = venta.venta_id?.split('-')[0].toUpperCase() || '---';
        doc.fontSize(10).font('Helvetica-Bold').text(`Receta Nº: ${recetaNum}`, 40, y);

        // Taller Envío info
        if (taller) {
            doc.fontSize(9).font('Helvetica-Bold').fillColor('red')
                .text(`Enviar a: ${taller.nombre} (Demora: ${taller.tiempo_demora || '-'})`, 160, y);
            doc.fillColor('black'); // Reset
        }

        // Tabla de Totales (simulada a la derecha)
        const totalsX = 400;
        const totalsWidth = 155;
        let totalsY = y;

        doc.fontSize(9).font('Helvetica');
        this.drawRow(doc, totalsX, totalsY, 'Total', money(total), totalsWidth, false);
        totalsY += 11; // Reduced from 12
        this.drawRow(doc, totalsX, totalsY, 'Seña', money(abonado), totalsWidth, false);
        totalsY += 11; // Reduced from 12
        this.drawRow(doc, totalsX, totalsY, 'Saldo', money(saldo), totalsWidth, true);

        y = totalsY + 15; // Reduced from 20

        // --- TABLA DE GRADUACIÓN ---
        // Pass updated y position
        const tableHeight = this.drawGraduationTable(doc, y, receta);

        y += tableHeight + 10; // Use calculated height + padding

        // --- INFO ADICIONAL ---
        if (receta?.multifocal?.tipo) {
            // Line 1: Multifocal: [Tipo]
            doc.font('Helvetica-Bold').text('Multifocal: ', 40, y, { continued: true })
                .font('Helvetica').text(val(receta.multifocal.tipo));
            y += 14;

            // Line 2: Heights & D.I.
            const altura = val(receta.multifocal.altura);
            const diLejos = val(receta.multifocal.di_lejos);
            const diCerca = val(receta.multifocal.di_cerca);

            // "Altura: [altura] mm | D.I. Lejos: [di_lejos] mm | D.I. Cerca: [di_cerca] mm"
            doc.font('Helvetica').text(`Altura: ${altura} mm  |  D.I. Lejos: ${diLejos} mm  |  D.I. Cerca: ${diCerca} mm`, 40, y);
            y += 14;

            // Line 3: Obs. Lab (Conditional)
            if (receta.multifocal.observaciones) {
                doc.font('Helvetica-Bold').text('Obs. Lab: ', 40, y, { continued: true })
                    .font('Helvetica').text(receta.multifocal.observaciones);
                y += 14;
            }

            // Line 4: Armazón Multifocal
            const armazonMulti = receta.multifocal.armazon?.nombre || '---';
            doc.font('Helvetica-Bold').text('Armazón Multifocal: ', 40, y, { continued: true })
                .font('Helvetica').text(armazonMulti);
            y += 18;
        }

        doc.fontSize(8).font('Helvetica-Oblique').text(`Observaciones: ${val(venta.observaciones)}`, 40, y);

        // Label Tipo (Original/Copia)
        // Was startY + 380. Now 30 (start) + 350 = 380 absolute for Original.
        // Copy: 440 (start) + 350 = 790 absolute. A4 height is ~841. Safe.
        doc.fontSize(6).font('Helvetica').text(label, 40, startY + 350, { align: 'right', width: 515 });
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

    private drawGraduationTable(doc: PDFKit.PDFDocument, startY: number, receta: any): number {
        const val = (v: any) => v ?? '';

        // Configuración de columnas
        const xLejosCerca = 40;
        const xOjo = 90;
        const xEsf = 120;
        const xCil = 180;
        const xEje = 240;
        const xTipo = 300;
        const xTratamiento = 390;
        const xDNPLabel = 480;
        const xDNPVal = 510;

        const rowHeight = 16;
        let currentY = startY;

        // --- LEJOS ---
        // Linea Superior
        doc.lineWidth(0.5).strokeColor('#aaa');
        doc.moveTo(xLejosCerca, currentY).lineTo(550, currentY).stroke();

        // Row 1 (OD)
        this.drawGradCell(doc, xLejosCerca, currentY, 'Lejos', true, true);
        this.drawGradCell(doc, xOjo, currentY, 'O.D.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.lejos?.OD?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.lejos?.OD?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.lejos?.OD?.eje)}°`);

        // Merged Cells Lejos
        doc.fontSize(8).text(`Tipo: ${val(receta?.lejos?.tipo)}`, xTipo, currentY + 10);
        doc.fontSize(8).text(`Trat.: ${val(receta?.lejos?.color)}`, xTratamiento, currentY + 10);
        doc.fontSize(7).text('DNP', xDNPLabel, currentY + 10, { align: 'center', width: 30 });
        doc.fontSize(9).text(val(receta?.lejos?.dnp), xDNPVal, currentY + 10, { align: 'center', width: 40 });

        currentY += rowHeight;

        // Row 2 (OI)
        this.drawGradCell(doc, xOjo, currentY, 'O.I.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.lejos?.OI?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.lejos?.OI?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.lejos?.OI?.eje)}°`);

        currentY += rowHeight + 4;

        // Armazón Lejos
        const armazonLejos = receta?.lejos?.armazon?.nombre;
        if (armazonLejos) {
            doc.fontSize(9).font('Helvetica-Bold').text('Armazón Lejos: ', 40, currentY, { continued: true })
                .font('Helvetica').text(armazonLejos);
            currentY += 14;
        }

        // Linea Media (Separador Lejos/Cerca)
        doc.lineWidth(0.5).strokeColor('#aaa');
        doc.moveTo(xLejosCerca, currentY).lineTo(550, currentY).stroke();

        // --- CERCA ---
        // Row 1 (OD)
        this.drawGradCell(doc, xLejosCerca, currentY, 'Cerca', true, true);
        this.drawGradCell(doc, xOjo, currentY, 'O.D.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.cerca?.OD?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.cerca?.OD?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.cerca?.OD?.eje)}°`);

        // Merged Cells Cerca
        doc.fontSize(8).font('Helvetica').text(`Tipo: ${val(receta?.cerca?.tipo)}`, xTipo, currentY + 10);
        doc.fontSize(8).font('Helvetica').text(`Trat.: ${val(receta?.cerca?.color)}`, xTratamiento, currentY + 10);
        doc.fontSize(7).text('DNP', xDNPLabel, currentY + 10, { align: 'center', width: 30 });
        doc.fontSize(9).text(val(receta?.cerca?.dnp), xDNPVal, currentY + 10, { align: 'center', width: 40 });

        currentY += rowHeight;

        // Row 2 (OI)
        this.drawGradCell(doc, xOjo, currentY, 'O.I.', true);
        this.drawGradCell(doc, xEsf, currentY, `Esf: ${val(receta?.cerca?.OI?.esfera)}`);
        this.drawGradCell(doc, xCil, currentY, `Cil: ${val(receta?.cerca?.OI?.cilindro)}`);
        this.drawGradCell(doc, xEje, currentY, `En: ${val(receta?.cerca?.OI?.eje)}°`);

        currentY += rowHeight + 4;

        // Armazón Cerca
        const armazonCerca = receta?.cerca?.armazon?.nombre;
        if (armazonCerca) {
            doc.fontSize(9).font('Helvetica-Bold').text('Armazón Cerca: ', 40, currentY, { continued: true })
                .font('Helvetica').text(armazonCerca);
            currentY += 14;
        }

        // Linea Inferior
        doc.lineWidth(0.5).strokeColor('#aaa');
        doc.moveTo(xLejosCerca, currentY).lineTo(550, currentY).stroke();

        return (currentY) - startY;
    }

    private drawGradCell(doc: PDFKit.PDFDocument, x: number, y: number, text: string, bold = false, big = false) {
        doc.fontSize(big ? 10 : 9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(text, x, y + 4); // Reduced padding from 5
    }
}
