import { Request, Response } from "express";
import { InvoiceService } from "../services/invoice.service";
import { PdfService } from "../services/pdf.service";
import { CompanyService } from "../services/company.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class InvoiceController {
  constructor(
    private invoiceService: InvoiceService,
    private pdfService: PdfService,
    private companyService: CompanyService,
  ) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query);
    const { rows, total } = await this.invoiceService.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as never,
      paymentStatus: req.query.paymentStatus as string | undefined,
      dateFrom: req.query.dateFrom as Date | undefined,
      dateTo: req.query.dateTo as Date | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.invoiceService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    const invoice = await this.invoiceService.create(req.body, req.user!.sub);
    return ApiResponse.created(res, serialize(invoice), "Draft invoice created");
  };

  update = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.invoiceService.update(req.params.id, req.body)), "Invoice updated");
  };

  finalize = async (req: Request, res: Response) => {
    const invoice = await this.invoiceService.finalize(req.params.id);
    return ApiResponse.success(res, serialize(invoice), `Issued as ${invoice.invoiceNumber}`);
  };

  cancel = async (req: Request, res: Response) => {
    const invoice = await this.invoiceService.cancel(req.params.id, req.body.reason);
    return ApiResponse.success(res, serialize(invoice), "Invoice cancelled");
  };

  remove = async (req: Request, res: Response) => {
    await this.invoiceService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };

  payments = async (req: Request, res: Response) => {
    const invoice = await this.invoiceService.getById(req.params.id);
    return ApiResponse.success(res, serialize(invoice.payments));
  };

  pdf = async (req: Request, res: Response) => {
    const [invoice, company] = await Promise.all([
      this.invoiceService.getById(req.params.id),
      this.companyService.get(),
    ]);
    const buffer = await this.pdfService.renderInvoice(invoice, company);
    const filename = `${(invoice.invoiceNumber ?? "invoice-draft").replace(/[^\w-]/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "true" ? "attachment" : "inline"}; filename="${filename}"`);
    return res.send(buffer);
  };
}
