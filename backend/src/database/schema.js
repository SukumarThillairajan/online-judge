import {pgEnum, pgTable, uuid, varchar, timestamp, text, jsonb, index, integer} from 'drizzle-orm/pg-core';

//------
// Enums
//------
// Declaring and exporting the Role Enum for Role-Based Access Control (RBAC).
export const roleEnum = pgEnum("role", ["ADMIN", "USER"]);

export const languageEnum = pgEnum("language", ["c", "cpp", "java", "python", "javascript"]);

export const verdictEnum = pgEnum("verdict", [
    "Pending",
    "Accepted",
    "Compilation Error",
    "Runtime Error",
    "Time Limit Exceeded",
    "Memory Limit Exceeded",
    "Wrong Answer"
]);

//-------
// Tables
//-------

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
    problemId: uuid("problem_id").references(() => problems.problemId, {onDelete: "cascade"}).notNull(), // Foreign Key with ON DELETE CASCADE

    input: text("input").notNull(),
    output: text("output").notNull()
}, 
(table) => {
    return {
        problemIdIndex: index("problem_id_index").on(table.problemId)
    };
}
);

export const submissions = pgTable("submissions", {
    submissionId: uuid("submission_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.userId).notNull(), // Foreign key to Users
    problemId: uuid("problem_id").references(() => problems.problemId).notNull(), // Foreign key to Problems

    code: text("code").notNull(),
    language: languageEnum("language").notNull(),
    verdict: verdictEnum("verdict").default("Pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    errorDetails: jsonb("error_details"),

    totalScore: integer("total_score").default(0).notNull(),
    gamifiedRank: varchar("gamified_rank", {length: 15}).default("Unranked").notNull(),
    scoreBreakdown: jsonb("score_breakdown").default({}).notNull() // Storing the AI's score breakdown as a JSON object, allowing more flexibility for future versions.
}, (table) => ({
    userIndex: index("user_index").on(table.userId),
    problemIndex: index("problem_index").on(table.problemId),
    userProblemIndex: index("user_problem_index").on(table.userId, table.problemId), // a Composite Index
    createdAtIndex: index("created_at_index").on(table.createdAt),

    leaderboardIndex: index("leaderboard_index").on(table.problemId, table.totalScore.desc()) // a Composite Index
}));

export const interviewSessions = pgTable("interview_sessions", {
    sessionId: uuid("session_id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.userId).notNull(), // Foreign key to Users
    problemId: uuid("problem_id").references(() => problems.problemId).notNull(), // Foreign key to Problems
    submissionId: uuid("submission_id").references(() => submissions.submissionId), // Foreign key to Submissions. Allowing Null values, since users are in an interview session before submitting their solution.

    chatHistory: jsonb("chat_history").default("[]"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"), // will be Null until the interview session is completed.
}, (table) => ({
    sessionUserIndex: index("session_user_index").on(table.userId),
    sessionProblemIndex: index("session_problem_index").on(table.problemId),
    sessionUserProblemIndex: index("session_user_problem_index").on(table.userId, table.problemId), // a Composite Index
    sessionSubmissionIndex: index("session_submission_index").on(table.submissionId)
}));