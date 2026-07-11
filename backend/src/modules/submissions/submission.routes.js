import express from 'express';

import {requireAuth} from "../../middlewares/auth.middleware.js";

import {
    createSubmission, 
    runCustomCode,
    getSubmissionStatus,
    getMySubmissionsForProblem,
    getAllSubmissionsForProblem,
    getMySubmissions
} from "./submission.controller.js";

const router = express.Router();

// Route: POST /api/submissions/submit
// Purpose: Creates and queues a new code submission against hidden test cases
router.post("/submit", requireAuth, createSubmission);

// Route: POST /api/submissions/run
// Purpose: Queues a code execution job against custom and sample test cases
router.post("/run", requireAuth, runCustomCode);

// Route: GET /api/submissions/me
// Purpose: 
router.get("/me", requireAuth, getMySubmissions);

// Route: GET /api/submissions/problem/:problemId/me
// Purpose:
router.get("/problem/:problemId/me", requireAuth, getMySubmissionsForProblem);

// Route: GET /api/submissions/problem/:problemId/all
// Purpose:
router.get("/problem/:problemId/all", requireAuth, getAllSubmissionsForProblem);

// Route: GET /api/submissions/:id/status
// Purpose:
router.get("/:id/status", requireAuth, getSubmissionStatus);

export default router;