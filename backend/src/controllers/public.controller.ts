import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { MasterDataService } from "../services/master-data.service";
import { CompanyService } from "../services/company.service";
import { EnquiryService } from "../services/enquiry.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

/**
 * Endpoints the public website calls. These are unauthenticated, so they expose
 * only catalogue and contact information — never prices paid by other customers,
 * document data, or company banking details.
 */
export class PublicController {
  constructor(
    private productService: ProductService,
    private masterDataService: MasterDataService,
    private companyService: CompanyService,
    private enquiryService: EnquiryService,
  ) {}

  products = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query, 24);
    const { rows, total } = await this.productService.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      isActive: true,
      showOnWebsite: true,
    });

    return ApiResponse.paginated(res, serialize(rows.map(toPublicProduct)), page, limit, total);
  };

  product = async (req: Request, res: Response) => {
    const product = await this.productService.getBySlug(req.params.slug);
    return ApiResponse.success(res, serialize(toPublicProduct(product)));
  };

  categories = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.masterDataService.listCategories()));
  };

  company = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.companyService.publicProfile()));
  };

  enquiry = async (req: Request, res: Response) => {
    const enquiry = await this.enquiryService.create(req.body);
    return ApiResponse.created(
      res,
      { id: enquiry.id },
      "Thanks — we have your enquiry and will call you back.",
    );
  };
}

/** The public catalogue shows the list price as indicative only. */
function toPublicProduct(product: {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  description: string | null;
  dilutionRatio: string | null;
  packSize: string | null;
  imageUrl: string | null;
  hsnCode: string | null;
  defaultPrice: unknown;
  defaultGstRate: unknown;
  category: { id: string; name: string; slug: string; zoneCode: string | null } | null;
  unit: { id: string; name: string; shortName: string };
}) {
  return {
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    slug: product.slug,
    description: product.description,
    dilutionRatio: product.dilutionRatio,
    packSize: product.packSize,
    imageUrl: product.imageUrl,
    hsnCode: product.hsnCode,
    indicativePrice: product.defaultPrice,
    gstRate: product.defaultGstRate,
    category: product.category,
    unit: product.unit,
  };
}
