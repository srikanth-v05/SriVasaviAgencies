import { Role } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import { AuthService } from "./auth.service";
import { AuditService, AuditAction } from "./audit.service";
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private auditService: AuditService,
  ) {}

  list() {
    return this.userRepository.list();
  }

  async getById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async create(input: CreateUserInput) {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw new ValidationError("A user with this email address already exists");

    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await AuthService.hashPassword(input.password),
    });

    await this.auditService.record(AuditAction.CREATE_USER, {
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, name: user.name, role: user.role },
    });
    return user;
  }

  async update(id: string, input: { name?: string; role?: Role; isActive?: boolean }, actingUserId: string) {
    const before = await this.getById(id);

    // Guard against an admin locking themselves out of their own account.
    if (id === actingUserId && input.isActive === false) {
      throw new ForbiddenError("You cannot deactivate your own account");
    }
    if (id === actingUserId && input.role && input.role !== before.role) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const user = await this.userRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    // A deactivated or demoted user must not keep an active session.
    if (input.isActive === false || (input.role && input.role !== before.role)) {
      await this.refreshTokenRepository.revokeAllForUser(id);
    }

    await this.auditService.record(AuditAction.UPDATE_USER, {
      entityType: "User",
      entityId: id,
      oldValues: { name: before.name, role: before.role, isActive: before.isActive },
      newValues: { name: user.name, role: user.role, isActive: user.isActive },
    });
    return user;
  }

  /** Admin-initiated reset. The target's sessions are dropped immediately. */
  async resetPassword(id: string, newPassword: string) {
    await this.getById(id);
    const user = await this.userRepository.updatePassword(id, await AuthService.hashPassword(newPassword));
    await this.refreshTokenRepository.revokeAllForUser(id);

    await this.auditService.record(AuditAction.CHANGE_PASSWORD, {
      entityType: "User",
      entityId: id,
      newValues: { resetByAdmin: true },
    });
    return user;
  }
}
