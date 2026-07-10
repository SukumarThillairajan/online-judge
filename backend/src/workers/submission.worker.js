import {db} from "../database/db_connector.js";
import {submissions, testCases} from "../database/schema.js";
import {eq} from 'drizzle-orm';
import {redisConnection} from "../queues/submissionQueue.js";
import {Worker} from 'bullmq';
import {runCodeInDocker} from "./dockerEngine.js";
import {evaluateSubmission} from "../modules/submissions/evaluation.service.js";

const workerOptions = {
    connection: redisConnection,
    concurrency: 5,
    maxStalledCount: 3, // if a Worker crashes/stalls, BullMQ will retry for a maximum of 3 times
    lockDuration: 30000 // Worker must renew lock every 30s to prove it hasn't crashed
};

export const submissionWorker = new Worker("submissionQueue", async (job) => {
    console.log(`Worker picked up job ${job.id} of type: ${job.name}`);

    try {
        if (job.name === "run-code") {
            const {code, language, input} = job.data;

            const result = await runCodeInDocker(code, language, input);

            // Caching the result in Redis for the frontend to poll
            await redisConnection.set(job.id, JSON.stringify(result), "EX", 300); // 5-minute expiry

            return {status: "Success", result};
        }

        if (job.name === "evaluate-code") {
            const {submissionId, code, language, problemId} = job.data;

            const hiddenTestCases = await db.select().from(testCases).where(eq(testCases.problemId, problemId));
            if (!hiddenTestCases.length) {
                throw new Error("No hidden test cases found for this problem.");
            }

            const result = await evaluateSubmission(code, language, hiddenTestCases);

            await db.update(submissions).set({
                verdict: result.verdict,
                details: result
            }).where(eq(submissions.submissionId, submissionId));

            return result;
        }
    }
    catch (error) {
        console.error(`Fatal execution error on job ${job.id}: `, error);

        // Updatig the database to reflect the system error
        if (job.name === "evaluate-code") {
            await db.update(submissions).set({
                verdict: "Internal System Error",
                details: {error: error.message}
            }).where(eq(submissions.submissionId, job.data.submissionId));
        }

        // Rethrowing tells BullMQ that this job technically failed.
        throw error;
    }
}, workerOptions);

submissionWorker.on("completed", (job, returnvalue) => {
    console.log(`Job ${job.id} completed successfully! Verdict: ${returnvalue?.verdict || "N/A"}`);
});
submissionWorker.on("failed", (job, error) => {
    console.error(`Job ${job.id} failed with error: ${error.message}`);
});
submissionWorker.on("stalled", (jobId) => {
    console.warn(`Job ${jobId} stalled. A worker likely crashed. Returning to queue...`);
});