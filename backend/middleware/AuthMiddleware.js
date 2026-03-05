import { Consts } from "../lib/Consts.js";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import jwt from "jsonwebtoken";
import { Op } from 'sequelize'; // Import Sequelize operators

function authenticate(request, response, next) {
    try {
        // Get token from either Authorization header or access-token header
        const authHeader = request.headers['authorization'];
        const token = authHeader ? authHeader.split(' ')[1] : request.headers['access-token'];
        
        if (Utils.isEmpty(token)) {
            return response.status(Consts.unAuthorized).json({
                status: Consts.unAuthorized,
                message: "No token provided",
                error: "Missing authentication token"
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env['JWT_KEY']);
        } catch (err) {
            console.error('JWT verification error:', err);
            return response.status(Consts.unAuthorized).json({
                status: Consts.unAuthorized,
                message: "Invalid token",
                error: err.message
            });
        }

        // Validate session in database
        DatabaseManager.user.findOne({
            attributes: ["userID", "name", "phone", "session", "email", "expiry", "role", "status"],
            where: { 
                session: decoded.session,
                expiry: { [Op.gte]: new Date() } // Use the imported Op operator
            }
        }).then((user) => {
            if (!user) {
                return response.status(Consts.unAuthorized).json({
                    status: Consts.unAuthorized,
                    message: "Session expired or invalid",
                    error: "No active session found"
                });
            }
            
            // Attach user to request
            request.user = user.get({ plain: true });
            next();
        }).catch((err) => {
            console.error('Database error:', err);
            response.status(Consts.httpCodeServerError).json({
                status: Consts.httpCodeServerError,
                message: "Authentication failed",
                error: "Database error"
            });
        });

    } catch (err) {
        console.error('Authentication middleware error:', err);
        response.status(Consts.httpCodeServerError).json({
            status: Consts.httpCodeServerError,
            message: "Authentication failed",
            error: err.message
        });
    }
}

export default authenticate;