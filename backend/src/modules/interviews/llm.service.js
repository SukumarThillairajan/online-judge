import { GoogleGenerativeAI } from '@google/generative-ai';

// Initializing the SDK
// Validating that the API key is set.
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined in the environment variables.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Connects to the LLM and returns a stream of the AI's response.
 * @param {Array} chatHistory - The array of previous messages from Redis.
 * @param {Object} problem - The database object of the current problem.
 * @param {String} currentCode - The live code from the Monaco Editor.
 */
export const getInterviewerStream = async (chatHistory, problem, currentCode) => {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0 || !problem?.problemName) {
        console.error("getInterviewerStream called with invalid or empty parameters.", { hasHistory: chatHistory?.length > 0, hasProblem: !!problem });
        throw new Error("Invalid parameters provided to get interviewer stream.");
    }

    // Defining the "State machine" prompt
    const systemPrompt = `
    You are an expert technical interviewer at a top-tier tech company. 
    You are currently interviewing a candidate solving the following problem:
    
    PROBLEM NAME: ${problem.problemName}
    PROBLEM STATEMENT: ${problem.statement}
    THE CANDIDATE'S CURRENT CODE EDITOR STATE:
    \`\`\`
    ${currentCode ? currentCode : "// The candidate has not written any code yet."}
    \`\`\`
    
    YOUR STRICT RULES:
    1. NEVER WRITE THE FULL CODE SOLUTION. You are an interviewer, not a code generator.
    2. Phase 1 (Brainstorming): Start by asking the user to explain their approach and the Time/Space complexity before they write code.
    3. Phase 2 (Coding): If they are stuck, ask guided, Socratic questions. Only provide tiny hints if explicitly requested.
    4. Phase 3 (Evaluation): If they submit code that fails edge cases, point out the flaw conceptually without fixing the code for them.
    5. Keep your responses concise, professional, and formatted in clean Markdown.
    `;

    try {
        // Initializing the model with system instructions
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        // Formatting the Redis history for the SDK
        // Redis uses {role: 'user'/'assistant'}. Gemini uses {role: 'user'/'model'}.
        const formattedHistory = chatHistory.map(message => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content || "" }]
        }));

        const latestMessage = formattedHistory.pop();

        // Initializing the chat with the historical context
        const chat = model.startChat({
            history: formattedHistory
        });

        // Sending the latest message and requesting a Stream
        // We return the stream so our controller can send it word-by-word to the frontend
        const result = await chat.sendMessageStream(latestMessage.parts[0].text);

        return result.stream;
    }
    catch (error) {
        console.error("Error connecting to Google AI for interview stream:", error);
        throw new Error("Failed to get response from AI service.");
    }
};