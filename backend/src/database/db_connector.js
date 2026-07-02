import dotenv from 'dotenv';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';

// Loads the variable from the .env file into the Node.js' process.env object
dotenv.config();

// Initializing the PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Wrapping the connection pool with Drizzle ORM
export const db = drizzle(pool);