import {db} from "../../database/db_connector.js";
import {submissions, problems, users, languageEnum} from "../../database/schema.js";
import {eq, and, asc, desc} from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {submissionQueue, redisConnection} from "../../queues/submissionQueue.js";

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

        const secureJobId = randomUUID();
        const job = await submissionQueue.add("run-code", {
            code,
            language,
            customInput: customInput || "" // passing the custom stdin, defaulting to empty string
        }, {
            jobId: secureJobId // forcing Redis to use our randomUUID as the jobId, instead of it's default sequential job ID.
        });

        return res.status(200).json({
            status: "Executing",
            message: "Run job queued successfully.",
            jobId: job.id, // returning the job ID for polling
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

export const createSubmission = async(req, res) => {
    const {problemId, code, language, sessionId} = req.body; // Added sessionId
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
        const [newSubmission] = await db.insert(submissions).values({
            userId,
            problemId,
            code,
            language,
            sessionId // Pass along the session ID if it exists. It will be null/undefined for normal submissions.
        }).returning({submissionId: submissions.submissionId}); // The schema sets the verdict to "Pending" by default.
        console.log(`New submission was inserted into the DB successfully. Pushing the submission ${newSubmission.submissionId} to the evaluation queue.`);

        // 3. Adding the job to the evaluation queue
        const job = await submissionQueue.add("evaluate-code", {
            submissionId: newSubmission.submissionId,
            problemId: problemId,
            code: code,
            language: language
        })
        console.log(`New Job was successfully added to the evaluation queue. Job ID: ${job.id}.`);

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

export const getRunStatus = async(req, res) => {
    try {
        const {id} = req.params;

        // Check Redis for the 'run-code' job result
        const redisResult = await redisConnection.get(id);

        if (redisResult) {
            return res.status(200).json({
                success: true,
                source: "cache",
                data: JSON.parse(redisResult)
            });
        }

        // If not found, it's either still pending or has expired.
        return res.status(202).json({ // Using 202 Accepted to indicate the request is valid but processing is not complete.
            success: true,
            source: "none",
            data: { status: "Pending" }
        });

    } catch (error) {
        console.error("Error fetching run status from Redis: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching run status."
        });
    }
};

export const getSubmissionStatus = async(req, res) => {
    try {
        const {id} = req.params;

        // Check the database for an 'evaluate-code' submission
        const [submission] = await db.select({
            verdict: submissions.verdict,
            errorDetails: submissions.errorDetails
        }).from(submissions).where(eq(submissions.submissionId, id));

        if (!submission) {
            return res.status(404).json({success: false, message: "Submission not found."});
        }

        return res.status(200).json({
            success: true,
            data: submission
        });
    } catch (error) {
        console.error("Error fetching submission status: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching submission status."
        });
    }
};

export const getMySubmissionsForProblem = async(req, res) => {
    try {
        const userId = req.user.userId;
        const {problemId} = req.params;

        const mySubmissions = await db.select().from(submissions)
            .where(
                and(
                    eq(submissions.userId, userId), 
                    eq(submissions.problemId, problemId)
                )
            ).orderBy(desc(submissions.createdAt));

        return res.status(200).json({
            success: true,
            data: mySubmissions
        });
    }
    catch (error) {
        console.error("Error my submissions for problem: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching my submissions for problem."
        });
    }
};

export const getAllSubmissionsForProblem = async(req, res) => {
    try {
        const {problemId} = req.params;

        const allSubmissions = await db.select().from(submissions)
            .where(eq(submissions.problemId, problemId))
            .orderBy(desc(submissions.createdAt));

        return res.status(200).json({
            success: true,
            data: allSubmissions
        });
    }
    catch (error) {
        console.error("Error while fetching all submissions for problem: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching all submissions for problem."
        });
    }
};

export const getMySubmissions = async(req, res) => {
    try {
        const userId = req.user.userId;

        const mySubmissions = await db.select().from(submissions)
            .where(eq(submissions.userId, userId))
            .orderBy(desc(submissions.createdAt));
        
        return res.status(200).json({
            success: true,
            data: mySubmissions
        });
    }
    catch (error) {
        console.error("Error fetching my submissions: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching my submissions."
        });
    }
};

export const getProblemLeaderboard = async(req, res) => {
    try {
        const { problemId } = req.params;

        // This query fetches all accepted submissions for the problem,
        // joining with the users table to get usernames.
        // It sorts them by the highest score first, then by the earliest submission time as a tie-breaker.
        const leaderboardData = await db
            .select({
                submissionId: submissions.submissionId,
                username: users.username,
                language: submissions.language,
                totalScore: submissions.totalScore,
                gamifiedRank: submissions.gamifiedRank,
                createdAt: submissions.createdAt,
                code: submissions.code
            })
            .from(submissions)
            .innerJoin(users, eq(submissions.userId, users.userId))
            .where(
                and(
                    eq(submissions.problemId, problemId),
                    eq(submissions.verdict, 'Accepted') // Only show successful submissions on the leaderboard
                )
            )
            .orderBy(
                desc(submissions.totalScore), // Primary sort: Highest Score
                asc(submissions.createdAt)    // Tie-breaker: Who submitted first
            );

        // The query gets all accepted submissions. Now, we filter in JavaScript
        // to ensure we only show the single best (highest score) submission for each user.
        const uniqueUserLeaderboard = [];
        const seenUsers = new Set();

        for (const entry of leaderboardData) {
            if (!seenUsers.has(entry.username)) {
                seenUsers.add(entry.username);
                uniqueUserLeaderboard.push(entry);
            }
        }

        return res.status(200).json({ success: true, data: uniqueUserLeaderboard });
    } catch (error) {
        console.error("Error fetching problem leaderboard:", error);
        return res.status(500).json({ success: false, message: "Internal server error fetching leaderboard." });
    }
};