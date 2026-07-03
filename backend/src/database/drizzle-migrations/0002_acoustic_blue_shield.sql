CREATE INDEX "difficulty_index" ON "problems" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "problem_id_index" ON "test_cases" USING btree ("problem_id");