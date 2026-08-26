import { Request, Response } from "express";
import { ReviewService } from "../services/review.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";

export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /** Public: published reviews plus the aggregate rating and listing links. */
  publicList = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reviewService.published()));
  };

  list = async (req: Request, res: Response) => {
    const { rows, total } = await this.reviewService.list({
      source: req.query.source as never,
      isPublished:
        req.query.isPublished === undefined ? undefined : req.query.isPublished === "true",
    });
    return ApiResponse.success(res, serialize({ reviews: rows, total }));
  };

  create = async (req: Request, res: Response) => {
    return ApiResponse.created(res, serialize(await this.reviewService.create(req.body)), "Review added");
  };

  update = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.reviewService.update(req.params.id, req.body)), "Review updated");
  };

  remove = async (req: Request, res: Response) => {
    await this.reviewService.remove(req.params.id);
    return ApiResponse.noContent(res);
  };

  syncStatus = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, await this.reviewService.googleSyncStatus());
  };

  syncGoogle = async (_req: Request, res: Response) => {
    const result = await this.reviewService.syncFromGoogle();
    return ApiResponse.success(res, result, `Imported ${result.imported} review(s) from Google`);
  };
}
