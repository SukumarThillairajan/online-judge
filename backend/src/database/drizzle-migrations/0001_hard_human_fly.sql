CREATE TYPE "public"."difficulty" AS ENUM('Easy', 'Medium', 'Hard');--> statement-breakpoint
CREATE TABLE "problems" (
	"problem_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_name" varchar(255) NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"statement" text NOT NULL,
	"sample_test_cases" jsonb NOT NULL,
	CONSTRAINT "problems_problem_name_unique" UNIQUE("problem_name")
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"test_case_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"input" text NOT NULL,
	"output" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE no action ON UPDATE no action;