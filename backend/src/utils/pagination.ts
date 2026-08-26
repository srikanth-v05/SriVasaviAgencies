export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

/** Clamp user-supplied paging so a stray ?limit=100000 cannot exhaust the database. */
export function pageParams(query: { page?: unknown; limit?: unknown }, defaultLimit = 25): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
