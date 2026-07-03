import {pgEnum, pgTable, uuid, varchar, timestamp, text, jsonb, index} from 'drizzle-orm/pg-core';

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

export const difficultyEnum = pgEnum("difficulty", ["Easy", "Medium", "Hard"]);

export const problems = pgTable("problems", {

    problemId: uuid("problem_id").primaryKey().defaultRandom(),

    problemName: varchar("problem_name", {length: 255}).notNull().unique(),

    difficulty: difficultyEnum("difficulty").notNull(),

    statement: text("statement").notNull(),

    sampleTestCases: jsonb("sample_test_cases").notNull() // storing the sample test cases as a JSON object, allowing more flexibility for V2.
}, 
(table) => {
    return { // by returning a named object for the index, we can easily reference them later, without breaking JS' scoping rules.
        difficultyIndex: index("difficulty_index").on(table.difficulty)
    };
}
);

export const testCases = pgTable("test_cases", {

    testCaseId: uuid("test_case_id").primaryKey().defaultRandom(),

    problemId: uuid("problem_id").references(() => problems.problemId).notNull(), // Foreign Key.

    input: text("input").notNull(),

    output: text("output").notNull()
}, 
(table) => {
    return {
        problemIdIndex: index("problem_id_index").on(table.problemId)
    };
}
);