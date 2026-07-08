import {db} from "../../database/db_connector.js";
import {roleEnum, users} from "../../database/schema.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {eq} from "drizzle-orm";

export const register = async (req, res) => {
    try {
        // Destructuring the request body
        const {username, emailId, password, role} = req.body;

        if (!username || !emailId || !password) {
            return res.status(400).json({success: false, error: "All fields are required"});
        }

        // Salting and hashing the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Inserting the new user into the database
        const [newUser] = await db.insert(users).values({ // Array Destructuring to get the first element of the returned array.
            username,
            emailId,
            hashedPassword,
            role: role || roleEnum.user
        }).returning({ // returns an array of object/objects.
            userId: users.userId, // returning the newly generated userId for our JWT payload.
            username: users.username,
            role: users.role,
        });

        // Creating and signing a JWT.
        const token = jwt.sign(
            {userId: newUser.userId, role: newUser.role},
            process.env.JWT_SECRET_KEY,
            {expiresIn: '1d'}
        );

        res.cookie("token", token, {
            httpOnly: true, // prevents JavaScript from accessing the cookie, enhancing security against XSS attacks
            secure: process.env.NODE_ENV === "production", // 'secure' attribute ensures the cookie is sent over HTTPS only. It's set to true in production for added security.
            sameSite: "strict", // cookie will only be sent with same-site requests (not with any cross-site requests), enhancing CSRF protection.
            maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
        });

        res.status(201).json({success: true,message: "Registration successful", user: newUser});
    }
    catch (error) {
        // Unique violation error code for PostgreSQL
        if (error.code === "23505" || error.cause?.code === "23505") { // "Optional Chaining" is used to safely access nested object properties. If error.cause is undefined, it won't throw an error.
            res.status(400).json({success: false, error: "Username or Email-ID already exists"});
        } 
        else {
            console.error("Error during registration:", error);
            res.status(500).json({success: false, error: "Internal Server Error during Registration"});
        }
    }
};

export const login = async (req, res) => {
    try {
        const {emailId, password} = req.body;

        if (!emailId || !password) {
            return res.status(400).json({success: false, error: "All fields are required"});
        }

        const [user] = await db.select().from(users).where(eq(emailId, users.emailId));
        if (!user) {
            return res.status(401).json({success: false, error: "Invalid credentials"});
        }

        const isPasswordMatch = await bcrypt.compare(password, user.hashedPassword);
        if (!isPasswordMatch) {
            return res.status(401).json({success: false, error: "Invalid credentials"});
        }

        // If the user exists and the password matches, create a JWT token
        const token = jwt.sign(
            {userId: user.userId, role: user.role},
            process.env.JWT_SECRET_KEY,
            {expiresIn: '1d'}
        );

        // Attaching the token to an HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000 // 1 day in ms
        })

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                userId: user.userId,
                username: user.username,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({success: false, error: "Internal Server Error during Login"});
    }
};

export const logout = (req, res) => {
    // Clearing the cookie by name and matching the security attributes.
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    res.status(200).json({success: true,message: "Logout successful"});
};