import express from 'express';
import { register, login, logout } from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

// Initializing the express router
const router = express.Router();

// Route: POST /api/auth/register
// Purpose: Create a new user and return a JWT cookie
router.post("/register", register);

// Route: POST /api/auth/login
// Purpose: Authenticate a user and return a JWT cookie
router.post("/login", login);

// Route: POST /api/auth/logout
// Purpose: Clear the JWT cookie from the user's browser
router.post("/logout", logout);

// Route: GET /api/auth/verify
// Purpose: Verify the JWT token and return user info if valid
router.get("/verify", requireAuth, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Token is valid",
        user: req.user
    });
});

export default router;