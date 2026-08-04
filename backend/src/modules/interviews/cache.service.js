import {redisConnection} from "../../queues/submissionQueue.js";

// Setting a Time-To-Live (TTL) of 2 hours. 
// If a user abandons a 45-minute interview, this ensures the RAM clears itself automatically.
const INTERVIEW_TTL = 60 * 60 * 2;

/**
 * Generates a consistent Redis key for an interview chat session.
 * @param {string} sessionId
 * @returns {string} The Redis key.
 */
const generateRedisChatKey = (sessionId) => `interview:chat:${sessionId}`;

/**
 * Fetches the active chat array from Redis.
 * @param {string} sessionId - The unique identifier for the interview session.
 */
export const getChatHistory = async (sessionId) => {
    if (!sessionId) {
        console.error("getChatHistory called without a sessionId.");
        return [];
    }

    const key = generateRedisChatKey(sessionId);

    try {
        const data = await redisConnection.get(key);
        if (!data) {
            return [];
        }
        // Safely parse the data, returning an empty array if it's corrupted.
        return JSON.parse(data);
    }
    catch (error) {
        console.error(`Error fetching or parsing chat history for sessionId ${sessionId}:`, error);
        // Return an empty array to ensure the calling function doesn't break.
        return [];
    }
};

/**
 * Appends a new message (either from the user or the AI) to the temporary chat history in Redis.
 * @param {string} sessionId - The unique identifier for the interview session.
 * @param {string} role - The role of the message sender (e.g., 'user' or 'assistant').
 * @param {string} content - The content of the message.
 * @param {Object} [options]
 * @param {boolean} [options.isGhost] - True for hidden system-observation/ghost-prompt turns that
 *   should stay out of the candidate-facing transcript on resume, but still count for AI context.
 */
export const appendChatMessage = async (sessionId, role, content, options = {}) => {
    if (!sessionId || !role || !content) {
        console.error("appendChatMessage called with missing parameters.", { sessionId, role, content: content ? '(has content)' : content });
        // Returning the current history (or empty) is a safe default.
        return await getChatHistory(sessionId);
    }

    const key = generateRedisChatKey(sessionId);

    try {
        const currentData = await redisConnection.get(key);
        const history = currentData ? JSON.parse(currentData) : [];

        // Appending the new message to the history, timestamped so the AI can reason about
        // pacing and so a resumed session can be replayed.
        history.push({ role, content, createdAt: Date.now(), isGhost: !!options.isGhost }); // !! is used to ensure isGhost is a boolean

        // Setting the updated history back to Redis with a TTL
        await redisConnection.set(key, JSON.stringify(history), "EX", INTERVIEW_TTL);

        return history;
    }
    catch (error) {
        console.error(`Error appending chat message for sessionId ${sessionId}:`, error);
        throw new Error("Failed to append chat message to cache.");
    }
};

/**
 * Deletes the temporary chat history from Redis for a given session.
 * @param {string} sessionId - The unique identifier for the interview session.
 */
export const clearChatHistory = async (sessionId) => {
    if (!sessionId) {
        console.warn("clearChatHistory called with no sessionId.");
        return;
    }

    const key = generateRedisChatKey(sessionId);

    try {
        await redisConnection.del(key);
    }
    catch (error) {
        // This is a non-fatal error for the user, but critical for system health monitoring.
        console.error(`CRITICAL: Failed to clear chat history for session ${sessionId}. This may indicate a Redis connectivity issue.`, error);
    }
}

/**
 * Generates a consistent Redis key for an interview session's editor state.
 * @param {string} sessionId
 * @returns {string} The Redis key.
 */
const generateRedisCodeKey = (sessionId) => `interview:code:${sessionId}`;

/**
 * Fetches the last autosaved editor state (code + language) from Redis.
 * @param {string} sessionId - The unique identifier for the interview session.
 * @returns {Promise<{code: string, language: string}|null>}
 */
export const getEditorState = async (sessionId) => {
    if (!sessionId) {
        console.error("getEditorState called without a sessionId.");
        return null;
    }

    const key = generateRedisCodeKey(sessionId);

    try {
        const data = await redisConnection.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        console.error(`Error fetching or parsing editor state for sessionId ${sessionId}:`, error);
        return null;
    }
};

/**
 * Autosaves the candidate's current editor contents to Redis, so a page reload can
 * restore exactly what they were typing, not just the chat transcript.
 * @param {string} sessionId - The unique identifier for the interview session.
 * @param {string} code - The live contents of the Monaco editor.
 * @param {string} language - The currently selected language.
 */
export const saveEditorState = async (sessionId, code, language) => {
    if (!sessionId || typeof code !== "string" || !language) {
        console.error("saveEditorState called with missing parameters.", { sessionId, hasCode: typeof code === "string", language });
        return;
    }

    const key = generateRedisCodeKey(sessionId);

    try {
        await redisConnection.set(key, JSON.stringify({ code, language }), "EX", INTERVIEW_TTL);
    }
    catch (error) {
        console.error(`Error saving editor state for sessionId ${sessionId}:`, error);
        throw new Error("Failed to save editor state to cache.");
    }
};

/**
 * Deletes the autosaved editor state from Redis for a given session.
 * @param {string} sessionId - The unique identifier for the interview session.
 */
export const clearEditorState = async (sessionId) => {
    if (!sessionId) {
        console.warn("clearEditorState called with no sessionId.");
        return;
    }

    const key = generateRedisCodeKey(sessionId);

    try {
        await redisConnection.del(key);
    }
    catch (error) {
        console.error(`CRITICAL: Failed to clear editor state for session ${sessionId}. This may indicate a Redis connectivity issue.`, error);
    }
};