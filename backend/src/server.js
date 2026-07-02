import express from 'express';
import dotenv from 'dotenv';

import authRoutes from "./modules/auth/auth.routes.js";

// Loading the environment variables from the .env file into the process.env object
dotenv.config();

// Initializing the Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Global Middlewares
app.use(express.json()); // Middleware to parse incoming JSON payloads. Without this req.body will be undefined for JSON requests.

// Router Mounting
app.use("/api/auth", authRoutes); // any request starting with /api/auth will be handed off to authRoutes

// Base routes (Health check)
app.get("/", (req, res) => {
    res.status(200).json({ 
        status: "OK",
        message: "Server is running!" });
});

app.listen(PORT, () => {
    console.log(`Server is successfully running on port ${PORT}`); // backtick allows for string interpolation.
});