import { PrismaClient, RefreshToken } from "@prisma/client";

export class RefreshTokenRepository {
  constructor(private db: PrismaClient) {}

  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.db.refreshToken.create({ data });
  }

  findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping: drop tokens that are already expired or revoked. */
  async purgeExpired(): Promise<number> {
    const result = await this.db.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
    });
    return result.count;
  }
}
