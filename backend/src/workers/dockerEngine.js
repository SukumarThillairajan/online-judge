import {exec} from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';

// Promisifying 'exec' which is by default callback-based into Promise or Async-Await -based.
const execPromise = util.promisify(exec);

//-----------------------
// Sandbox resource limits
//-----------------------

// The hard memory ceiling for a single execution.
// IMPORTANT: '--memory-swap' MUST be passed alongside '--memory' and set to the SAME value.
// If '--memory-swap' is omitted, Docker silently defaults it to (2 x --memory), which lets a
// submission use 256 MB of RAM PLUS 256 MB of swap before the kernel steps in. Setting both to
// the same value disables swap for the container entirely and makes the limit a true 256 MB.
const MEMORY_LIMIT = "256m";

// A container killed by the kernel's OOM killer receives SIGKILL (signal 9),
// and Docker surfaces that to the CLI as exit code 128 + 9 = 137.
const OOM_EXIT_CODE = 137;

// The wall-clock ceiling for a single test case execution.
const TIME_LIMIT_MS = 3000;

export const languageConfigs = {
    c: {
        fileName: "main.c",
        dockerImage: "gcc-alpine",
        compileCommand: "gcc -fsanitize=address,undefined -fno-sanitize-recover=all -g", // adding an AddressSanitizer(ASan) to flag invalid memory access to be an RTE
        compileArgs: ["-Wall", "-Werror", "/app/main.c", "-o", "/app/main", "-lubsan", "-lasan", "-lstdc++"], // adding an UndefinedBehaviourSanitizer(UBSan) to flag other common issues like Integer overflows, and so on.
        runCommand: "/app/main",
        runArgs: []
    },
    cpp: {
        fileName: "main.cpp",
        dockerImage: "gcc-alpine",
        compileCommand: "g++ -fsanitize=address,undefined -fno-sanitize-recover=all -g",
        compileArgs: ["-Wall", "-Werror", "/app/main.cpp", "-o", "/app/main", "-lubsan", "-lasan", "-lstdc++"],
        runCommand: "/app/main",
        runArgs: []
    },
    java: {
        fileName: "Main.java",
        dockerImage: "amazoncorretto:21-alpine",
        compileCommand: "javac",
        compileArgs: ["-Xlint:all", "-Werror", "/app/Main.java"],
        runCommand: "java",
        runArgs: ["Main"]
    },
    python: {
        fileName: "main.py",
        dockerImage: "python:3.11-slim",
        compileCommand: "python -m py_compile", // This acts as a syntax check
        compileArgs: ["/app/main.py"],
        runCommand: "python",
        runArgs: ["-W", "error", "/app/main.py"]
    },
    javascript: {
        fileName: "main.js",
        dockerImage: "node:20-alpine",
        compileCommand: "node -c", // This acts as a syntax check
        compileArgs: ["/app/main.js"],
        runCommand: "node",
        runArgs: ["--use_strict", "--throw-deprecation", "/app/main.js"]
    }
}

// Compiles the code (if applicable)
export const compileCode = async(hostDirPath, language) => {
    const config = languageConfigs[language];

    // If the language doesn't have a compileCommand, immediately return success for compilation.
    if (!config.compileCommand) {
        return {success: true};
    }

    const fullCompileCommand = `${config.compileCommand} ${config.compileArgs.join(" ")}`;
    const compileDockerCommand = `docker run --rm -v "${hostDirPath}:/app" -w /app ${config.dockerImage} sh -c "${fullCompileCommand}"`;

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
export const runCode = async(workerDirPath, hostDirPath, language, inputData) => {
    const config = languageConfigs[language];

    // Writing the test case input into a file
    // Node.js writes the file using the path inside its own container (workerDirPath)
    const inputFilePath = path.join(workerDirPath, "input.txt");
    await fs.writeFile(inputFilePath, inputData || "");

    const fullRunCommand = `${config.runCommand} ${config.runArgs.join(" ")}`;
    const runDockerCommand = `docker run --rm --network none --memory ${MEMORY_LIMIT} --memory-swap ${MEMORY_LIMIT} -v "${hostDirPath}:/app" -w /app ${config.dockerImage} sh -c "${fullRunCommand} < /app/input.txt"`;

    try {
        const {stdout, stderr} = await execPromise(runDockerCommand, { timeout: TIME_LIMIT_MS });
        return {
            success: true,
            output: stdout.trim()
        };
    }
    catch (error) {
        // 1. Time Limit Exceeded.
        // Node's own 'exec' timeout fired and killed the docker client with SIGTERM.
        // This is checked FIRST because a timed-out process has no meaningful exit code to inspect.
        if (error.killed && error.signal === 'SIGTERM') {
            return {
                success: false,
                error: "Time Limit Exceeded",
                details: `The process did not finish within the ${TIME_LIMIT_MS / 1000}-second time limit and was terminated.`
            };
        }

        // 2. Memory Limit Exceeded.
        // The container blew past the cgroup ceiling and the kernel's OOM killer sent SIGKILL,
        // which Docker reports as exit code 137. Since the sandbox runs with '--network none'
        // and nothing else on the host targets these containers, a 137 here is an OOM kill.
        if (error.code === OOM_EXIT_CODE) {
            return {
                success: false,
                error: "Memory Limit Exceeded",
                details: `The process exceeded the ${MEMORY_LIMIT.toUpperCase()} memory limit and was terminated.`
            };
        }

        return {
            success: false,
            error: "Runtime Error",
            details: error.stderr || "Process crashed during execution."
        };
    }
};