import { Consts } from "../lib/Consts.js";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";

function authenticate(request, response, next) {
    try {
        const authHeader = request.headers["authorization"];
        const token = authHeader
            ? authHeader.split(" ")[1]
            : request.headers["access-token"];

        if (Utils.isEmpty(token)) {
            return response.status(Consts.unAuthorized).json({
                status: Consts.unAuthorized,
                message: "No token provided",
                error: "Missing authentication token"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env["JWT_KEY"]);
        } catch (err) {
            return response.status(Consts.unAuthorized).json({
                status: Consts.unAuthorized,
                message: "Invalid token",
                error: err.message
            });
        }

        // Load user + permissions from DB (SOURCE OF TRUTH)
        DatabaseManager.user.findOne({
            attributes: [
                "userID",
                "name",
                "phone",
                "session",
                "email",
                "team",
                "expiry",
                "roleID",
                "status"
            ],
            include: [
                {
                    model: DatabaseManager.role,
                    as: "role",
                    attributes: ["roleID", "roleName"],
                    include: [
                        {
                            model: DatabaseManager.rolePermission,
                            as: "rolePermissions",
                            include: [
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: [ "permissionID", "code", "module", "action" ]
                                }
                            ]
                        }
                    ]
                }
            ],
            where: {
                session: decoded.session,
                expiry: { [Op.gte]: new Date() }
            }
        })
        .then((user) => {
            if (!user) {
                return response.status(Consts.unAuthorized).json({
                    status: Consts.unAuthorized,
                    message: "Session expired or invalid",
                    error: "No active session found"
                });
            }

            const plainUser = user.get({ plain: true });

            // Extract permissions cleanly
            const permissions =
                plainUser.role?.rolePermissions?.map(
                    rp => rp.permission?.code
                ) || [];

            request.user = {
                ...plainUser,
                permissions
            };

            next();
        })
        .catch((err) => {
            console.error("Database error:", err);
            response.status(Consts.httpCodeServerError).json({
                status: Consts.httpCodeServerError,
                message: "Authentication failed",
                error: "Database error"
            });
        });

    } catch (err) {
        console.error("Authentication middleware error:", err);
        response.status(Consts.httpCodeServerError).json({
            status: Consts.httpCodeServerError,
            message: "Authentication failed",
            error: err.message
        });
    }
}

export default authenticate;