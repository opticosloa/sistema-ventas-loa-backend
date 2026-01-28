import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

interface LabelConfig {
    widthMm: number;
    heightMm: number;
    fontSize?: number;
}

export class StockPdfController {
    private static instance: StockPdfController;

    private constructor() { }

    public static getInstance(): StockPdfController {
        if (!StockPdfController.instance) {
            StockPdfController.instance = new StockPdfController();
        }
        return StockPdfController.instance;
    }

    public async generateLabels(req: Request, res: Response) {
        try {
            const { productIds, config } = req.body as { productIds: number[], config: LabelConfig };

            if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
                return res.status(400).json({ success: false, error: 'No se enviaron productos para imprimir.' });
            }

            if (!config || !config.widthMm || !config.heightMm) {
                return res.status(400).json({ success: false, error: 'Dimensiones de etiqueta inválidas.' });
            }

            // 1. Fetch Products
            const db = PostgresDB.getInstance();
            // Using ANY($1) for array param in Postgres
            const productsResult = await db.executeQuery(
                'SELECT producto_id, nombre, codigo_qr FROM productos WHERE producto_id = ANY($1)',
                [productIds]
            );
            const products = productsResult.rows;

            if (products.length === 0) {
                return res.status(404).json({ success: false, error: 'No se encontraron los productos especificados.' });
            }

            // 2. Setup PDF
            const doc = new PDFDocument({
                size: 'A4',
                margin: 0,
                autoFirstPage: true
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=etiquetas.pdf');

            doc.pipe(res);

            // 3. Grid Logic
            const MM_TO_PT = 2.83465;
            const marginMm = 5; // Safety margin
            const margin = marginMm * MM_TO_PT;

            const cellWidth = config.widthMm * MM_TO_PT;
            const cellHeight = config.heightMm * MM_TO_PT;

            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;

            const cols = Math.floor((pageWidth - (margin * 2)) / cellWidth);
            const rows = Math.floor((pageHeight - (margin * 2)) / cellHeight);

            if (cols <= 0 || rows <= 0) {
                return res.status(400).json({ success: false, error: 'Las etiquetas son demasiado grandes para una hoja A4.' });
            }

            let col = 0;
            let row = 0;

            console.log(`Grid: ${cols} cols x ${rows} rows. Cell: ${config.widthMm}x${config.heightMm}mm`);

            for (const product of products) {
                // Check pagination
                if (margin + ((row + 1) * cellHeight) > pageHeight - margin) {
                    doc.addPage();
                    col = 0;
                    row = 0;
                }

                const x = margin + (col * cellWidth);
                const y = margin + (row * cellHeight);

                // Draw Cell
                await this.drawLabel(doc, x, y, cellWidth, cellHeight, product, config.fontSize || 8);

                // Move cursor
                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                }
            }

            doc.end();

        } catch (error: any) {
            console.error("Error generating labels PDF:", error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }

    private async drawLabel(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, product: any, fontSize: number) {
        // 1. Cut Guide (Dashed Box) - Optional: Make it light gray
        doc.lineWidth(0.5).strokeColor('#ccc').dash(2, { space: 2 });
        doc.rect(x, y, w, h).stroke();
        doc.undash().strokeColor('black'); // Reset

        // Padding inside the cell
        const padding = 2;
        const innerX = x + padding;
        const innerY = y + padding;
        const innerW = w - (padding * 2);
        const innerH = h - (padding * 2);

        // 2. QR Code
        // Reserve about 60% of height for QR, 40% for text, or adapt based on aspect ratio
        // Let's try to fit QR in top center.
        const qrSize = Math.min(innerW, innerH * 0.60);

        try {
            const qrData = product.codigo_qr || product.producto_id.toString();
            const qrBuffer = await QRCode.toBuffer(qrData, { margin: 0 });

            const qrX = innerX + (innerW - qrSize) / 2;
            const qrY = innerY;

            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
        } catch (e) {
            console.error("Error creating QR for product", product.producto_id, e);
        }

        // 3. Text (Product Name)
        const textY = innerY + qrSize + 2;
        const textHeight = innerH - qrSize - 4;

        if (textHeight > 5) {
            doc.fontSize(fontSize).font('Helvetica');
            doc.text(product.nombre, innerX, textY, {
                width: innerW,
                height: textHeight,
                align: 'center',
                ellipsis: true,
                lineBreak: true
            });

            // Optional: Add Price or Code below if space permits?
            // For now just name as requested.
        }
    }
}
