import jwt, {TokenExpiredError, JsonWebTokenError} from 'jsonwebtoken';

// Verifies the JWT to ensure that the user is logged-in.
// Only if the token is valid, requireAuth middleware attaches it to the request object.
export const requireAuth = (req, res, next) => { // 'next' is a callback function to pass control from the current middleware to the next.
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: No token provided"
            });
        }

        // Verifying the token, using our JWT Secret Key
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // this is synchronous verification

        // Attaching the decoded user payload to the request object
        req.user = decoded;

        // Passing the control over to the next middleware
        next();
    }
    catch (error) {
        if (error.name === "TokenExpiredError") {
            console.error("JWT Verification Error: Token has expired.");
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token has expired. Please log in again."
            });
        }

        if (error.name === "JsonWebTokenError") {
            console.warn(`JWT Verification Error: Malformed/Tampered JWT attempted from IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid token."
            });
        }

        // For other errors
        console.error("Unexpected JWT error: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during JWT verification."
        });
    }
};

// Checks if the "logged-in" user has the ADMIN role.
export const requireAdmin = (req, res, next) => {
    try {
        if (!req.user || req.user.role !== "ADMIN") {
            console.warn(`User ${req.user.userId} attempted unauthenticated/unauthorized access to Admin routes. IP: ${req.ip}`);
            return res.status(403).json({
                success: false,
                message: "Forbidden: You do not have the Admin privileges"
            });
        }

        next();
    }
    catch (error) {
        console.error("Admin Authorization Error: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during Admin Authorization"
        });
    }
};