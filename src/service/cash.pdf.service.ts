import PDFDocument from 'pdfkit';

interface ClosureData {
    cierre_id: string;
    sucursal: string;
    cajero: string;
    fecha_cierre: string;
    fecha_apertura: string;

    // Totals
    monto_sistema: number;     // Total System (All methods)
    monto_real_total: number;  // Total Declared (All methods)

    // Cash Specifics
    fondo_inicial: number;
    imputacion_efectivo_sistema: number; // Cash Sales only
    efectivo_fisico: number;             // Physical Cash Counted

    // Calculated
    diferencia_global: number;      // Global Diff (Total Real - System)
    diferencia_efectivo: number;    // Cash Diff (Physical - Expected)

    // Withdrawals
    monto_remanente: number;
    monto_extraccion: number;

    observaciones: string;
    detalle_metodos: Record<string, number>;

    // OS
    liquidaciones?: { obra_social: string; total: number; estado: string }[];
}

export class CashPdfService {

    public static async generateClosingReport(data: ClosureData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const col1 = 50;
            const col2 = 300;
            const colValue = 450;

            // -- HEADER --
            doc.fontSize(20).text('Reporte de Cierre de Caja', { align: 'center' });
            doc.moveDown();

            doc.fontSize(10);
            doc.text(`ID Cierre: ${data.cierre_id}`, { align: 'right' });
            doc.text(`Fecha: ${new Date(data.fecha_cierre).toLocaleString()}`, { align: 'right' });

            doc.text(`Sucursal: ${data.sucursal || 'Principal'}`, col1, doc.y - 30); // Quick align fix
            doc.text(`Cajero: ${data.cajero || 'Usuario'}`, col1);
            doc.moveDown(2);

            // Helper for Rows
            const printRow = (label: string, value: any, bold = false, indent = 0) => {
                doc.x = col1 + indent;
                if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
                doc.text(label, { continued: true });
                doc.x = colValue;
                doc.text(typeof value === 'number' ? `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : value, { align: 'right' });
                doc.font('Helvetica');
            };

            const sectionTitle = (title: string) => {
                doc.moveDown();
                doc.fontSize(12).font('Helvetica-Bold').fillColor('#222').text(title, { underline: true });
                doc.fontSize(10).fillColor('black').moveDown(0.5);
            };

            // 1. TOTALES DE SISTEMA
            sectionTitle('1. Totales de Sistema (Ventas)');
            const methods = data.detalle_metodos || {};
            let systemTotalCalc = 0;

            Object.entries(methods).forEach(([method, amount]) => {
                printRow(`• ${method}`, amount, false, 10);
                systemTotalCalc += Number(amount);
            });
            doc.moveDown(0.5);
            printRow('TOTAL VENTAS (SISTEMA)', systemTotalCalc, true);


            // 2. CONCILIACIÓN DE EFECTIVO
            sectionTitle('2. Conciliación de Efectivo');

            const cashSales = Number(methods['EFECTIVO'] || 0);
            const expectedCash = cashSales + Number(data.fondo_inicial);

            printRow('Fondo Inicial (Turno Anterior):', data.fondo_inicial);
            printRow('Ventas en Efectivo:', cashSales);
            doc.moveDown(0.5);
            printRow('Efectivo Esperado (Fondo + Ventas):', expectedCash, true);

            doc.moveDown(0.5);
            printRow('Efectivo Físico Declarado:', data.efectivo_fisico);

            // Diferencia logic (Use SP provided value)
            const cashDiff = Number(data.diferencia_efectivo);
            const color = cashDiff === 0 ? 'black' : (cashDiff < 0 ? 'red' : 'green');

            doc.fillColor(color);
            doc.font('Helvetica-Bold');
            doc.text('Diferencia (Sobrante/Faltante):', col1, doc.y + 5, { continued: true });
            doc.text(`$ ${cashDiff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, colValue, doc.y, { align: 'right' });
            doc.fillColor('black');
            doc.font('Helvetica');


            // 3. GESTIÓN DE RETIROS
            sectionTitle('3. Gestión de Retiros');

            printRow('Monto Remanente (Queda en Caja):', data.monto_remanente);
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica-Bold');
            printRow('MONTO DE EXTRACCIÓN (A Retirar):', data.monto_extraccion, true);
            doc.fontSize(10).font('Helvetica');


            // 4. OBRAS SOCIALES
            if (data.liquidaciones && data.liquidaciones.length > 0) {
                sectionTitle('4. Liquidaciones Generadas (Obras Sociales)');

                // Table Header
                const tableY = doc.y + 10;
                doc.font('Helvetica-Bold');
                doc.text('Obra Social', col1, tableY);
                doc.text('Estado', col1 + 200, tableY);
                doc.text('Monto', colValue, tableY, { align: 'right' });
                doc.font('Helvetica');
                doc.moveDown();

                data.liquidaciones.forEach(liq => {
                    const y = doc.y;
                    doc.text(liq.obra_social, col1, y);
                    doc.text(liq.estado, col1 + 200, y);
                    doc.text(`$ ${Number(liq.total).toLocaleString('es-AR')}`, colValue, y, { align: 'right' });
                });
            }

            // OBSERVACIONES
            if (data.observaciones) {
                sectionTitle('Observaciones');
                doc.text(data.observaciones);
            }

            // FIRMA
            doc.moveDown(4);
            const lineY = doc.y;
            doc.moveTo(doc.page.width / 2 - 100, lineY).lineTo(doc.page.width / 2 + 100, lineY).stroke();
            doc.text('Firma Responsable', { align: 'center' });

            doc.end();
        });
    }
}
