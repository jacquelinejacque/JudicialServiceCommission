import { Consts } from "../lib/Consts.js";
import DatabaseManager from "../lib/DatabaseManager.js";
import AuditService from "../lib/AuditService.js";
import async from "async";
import Utils from "../lib/Utils.js";

class TicketHistoryLogic {
    static getTicketHistory(authUser, ticketID, callback) {
        async.waterfall(
            [
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
                    }

                    if (Utils.isEmpty(ticketID)) {
                        return done({ message: "ticketID is required", status: Consts.httpCodeBadRequest });
                    }

                    DatabaseManager.helpdesk.findOne({ where: { ticketID } })
                        .then((ticket) => {
                            if (!ticket) {
                                return done({ message: "Ticket not found", status: Consts.httpCodeNotFound });
                            }

                            const isAdmin = authUser.role === "admin";
                            const isOwner = ticket.userID === authUser.userID;
                            const isAssignee = ticket.assignedTo === authUser.userID;

                            if (!isAdmin && !isOwner && !isAssignee) {
                                return done({ message: "Forbidden", status: Consts.httpCodeForbidden });
                            }

                            done(null, ticket);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                function (ticket, done) {
                    DatabaseManager.ticketHistory.findAll({
                        where: { ticketID: ticket.ticketID },
                        order: [["createdAt", "ASC"]],
                        include: [
                            {
                                model: DatabaseManager.user,
                                as: "actor",
                                attributes: ["userID", "name", "email"],
                                required: false,
                            },
                            {
                                model: DatabaseManager.user,
                                as: "fromUser",
                                attributes: ["userID", "name", "email"],
                                required: false,
                            },
                            {
                                model: DatabaseManager.user,
                                as: "toUser",
                                attributes: ["userID", "name", "email"],
                                required: false,
                            },
                        ],
                    })
                    .then((history) => done(null, history))
                    .catch((err) =>
                        done({
                            message: "Failed to fetch ticket history",
                            status: Consts.httpCodeServerError,
                            error: err,
                        })
                    );
                },
            ],
            function (err, history) {
                if (err) {
                    return callback(err);
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket history fetched successfully",
                    history,
                });
            }
        );
    }
}

export default TicketHistoryLogic;