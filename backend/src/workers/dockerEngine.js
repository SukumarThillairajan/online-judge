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
        compileCommand: "gcc -fsanitize=address,undefined -g", // adding an AddressSanitizer(ASan) to flag invalid memory access to be an RTE
        compileArgs: ["/app/main.c", "-o", "/app/main", "-lubsan", "-lasan", "-lstdc++"], // adding an UndefinedBehaviourSanitizer(UBSan) to flag other common issues like Integer overflows, and so on.
        runCommand: "/app/main",
        runArgs: []
    },
    cpp: {
        fileName: "main.cpp",
        dockerImage: "gcc-alpine",
        compileCommand: "g++ -fsanitize=address,undefined -g", // adding an AddressSanitizer(ASan) to flag invalid memory access to be an RTE
        compileArgs: ["/app/main.cpp", "-o", "/app/main", "-lubsan", "-lasan", "-lstdc++"], // adding an UndefinedBehaviourSanitizer(UBSan) to flag other common issues like Integer overflows, and so on.
        runCommand: "/app/main",
        runArgs: []
    },
    java: {
        fileName: "Main.java",
        dockerImage: "amazoncorretto:21-alpine",
        compileCommand: "javac",
        compileArgs: ["/app/Main.java"],
        runCommand: "java",
        runArgs: ["Main"]
    },
    python: {
        fileName: "main.py",
        dockerImage: "python:3.11-slim",
        compileCommand: "", // Python is an Interpreted language
        compileArgs: [],
        runCommand: "python",
        runArgs: ["/app/main.py"]
    },
    javascript: {
        fileName: "main.js",
        dockerImage: "node:20-alpine",
        compileCommand: "", // JavaScript is an Interpreted language
        compileArgs: [],
        runCommand: "node",
        runArgs: ["/app/main.js"]
    }
}

// Compiles the code (if applicable)
export const compileCode = async(tempDirPath, language) => {
    const config = languageConfigs[language];

    // If the language doesn't have a compileCommand, immediately return success for compilation.
    if (!config.compileCommand) {
        return {success: true};
    }

    const fullCompileCommand = `${config.compileCommand} ${config.compileArgs.join(" ")}`;
    const compileDockerCommand = `docker run --rm -v "${tempDirPath}:/app" -w /app ${config.dockerImage} sh -c "${fullCompileCommand}"`;

    try {
        await execPromise(compileDockerCommand, {timeout: 10000}); // max 10s for compilation
        return {success: true};
    }
    catch (error) {
        return {
            success: false,
            error: "Compilation Error",
            details: error.stderr || error.message || "Unknown compilation failure."
        };
    }
};

// Runs the code against a single testcase
export const runCode = async(tempDirPath, language, inputData) => {
    const config = languageConfigs[language];

    // Writing the test case input into a file
    const inputFilePath = path.join(tempDirPath, "input.txt");
    await fs.writeFile(inputFilePath, inputData || "");

    const fullRunCommand = `${config.runCommand} ${config.runArgs.join(" ")}`;
    const runDockerCommand = `timeout 3 docker run --rm --network none --memory 256m -v "${tempDirPath}:/app" -w /app ${config.dockerImage} sh -c "cat /app/input.txt | ${fullRunCommand}"`;

    try {
        const {stdout, stderr} = await execPromise(runDockerCommand);
        return {
            success: true,
            output: stdout.trim()
        };
    }
    catch (error) {
        if (error.code == 124 || error.killed) {
            return { // error.code 124 is the exit code for the 'timeout' command
                success: false,
                error: "Time Limit Exceeded",
            };
        }

        return {
            success: false,
            error: "Runtime Error",
            details: error.stderr || "Process crashed during execution."
        };
    }
};