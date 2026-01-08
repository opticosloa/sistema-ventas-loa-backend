import { ProductsController } from '../src/controllers/products.controller';
import { PostgresDB } from '../src/database/postgres';
import { Request, Response } from 'express';

// Mock Request and Response
const mockRequest = (body: any) => ({
    body
} as Request);

const mockResponse = () => {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        res.data = data;
        return res;
    };
    return res as Response;
};

async function verifyQrGeneration() {
    console.log('Starting QR Code Verification...');

    const testProduct = {
        name: `Test Product ARMAZON ${Date.now()}`,
        description: 'Test Description',
        type: 'ARMAZON',
        brand_id: null, // Assuming nullable or provide valid UUID if needed. Let's check schema.
        // Schema says brand_id uuid, nullable.
        price_cost: 100,
        price_sale: 200,
        iva: 21,
        stock: 10,
        stock_min: 5,
        location: 'Test Loc'
    };

    const req = mockRequest(testProduct);
    const res = mockResponse();

    try {
        await ProductsController.getInstance().createProducto(req, res);

        const responseData = (res as any).data;
        console.log('Controller Response:', responseData);

        if (responseData.success && responseData.result && responseData.result.rows.length > 0) {
            const productId = Object.values(responseData.result.rows[0])[0];
            console.log('Created Product ID:', productId);

            // Verify DB content
            const dbResult = await PostgresDB.getInstance().executeQuery(
                'SELECT qr_code FROM productos WHERE producto_id = $1',
                [productId]
            );

            if (dbResult.rows.length > 0) {
                const qrCode = dbResult.rows[0].qr_code;
                console.log('QR Code in DB:', qrCode ? 'FOUND' : 'NOT FOUND');
                if (qrCode && qrCode.startsWith('data:image/png;base64,')) {
                    console.log('SUCCESS: QR Code is a valid Data URL.');
                } else {
                    console.error('FAILURE: QR Code is missing or invalid format.');
                }
            } else {
                console.error('FAILURE: Product not found in DB.');
            }
        } else {
            console.error('FAILURE: Controller did not return success or product ID.');
        }

    } catch (error) {
        console.error('Test Error:', error);
    } finally {
        process.exit(0);
    }
}

verifyQrGeneration();
