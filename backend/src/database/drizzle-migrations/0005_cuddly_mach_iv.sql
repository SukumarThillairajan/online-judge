ALTER TABLE "submissions" ALTER COLUMN "language" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."language";--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('c', 'cpp', 'java', 'python', 'javascript');--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "language" SET DATA TYPE "public"."language" USING "language"::"public"."language";