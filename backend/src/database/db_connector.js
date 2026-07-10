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

// Graceful shutdown
// process.on() is used to attach event listeners to the 'process' object (a global object representing the current Node.js process).
process.on('SIGINT', async () => { // writing a callback function (event listener) to close the DB pool, once "Ctrl + C" (SIGINT) is hit in the terminal (i.e, the server is shutdown).
    console.log('SIGINT signal received: Closing DB pool');
    await pool.end();
    console.log('DB pool has been closed');
    process.exit(0);
});