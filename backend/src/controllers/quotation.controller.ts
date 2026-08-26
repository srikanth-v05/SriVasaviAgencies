import { Request, Response } from "express";
import { QuotationService } from "../services/quotation.service";
import { InvoiceService } from "../services/invoice.service";
import { PdfService } from "../services/pdf.service";
import { CompanyService } from "../services/company.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class QuotationController {
  constructor(
    private quotationService: QuotationService,
    private invoiceService: InvoiceService,
    private pdfService: PdfService,
    private companyService: CompanyService,
  ) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query);
    const { rows, total } = await this.quotationService.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as never,
      dateFrom: req.query.dateFrom as Date | undefined,
      dateTo: req.query.dateTo as Date | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.quotationService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    const quotation = await this.quotationService.create(req.body, req.user!.sub);
    return ApiResponse.created(res, serialize(quotation), `Quotation ${quotation.quotationNumber} created`);
  };

  update = async (req: Request, res: Response) => {
    const quotation = await this.quotationService.update(req.params.id, req.body);
    return ApiResponse.success(res, serialize(quotation), "Quotation updated");
  };

  send = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.quotationService.transition(req.params.id, "SENT")), "Quotation marked as sent");
  };

  accept = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.quotationService.transition(req.params.id, "ACCEPTED")), "Quotation accepted");
  };

  reject = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.quotationService.transition(req.params.id, "REJECTED")), "Quotation rejected");
  };

  cancel = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.quotationService.transition(req.params.id, "CANCELLED")), "Quotation cancelled");
  };

  duplicate = async (req: Request, res: Response) => {
    const quotation = await this.quotationService.duplicate(req.params.id, req.user!.sub);
    return ApiResponse.created(res, serialize(quotation), `Copied to ${quotation.quotationNumber}`);
  };

  convertToInvoice = async (req: Request, res: Response) => {
    const invoice = await this.invoiceService.convertFromQuotation(req.params.id, req.user!.sub);
    return ApiResponse.created(res, serialize(invoice), "Draft invoice created from the quotation");
  };

  remove = async (req: Request, res: Response) => {
    await this.quotationService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };

  pdf = async (req: Request, res: Response) => {
    const [quotation, company] = await Promise.all([
      this.quotationService.getById(req.params.id),
      this.companyService.get(),
    ]);
    const buffer = await this.pdfService.renderQuotation(quotation, company);
    const filename = `${(quotation.quotationNumber ?? "quotation").replace(/[^\w-]/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download === "true" ? "attachment" : "inline"}; filename="${filename}"`);
    return res.send(buffer);
  };
}
