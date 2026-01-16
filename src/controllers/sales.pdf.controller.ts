import { Request, Response } from 'express';
import { PostgresDB } from '../database/postgres';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// En Node.js usamos las fuentes estándar del sistema para evitar errores de carga de archivos
const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

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

            // 1. Datos de la Venta (Aseguramos obtener nombres de cliente)
            const ventaResult = await db.callStoredProcedure('sp_venta_get_by_id', [id]);
            const venta = ventaResult.rows[0];

            if (!venta) return res.status(404).json({ success: false, error: 'Venta no encontrada' });

            // 2. Items y Pagos
            const [itemsRes, pagosRes] = await Promise.all([
                db.callStoredProcedure('sp_venta_items_get', [id]),
                db.callStoredProcedure('sp_pago_get_by_venta', [id])
            ]);

            const items = itemsRes.rows;
            const pagos = pagosRes.rows;

            const total = Number(venta.total) || 0;
            const abonado = pagos.reduce((acc: number, p: any) => acc + Number(p.monto), 0);
            const saldo = total - abonado;

            // 3. Receta (Buscamos la última del cliente)
            let receta: any = null;
            if (venta.cliente_id) {
                const recetaResult = await db.callStoredProcedure('sp_prescripcion_get_ultima', [venta.cliente_id]);
                receta = recetaResult.rows[0];
            }

            const docDefinition = this.buildPdfDefinition(venta, items, receta, total, abonado, saldo);

            // Generar el Stream del PDF
            const pdfDoc = printer.createPdfKitDocument(docDefinition);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Orden_Taller_${id}.pdf`);

            pdfDoc.pipe(res);
            pdfDoc.end();

        } catch (error: any) {
            console.error("Error generando PDF:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    private buildPdfDefinition(venta: any, items: any[], receta: any, total: number, abonado: number, saldo: number): TDocumentDefinitions {
        // Helpers de formato
        const val = (v: any) => v ?? '';
        const money = (v: number) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

        const clienteNombre = `${venta.cliente_apellido || ''} ${venta.cliente_nombre || ''}`.trim();
        const fechaRecibido = new Date(venta.created_at).toLocaleDateString('es-AR');

        // Buscamos el nombre del armazón en los items
        const armazonNombre = items.find((i: any) =>
            (i.categoria === 'ARMAZON') || (i.producto_nombre || '').toLowerCase().includes('armaz')
        )?.producto_nombre || '---';

        const buildGradRow = (ojo: string, data: any) => [
            { text: ojo, alignment: 'center', bold: true },
            { text: `Esf: ${val(data?.esfera)}`, fontSize: 9 },
            { text: `Cil: ${val(data?.cilindro)}`, fontSize: 9 },
            { text: `En: ${val(data?.eje)}°`, fontSize: 9 }
        ];

        const createTalon = (tipo: string) => [
            // Cabecera
            {
                columns: [
                    {
                        width: '*', stack: [
                            { text: `Cliente: ${clienteNombre}`, bold: true },
                            { text: `Domicilio: ${val(venta.cliente_direccion)}`, fontSize: 8 },
                            { text: `Fecha Recibido: ${fechaRecibido}`, fontSize: 8 }
                        ]
                    },
                    {
                        width: 'auto', stack: [
                            { text: 'LOA', fontSize: 16, bold: true, alignment: 'center' },
                            { text: 'Laboratorio Óptico Acuña', fontSize: 7, alignment: 'center' }
                        ], margin: [10, 0, 10, 0]
                    },
                    {
                        width: '*', stack: [
                            { text: `Tel: ${val(venta.cliente_telefono)}`, alignment: 'right', fontSize: 8 },
                            { text: `Prometido: ${val(venta.fecha_entrega_estimada)}`, alignment: 'right', bold: true, fontSize: 8 }
                        ]
                    }
                ]
            },
            { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5 }] },

            // Totales y Receta Nº
            {
                margin: [0, 5, 0, 5],
                columns: [
                    { text: `Receta Nº: ${venta.venta_id?.split('-')[0].toUpperCase()}`, bold: true },
                    {
                        width: 120, table: {
                            body: [
                                ['Total', { text: money(total), alignment: 'right' }],
                                ['Seña', { text: money(abonado), alignment: 'right' }],
                                [{ text: 'Saldo', bold: true }, { text: money(saldo), alignment: 'right', bold: true }]
                            ]
                        }, layout: 'noBorders', fontSize: 9
                    }
                ]
            },

            // Tabla de Graduación corregida
            {
                table: {
                    widths: [40, 25, 60, 60, 60, '*', 30, 40],
                    body: [
                        [
                            { text: 'Lejos', rowSpan: 2, margin: [0, 10, 0, 0], bold: true, alignment: 'center' },
                            ...buildGradRow('O.D.', receta?.lejos?.OD),
                            { text: `Tipo: ${val(receta?.lejos?.tipo)}`, rowSpan: 2, fontSize: 8 },
                            { text: 'DNP', alignment: 'center', fontSize: 7 },
                            { text: val(receta?.lejos?.dnp), rowSpan: 2, alignment: 'center', margin: [0, 10, 0, 0] }
                        ],
                        ['', ...buildGradRow('O.I.', receta?.lejos?.OI), '', '', ''],
                        [
                            { text: 'Cerca', rowSpan: 2, margin: [0, 10, 0, 0], bold: true, alignment: 'center' },
                            ...buildGradRow('O.D.', receta?.cerca?.OD),
                            { text: `Tipo: ${val(receta?.cerca?.tipo)}`, rowSpan: 2, fontSize: 8 },
                            { text: 'DNP', alignment: 'center', fontSize: 7 },
                            { text: val(receta?.cerca?.dnp), rowSpan: 2, alignment: 'center', margin: [0, 10, 0, 0] }
                        ],
                        ['', ...buildGradRow('O.I.', receta?.cerca?.OI), '', '', '']
                    ]
                },
                layout: {
                    hLineWidth: (i: number) => (i === 0 || i === 2 || i === 4) ? 1 : 0.5,
                    vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0.5
                }
            },

            // Info Adicional
            {
                margin: [0, 5, 0, 0],
                text: [
                    { text: 'Armazón: ', bold: true }, `${armazonNombre}\n`,
                    { text: 'Multifocal: ', bold: true }, `${val(receta?.multifocal?.tipo)} | Altura: ${val(receta?.multifocal?.altura)}`
                ], fontSize: 9
            },
            { text: `Observaciones: ${val(venta.observaciones)}`, margin: [0, 5, 0, 0], fontSize: 8, italics: true },
            { text: tipo, alignment: 'right', fontSize: 6, margin: [0, 5, 0, 0] }
        ];

        return {
            pageSize: 'A4',
            pageMargins: [40, 20, 40, 20],
            content: [
                ...createTalon('ORIGINAL'),
                { text: '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n\n', alignment: 'center', color: '#ccc' },
                ...createTalon('COPIA TALLER')
            ] as any,
            defaultStyle: { font: 'Helvetica' } // Usamos la fuente mapeada arriba
        };
    }
}