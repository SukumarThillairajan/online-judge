import {pgEnum, pgTable, uuid, varchar, timestamp} from 'drizzle-orm/pg-core';

// Declaring and exporting the Role Enum for Role-Based Access Control (RBAC).
export const roleEnum = pgEnum("role", ["ADMIN", "USER"]);

// Declaring and exporting the Users table.
export const users = pgTable("users", { // here we are using camelCase for the JSON object keys, but the actual table/column names will be in snake_case.
    
    userId: uuid("user_id").primaryKey().defaultRandom(),

    username: varchar("username", {length: 255}).notNull().unique(),

    emailId: varchar("email_id", {length: 255}).notNull().unique(),

    hashedPassword: varchar("hashed_password", {length: 255}).notNull(),

    role: roleEnum("role").default("USER").notNull(), // By default, the role will be USER.

    createdAt: timestamp("created_at").defaultNow().notNull() // By dafault, the current timestamp will be set when a new user is created.
});