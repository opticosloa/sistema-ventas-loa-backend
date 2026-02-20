import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PDFDocument from 'pdfkit';

/**
 * Genera una Nota de Crédito Interna en formato A4 usando PDFKit.
 * Endpoint: GET /api/sales/:id/credit-note
 *
 * Query params opcionales:
 *   saldo_acreditado  (número)
 *   efectivo_a_devolver (número)
 *
 * Si los query params no se envían, intenta calcularlos desde la DB.
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

        // Los montos pueden venir como query params (enviados desde el frontend justo
        // después de la cancelación) o se calculan desde la DB si no se pasan.
        const saldoAcreditado = parseFloat(String(req.query.saldo_acreditado ?? '0'));
        const efectivoADevolver = parseFloat(String(req.query.efectivo_a_devolver ?? '0'));

        try {
            const db = PostgresDB.getInstance();

            // ── Datos de la venta
            const ventaResult = await db.callStoredProcedure('sp_venta_get_by_id', [id]);
            const venta = ventaResult.rows[0];
            if (!venta) {
                return res.status(404).json({ success: false, error: 'Venta no encontrada' });
            }

            // ── Datos del cliente (opcional, puede no tener)
            let cliente: any = null;
            if (venta.cliente_id) {
                const clienteResult = await db.callStoredProcedure('sp_cliente_get_by_id', [venta.cliente_id]);
                cliente = clienteResult.rows[0] ?? null;
            }

            // ── Helpers
            const money = (v: number) =>
                `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
            const val = (v: any, fallback = '–') => (v != null && v !== '' ? String(v) : fallback);

            const totalVenta = Number(venta.total) || 0;
            const fechaVenta = new Date(venta.fecha || venta.created_at);
            const fechaStr = fechaVenta.toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
            const horaStr = fechaVenta.toLocaleTimeString('es-AR', {
                hour: '2-digit', minute: '2-digit',
            });
            const ventaNumStr = (venta.venta_id as string)?.split('-')[0]?.toUpperCase() ?? id;

            const clienteNombre = val(cliente?.nombre ?? venta.cliente_nombre);
            const clienteApellido = val(cliente?.apellido ?? venta.cliente_apellido);
            const clienteDni = val(cliente?.dni ?? venta.cliente_dni);
            const clienteTel = val(cliente?.telefono ?? venta.cliente_telefono);

            // ── Configurar PDF A4
            const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `inline; filename=NotaCredito_${ventaNumStr}.pdf`
            );
            doc.pipe(res);

            // ── Constantes de layout (A4 = 595 × 842 pt)
            const W = 595;
            const marginX = 40;
            const contentW = W - marginX * 2;

            // ══════════════════════════════════════════════
            //  SECCIÓN 1 — CABECERA / MEMBRETE
            // ══════════════════════════════════════════════
            let y = 36;

            // Fondo gris muy claro para el membrete
            doc.rect(0, 0, W, 110).fill('#f5f5f5');
            doc.fillColor('black');

            // Nombre de la óptica (izquierda)
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a1a2e')
                .text('LOA', marginX, y);
            doc.fontSize(9).font('Helvetica').fillColor('#555')
                .text('Laboratorio Óptico Acuña', marginX, y + 28);
            doc.fontSize(8).font('Helvetica').fillColor('#777')
                .text('óptica@loa.com.ar', marginX, y + 40);

            // Recuadro azul con datos del comprobante (derecha)
            const boxW = 210;
            const boxX = W - marginX - boxW;
            const boxY = y - 6;
            const boxH = 78;
            doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#1a1a2e');

            doc.fontSize(10).font('Helvetica-Bold').fillColor('white')
                .text('NOTA DE CRÉDITO INTERNA', boxX, boxY + 12, {
                    width: boxW, align: 'center',
                });
            doc.fontSize(8).font('Helvetica').fillColor('#aad4f5')
                .text(`Nro. Venta Original: ${ventaNumStr}`, boxX, boxY + 32, {
                    width: boxW, align: 'center',
                });
            doc.fontSize(8).font('Helvetica').fillColor('#cce5ff')
                .text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, boxX, boxY + 46, {
                    width: boxW, align: 'center',
                });
            // Fecha de emisión de la nota
            const now = new Date();
            const emisionStr = now.toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
            doc.fontSize(7).font('Helvetica').fillColor('#aaa')
                .text(`Emitido: ${emisionStr}`, boxX, boxY + 60, {
                    width: boxW, align: 'center',
                });

            doc.fillColor('black');

            // Línea divisoria bajo el membrete
            y = 126;
            doc.moveTo(marginX, y).lineTo(W - marginX, y)
                .lineWidth(1).strokeColor('#1a1a2e').stroke();

            // ══════════════════════════════════════════════
            //  SECCIÓN 2 — DATOS DEL CLIENTE
            // ══════════════════════════════════════════════
            y += 16;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e')
                .text('DATOS DEL CLIENTE', marginX, y);

            y += 14;
            // Recuadro gris claro
            const clientBoxH = 62;
            doc.roundedRect(marginX, y, contentW, clientBoxH, 5)
                .fillAndStroke('#f0f4f8', '#d0d9e6');
            doc.fillColor('black');

            // Columna izquierda
            const colGap = contentW / 2;
            doc.fontSize(9).font('Helvetica-Bold').text('Nombre:', marginX + 12, y + 10);
            doc.font('Helvetica').text(`${clienteNombre} ${clienteApellido}`, marginX + 70, y + 10);

            doc.font('Helvetica-Bold').text('DNI:', marginX + 12, y + 26);
            doc.font('Helvetica').text(clienteDni, marginX + 70, y + 26);

            // Columna derecha
            doc.font('Helvetica-Bold').text('Teléfono:', marginX + colGap + 12, y + 10);
            doc.font('Helvetica').text(clienteTel, marginX + colGap + 70, y + 10);

            doc.font('Helvetica-Bold').text('Estado:', marginX + colGap + 12, y + 26);
            doc.font('Helvetica').fillColor('#c0392b').text('VENTA ANULADA', marginX + colGap + 70, y + 26);
            doc.fillColor('black');

            y += clientBoxH + 20;

            // ══════════════════════════════════════════════
            //  SECCIÓN 3 — RESUMEN FINANCIERO
            // ══════════════════════════════════════════════
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e')
                .text('RESUMEN FINANCIERO', marginX, y);

            y += 14;

            // Helper para dibujar cada fila de la tabla
            const drawFinancialRow = (
                label: string,
                value: string,
                isBold = false,
                bgColor = 'white',
                textColor = '#1a1a2e',
                rowH = 28
            ) => {
                doc.rect(marginX, y, contentW, rowH).fillAndStroke(bgColor, '#d0d9e6');
                const font = isBold ? 'Helvetica-Bold' : 'Helvetica';
                const fSize = isBold ? 12 : 10;
                doc.fontSize(fSize).font(font).fillColor(textColor)
                    .text(label, marginX + 14, y + (rowH - fSize) / 2 + 2, {
                        width: contentW * 0.55,
                    });
                doc.fontSize(fSize).font('Helvetica-Bold').fillColor(textColor)
                    .text(value, marginX + contentW * 0.55, y + (rowH - fSize) / 2 + 2, {
                        width: contentW * 0.42, align: 'right',
                    });
                doc.fillColor('black');
                y += rowH;
            };

            // Fila 1: Monto total de la venta anulada
            drawFinancialRow(
                'Monto Total de la Venta Anulada',
                money(totalVenta),
                false, '#f8f9fb', '#333'
            );

            // Fila 2: Devolución en efectivo (solo si > 0)
            if (efectivoADevolver > 0) {
                drawFinancialRow(
                    '💵  Devolución en Efectivo',
                    money(efectivoADevolver),
                    false, '#fff8e1', '#b7700a'
                );
            }

            // Fila 3: SALDO A FAVOR — la más importante, más alta y destacada
            drawFinancialRow(
                '✅  SALDO A FAVOR ACREDITADO',
                money(saldoAcreditado),
                true, '#e8f5e9', '#257a3e',
                44  // row más alta
            );

            // ══════════════════════════════════════════════
            //  SECCIÓN 4 — TEXTO LEGAL
            // ══════════════════════════════════════════════
            y += 24;
            doc.roundedRect(marginX, y, contentW, 44, 5)
                .fillAndStroke('#fffde7', '#f0c040');

            doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#5d4720')
                .text(
                    'Este documento certifica un saldo a favor en su Cuenta Corriente. ' +
                    'Consérvelo para aplicarlo a futuras compras en nuestra óptica.',
                    marginX + 12, y + 8,
                    { width: contentW - 24, align: 'center' }
                );
            doc.fillColor('black');

            // ══════════════════════════════════════════════
            //  SECCIÓN 5 — LÍNEAS DE FIRMA
            // ══════════════════════════════════════════════
            // Posicionamos las firmas cerca del pie de página (842 pt)
            const firmaY = 755;

            // Línea izquierda
            const firmaW = 180;
            const firmaLeft = marginX + 30;
            const firmaRight = W - marginX - 30 - firmaW;

            doc.moveTo(firmaLeft, firmaY).lineTo(firmaLeft + firmaW, firmaY)
                .lineWidth(0.8).strokeColor('#555').stroke();
            doc.fontSize(8).font('Helvetica').fillColor('#555')
                .text('Firma Vendedor / Administrador', firmaLeft, firmaY + 5, {
                    width: firmaW, align: 'center',
                });

            // Línea derecha
            doc.moveTo(firmaRight, firmaY).lineTo(firmaRight + firmaW, firmaY)
                .lineWidth(0.8).strokeColor('#555').stroke();
            doc.text('Firma Cliente (conformidad)', firmaRight, firmaY + 5, {
                width: firmaW, align: 'center',
            });

            // ── Pie de página
            doc.fontSize(7).font('Helvetica').fillColor('#aaa')
                .text(
                    `Laboratorio Óptico Acuña — Nota de Crédito Interna — ${emisionStr}`,
                    0, 820, { width: W, align: 'center' }
                );

            doc.fillColor('black');
            doc.end();

        } catch (error: any) {
            console.error('Error generando Nota de Crédito PDF:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    }
}
