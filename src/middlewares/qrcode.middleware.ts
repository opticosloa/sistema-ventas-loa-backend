import { Request, Response, NextFunction } from 'express';
import * as QRCode from 'qrcode';
import { PostgresDB } from '../database/postgres';

export const generateQRCode = async (req: Request, res: Response, next: NextFunction) => {
    // Check if the previous middleware/controller stored the product result
    if (res.locals.productResult && res.locals.productResult.rows && res.locals.productResult.rows.length > 0) {
        const product = res.locals.productResult.rows[0];
        // The stored procedure might return different column names depending on how it's written.
        // Based on previous code, we access the first value or specific keys.
        // Let's assume the controller passes the necessary info or we extract it from the result.

        // We need the ID and the Type. 
        // The controller's createProducto uses req.body for type.
        // We can access req.body here as well.

        const { tipo } = req.body;

        if (tipo === 'ARMAZON') {
            const productId = Object.values(product)[0]; // Assuming the first column is the ID as per previous code
            const qrData = `https://example.com/products/${productId}`;

            try {
                const qrCodeImage = await QRCode.toDataURL(qrData);

                // Update the product with the QR code
                await PostgresDB.getInstance().executeQuery(
                    'UPDATE productos SET qr_code = $1 WHERE producto_id = $2',
                    [qrCodeImage, productId]
                );
                console.log(`QR Code generated for product ${productId}`);
            } catch (qrError) {
                console.error('Error generating or saving QR code:', qrError);
                // We don't block the response if QR generation fails, but we could attach an error warning.
            }
        }
    }

    // Continue or send response. 
    // Since this is likely the last step after creation, we can send the response here 
    // OR we can let the controller send it if we used `next()` *before* sending response in controller.
    // However, the plan said "Modify Controller... Call next() instead of res.json(...)".
    // So this middleware should send the response.

    res.json({ success: true, result: res.locals.productResult });
};
