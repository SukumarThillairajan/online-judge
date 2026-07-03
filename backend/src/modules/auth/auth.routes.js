import express from 'express';
import {register, login, logout} from "./auth.controller.js";

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

export default router;