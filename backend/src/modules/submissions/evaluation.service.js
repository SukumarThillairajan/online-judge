import path from 'path';
import fs from 'fs/promises';
import {spawn} from 'child_process';
import os from 'os';
import crypto from 'crypto';

import {languageConfigs, compileCode, runCode} from "../../workers/dockerEngine.js";

export const evaluateSubmission = async (code, language, testCases) => {
    const config = languageConfigs[language];

    // Validation
    if (!config) {
        throw new Error(`${language} language is currently not supported.`);
    }

    // Creating a temporary directory for this specific submission
    const tempDirName = crypto.randomUUID();
    const tempDirPath = path.join(os.tmpdir(), tempDirName); // returns the absolute path of the OS' default directory for temporary files.
    const filePath = path.join(tempDirPath, config.fileName);

    try {
        await fs.mkdir(tempDirPath, {recursive: true});
        await fs.writeFile(filePath, code);

        // 1. Compilation Step (if applicable)
        const compileResult = await compileCode(tempDirPath, language);
        if (!compileResult.success) {
            return {
                verdict: compileResult.error,
                details: compileResult.details
            };
        }

        // 2. Execution Step
        for (const [index, testCase] of testCases.entries()) {
            const result = await runCode(tempDirPath, language, testCase.input);

            if (!result.success) {
                return {
                    verdict: result.error,
                    details: result.details,
                    errorDetails: { failedAtTestCase: testCase.testCaseId }
                };
            }

            if (result.output !== testCase.output) {
                return {
                    verdict: "Wrong Answer",
                    errorDetails: {
                        failedAtTestCase: testCase.testCaseId,
                        input: testCase.input,
                        actualOutput: result.output,
                        expectedOutput: testCase.output
                    }
                };
            }
        }

        // If the code has survived the above loop, then it has passed all the hidden test cases
        return {
            verdict: "Accepted",
            details: "All test cases passed."
        };
    }
    catch (error) {
        console.error("Evaluation error: ", error);
        return {
            verdict: "System Error",
            details: error.message
        };
    }
    finally {
        // Cleanup
        try {
            await fs.rm(tempDirPath, {recursive: true, force: true});
        }
        catch (cleanupError) {
            console.error(`Failed to clean up the temp directory ${tempDirPath}: `, cleanupError);
        }
    }
};

export const runCustomCode = async (code, language, customInput) => {
    const config = languageConfigs[language];
    if (!config) {
        throw new Error(`${language} language is currently not supported.`);
    }

    // Creating a temporary directory to run this code without submitting it.
    const tempDirName = crypto.randomUUID();
    const tempDirPath = path.join(os.tmpdir(), tempDirName);
    const filePath = path.join(tempDirPath, config.fileName);

    try {
        await fs.mkdir(tempDirPath, {recursive: true});
        await fs.writeFile(filePath, code);

        // Compilation step
        const compileResult = await compileCode(tempDirPath, language);
        if (!compileResult.success) {
            return {
                error: compileResult.error,
                details: compileResult.details
            };
        }

        // Execution step
        const result = await runCode(tempDirPath, language, customInput);
        if (!result.success) {
            return {
                error: result.error,
                details: result.details || ""
            };
        }

        return {
            status: "Success",
            input: customInput,
            output: result.output
        };
    }
    catch (error) {
        console.error("Error running custom code: ", error);
        return {
            error: "System Error",
            output: error.message
        };
    }
    finally {
        // Cleanup
        try {
            await fs.rm(tempDirPath, {recursive: true, force: true});
        }
        catch (cleanupError) {
            console.error(`Failed to remove the temp directory ${tempDirPath}: `, cleanupError);
        }
    }
};