import { eq, desc, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from "../../database/db_connector.js";
import { problems, submissions, interviewSessions } from "../../database/schema.js";
import { submissionQueue } from '../../queues/submissionQueue.js';

import { appendChatMessage, getChatHistory, clearChatHistory, getEditorState, saveEditorState, clearEditorState } from "./cache.service.js";
import { getInterviewerStream } from "./llm.service.js";
import { evaluateInterview, calculateGamifiedRank } from "./grading.service.js";

// Matches the 45-minute session length enforced by the frontend's InterviewTimer, plus a
// few minutes of grace for network/reload lag before we consider a session abandoned.
const INTERVIEW_DURATION_MS = 45 * 60 * 1000;
const STALE_SESSION_GRACE_MS = 5 * 60 * 1000;

export const startInterview = async (req, res) => {
    try {
        const { problemId } = req.body;
        if (!problemId) {
            return res.status(400).json({ error: "Missing required field: problemId." });
        }

        const problem = await db.query.problems.findFirst({
            where: eq(problems.problemId, problemId)
        });
        if (!problem) {
            return res.status(404).json({ error: "Problem not found." });
        }

        const userId = req.user.userId; // Extracted safely from requireAuth middleware

        // Resume support: if the candidate already has an unfinished session for this problem
        // (e.g. they reloaded the page), hand back that same session instead of starting over.
        const existingSession = await db.query.interviewSessions.findFirst({
            where: and(
                eq(interviewSessions.userId, userId),
                eq(interviewSessions.problemId, problemId),
                isNull(interviewSessions.endedAt)
            ),
            orderBy: desc(interviewSessions.startedAt)
        });

        const isStale = existingSession &&
            (Date.now() - new Date(existingSession.startedAt).getTime()) > (INTERVIEW_DURATION_MS + STALE_SESSION_GRACE_MS);

        if (existingSession && !isStale) {
            const chatHistory = await getChatHistory(existingSession.sessionId);
            // The editor's contents are autosaved separately from the chat transcript, so a reload restores the candidate's code, not just the chat.
            const editorState = await getEditorState(existingSession.sessionId);
            return res.status(200).json({
                success: true,
                sessionId: existingSession.sessionId,
                startedAt: existingSession.startedAt,
                chatHistory,
                code: editorState?.code ?? null,
                language: editorState?.language ?? null,
                message: "Resumed existing interview session."
            });
        }

        // A stale, never-finished session (e.g. an old abandoned tab) shouldn't linger as
        // "active" forever, since that would block the candidate from ever starting fresh.
        if (existingSession && isStale) {
            await db.update(interviewSessions)
                .set({ endedAt: new Date() })
                .where(eq(interviewSessions.sessionId, existingSession.sessionId));
            await clearChatHistory(existingSession.sessionId);
        }

        // Generate a unique session ID for this specific interview attempt
        const sessionId = crypto.randomUUID();

        // Create a new interview session in the database
        const [newSession] = await db.insert(interviewSessions).values({
            sessionId: sessionId,
            userId: userId,
            problemId: problemId,
        }).returning({ startedAt: interviewSessions.startedAt });

        return res.status(201).json({
            success: true,
            sessionId: sessionId,
            startedAt: newSession.startedAt,
            chatHistory: [],
            code: null,
            language: null,
            message: "Interview session started successfully."
        });
    }
    catch (error) {
        console.error("Error starting interview session:", error);
        return res.status(500).json({ error: "Internal server error occurred while starting the interview." });
    }
};

export const streamInterviewChat = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Request body is missing or not in JSON format." });
        }

        const userId = req.user.userId;
        const { sessionId, problemId, currentCode, message, systemObservation } = req.body;
        if (!sessionId || !problemId || typeof message === "undefined") {
            return res.status(400).json({ error: "Missing required fields: sessionId or problemId." });
        }

        const session = await db.query.interviewSessions.findFirst({
            where: and(
                eq(interviewSessions.sessionId, sessionId),
                eq(interviewSessions.userId, userId),
                eq(interviewSessions.problemId, problemId)
            )
        });
        if (!session) {
            return res.status(404).json({ error: "Interview session not found." });
        }

        // Fetching the problem from the database
        const problem = await db.query.problems.findFirst({
            where: eq(problems.problemId, problemId)
        });
        if (!problem) {
            return res.status(404).json({ error: "Problem not found." });
        }
        // Saving the user's message to Redis
        // Only saving the human 'message' to Redis if it actually exists.
        // If the user just clicked "Submit" without typing a chat message, 'message' will be empty.
        // Ghost/system-observation turns (the frontend sends the same text as both 'message' and
        // 'systemObservation') are flagged so they can be hidden from the candidate-facing
        // transcript on resume, while still being kept for AI/grading context.
        if (message && message.trim() !== "") {
            await appendChatMessage(sessionId, "user", message, { isGhost: !!systemObservation });
        }

        // Retrieving the full chat history (which now includes the user's latest message)
        const chatHistory = await getChatHistory(sessionId);

        // Setting the SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Connecting to the LLM. Passing the session's startedAt lets the interviewer reason
        // about elapsed/remaining time and pace itself instead of following a fixed script.
        const stream = await getInterviewerStream(chatHistory, problem, currentCode, systemObservation, session.startedAt);

        let fullAiResponse = "";

        // Iterating over the stream and sending each chunk as they arrive to the frontend
        for await (const chunk of stream) {
            const chunkText = chunk.text();
            fullAiResponse += chunkText;

            // SSE format strictly requires data to start with "data: " and end with "\n\n"
            // We stringify the chunk so we don't accidentally break the SSE format with internal newlines
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }

        // Once the stream is complete, we save the AI's full response to Redis
        await appendChatMessage(sessionId, "assistant", fullAiResponse);

        // Notifying the frontend that the stream has ended
        res.write(`data: [DONE]\n\n`);
        res.end();
    }
    catch (error) {
        console.error("Error in streamInterviewChat in Interview Controller:", error);

        // Streaming Error Handling
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ error: "An error occurred with the AI service. Please try again." })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
        } else {
            return res.status(500).json({ error: "An internal server error occurred during the interview stream." });
        }
    }
    finally {
        // Ensure the response is always closed securely
        if (!res.writableEnded) {
            res.end();
        }
    }
};

