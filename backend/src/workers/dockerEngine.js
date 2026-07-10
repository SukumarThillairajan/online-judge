import {exec} from 'child_process';
import util from 'util';
import {v4 as uuidv4} from 'uuid';
import path from 'path';
import fs from 'fs/promises';

// Promisifying 'exec' which is by default callback-based into Promise or Async-Await -based.
const execPromise = util.promisify(exec);

export const languageConfigs = {
    c: {
        fileName: "main.c",
        dockerImage: "gcc-alpine",
        compileCommand: "gcc /app/main.c -o /app/main",
        runCommand: "timeout 2s /app/main < /app/input.txt"
    },
    cpp: {
        fileName: "main.cpp",
        dockerImage: "gcc-alpine",
        compileCommand: "g++ /app/main.cpp -o /app/main",
        runCommand: "timeout 2s /app/main < /app/input.txt"
    },
    java: {
        fileName: "Main.java",
        dockerImage: "amazoncorretto:21-alpine",
        compileCommand: "javac /app/Main.java",
        runCommand: "timeout 2s java Main < /app/input.txt"
    },
    python: {
        fileName: "main.py",
        dockerImage: "python:3.11-slim",
        compileCommand: "",
        runCommand: "timeout 2s python /app/main.py < /app/input.txt"
    },
    javascript: {
        fileName: "main.js",
        dockerImage: "node:20-alpine",
        compileCommand: "",
        runCommand: "timeout 2s node /app/main.js < /app/input.txt"
    }
}

export const runCodeInDocker = async(code, language, input = "") => {
    const config = languageConfigs[language];
    // Validation
    if (!config) {
        return {
            success: false,
            error: "Unsupported language."
        };
    }

    try {
        const {fileName, dockerImage, compileCommand, runCommand} = config;

        // Creating a temporary directory for this specific execution
        const jobId = uuidv4();
        const tempDirPath = path.join(process.cwd(), "temp", jobId); // process.cwd() gives the Current Working Directory of the Node.js process
        await fs.mkdir(tempDirPath, {recursive: true});

        // Writing user's code and input to the local temporary folder
        const codeFilePath = path.join(tempDirPath, fileName);
        await fs.writeFile(codeFilePath, code);
        const inputFilePath = path.join(tempDirPath, "input.txt");
        await fs.writeFile(inputFilePath, input);

        // --rm : Automatically delete container after it finishes
        // -v : Volume Mount the local temp folder into the container at /app
        // --memory="256m" & --cpus="1.0" : Prevent infinite loops from crashing your actual computer
        // --network none : Prevent the user's code from making malicious internet requests
        const baseDockerCommand = `docker run --rm --memory="256m" --cpus="1.0" --network none -v "${tempDirPath}:/app" ${dockerImage}`;

        // Compilation Step (if applicable)
        if (compileCommand) {
            const compileDockerCommand = `${baseDockerCommand} sh -c "${compileCommand}"`;

            try {
                await execPromise(compileDockerCommand, {timeout: 5000});
            }
            catch (error) {
                return {
                    success: false,
                    error: "Compilation Error",
                    details: error.stderr ? error.stderr.trim() : "Unknown compilation failure."
                };
            }
        }

        // Execution Step
        const runDockerCommand = `${baseDockerCommand} sh -c "${runCommand}"`;
        try {
            const {stdout} = await execPromise(runDockerCommand, {timeout: 3000}); // 3s hard timeout on exec

            return {
                success: true,
                output: stdout.trim(),
                error: ""
            };
        }
        catch (error) {
            if (error.code === 124) { // Timeout exit code from 'timeout' utility
                return {
                    success: false,
                    error: "Time Limit Exceeded"
                };
            }
            if (error.killed) { // Node.js exec timeout
                return {
                    success: false,
                    error: "Time Limit Exceeded"
                };
            }

            return {
                success: false,
                error: "Runtime Error",
                details: error.stderr ? error.stderr.trim() : "Unknown runtime failure."
            };
        }
    }
    catch(error) {
        console.error("An unexpected error occurred in dockerEngine: ", error);
        return {
            success: false,
            error: "Internal System Error"
        };
    }
    finally {
        // Cleanup
        try {
            await fs.rm(tempDirPath, {recursive: true, force: true});
        }
        catch (cleanupError) {
            console.error(`Failed to cleanup the temporary directory ${tempDirPath}: `, cleanupError);
        }
    }
};