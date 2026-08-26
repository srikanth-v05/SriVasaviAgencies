import { Prisma, PrismaClient } from "@prisma/client";

export class EnquiryRepository {
  constructor(private db: PrismaClient) {}

  create(data: Prisma.EnquiryCreateInput) {
    return this.db.enquiry.create({ data });
  }

  async list(params: { isHandled?: boolean; skip: number; take: number }) {
    const where: Prisma.EnquiryWhereInput = params.isHandled === undefined ? {} : { isHandled: params.isHandled };
    const [rows, total] = await Promise.all([
      this.db.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: params.skip, take: params.take }),
      this.db.enquiry.count({ where }),
    ]);
    return { rows, total };
  }

  markHandled(id: string, isHandled: boolean) {
    return this.db.enquiry.update({ where: { id }, data: { isHandled } });
  }
}
