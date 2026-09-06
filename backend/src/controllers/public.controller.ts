import { Request, Response } from "express";
import { CatalogCacheService } from "../services/catalog-cache.service";
import { CompanyService } from "../services/company.service";
import { EnquiryService } from "../services/enquiry.service";
import { NotFoundError } from "../utils/errors";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

/**
 * Endpoints the public website calls. These are unauthenticated, so they expose
 * only catalogue and contact information — never prices paid by other customers,
 * document data, or company banking details.
 *
 * Products and categories are served from CatalogCacheService's in-memory
 * catalog.json snapshot, never from the database directly — every visitor
 * reads the same cached file regardless of how many people are browsing.
 */
export class PublicController {
  constructor(
    private catalogCache: CatalogCacheService,
    private companyService: CompanyService,
    private enquiryService: EnquiryService,
  ) {}

  products = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query, 24);
    const { rows, total } = await this.catalogCache.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
    });

    return ApiResponse.paginated(res, rows, page, limit, total);
  };

  product = async (req: Request, res: Response) => {
    const product = await this.catalogCache.bySlug(req.params.slug);
    if (!product) throw new NotFoundError("Product not found");
    return ApiResponse.success(res, product);
  };

  categories = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, await this.catalogCache.allCategories());
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
