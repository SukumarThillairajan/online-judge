import path from 'path';
import fs from 'fs/promises';
import {spawn} from 'child_process';
import os from 'os';
import crypto from 'crypto';

// Configuring supported languages and Docker images
const languageConfigs = {
    c: {
        image: "gcc-alpine",
        fileName: "main.c",
        compile: {
            command: "gcc",
            args: ["main.c", "-o", "main"]
        },
        run: {
            command: "./main",
            args: []
        }
    },
    cpp: {
        image: "gcc-alpine",
        fileName: "main.cpp",
        compile: {
            command: "g++",
            args: ["main.cpp", "-o", "main"]
        },
        run: {
            command: "./main",
            args: []
        }
    },
    java: {
        image: "amazoncorretto:21-alpine",
        fileName: "Main.java",
        compile: {
            command: "javac",
            args: ["Main.java"]
        },
        run: {
            command: "java",
            args: ["Main"]
        }
    },
    python: {
        image: "python:3.11-slim",
        fileName: "main.py",
        run: {
            command: "python",
            args: ["main.py"]
        }
    },
    javascript: {
        image: "node:20-alpine",
        fileName: "main.js",
        run: {
            command: "node",
            args: ["main.js"]
        }
    }
}

// Helper function to safely execute code inside a Docker sandbox
const runInDockerHelper = (tempDirPath, image, command, args, inputData) => {
    return new Promise((resolve, reject) => {
        let output = "";
        let errorOutput = "";

        const dockerArgs = [
            "run",
            "--rm", // destroy the container once it is finished running the code
            "-i", // Interactive mode (allows us to write to STDIN)
            "--network", "none", // disables internet access
            "--memory", "256m", // memory constraints
            "--cpus", "1.0", // CPU constraints
            "-v", `${tempDirPath}:/app`, // Volume Mounting the temp folder from the host to the /app inside the container
            "-w", "/app", // setting the working directory to be /app
            image,
            command,
            ...args
        ];
        // Spawning the child process
        const dockerProcess = spawn("docker", dockerArgs);

        // Set a timeout to kill the process
        const timer = setTimeout(() => {
            dockerProcess.kill();
            // 'close' event will be triggered, and we'll handle the TLE there
        }, 3000);

        // Feeding the test case input into the container's standard input
        if (inputData) {
            dockerProcess.stdin.write(inputData);
            dockerProcess.stdin.end(); // telling the container that we're done sending the input
        }
        // Collecting the standard output
        dockerProcess.stdout.on("data", (data) => {
            output += data.toString();
        });
        // Collecting the standard error like RTE and Compilation error
        dockerProcess.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        // Once the container is done with the code
        dockerProcess.on("close", (code, signal) => {
            clearTimeout(timer); // Clearing the timeout timer

            if (signal === 'SIGTERM') {
                return resolve({status: "Time Limit Exceeded", output: ""});
            }

            if (code !== 0) { // if the process exits with any non-zero code, then it means that it crashed or failed to compile
                return resolve({
                    status: "Runtime Error", // Generic runtime error
                    output: errorOutput
                });
            }

            resolve({status: "Success", output: output.trim()});
        });
    });
};

// Main evaluation service/engine
export const evaluateSubmission = async (code, language, testCases) => {
    const config = languageConfigs[language];

    // Validation
    if (!config) {
        throw new Error(`Language ${language} is currently not supported.`);
    }

    // Creating a temporary directory for this specific submission
    const tempDirName = crypto.randomUUID();
    const tempDirPath = path.join(os.tmpdir(), tempDirName); // returns the absolute path of the OS' default directory for temporary files.
    const filePath = path.join(tempDirPath, config.fileName);

    try {
        await fs.mkdir(tempDirPath, {recursive: true});
        await fs.writeFile(filePath, code);

        // 1. Compilation Step (if applicable)
        if (config.compile) {
            const compileResult = await runInDockerHelper(tempDirPath, config.image, config.compile.command, config.compile.args);
            if (compileResult.status !== "Success") {
                return {
                    verdict: "Compilation Error",
                    output: compileResult.output
                };
            }
        }

        // 2. Execution Step
        for (const testCase of testCases) {
            const result = await runInDockerHelper(tempDirPath, config.image, config.run.command, config.run.args, testCase.input);

            if (result.status !== "Success") {
                // This will catch "Time Limit Exceeded" or "Runtime Error"
                return {
                    verdict: result.status,
                    failedAtTestCase: testCase.id,
                    output: result.output
                };
            }

            if (result.output !== testCase.output) {
                return {
                    verdict: "Wrong Answer",
                    failedAtTestCase: testCase.id,
                    input: testCase.input,
                    output: result.output,
                    expectedOutput: testCase.output
                };
            }
        }

        // If the code has survived the above loop, then it has passed all the hidden test cases
        return {
            verdict: "Accepted",
        };
    }
    catch (error) {
        console.error("Evaluation error: ", error);
        return {
            verdict: "System Error",
            error: "An unexpected error occured in the evaluation engine."
        };
    }
    finally {
        // Cleanup
        try {
            await fs.rm(tempDirPath, {recursive: true, force: true});
        }
        catch (cleanupError) {
            console.error(`Failed to clean up the temporary directory ${tempDirPath}: `, cleanupError);
        }
    }
};