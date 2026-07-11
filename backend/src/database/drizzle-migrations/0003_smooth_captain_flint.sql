CREATE TYPE "public"."language" AS ENUM('c', 'cpp', 'java', 'python', 'javaScript');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('Pending', 'Accepted', 'Compilation Error', 'Runtime Error', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Wrong Answer');--> statement-breakpoint
CREATE TABLE "submissions" (
	"submission_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"code" text NOT NULL,
	"language" "language" NOT NULL,
	"verdict" "verdict" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_cases" DROP CONSTRAINT "test_cases_problem_id_problems_problem_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_index" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "problem_index" ON "submissions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "user_problem_index" ON "submissions" USING btree ("user_id","problem_id");--> statement-breakpoint
CREATE INDEX "created_at_index" ON "submissions" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE cascade ON UPDATE no action;