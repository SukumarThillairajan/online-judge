import Redis from "ioredis";
import {Queue} from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// Validating that the Redis connection details are set in the environment variables.
if (!process.env.REDIS_HOST) {
    console.error("FATAL ERROR: REDIS_HOST is not defined in the environment variables.");
    process.exit(1); // Exit the application with a failure code.
}
if (!process.env.REDIS_PORT) {
    console.error("FATAL ERROR: REDIS_PORT is not defined in the environment variables.");
    process.exit(1); // Exit the application with a failure code.
}

// Establishing the Redis connection
export const redisConnection = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    maxRetriesPerRequest: null, // BullMQ requires this to be null to handle blocking commands correctly.
    enableReadyCheck: true, // ioredis will check the status of the Redis server and emit a ready event when the server is able to process commands.
});

// Event listeners for the Redis connection to provide better logging and error handling.
redisConnection.on("connect", () => console.log("Successfully connected to Redis for BullMQ."));
redisConnection.on("ready", () => console.log("Redis connection is ready."));
redisConnection.on("error", (err) => {
    console.error("Redis connection error:", err);
    console.error("FATAL ERROR: Could not maintain Redis connection. Exiting..."); 
    process.exit(1); // If Redis is critical, the application cannot function without it.
});

// Initializing the BullMQ queue
export const submissionQueue = new Queue("submissionQueue", {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: {
            count: 1000, // Keep the last 1000 completed jobs for auditing
            age: 24 * 60 * 60, // Keep for up to 24 hours
        },
        attempts: 3, // If the job stalls/crashes, retry for a maximum of 3 times
        backoff: { // If a job fails, then wait for 1s, then 2s, then 4s and so on before retrying
            type: "exponential",
            delay: 1000
        }
    }
});

// Listen for queue-level errors
submissionQueue.on("error", (err) => {
    console.error("BullMQ queue error: ", err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log("SIGINT signal received: Closing BullMQ Redis connection.");
    await submissionQueue.close();
    console.log("BullMQ queue and Redis connection have been closed.");
    process.exit(0);
});