import { Request, Response } from "express";
import { CustomerService } from "../services/customer.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query);
    const { rows, total } = await this.customerService.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      customerType: req.query.customerType as never,
      isActive: req.query.isActive as boolean | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.customerService.create(req.body)), "Customer created");
  };

  update = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.update(req.params.id, req.body)), "Customer updated");
  };

  remove = async (req: Request, res: Response) => {
    await this.customerService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };

  quotations = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.quotations(req.params.id)));
  };

  invoices = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.invoices(req.params.id)));
  };

  payments = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.payments(req.params.id)));
  };

  ledger = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.customerService.ledger(req.params.id)));
  };
}
