import dotenv from 'dotenv';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';

// Loads the variable from the .env file into the Node.js' process.env object
dotenv.config();

// Validating that the DATABASE_URL is set.
if (!process.env.DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL is not defined in the environment variables.");
    process.exit(1); // Exit the application with a failure code.
}

// Initializing the PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000, // 5 seconds
});

// Wrapping the connection pool with Drizzle ORM
export const db = drizzle(pool);

export const testDbConnection = async () => {
    try {
        console.log("Attempting to connect to the database...");

        const client = await pool.connect();

        console.log("Database connection successful!");

        client.release();
    }
    catch (error) {
        console.error("Database connection failed: ", error.message);
        process.exit(1); // Exit the application if the initial connection fails.
    }
}

export const closeDbConnection = async () => {
    await pool.end();
};