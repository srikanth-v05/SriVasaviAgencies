import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query);
    const { rows, total } = await this.paymentService.list({
      skip,
      take: limit,
      invoiceId: req.query.invoiceId as string | undefined,
      customerId: req.query.customerId as string | undefined,
      paymentMethod: req.query.paymentMethod as never,
      dateFrom: req.query.dateFrom as Date | undefined,
      dateTo: req.query.dateTo as Date | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.paymentService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    const payment = await this.paymentService.create(req.body, req.user!.sub);
    return ApiResponse.created(res, serialize(payment), "Payment recorded");
  };

  update = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.paymentService.update(req.params.id, req.body)), "Payment updated");
  };

  remove = async (req: Request, res: Response) => {
    await this.paymentService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };
}