/**
 * Autosaves the candidate's live editor contents (code + language) so that a page reload
 * or dropped connection can restore exactly what they were working on, not just the chat
 * transcript. Called by the frontend on a debounce, not on every keystroke.
 */
export const saveCode = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { sessionId, problemId, code, language } = req.body;
        if (!sessionId || !problemId || typeof code !== "string" || !language) {
            return res.status(400).json({ error: "Missing required fields: sessionId, problemId, code, or language." });
        }

        const session = await db.query.interviewSessions.findFirst({
            where: and(
                eq(interviewSessions.sessionId, sessionId),
                eq(interviewSessions.userId, userId),
                eq(interviewSessions.problemId, problemId)
            )
        });
        if (!session) {
            return res.status(404).json({ error: "Interview session not found." });
        }

        await saveEditorState(sessionId, code, language);

        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error("Error in saveCode in Interview Controller:", error);
        return res.status(500).json({ error: "An internal server error occurred while saving the editor state." });
    }
};

/**
 * A helper function to poll the database for a submission's final verdict.
 * @param {string} submissionId - The ID of the submission to poll.
 * @param {number} retries - The maximum number of times to poll.
 * @param {number} interval - The time in milliseconds between polls.
 * @returns {Promise<object>} A promise that resolves with the final submission object.
 */
const pollForVerdict = async (submissionId, retries = 20, interval = 1000) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const [submission] = await db.select().from(submissions).where(eq(submissions.submissionId, submissionId));

        if (submission && submission.verdict !== "Pending") {
            return submission;
        }
        if (attempt === retries) {
            throw new Error("Evaluation timed out waiting for a verdict.");
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
};

