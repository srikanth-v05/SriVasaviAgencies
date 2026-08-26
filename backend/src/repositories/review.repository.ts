import { Prisma, PrismaClient, Review, ReviewSource } from "@prisma/client";

export interface ReviewQuery {
  source?: ReviewSource;
  isPublished?: boolean;
  skip?: number;
  take?: number;
}

export class ReviewRepository {
  constructor(private db: PrismaClient) {}

  async list(query: ReviewQuery = {}): Promise<{ rows: Review[]; total: number }> {
    const where: Prisma.ReviewWhereInput = {
      ...(query.source ? { source: query.source } : {}),
      ...(query.isPublished === undefined ? {} : { isPublished: query.isPublished }),
    };

    const [rows, total] = await Promise.all([
      this.db.review.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { reviewDate: "desc" }],
        ...(query.skip === undefined ? {} : { skip: query.skip }),
        ...(query.take === undefined ? {} : { take: query.take }),
      }),
      this.db.review.count({ where }),
    ]);

    return { rows, total };
  }

  findById(id: string): Promise<Review | null> {
    return this.db.review.findUnique({ where: { id } });
  }

  create(data: Prisma.ReviewCreateInput): Promise<Review> {
    return this.db.review.create({ data });
  }

  update(id: string, data: Prisma.ReviewUpdateInput): Promise<Review> {
    return this.db.review.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.review.delete({ where: { id } });
  }

  /**
   * Upsert on the external id so re-syncing a source updates the existing row
   * rather than accumulating duplicates.
   */
  upsertByExternalId(externalId: string, data: Prisma.ReviewCreateInput): Promise<Review> {
    const { authorName, authorRole, rating, text, reviewDate, sourceUrl, source } = data;
    return this.db.review.upsert({
      where: { externalId },
      update: { authorName, authorRole, rating, text, reviewDate, sourceUrl, source },
      create: { ...data, externalId },
    });
  }

  /** Aggregate rating across published reviews, for the summary line on the website. */
  async summary(): Promise<{ count: number; average: number }> {
    const result = await this.db.review.aggregate({
      where: { isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      count: result._count._all,
      average: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
    };
  }
}
