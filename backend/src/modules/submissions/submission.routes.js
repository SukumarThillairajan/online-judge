import express from 'express';

import {requireAuth} from "../../middlewares/requireAuth.js";

import {createSubmission, runCustomCode} from "./submission.controller.js";

const router = express.Router();

// Route: POST /api/submissions/submit
// Purpose: Creates and queues a new code submission against hidden test cases
router.post("/submit", requireAuth, createSubmission);

// Route: POST /api/submissions/run
// Purpose: Queues a code execution job against custom and sample test cases
router.post("/run", requireAuth, runCustomCode);

export default router;