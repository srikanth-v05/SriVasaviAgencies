import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { UserRepository, type SafeUser } from "../repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import { AuditService, AuditAction } from "./audit.service";
import { UnauthorizedError, ValidationError, ForbiddenError } from "../utils/errors";
import { env } from "../config/env";
import { permissionsForRole, type RoleName } from "../config/permissions";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser & { permissions: string[] };
}

/**
 * Password hashing uses Argon2id (architecture.md §31). Plaintext passwords are
 * never stored, logged, or returned.
 */
const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private refreshTokenRepository: RefreshTokenRepository,
    private auditService: AuditService,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(email);

    // Verify against a dummy hash when the user is unknown so that response time
    // does not reveal whether an email address exists.
    if (!user) {
      await argon2.verify(DUMMY_HASH, password).catch(() => false);
      await this.auditService.record(AuditAction.LOGIN_FAILED, {
        entityType: "User",
        userId: null,
        newValues: { email },
      });
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) {
      await this.auditService.record(AuditAction.LOGIN_FAILED, {
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        newValues: { email },
      });
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new ForbiddenError("This account has been deactivated");
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.userRepository.markLogin(user.id);
    await this.auditService.record(AuditAction.LOGIN, {
      entityType: "User",
      entityId: user.id,
      userId: user.id,
    });

    const { passwordHash: _ignored, ...safe } = user;
    return { ...tokens, user: { ...safe, permissions: permissionsForRole(user.role as RoleName) } };
  }

  /** Rotating refresh: the presented token is revoked as the new pair is issued. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string };
    try {
      payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as { sub: string };
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const hash = hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findActiveByHash(hash);
    if (!stored) {
      // Either already used or revoked. Treat reuse as a compromise and cut the
      // whole session family loose.
      await this.refreshTokenRepository.revokeAllForUser(payload.sub);
      throw new UnauthorizedError("Refresh token is no longer valid");
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedError("Account is unavailable");

    await this.refreshTokenRepository.revoke(hash);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) await this.refreshTokenRepository.revoke(hashToken(refreshToken));
    else if (userId) await this.refreshTokenRepository.revokeAllForUser(userId);

    if (userId) {
      await this.auditService.record(AuditAction.LOGOUT, { entityType: "User", entityId: userId });
    }
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Account no longer exists");
    return { ...user, permissions: permissionsForRole(user.role as RoleName) };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findByIdWithHash(userId);
    if (!user) throw new UnauthorizedError("Account no longer exists");

    const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!valid) throw new ValidationError("Current password is incorrect");

    await this.userRepository.updatePassword(userId, await AuthService.hashPassword(newPassword));
    // Every existing session is invalidated when the password changes.
    await this.refreshTokenRepository.revokeAllForUser(userId);
    await this.auditService.record(AuditAction.CHANGE_PASSWORD, { entityType: "User", entityId: userId });
  }

  private async issueTokens(userId: string, email: string, role: Role): Promise<AuthTokens> {
    const accessToken = jwt.sign({ sub: userId, email, role }, env.JWT_SECRET, {
      expiresIn: env.ACCESS_TOKEN_TTL,
    } as jwt.SignOptions);

    // `jti` gives every refresh token its own identity.
    //
    // Without it the payload is only { sub, iat, exp }, and iat/exp have
    // one-second resolution — so two logins in the same second produced a
    // byte-identical token, an identical hash, and a unique-constraint failure
    // on refresh_tokens.tokenHash. Two people signing in together, or one
    // double-clicking, got a 500.
    const refreshToken = jwt.sign({ sub: userId, jti: randomUUID() }, env.REFRESH_TOKEN_SECRET, {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
    } as jwt.SignOptions);

    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepository.create({ userId, tokenHash: hashToken(refreshToken), expiresAt });

    return { accessToken, refreshToken, expiresIn: env.ACCESS_TOKEN_TTL };
  }
}

/** Refresh tokens are stored as digests so a database leak cannot resume sessions. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Argon2id hash of a random string, used only to equalise failed-login timing.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZXg$Zm9yVGltaW5nRXF1YWxpc2F0aW9uT25seUFB";
