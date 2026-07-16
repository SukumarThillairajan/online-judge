import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {testDbConnection, closeDbConnection} from "./database/db_connector.js";
import {submissionQueue} from "./queues/submissionQueue.js";

import authRoutes from "./modules/auth/auth.routes.js";
import problemRoutes from "./modules/problems/problem.routes.js";
import submissionRoutes from "./modules/submissions/submission.routes.js";

// Loading the environment variables from the .env file into the process.env object
dotenv.config();

// Validating that the JWT_SECRET_KEY is set.
if (!process.env.JWT_SECRET_KEY) {
    console.error("FATAL ERROR: JWT_SECRET_KEY is not defined in the environment variables.");
    process.exit(1); // Exit the application with a failure code.
}

// Initializing the Express application
const app = express();
const PORT = process.env.PORT || 3000; // Defaulting to the standard Node.js/Express.js server port 3000.

// Global Middlewares
app.use(express.json()); // Middleware to parse incoming JSON payloads. Without this req.body will be undefined for JSON requests.
app.use(cookieParser());

// Adding all the trusted frontends to this array
const allowedOrigins = [
  'http://localhost:3000', // For my local development
  'https://online-judge-sable.vercel.app', // For V1 production
  "https://online-judge-ij4lyt74n-sukumar-s-team.vercel.app",
];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
    }
    return callback(null, true);
  },
  credentials: true, // This is MANDATORY for your JWT cookies to work
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Router Mounting
app.use("/api/auth", authRoutes); // any request starting with /api/auth will be handed off to authRoutes
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);

// Base routes (Health check)
app.get("/", (req, res) => {
    res.status(200).json({ 
        status: "OK",
        message: "Server is running!" });
});

// Test the database connection when the server starts
await testDbConnection();

app.listen(PORT, () => {
    console.log(`Server is successfully running on port http://localhost:${PORT}`); // backtick allows for string interpolation.
});

// Centralized Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('SIGINT signal received: Closing connections gracefully.');
    try {
        await submissionQueue.close();
        console.log('BullMQ queue and Redis connection have been closed.');
        await closeDbConnection();
        console.log('Database pool has been closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown: ', error);
        process.exit(1);
    }
});