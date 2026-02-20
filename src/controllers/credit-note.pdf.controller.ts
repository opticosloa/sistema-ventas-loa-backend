import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PDFDocument from 'pdfkit';

/**
 * Genera una Nota de Crédito Interna en formato A4 — Blanco y Negro.
 * Endpoint: GET /api/sales/:id/credit-note
 *
 * Query params:
 *   saldo_acreditado    (number)
 *   efectivo_a_devolver (number)
 */
export class CreditNotePdfController {
    private static instance: CreditNotePdfController;

    private constructor() { }

    public static getInstance(): CreditNotePdfController {
        if (!CreditNotePdfController.instance) {
            CreditNotePdfController.instance = new CreditNotePdfController();
        }
        return CreditNotePdfController.instance;
    }

    public async generateCreditNote(req: Request, res: Response) {
        const { id } = req.params;

        const saldoAcreditado = parseFloat(String(req.query.saldo_acreditado ?? '0'));
        const efectivoADevolver = parseFloat(String(req.query.efectivo_a_devolver ?? '0'));

        try {
            const db = PostgresDB.getInstance();

            const ventaResult = await db.callStoredProcedure('sp_venta_get_by_id', [id]);
            const venta = ventaResult.rows[0];
            if (!venta) {
                return res.status(404).json({ success: false, error: 'Venta no encontrada' });
            }

            let cliente: any = null;
            if (venta.cliente_id) {
                const clienteResult = await db.callStoredProcedure('sp_cliente_get_by_id', [venta.cliente_id]);
                cliente = clienteResult.rows[0] ?? null;
            }

            // ── Helpers
            const money = (v: number) =>
                `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
            const val = (v: any, fallback = '–') =>
                v != null && v !== '' ? String(v) : fallback;

            const totalVenta = Number(venta.total) || 0;
            const fechaVenta = new Date(venta.fecha || venta.created_at);
            const fechaStr = fechaVenta.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const horaStr = fechaVenta.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const ventaNumStr = (venta.venta_id as string)?.split('-')[0]?.toUpperCase() ?? id;
            const emisionStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const clienteNombre = val(cliente?.nombre ?? venta.cliente_nombre);
            const clienteApellido = val(cliente?.apellido ?? venta.cliente_apellido);
            const clienteDni = val(cliente?.dni ?? venta.cliente_dni);
            const clienteTel = val(cliente?.telefono ?? venta.cliente_telefono);

            // ── PDF setup — A4, blanco y negro
            const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=NotaCredito_${ventaNumStr}.pdf`);
            doc.pipe(res);

            // Constantes
            const W = 595;
            const mX = 40;          // margen horizontal
            const cW = W - mX * 2;  // ancho de contenido
            const BLACK = '#000000';
            const WHITE = '#ffffff';

            let y = 36;

            // ══════════════════════════════════════════════════
            // SECCIÓN 1 — CABECERA
            // ══════════════════════════════════════════════════

            // Nombre óptica (izquierda)
            doc.fontSize(22).font('Helvetica-Bold').fillColor(BLACK)
                .text('LOA', mX, y);
            doc.fontSize(9).font('Helvetica').fillColor(BLACK)
                .text('Laboratorio Óptico Acuña', mX, y + 28);
            doc.fontSize(8).font('Helvetica').fillColor(BLACK)
                .text('optica@loa.com.ar', mX, y + 40);

            // Recuadro derecho — tipo de comprobante
            const boxW = 210;
            const boxX = W - mX - boxW;
            const boxY = y - 6;
            const boxH = 78;

            // Borde negro, fondo blanco
            doc.rect(boxX, boxY, boxW, boxH)
                .lineWidth(1.5).strokeColor(BLACK).fillAndStroke(WHITE, BLACK);

            doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
                .text('NOTA DE CRÉDITO INTERNA', boxX, boxY + 12, { width: boxW, align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor(BLACK)
                .text(`Nro. Venta: ${ventaNumStr}`, boxX, boxY + 32, { width: boxW, align: 'center' });
            doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, boxX, boxY + 46, { width: boxW, align: 'center' });
            doc.fontSize(7).font('Helvetica').fillColor(BLACK)
                .text(`Emitido: ${emisionStr}`, boxX, boxY + 60, { width: boxW, align: 'center' });

            // Línea divisoria
            y = 126;
            doc.moveTo(mX, y).lineTo(W - mX, y).lineWidth(1).strokeColor(BLACK).stroke();

            // ══════════════════════════════════════════════════
            // SECCIÓN 2 — DATOS DEL CLIENTE
            // ══════════════════════════════════════════════════
            y += 16;

            doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
                .text('DATOS DEL CLIENTE', mX, y);

            y += 14;
            const clientBoxH = 62;
            doc.rect(mX, y, cW, clientBoxH).lineWidth(1).strokeColor(BLACK).stroke();

            const col = cW / 2;
            const pad = 12;

            doc.fontSize(9).font('Helvetica-Bold').fillColor(BLACK)
                .text('Nombre:', mX + pad, y + 10);
            doc.font('Helvetica')
                .text(`${clienteNombre} ${clienteApellido}`, mX + pad + 55, y + 10);

            doc.font('Helvetica-Bold')
                .text('DNI:', mX + pad, y + 28);
            doc.font('Helvetica')
                .text(clienteDni, mX + pad + 55, y + 28);

            // Columna derecha
            doc.font('Helvetica-Bold')
                .text('Teléfono:', mX + col + pad, y + 10);
            doc.font('Helvetica')
                .text(clienteTel, mX + col + pad + 60, y + 10);

            doc.font('Helvetica-Bold')
                .text('Estado:', mX + col + pad, y + 28);
            doc.font('Helvetica-Bold')
                .text('VENTA ANULADA', mX + col + pad + 60, y + 28);

            y += clientBoxH + 22;

            // ══════════════════════════════════════════════════
            // SECCIÓN 3 — RESUMEN FINANCIERO
            // ══════════════════════════════════════════════════
            doc.fontSize(10).font('Helvetica-Bold').fillColor(BLACK)
                .text('RESUMEN FINANCIERO', mX, y);
            y += 14;

            // Helper fila
            const drawRow = (
                label: string,
                value: string,
                bold = false,
                rowH = 30,
                fontSize = 10
            ) => {
                doc.rect(mX, y, cW, rowH).lineWidth(0.7).strokeColor(BLACK).stroke();
                const font = bold ? 'Helvetica-Bold' : 'Helvetica';
                doc.fontSize(fontSize).font(font).fillColor(BLACK)
                    .text(label, mX + pad, y + (rowH - fontSize) / 2 + 1, {
                        width: cW * 0.6,
                    });
                doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(BLACK)
                    .text(value, mX + cW * 0.6, y + (rowH - fontSize) / 2 + 1, {
                        width: cW * 0.38, align: 'right',
                    });
                y += rowH;
            };

            drawRow('Monto Total de la Venta Anulada', money(totalVenta));

            if (efectivoADevolver > 0) {
                drawRow('Devolucion en Efectivo', money(efectivoADevolver));
            }

            // Fila destacada — SALDO A FAVOR (negrita, mayor, borde grueso)
            const saldoRowH = 46;
            doc.rect(mX, y, cW, saldoRowH).lineWidth(2).strokeColor(BLACK).stroke();
            doc.fontSize(13).font('Helvetica-Bold').fillColor(BLACK)
                .text('SALDO A FAVOR ACREDITADO', mX + pad, y + (saldoRowH - 13) / 2 + 1, {
                    width: cW * 0.6,
                });
            doc.fontSize(13).font('Helvetica-Bold').fillColor(BLACK)
                .text(money(saldoAcreditado), mX + cW * 0.6, y + (saldoRowH - 13) / 2 + 1, {
                    width: cW * 0.38, align: 'right',
                });
            y += saldoRowH;

            // ══════════════════════════════════════════════════
            // SECCIÓN 4 — TEXTO LEGAL
            // ══════════════════════════════════════════════════
            y += 24;
            doc.rect(mX, y, cW, 46).lineWidth(1).strokeColor(BLACK).stroke();
            doc.fontSize(8.5).font('Helvetica-Oblique').fillColor(BLACK)
                .text(
                    'Este documento certifica un saldo a favor en su Cuenta Corriente. ' +
                    'Conservelo para aplicarlo a futuras compras en nuestra optica.',
                    mX + pad, y + 10,
                    { width: cW - pad * 2, align: 'center' }
                );

            // ══════════════════════════════════════════════════
            // SECCIÓN 5 — LÍNEAS DE FIRMA
            // ══════════════════════════════════════════════════
            const firmaY = 755;
            const firmaW = 185;
            const firmaL = mX + 20;
            const firmaR = W - mX - 20 - firmaW;

            doc.moveTo(firmaL, firmaY).lineTo(firmaL + firmaW, firmaY)
                .lineWidth(0.8).strokeColor(BLACK).stroke();
            doc.fontSize(8).font('Helvetica').fillColor(BLACK)
                .text('Firma Vendedor / Administrador', firmaL, firmaY + 5, {
                    width: firmaW, align: 'center',
                });

            doc.moveTo(firmaR, firmaY).lineTo(firmaR + firmaW, firmaY)
                .lineWidth(0.8).strokeColor(BLACK).stroke();
            doc.text('Firma Cliente (conformidad)', firmaR, firmaY + 5, {
                width: firmaW, align: 'center',
            });

            // Pie
            doc.fontSize(7).font('Helvetica').fillColor(BLACK)
                .text(
                    `Laboratorio Optico Acuna — Nota de Credito Interna — ${emisionStr}`,
                    0, 820, { width: W, align: 'center' }
                );

            doc.end();

        } catch (error: any) {
            console.error('Error generando Nota de Credito PDF:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }
}
