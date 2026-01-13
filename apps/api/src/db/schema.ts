import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// User profiles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Authentication
export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  age: integer("age"),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export type AuthUser = typeof authUser.$inferSelect;
export type Session = typeof session.$inferSelect;
