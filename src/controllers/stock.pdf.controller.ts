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
        // 1. Label Boundary (Outline)
        doc.lineWidth(0.5).strokeColor('#e0e0e0').rect(x, y, w, h).stroke();

        // Constants for Internal Layout
        const padding = 2;
        const innerX = x + padding;
        const innerY = y + padding;
        const innerW = w - (padding * 2);
        const innerH = h - (padding * 2);

        // Sections: 70% QR, 30% Text
        const splitRatio = 0.70;
        const qrSectionH = innerH * splitRatio;
        const textSectionH = innerH * (1 - splitRatio);

        // Y position of the divider (Cut Guide)
        // We calculate coordinate relative to the inner/outer box using inner logic for sizing but drawing from edge for the line
        // The user wants a "guia de sub-corte ... interna", but usually cut lines go edge to edge.
        // Let's place it at y + padding + qrSectionH roughly.
        const splitLineY = innerY + qrSectionH;

        // 2. Sub-cut Guide (Dotted Line)
        doc.save();
        doc.lineWidth(0.5)
            .strokeColor('#999') // Visible grey
            .dash(2, { space: 2 }) // Dotted
            .moveTo(x, splitLineY)
            .lineTo(x + w, splitLineY)
            .stroke();
        doc.restore();

        // 3. QR Code (Strictly ID)
        const qrData = String(product.producto_id); // Simplify payload
        const qrBufferPadding = 2; // Space inside the top section
        // Calculate max square fit
        const maxQrDim = Math.min(innerW, qrSectionH - (qrBufferPadding * 2));

        try {
            const qrBuffer = await QRCode.toBuffer(qrData, {
                margin: 0,
                errorCorrectionLevel: 'L' // Low density for clearer scanning
            });

            // Center QR in top section
            const qrX = innerX + (innerW - maxQrDim) / 2;
            const qrY = innerY + (qrSectionH - maxQrDim) / 2;

            doc.image(qrBuffer, qrX, qrY, { width: maxQrDim, height: maxQrDim });
        } catch (e) {
            console.error("Error generating QR:", e);
        }

        // 4. Product Name (Bottom Section)
        const textMarginTop = 4;
        const textY = splitLineY + textMarginTop;
        const textAvailableH = textSectionH - textMarginTop - 2;

        if (textAvailableH > 5) { // Only draw if space exists
            doc.fillColor('black')
                .fontSize(fontSize)
                .font('Helvetica');

            doc.text(product.nombre, innerX, textY, {
                width: innerW,
                height: textAvailableH,
                align: 'center',
                ellipsis: true,
                lineBreak: true,
                baseline: 'top' // Ensure it starts somewhat below the line
            });
        }
    }
}
