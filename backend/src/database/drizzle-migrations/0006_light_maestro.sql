CREATE TABLE "interview_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"submission_id" uuid,
	"chat_history" jsonb DEFAULT '[]' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "total_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "gamified_rank" varchar(15) DEFAULT 'Unranked' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_problem_id_problems_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("problem_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_submission_id_submissions_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("submission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_index" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_problem_index" ON "interview_sessions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "session_user_problem_index" ON "interview_sessions" USING btree ("user_id","problem_id");--> statement-breakpoint
CREATE INDEX "session_submission_index" ON "interview_sessions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "leaderboard_index" ON "submissions" USING btree ("problem_id","total_score" DESC NULLS LAST);