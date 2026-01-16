import { eq, lt } from "drizzle-orm";

import { generateSecureToken } from "../../common/crypto";
import { db } from "../../db";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
} from "../../db/schema";

export const authRepository = {
  async findUserById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  async findUserByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  },

  async findUserByIntraId(intraId: number) {
    return db.query.users.findFirst({
      where: eq(users.intraId, intraId),
    });
  },

  async createUser(data: {
    email: string;
    passwordHash?: string;
    displayName: string;
    intraId?: number;
    avatarUrl?: string;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        intraId: data.intraId,
        avatarUrl: data.avatarUrl,
        emailVerified: data.intraId !== undefined,
      })
      .returning();

    return user;
  },

  async updatePassword(userId: number, passwordHash: string) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async updateEmailVerified(userId: number, verified: boolean) {
    const [updated] = await db
      .update(users)
      .set({
        emailVerified: verified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async linkIntraAccount(userId: number, intraId: number) {
    const [updated] = await db
      .update(users)
      .set({
        intraId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async unlinkIntraAccount(userId: number) {
    const [updated] = await db
      .update(users)
      .set({
        intraId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async updateUserTotp(
    userId: number,
    secret: string | null,
    enabled: boolean
  ) {
    const [updated] = await db
      .update(users)
      .set({
        totpSecret: secret,
        twoFactorEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async updateAvatarUrl(userId: number, avatarUrl: string | null) {
    const [updated] = await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async incrementFailedLogins(userId: number) {
    const user = await this.findUserById(userId);
    if (!user) return null;

    const newCount = user.failedLoginAttempts + 1;
    const lockUntil =
      newCount >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    const [updated] = await db
      .update(users)
      .set({
        failedLoginAttempts: newCount,
        lockedUntil: lockUntil,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async resetFailedLogins(userId: number) {
    const [updated] = await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async createSession(userId: number, expiresAt: Date) {
    const id = generateSecureToken(32);

    const [session] = await db
      .insert(sessions)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return session;
  },

  async findSessionById(sessionId: string) {
    return db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        user: true,
      },
    });
  },

  async deleteSession(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },

  async deleteAllUserSessions(userId: number) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },

  async deleteExpiredSessions() {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  },

  async createEmailVerificationToken(userId: number, expiresAt: Date) {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    const id = generateSecureToken(32);

    const [token] = await db
      .insert(emailVerificationTokens)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return token;
  },

  async findEmailVerificationToken(tokenId: string) {
    return db.query.emailVerificationTokens.findFirst({
      where: eq(emailVerificationTokens.id, tokenId),
    });
  },

  async deleteEmailVerificationToken(tokenId: string) {
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, tokenId));
  },

  async createPasswordResetToken(userId: number, expiresAt: Date) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    const id = generateSecureToken(32);

    const [token] = await db
      .insert(passwordResetTokens)
      .values({
        id,
        userId,
        expiresAt,
      })
      .returning();

    return token;
  },

  async findPasswordResetToken(tokenId: string) {
    return db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.id, tokenId),
    });
  },

  async deletePasswordResetToken(tokenId: string) {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenId));
  },
};
