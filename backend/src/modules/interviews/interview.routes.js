import express from 'express';
import rateLimit from 'express-rate-limit';
import {requireAuth} from "../../middlewares/auth.middleware.js";
import {startInterview, streamInterviewChat, finishInterviewAndGrade, saveCode} from "./interview.controller.js";

const router = express.Router();

// Rate limiter to prevent abuse of the AI endpoints.
// 6 requests per minute from a single IP is generous for a human user
// but perfectly blocks malicious scripts or rapid-fire spam.
const interviewLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 6, // limit each IP to 6 requests per windowMs
    message: { error: 'Too many requests from this IP. Please try again after a minute.' },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// Route to initialize the interview session
router.post("/start", requireAuth, interviewLimiter, startInterview);

// Route to autosave the live editor contents (No need to rate limit this, since no AI call is involved; and the frontend already debounces it)
router.post("/code", requireAuth, saveCode);

// Chatting route using Server-Sent Events (SSE) (Protected by Rate Limiter)
router.post("/chat", requireAuth, interviewLimiter, streamInterviewChat);

// Route to finish the interview and grade (Protected by Rate Limiter)
router.post("/finish", requireAuth, interviewLimiter, finishInterviewAndGrade);

export default router;