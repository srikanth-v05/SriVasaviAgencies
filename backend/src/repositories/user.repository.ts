import { Prisma, PrismaClient, Role, User } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

const safeSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export class UserRepository {
  constructor(private db: PrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<SafeUser | null> {
    return this.db.user.findUnique({ where: { id }, select: safeSelect });
  }

  findByIdWithHash(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  list(): Promise<SafeUser[]> {
    return this.db.user.findMany({ select: safeSelect, orderBy: { createdAt: "asc" } });
  }

  create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<SafeUser> {
    return this.db.user.create({
      data: { ...data, email: data.email.toLowerCase() },
      select: safeSelect,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> {
    return this.db.user.update({ where: { id }, data, select: safeSelect });
  }

  updatePassword(id: string, passwordHash: string): Promise<SafeUser> {
    return this.db.user.update({ where: { id }, data: { passwordHash }, select: safeSelect });
  }

  markLogin(id: string): Promise<unknown> {
    return this.db.user.update({ where: { id }, data: { lastLoginAt: new Date() }, select: { id: true } });
  }

  count(): Promise<number> {
    return this.db.user.count();
  }
}
