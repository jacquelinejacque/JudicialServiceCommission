import { Consts } from "../lib/Consts.js";
import DatabaseManager from "../lib/DatabaseManager.js";
import AuditService from "../lib/AuditService.js";
import async from "async";
import Utils from "../lib/Utils.js";

class DisciplinaryRecordHistoryLogic {
    static getDisciplinaryRecordHistory(authUser, recordID, callback) {
        async.waterfall(
            [
                // 1️⃣ Validate user + record existence + authorization
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
                    }

                    if (Utils.isEmpty(recordID)) {
                        return done({ message: "recordID is required", status: Consts.httpCodeBadRequest });
                    }

                    DatabaseManager.disciplinaryRecord.findOne({ where: { recordID } })
                        .then((record) => {
                            if (!record) {
                                return done({ message: "Disciplinary record not found", status: Consts.httpCodeNotFound });
                            }

                            const isAdmin = authUser.role === "admin";
                            const isAssignee = record.assignedTo === authUser.userID;

                            if (!isAdmin && !isAssignee) {
                                return done({ message: "Forbidden", status: Consts.httpCodeForbidden });
                            }

                            done(null, record);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch disciplinary record",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 2️⃣ Fetch history
                function (record, done) {
                    DatabaseManager.disciplinaryHistory.findAll({
                        where: { recordID: record.recordID },
                        order: [["createdAt", "ASC"]],
                        include: [
                            {
                                model: DatabaseManager.user,
                                as: "actor",
                                attributes: ["userID", "name", "email"],
                                required: false,
                            },
                        ],
                    })
                    .then((history) => done(null, history))
                    .catch((err) =>
                        done({
                            message: "Failed to fetch disciplinary history",
                            status: Consts.httpCodeServerError,
                            error: err,
                        })
                    );
                },
            ],

            // 3️⃣ Final response (formatted)
            function (err, history) {
                if (err) {
                    return callback(err);
                }

                const formattedHistory = history.map(item => {
                    const h = item.toJSON();

                    return {
                        historyID: h.historyID,
                        recordID: h.recordID,
                        action: h.action,

                        // ✅ Include name instead of just userID
                        performedBy: h.actor
                            ? {
                                userID: h.actor.userID,
                                name: h.actor.name,
                                email: h.actor.email
                            }
                            : null,

                        // ✅ Parse JSON values safely
                        previousValue: h.previousValue
                            ? (typeof h.previousValue === "string" ? JSON.parse(h.previousValue) : h.previousValue)
                            : null,

                        newValue: h.newValue
                            ? (typeof h.newValue === "string" ? JSON.parse(h.newValue) : h.newValue)
                            : null,

                        createdAt: h.createdAt
                    };
                });

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Disciplinary record history fetched successfully",
                    history: formattedHistory,
                });
            }
        );
    }
    
}

export default DisciplinaryRecordHistoryLogic;