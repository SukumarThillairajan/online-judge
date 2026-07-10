import {db} from "../../database/db_connector.js";
import {submissions, problems, languageEnum} from "../../database/schema.js";
import {eq} from 'drizzle-orm';
import {v4 as uuidv4} from 'uuid';
import {submissionQueue} from "../../queues/submissionQueue.js";

export const createSubmission = async(req, res) => {
    const {problemId, code, language} = req.body;
    const userId = req.user.userId; // Extracted from requireAuth middleware (JWT cookie)
    let newSubmission;

    try {
        // 1. Validation
        if (!problemId || !code || !language) {
            return res.status(400).json({
                success: false, 
                message: "Missing required fields: problemId, code, or language."
            });
        }
        if (!languageEnum.enumValues.includes(language)) {
            return res.status(400).json({
                success: false,
                message: `Invalid language: '${language}'. Supported languages are: ${languageEnum.enumValues.join(', ')}`
            });
        }
        const [problemExists] = await db.select({id: problems.problemId}).from(problems).where(eq(problems.problemId, problemId));
        if (!problemExists) {
            return res.status(404).json({
                success: false,
                message: "Problem not found. Cannot create a submission for a non-existent problem."
            });
        }

        // 2. Saving the submission to the database
        [newSubmission] = await db.insert(submissions).values({
            userId,
            problemId,
            code,
            language
        }).returning({submissionId: submissions.submissionId}); // The schema sets the verdict to "Pending" by default.

        // 3. Adding the job to the evaluation queue
        await submissionQueue.add("evaluate-code", {
            submissionId: newSubmission.submissionId,
        });

        return res.status(201).json({
            status: "Pending",
            message: "Submission queued successfully.",
            submissionId: newSubmission.submissionId
        });
    }
    catch (error) {
        console.error(`Error creating submission for user ${userId} and problem ${problemId}:`, error);

        // 4. Error handling: 
        // Rolling back if queueing fails after DB insert
        if (newSubmission && newSubmission.submissionId) {
            console.error(`Failed to add job to queue for submissionId: ${newSubmission.submissionId}. Rolling back database entry.`);
            try {
                await db.delete(submissions).where(eq(submissions.submissionId, newSubmission.submissionId));
                console.log(`Successfully rolled back (deleted) submissionId: ${newSubmission.submissionId}`);
            } 
            catch (rollbackError) {
                console.error(`CATASTROPHIC FAILURE: Could not rollback submissionId: ${newSubmission.submissionId}. Manual intervention required.`, rollbackError);
            }
        }

        // Handle potential foreign key constraint errors during insertion
        if (error.code === '23503') { // PostgreSQL foreign key violation
            return res.status(404).json({
                success: false,
                message: "The specified problem or user does not exist."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error creating submission."
        });
    }
};

export const runCustomCode = async(req, res) => {
    try {
        const {code, language, customInput} = req.body;

        // Validation
        if (!code || !language) {
            return res.status(400).json({
                success: false, 
                message: "Missing required fields: code, or language."
            });
        }
        if (!languageEnum.enumValues.includes(language)) {
            return res.status(400).json({
                success: false,
                message: `Invalid language: '${language}'. Supported languages are: ${languageEnum.enumValues.join(', ')}`
            });
        }

        const secureJobId = uuidv4();
        const job = await submmissionQueue("run-code", {
            code,
            language,
            customInput: customInput || "" // passing the custom stdin, defaulting to empty string
        }, {
            jobId: secureJobId // forcing Redis to use our uuidv4 as the jobId, instead of it's default sequential job ID.
        });

        return res.status(200).json({
            status: "Executing",
            message: "Run job queued successfully.",
            jobId: job.id // returning the job ID for polling
        });
    }
    catch(error) {
        console.error("Error queueing run-code job:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error: Could not queue the run-code job"
        });
    }
};