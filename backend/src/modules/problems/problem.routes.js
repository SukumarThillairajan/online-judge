import express from 'express';
import {requireAuth, requireAdmin} from "../../middlewares/auth.middleware.js";
import {getAllProblems, getProblemById, createProblem, deleteProblem} from "./problem.controller.js";

// Initializing the express router
const router = express.Router();

//--------------------------
// Public Routes (for Users)
//--------------------------

// Route: GET /api/problems/
// Purpose: Fetch all problems for the dashboard
router.get("/", getAllProblems);

// Route: GET /api/problems/:id
// Purpose: Fetch a problem by its problem ID
router.get("/:id", getProblemById);

//-------------
// Admin Routes
//-------------

// Route: POST /api/problems/
// Purpose: Create a new problem
router.post("/", requireAuth, requireAdmin, createProblem); // the middleware execution order is important here to ensure proper RBAC.

// Route: DELETE /api/problems/:id
// Purpose: Delete a problem by its problem ID
router.delete("/:id", requireAuth, requireAdmin, deleteProblem);

export default router;