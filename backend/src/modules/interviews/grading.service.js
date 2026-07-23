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
 * @param {string} language - The programming language of the final code.
 * @returns {Promise<Object>} A promise that resolves to the evaluation object.
 */
export const evaluateInterview = async (chatHistory, problem, finalCode, language) => {
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
        You are an Elite FAANG Senior Engineering Interviewer and Hiring Manager.
        You are evaluating a candidate's completed interview session. You are STRICT, objective, and evidence-based. 

        --- INTERVIEW DATA ---
        PROBLEM NAME: ${problem.problemName}
        PROBLEM STATEMENT: ${problem.statement}
        OPTIMAL TIME COMPLEXITY: ${problem.optimalTC || "Determine based on standard optimal solution"}
        OPTIMAL SPACE COMPLEXITY: ${problem.optimalSC || "Determine based on standard optimal solution"}

        CANDIDATE'S FINAL CODE:
        \`\`\`${language}
        ${finalCode || "// NO CODE SUBMITTED"}
        \`\`\`

        INTERVIEW TRANSCRIPT (Chronological):
        ${transcript}
        ----------------------

        ### GRADING RUBRIC (100 Points Total)
        Calculate the \`total_score\` strictly using this 4-pillar rubric:

        1. Data Structures & Algorithms (25 Points)
        - Did they find the optimal approach? 
        - Did they correctly analyze Time and Space Complexity?
        - Deduct points for brute-force solutions or incorrect Big-O analysis.

        2. Code Quality & Edge Cases (25 Points)
        - Is the code clean, readable, and properly formatted?
        - Did they identify and handle edge cases (empty inputs, negative numbers, bounds)?
        - Deduct points for syntax errors, messy variable names, or missing edge cases.

        3. Communication & Discovery (25 Points)
        - Did they explicitly ask about Constraints and Edge Cases BEFORE coding? (Reward this heavily).
        - Did they dry-run their logic? 
        - Did they explain their thought process clearly?

        4. Problem Solving & Speed (25 Points)
        - How independently did they solve it? (Deduct points for every hint requested).
        - Did they answer the follow-up questions accurately?
        - How fast did they reach the Accepted solution?

        ### OUTPUT FORMAT
        You MUST return your evaluation strictly as a valid JSON object. Do not include markdown formatting like \`\`\`json. 

        {
        "total_score": <Integer 0-100 calculated from the rubric>,
        "summary": "A punchy, 2-3 sentence executive summary of their performance.",
        "strengths": ["List 1-3 specific strong points"],
        "weaknesses": ["List 1-3 specific areas for improvement"],
        "metrics": {
            "askedConstraints": "<'Excellent', 'Good', 'Poor'>",
            "firstApproach": "<'Optimal', 'Sub-optimal', 'Brute Force', 'None'>",
            "timeComplexity": "<'Excellent', 'Good', 'Partial', 'Poor'>",
            "edgeCases": "<'Excellent', 'Partial', 'Poor'>",
            "hintUsage": "<'Independent (0 hints)', 'Minimal (1-2 hints)', 'Heavy Reliance'>",
            "followUps": "<'Excellent', 'Good', 'Poor', 'Not Asked'>",
            "codeQuality": "<'Excellent', 'Good', 'Messy', 'Poor'>",
            "communication": "<'Excellent', 'Good', 'Poor'>"
        }
        }

        ### CRITICAL RULES:
        - If the FINAL CODE is empty, blank, or just a template, the total_score MUST be 0.
        - If the candidate hallucinates or gives a completely irrelevant answer, score heavily negatively.
        - Base your evaluation SOLELY on the provided transcript and code.
    `;

    try {
        // Initializing the model in JSON mode
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
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

        if (!evaluation.summary || !evaluation.metrics || typeof evaluation.total_score !== 'number') {
            console.error("AI response is missing required keys:", evaluation);
            throw new Error("AI returned an incomplete evaluation object.");
        }

        return evaluation;
    } catch (error) {
        console.error("Error during AI interview evaluation:", error);
        throw new Error("Failed to get evaluation from AI service.");
    }
};