import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import axios from 'axios';

export class BudgetController {
    private static instance: BudgetController;

    private constructor() { }

    public static getInstance(): BudgetController {
        if (!BudgetController.instance) {
            BudgetController.instance = new BudgetController();
        }
        return BudgetController.instance;
    }

    public async generateBudgetPdf(req: Request, res: Response) {
        try {
            const data = req.body;

            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                autoFirstPage: true
            });

            const filename = `Presupuesto_${Date.now()}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

            doc.pipe(res);

            // --- 1. HEADER & LOGO ---
            const logoUrl = 'https://res.cloudinary.com/dfuwdpual/image/upload/v1756402336/LOA-logo2_-_copia_l0jup8.png';
            try {
                const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
                const logoBuffer = Buffer.from(response.data, 'base64');
                doc.image(logoBuffer, 40, 40, { width: 100 });
            } catch (error) {
                doc.fontSize(20).font('Helvetica-Bold').text('LOA', 40, 40);
            }

            // Title and Info
            const rightX = 350;
            let currentY = 40;

            doc.fontSize(16).fillColor('black').font('Helvetica-Bold').text('PRESUPUESTO', rightX, currentY, { align: 'right' });
            currentY += 25;

            const today = new Date();
            const expiration = new Date();
            expiration.setDate(today.getDate() + 15);

            doc.fontSize(10).font('Helvetica');
            doc.text(`Fecha de Emisión: ${today.toLocaleDateString('es-AR')}`, rightX, currentY, { align: 'right' });
            currentY += 15;
            doc.font('Helvetica-Bold');
            doc.text(`Válido hasta: ${expiration.toLocaleDateString('es-AR')}`, rightX, currentY, { align: 'right' });
            doc.font('Helvetica');

            // --- 2. CLIENT INFO ---
            currentY = 120;
            doc.moveTo(40, currentY).lineTo(550, currentY).lineWidth(0.5).strokeColor('black').stroke();
            currentY += 10;

            doc.fontSize(10).font('Helvetica-Bold').text('Datos del Cliente:', 40, currentY);
            currentY += 15;

            const cli = data.cliente || {};
            const cliNombre = `${cli.nombre || ''} ${cli.apellido || ''}`.trim() || 'Consumidor Final';
            const cliDni = cli.dni || '---';

            doc.font('Helvetica').text(`Cliente: ${cliNombre}`, 40, currentY);
            doc.text(`DNI: ${cliDni}`, 300, currentY);
            currentY += 25;

            // --- 3. RECETA / PRESCRIPTION ---
            const receta = data.receta;
            const hasReceta = receta && (receta.lejos || receta.cerca || receta.multifocal);

            if (hasReceta) {
                // Ensure space
                if (currentY > 600) { doc.addPage(); currentY = 40; }

                doc.fontSize(10).font('Helvetica-Bold').text('Receta / Graduación:', 40, currentY);
                currentY += 15;

                const colOjo = 40;
                const colEsf = 100;
                const colCil = 160;
                const colEje = 220;
                const colDI = 280;

                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Ojo', colOjo, currentY);
                doc.text('Esfera', colEsf, currentY);
                doc.text('Cilindro', colCil, currentY);
                doc.text('Eje', colEje, currentY);
                doc.text('D.I./DNP', colDI, currentY);

                currentY += 15;
                doc.moveTo(40, currentY - 5).lineTo(550, currentY - 5).lineWidth(0.5).stroke();

                const drawOpticRow = (prefix: string, data: any, label: string) => {
                    if (!data) return;
                    doc.fontSize(9).font('Helvetica');
                    doc.text(`${label} OD`, colOjo, currentY);
                    doc.text(data.OD?.esfera || '-', colEsf, currentY);
                    doc.text(data.OD?.cilindro || '-', colCil, currentY);
                    doc.text(data.OD?.eje || '-', colEje, currentY);

                    doc.text(`${label} OI`, colOjo, currentY + 15);
                    doc.text(data.OI?.esfera || '-', colEsf, currentY + 15);
                    doc.text(data.OI?.cilindro || '-', colCil, currentY + 15);
                    doc.text(data.OI?.eje || '-', colEje, currentY + 15);

                    doc.text(data.dnp || '-', colDI, currentY);

                    currentY += 35;
                };

                if (receta.lejos) drawOpticRow('lejos', receta.lejos, 'Lejos');
                if (receta.cerca) drawOpticRow('cerca', receta.cerca, 'Cerca');

                if (receta.multifocal?.tipo) {
                    doc.text(`Multifocal: ${receta.multifocal.tipo} | Altura: ${receta.multifocal.altura || '-'}`, 40, currentY);
                    currentY += 20;
                }
            } else {
                currentY += 10;
            }

            // --- 4. PRODUCTOS / CART ---
            if (currentY > 650) { doc.addPage(); currentY = 40; }
            currentY += 10;
            doc.fontSize(10).font('Helvetica-Bold').text('Detalle de Productos:', 40, currentY);
            currentY += 20;

            const colCant = 40;
            const colDesc = 90;
            const colUnit = 380;
            const colSub = 480;

            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Cant.', colCant + 5, currentY);
            doc.text('Descripción', colDesc, currentY);
            doc.text('P. Unit.', colUnit, currentY, { align: 'right', width: 80 });
            doc.text('Total', colSub, currentY, { align: 'right', width: 60 });

            doc.moveTo(40, currentY + 12).lineTo(550, currentY + 12).lineWidth(0.5).stroke();
            currentY += 25;

            const items = Array.isArray(data.items) ? data.items : [];
            const money = (v: any) => `$ ${Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

            items.forEach((item: any) => {
                if (currentY > 750) {
                    doc.addPage();
                    currentY = 40;
                }

                const nombre = item.nombre || item.producto?.nombre || 'Item';
                const cant = item.cantidad || 1;
                const unit = item.precio_unitario || item.producto?.precio_venta || 0;
                const sub = item.subtotal || (cant * unit);

                doc.fontSize(9).font('Helvetica');
                doc.text(String(cant), colCant + 5, currentY);
                doc.text(nombre, colDesc, currentY, { width: 280, lineBreak: false, ellipsis: true });
                doc.text(money(unit), colUnit, currentY, { align: 'right', width: 80 });
                doc.text(money(sub), colSub, currentY, { align: 'right', width: 60 });

                currentY += 20;
            });

            doc.moveTo(40, currentY).lineTo(550, currentY).lineWidth(0.5).stroke();
            currentY += 10;

            // --- 5. TOTALES ---
            if (currentY > 700) { doc.addPage(); currentY = 40; }

            const totales = data.totales || {};
            const subtotal = Number(totales.subtotal) || 0;
            const descuento = Number(totales.descuento) || 0;
            const total = Number(totales.total) || (subtotal - descuento);

            const rowTotal = (label: string, val: number, bold = false) => {
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
                doc.text(label, 350, currentY, { align: 'right', width: 100 });
                doc.text(money(val), 460, currentY, { align: 'right', width: 80 });
                currentY += 15;
            };

            rowTotal('Subtotal:', subtotal);
            if (descuento > 0) {
                rowTotal('Descuento:', -descuento);
            }
            currentY += 5;
            doc.fontSize(12);
            rowTotal('TOTAL FINAL:', total, true);


            // --- 6. FOOTER ---
            // Absolute position at bottom of page
            const pageHeight = 841.89;
            const footerY = pageHeight - 60;

            // To ensure footer is on the last page relative to content
            // However, with flow, it will be at current doc.page.
            // If we are very low, we might need a new page.
            if (currentY > footerY - 20) {
                doc.addPage();
            }

            doc.fontSize(8).font('Helvetica-Oblique').fillColor('black');
            doc.text('Presupuesto válido por 15 días desde la fecha de emisión.', 40, footerY, { align: 'center', width: 515 });
            doc.text('Precios sujetos a cambio sin previo aviso.', 40, footerY + 12, { align: 'center', width: 515 });
            doc.text('Laboratorio Óptico Acuña', 40, footerY + 24, { align: 'center', width: 515 });

            doc.end();

        } catch (error: any) {
            console.error("Error creating budget PDF:", error);
            if (!res.headersSent) res.status(500).json({ success: false, error: 'Error generating budget PDF' });
        }
    }
}
