import { PaymentsController } from '../../controllers/payments.controller';
import { PaymentService } from '../../service/payment.service';
import { Request, Response } from 'express';

// Mock PaymentService
jest.mock('../../service/payment.service', () => {
    return {
        PaymentService: {
            getInstance: jest.fn().mockReturnValue({
                createPayment: jest.fn(),
                createMercadoPagoPreference: jest.fn(),
                handleMPWebhook: jest.fn(),
                createManualPayment: jest.fn(),
                getPaymentsBySaleId: jest.fn(),
            }),
        },
    };
});

describe('PaymentsController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let sendStatusMock: jest.Mock;

    beforeEach(() => {
        req = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        sendStatusMock = jest.fn();
        res = {
            json: jsonMock,
            status: statusMock,
            sendStatus: sendStatusMock,
        };
        jest.clearAllMocks();
    });

    it('should create payment', async () => {
        req.body = { venta_id: 1, monto: 100 };
        const mockResult = { id: 1 };
        (PaymentService.getInstance().createPayment as jest.Mock).mockResolvedValue(mockResult);

        await PaymentsController.getInstance().createPayment(req as Request, res as Response);

        expect(PaymentService.getInstance().createPayment).toHaveBeenCalledWith(req.body);
        expect(res.json).toHaveBeenCalledWith({ success: true, result: mockResult });
    });

    it('should create MP preference', async () => {
        req.body = { venta_id: 1, monto: 100, title: 'Item' };
        const mockResult = { id: 'pref_123' };
        (PaymentService.getInstance().createMercadoPagoPreference as jest.Mock).mockResolvedValue(mockResult);

        await PaymentsController.getInstance().createMercadoPagoPreference(req as Request, res as Response);

        expect(PaymentService.getInstance().createMercadoPagoPreference).toHaveBeenCalledWith(1, 100, 'Item');
        expect(res.json).toHaveBeenCalledWith({ success: true, id: 'pref_123' });
    });

    it('should handle webhook', async () => {
        req.body = { type: 'payment', data: { id: '123' } };
        req.query = { preference_id: 'pref_1' };

        await PaymentsController.getInstance().handleWebhook(req as Request, res as Response);

        expect(PaymentService.getInstance().handleMPWebhook).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
});