export const finishInterviewAndGrade = async (req, res) => {
    try {
        const userId = req.user.userId; // Extracted safely from requireAuth middleware

        const { sessionId, problemId, finalCode, language } = req.body;
        if (!sessionId || !problemId || !language || typeof finalCode === 'undefined') {
            return res.status(400).json({ success: false, error: "Missing required fields." });
        }

        const session = await db.query.interviewSessions.findFirst({
            where: and(
                eq(interviewSessions.sessionId, sessionId),
                eq(interviewSessions.userId, userId),
                eq(interviewSessions.problemId, problemId)
            )
        });
        if (!session) {
            return res.status(404).json({ error: "Interview session not found." });
        }

        // Fetching the problems and the full chat history from Redis
        const problem = await db.query.problems.findFirst({
            where: eq(problems.problemId, problemId)
        });
        if (!problem) {
            return res.status(404).json({ error: "Problem not found." });
        }

        let finalSubmissionId = null;

        // --- THE SMART SNAPSHOT LOGIC ---
        // 1. Fetch the most recent submission for this session
        const [lastSubmission] = await db.select()
            .from(submissions)
            .where(and(
                eq(submissions.userId, userId),
                eq(submissions.problemId, problemId),
                // Also check for a non-null session ID to be more specific
                eq(submissions.sessionId, sessionId) 
            ))
            .orderBy(desc(submissions.createdAt))
            .limit(1);

        // 2. Compare the code (using .trim() to ignore trailing spaces/newlines)
        if (lastSubmission && lastSubmission.code.trim() === finalCode.trim()) {

            // MATCH! The user didn't change anything since they last hit "Submit".
            // Reuse their existing submission (Preserves their "Accepted" or "Wrong Answer" status!)
            finalSubmissionId = lastSubmission.submissionId;

        } else {

            // NO MATCH! The user typed new code or never submitted at all.
            // Create a new submission, add it to the execution queue, and wait for the result.
            const [newSnapshot] = await db.insert(submissions).values({
                userId,
                problemId,
                sessionId,
                code: finalCode,
                language: language,
            }).returning({ submissionId: submissions.submissionId });

            // Add the job to the evaluation queue
            await submissionQueue.add("evaluate-code", {
                submissionId: newSnapshot.submissionId,
                problemId: problemId,
                code: finalCode,
                language: language
            });

            // Wait for the worker to finish executing the code
            await pollForVerdict(newSnapshot.submissionId);
            finalSubmissionId = newSnapshot.submissionId;
        }
        // ---------------------------------

        const chatHistory = await getChatHistory(sessionId);
        // if (chatHistory.length === 0) {
        //     return res.status(400).json({ error: "Cannot grade an empty interview. No chat history found." });
        // }

        // Evaluating the interview using the grading service
        const aiEvaluation = await evaluateInterview(chatHistory, problem, finalCode, language);
        const gamifiedRank = calculateGamifiedRank(aiEvaluation.total_score);

        // Database Transaction for Atomic Updates
        await db.transaction(async (tx) => {
            // Update the submission
            await tx.update(submissions)
                .set({
                    totalScore: aiEvaluation.total_score,
                    gamifiedRank: gamifiedRank,
                    scoreBreakdown: aiEvaluation.metrics // Storing the detailed metrics object
                })
                .where(eq(submissions.submissionId, finalSubmissionId));

            // Update the interview session log
            await tx.update(interviewSessions)
                .set({
                    chatHistory: JSON.stringify(chatHistory),
                    endedAt: new Date() // sets the end timestamp
                })
                .where(eq(interviewSessions.sessionId, sessionId));
        });

        // Cleaning up the Redis cache
        await clearChatHistory(sessionId);
        await clearEditorState(sessionId);

        return res.status(200).json({
            success: true,
            data: {
                ...aiEvaluation,
                rank: gamifiedRank, // Add the calculated rank to the response object
                submissionId: finalSubmissionId // Return the final submission ID for frontend use
            }
        });
    }
    catch (error) {
        console.error("Error in finishInterviewAndGrade in Interview Controller:", error);
        return res.status(500).json({ error: "An error occurred while grading the interview." });
    }
};