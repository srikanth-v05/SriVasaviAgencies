import { Request, Response } from "express";
import { AuditService } from "../services/audit.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";
import { pageParams } from "../utils/pagination";

export class AuditController {
  constructor(private auditService: AuditService) {}

  list = async (req: Request, res: Response) => {
    const { page, limit, skip } = pageParams(req.query, 50);
    const { rows, total } = await this.auditService.list({
      skip,
      take: limit,
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      userId: req.query.userId as string | undefined,
      dateFrom: req.query.dateFrom as Date | undefined,
      dateTo: req.query.dateTo as Date | undefined,
    });
    return ApiResponse.paginated(res, serialize(rows), page, limit, total);
  };
}
