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
        - Did they find the optimal approach? This can be credited from a clearly-articulated VERBAL approach in the transcript, even if it was never coded.
        - Did they correctly analyze Time Complexity AND Space Complexity as two separate, distinct assessments?
        - Deduct points for brute-force solutions or incorrect Big-O analysis (time or space).

        2. Code Quality & Edge Cases (25 Points)
        - Is the code clean, readable, and properly formatted?
        - Did they identify and handle edge cases (empty inputs, negative numbers, bounds)?
        - Deduct points for syntax errors, messy variable names, or missing edge cases.
        - If FINAL CODE is empty, blank, or just a template, this pillar scores 0/25 — there is no code to grade. This does NOT affect pillars 1 or 3 below.

        3. Communication & Discovery (25 Points)
        - Did they explicitly ask about Constraints and Edge Cases BEFORE coding? (Reward this heavily).
        - Did they dry-run their logic verbally?
        - Did they explain their thought process clearly?
        - This pillar is graded entirely from the transcript and is fully scoreable even if no code was ever written.

        4. Problem Solving & Speed (25 Points)
        - How independently did they solve it? (Deduct points for every hint requested).
        - Did they answer the follow-up questions accurately?
        - How fast did they reach the Accepted solution? If no code was submitted, there is no "Accepted solution" — score this specific speed sub-component as 0, but still grade hint-independence and follow-up-handling on their own merits from the transcript.

        ### OUTPUT FORMAT
        You MUST return your evaluation strictly as a valid JSON object. Do not include markdown formatting like \`\`\`json.

        {
        "total_score": <Integer 0-100 calculated from the rubric>,
        "summary": "A punchy, 2-3 sentence executive summary of their performance.",
        "strengths": ["List 1-3 specific strong points"],
        "weaknesses": ["List 1-3 specific areas for improvement"],
        "metrics": {
            "sessionOutcome": "<'Completed - Solution Submitted', 'Completed - Partial/Incomplete Solution', 'Ended Early - Confirmed Understanding, Time-Constrained', 'Ended Early - Actively Reasoning, No Code Yet', 'Ended Early - Stuck, Repeated Help Requests', 'Ended Early - Disengaged / Unresponsive', 'Timed Out - In Progress', 'Timed Out - No Meaningful Engagement', 'Unprofessional Behavior Detected'>",
            "askedConstraints": "<'Excellent (Proactive & Thorough)', 'Good', 'Poor (Didn't Clarify Constraints)', 'Not Applicable (Session Ended Before Discussion Phase)'>",
            "firstApproach": "<'Optimal', 'Sub-optimal but Valid', 'Brute Force', 'Proposed Verbally, Not Yet Coded', 'None Reached'>",
            "timeComplexity": "<'Excellent', 'Good', 'Partial', 'Poor', 'Not Applicable (No Code Submitted)'>",
            "spaceComplexity": "<'Excellent', 'Good', 'Partial', 'Poor', 'Not Applicable (No Code Submitted)'>",
            "edgeCases": "<'Excellent', 'Good', 'Partial', 'Poor', 'Not Applicable (No Code Submitted)'>",
            "hintUsage": "<'Independent (0 Hints Requested or Given)', 'Minimal (1-2 Hints)', 'Moderate (3-4 Hints)', 'Heavy Reliance (5+ Hints)', 'Not Applicable (Session Ended Before Hints Were Relevant)'>",
            "followUps": "<'Excellent', 'Good', 'Poor', 'Not Asked by Interviewer', 'Not Applicable (Session Ended Before Follow-ups)'>",
            "codeQuality": "<'Excellent', 'Good', 'Messy', 'Poor', 'No Code Submitted'>",
            "communication": "<'Excellent (Clear & Proactive)', 'Good', 'Poor', 'Disengaged / Minimal Interaction'>"
        }
        }

        ### CRITICAL RULES:
        - If the FINAL CODE is empty, blank, or just a template, do NOT zero out the whole total_score. Instead: award 0/25 for pillar 2 (Code Quality & Edge Cases) and 0 for the "speed to Accepted" sub-component of pillar 4, as specified above — but still grade pillars 1 and 3, and the non-speed parts of pillar 4, honestly from the transcript. total_score is the sum of what each pillar actually earns under this rule; it is not a fixed value. A candidate with no code but a correct, well-reasoned verbal approach and strong communication should land meaningfully above 0 — a candidate with no code AND weak/absent verbal engagement should still land near 0.
        - timeComplexity and spaceComplexity must be graded from whatever complexity reasoning the candidate gave verbally in the transcript, even without code. Only use "Not Applicable (No Code Submitted)" for either if the candidate never discussed that complexity at all (neither verbally nor in code).
        - Every individual tag inside "metrics" MUST be justified strictly by direct evidence in the transcript, independent of total_score. A low total_score does NOT mean every metric should default to its worst-case tag. Example: a candidate who asks excellent clarifying questions, clearly explains their approach, and correctly reasons through time/space complexity, but runs out of time before writing code, should still get an accurate "Excellent"/"Confirmed Understanding..." on askedConstraints, communication, timeComplexity, and spaceComplexity — while codeQuality and edgeCases correctly reflect "No Code Submitted" / "Not Applicable (No Code Submitted)". Do not let a low score bleed into unrelated tags.
        - Only select an hintUsage tag if the transcript literally contains hint requests from the candidate or hints given by the interviewer. Never infer hint usage from a low score, missing code, or a short session.
        - If the candidate hallucinates or gives a completely irrelevant answer or question, score heavily negatively.
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