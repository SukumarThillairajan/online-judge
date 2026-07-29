import {db} from "../database/db_connector.js";
import {submissions, testCases} from "../database/schema.js";
import {eq} from 'drizzle-orm';
import {redisConnection} from "../queues/submissionQueue.js";
import {Worker} from 'bullmq';
import {evaluateSubmission, runCustomCode} from "../modules/submissions/evaluation.service.js";

const workerOptions = {
    connection: redisConnection,
    concurrency: 5,
    maxStalledCount: 3, // if a Worker crashes/stalls, BullMQ will retry for a maximum of 3 times
    lockDuration: 30000 // Worker must renew lock every 30s to prove it hasn't crashed
};

/**
 * Normalises an evaluation result into the single shape stored in the
 * 'submissions.error_details' JSONB column.
 *
 * evaluateSubmission() reports failures across two separate keys:
 *   - 'details'      : a human-readable trace (compiler stderr, crash output, ...)
 *   - 'errorDetails' : structured context (failedAtTestCase, input, expectedOutput, actualOutput)
 *
 * Persisting only one of them silently threw the other away, which is why Wrong Answer
 * submissions used to land in the database with error_details = NULL. Merging both into
 * one flat object means every consumer can read the same keys regardless of the verdict.
 *
 * @param {Object} result - The object returned by evaluateSubmission().
 * @returns {Object|null} The blob to persist, or null when there is nothing to report.
 */
const buildErrorDetails = (result) => {
    // A successful run has nothing to record. Never let the "All test cases passed."
    // message leak into a column that exists to describe failures.
    if (result.verdict === "Accepted") {
        return null;
    }

    const errorDetails = {
        ...(result.errorDetails || {}),          // failedAtTestCase, input, expectedOutput, actualOutput
        ...(result.details ? {details: result.details} : {})  // compiler/runtime trace
    };

    // Returning null rather than an empty object keeps the column meaningfully empty.
    return Object.keys(errorDetails).length ? errorDetails : null;
};

export const submissionWorker = new Worker("submissionQueue", async (job) => {
    console.log(`Worker picked up job ${job.id} of type: ${job.name}`);

    try {
        if (job.name === "run-code") {
            const {code, language, customInput} = job.data;

            const result = await runCustomCode(code, language, customInput);

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
                errorDetails: buildErrorDetails(result)
            }).where(eq(submissions.submissionId, job.data.submissionId));

            return result;
        }
    }
    catch (error) {
        console.error(`Fatal execution error on job ${job.id}: `, error);

        // Updatig the database to reflect the system error
        if (job.name === "evaluate-code") {
            await db.update(submissions).set({
                verdict: "Internal System Error",
                errorDetails: {details: error.message}
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