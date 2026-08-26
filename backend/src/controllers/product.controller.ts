import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class ProductController {
  constructor(private productService: ProductService) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query);
    const { rows, total } = await this.productService.list({
      skip,
      take: limit,
      search: req.query.search as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      isActive: req.query.isActive as boolean | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.productService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.productService.create(req.body)), "Product created");
  };

  update = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.productService.update(req.params.id, req.body)), "Product updated");
  };

  setStatus = async (req: Request, res: Response) => {
    const product = await this.productService.setStatus(req.params.id, req.body.isActive);
    return ApiResponse.success(res, serialize(product), req.body.isActive ? "Product activated" : "Product deactivated");
  };

  remove = async (req: Request, res: Response) => {
    await this.productService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };
}
