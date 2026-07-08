import {db} from "../../database/db_connector.js";
import {roleEnum, problems, testCases} from "../../database/schema.js";
import {eq} from "drizzle-orm";

//--------------------------
// Public Routes (for Users)
//--------------------------

// Fetch all problems for the dashboard
export const getAllProblems = async(req, res) => {
    try {
        const problemList = await db.select({
            problemId: problems.problemId,
            problemName: problems.problemName,
            difficulty: problems.difficulty,
        }).from(problems);

        return res.status(200).json({
            success: true,
            data: problemList
        });
    }
    catch (error) {
        console.error("Error fetching problems: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during fetching all problems"
        });
    }
};

// Fetch a single problem's details for the coding arena
export const getProblemById = async(req, res) => {
    try {
        const {id} = req.params;

        const [problem] = await db.select().from(problems).where(eq(id, problems.problemId));

        if (!problem) {
            return res.status(404).json({
                success: false,
                message: "Problem not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: problem
        });
    }
    catch (error) {
        console.error("Error fetching the problem: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during fetching the problem"
        });
    }
};

//-------------
// Admin Routes
//-------------

// Creates a new problem and its testcases.
export const createProblem = async(req, res) => {
    try {
        const {problemName, difficulty, statement, sampleTestCases, hiddenTestCases} = req.body;
        if (!problemName || !difficulty || !statement || !sampleTestCases || !hiddenTestCases) {
            return res.status(400).json({
                success: false,
                message: "Problem Name, Difficulty, Statement, Sample Test Cases and Hidden Test Cases are required"
            });
        }

        // Starting a Drizzle DB Transaction
        await db.transaction(async (tx) => {
            const [newProblem] = await tx.insert(problems).values({
                problemName,
                difficulty,
                statement,
                sampleTestCases
            }).returning({problemId: problems.problemId}); // returns the newly generated problemId after insertion

            const formattedTestCases = hiddenTestCases.map((testcase) => ({
                problemId: newProblem.problemId, // formatting the hidden test cases to include the newly created problemId
                input: testcase.input,
                output: testcase.output
            }));

            await tx.insert(testCases).values(formattedTestCases); // bulk insertion of formatted hidden test cases
        });

        return res.status(201).json({
            success: true,
            message: "Problem and its testcases were created successfully!"
        });
    }
    catch (error) {
        console.error("Error creating the problem: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during creating the problem. Ensure that problemName is Unique."
        });
    }
};

// Adds an additional hidden test case to a particular problem
export const addHiddenTestCases = async(req, res) => {
    try {
        const {id} = req.params; // problemId from the URL
        const {input, output} = req.body;

        // Validating the request
        if (!input || !output) {
            return res.status(400).json({
                success: false,
                message: "Both Input and Output are required to create a test case."
            });
        }

        // Verifying that the problem actually exists
        const [existingProblem] = await db.select({problemId: problems.problemId}).from(problems).where(eq(id, problems.problemId));
        if (!existingProblem) {
            return res.status(404).json({
                success: false,
                message: "Problem not found. Cannot add a test case to a non-existent problem."
            });
        }

        // Inserting the new test case
        await db.insert(testCases).values({problemId: id, input: input, output: output});

        return res.status(201).json({
            success: true,
            message: "New hidden test case added successfully!"
        });
    }
    catch(error) {
        console.error("Error adding a new hidden test case: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error while adding a new hidden test case."
        });
    }
}

// Deletes and problem and its hidden test cases
export const deleteProblem = async(req, res) => {
    try {
        const {id} = req.params;

        await db.transaction(async (tx) => {
            // First, deleting all the hidden test cases tied to this problemId
            await tx.delete(testCases).where(eq(id, testCases.problemId));
            // Then, deleting the problem itself.
            await tx.delete(problems).where(eq(id, problems.problemId));
        });

        return res.status(200).json({
            success: true,
            message: "Problem and its test cases were deleted successfully!"
        });
    }
    catch (error) {
        console.error("Error deleting the problem: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during deleting the problem"
        });
    }
};