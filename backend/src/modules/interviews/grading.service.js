import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined in the environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Maps a numerical score (0-100) to a Gamified Tier.
 * @param {number} score - The numerical score from 0 to 100.
 * @returns {string} The corresponding gamified rank.
 */
export const calculateGamifiedRank = (score) => {
    // Validating the input to ensure it's a number.
    if (typeof score !== 'number' || isNaN(score)) {
        console.warn(`calculateGamifiedRank called with invalid score: ${score}. Defaulting to 'E-rank'.`);
        return "E-rank";
    }

    if (score >= 90) return "S-rank";
    if (score >= 80) return "A-rank";
    if (score >= 70) return "B-rank";
    if (score >= 60) return "C-rank";
    if (score >= 50) return "D-rank";
    return "E-rank";
};

/**
 * Sends the final chat history to the LLM and requests a JSON grading object.
 * @param {Array} chatHistory - The array of previous messages.
 * @param {Object} problem - The database object of the current problem.
 * @param {string} finalCode - The final code submitted by the user.
 * @returns {Promise<Object>} A promise that resolves to the evaluation object.
 */
export const evaluateInterview = async (chatHistory, problem, finalCode) => {
    if (!Array.isArray(chatHistory) || !problem?.problemName || typeof finalCode === 'undefined') {
        console.error("evaluateInterview called with invalid or missing parameters.");
        throw new Error("Invalid parameters provided for interview evaluation.");
    }

    const transcript = chatHistory
        .map(message => {
            const role = message.role || 'unknown';
            return `${role.toUpperCase()}: ${message.content || ''}`;
        })
        .join("\n\n");

    const graderPrompt = `
    You are a strict technical interviewer evaluating a candidate's performance.
    
    PROBLEM: ${problem.problemName}
    CANDIDATE'S FINAL CODE:
    \`\`\`
    ${finalCode}
    \`\`\`
    
    INTERVIEW TRANSCRIPT:
    ${transcript}
    
    Evaluate the candidate based on:
    1. Optimal Time & Space Complexity.
    2. How many hints they required (deduct points heavily for hand-holding).
    3. How many edge cases they considered and handled.
    4. Communication of their thought process.
    
    You MUST return a raw JSON object with exactly these two keys:
    - "total_score": An integer from 0 to 100.
    - "score_breakdown": {
            "time_complexity": "<string feedback>",
            "hint_penalty": "<string feedback>",
            "edge_cases": "<string feedback>",
            "communication": "<string feedback>"
        }
    `;

    try {
        // Initializing the model in JSON mode
        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            generationConfig: {
                responseMimeType: "application/json" // this forces a valid JSON output from the model
            }
        });

        const result = await model.generateContent(graderPrompt);
        const responseText = result.response.text();

        let evaluation;
        try {
            evaluation = JSON.parse(responseText);
        }
        catch (parseError) {
            console.error("Failed to parse JSON response from AI:", responseText, parseError);
            throw new Error("AI returned malformed evaluation data.");
        }

        if (typeof evaluation.total_score !== 'number' || typeof evaluation.score_breakdown !== 'object') {
            console.error("AI response is missing required keys:", evaluation);
            throw new Error("AI returned an incomplete evaluation object.");
        }

        return evaluation;
    }
    catch (error) {
        console.error("Error during AI interview evaluation:", error);
        throw new Error("Failed to get evaluation from AI service.");
    }
};