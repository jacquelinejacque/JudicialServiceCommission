import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Consts } from "../lib/Consts.js";
import Utils from "../lib/Utils.js";
import AuditService from "../lib/AuditService.js";
import { TicketActions } from "../lib/Consts.js";
import EmailService from "../lib/EmailService.js";

class TicketNoteLogic {
    static addTicketNote(authUser, body, file, callback) {
    async.waterfall(
        [
        // 1) Auth + validate input
        function (done) {
            if (!authUser || Utils.isEmpty(authUser.userID)) {
            return done({
                message: "Unauthorized",
                status: Consts.httpCodeUnauthorized,
            });
            }

            if (Utils.isEmpty(body.ticketID) && Utils.isEmpty(body.ticketNumber)) {
            return done({
                message: "ticketID or ticketNumber is required",
                status: Consts.httpCodeBadRequest,
            });
            }

            if (Utils.isEmpty(body.note) || String(body.note).trim().length === 0) {
            return done({
                message: "Note text is required",
                status: Consts.httpCodeBadRequest,
            });
            }

            done(null);
        },

        // 2) Fetch ticket
        function (done) {
            const where = {};
            if (!Utils.isEmpty(body.ticketID)) where.ticketID = body.ticketID;
            if (!Utils.isEmpty(body.ticketNumber)) where.ticketNumber = body.ticketNumber;

            DatabaseManager.helpdesk
            .findOne({ where })
            .then((ticket) => {
                if (!ticket) {
                return done({
                    message: "Ticket not found",
                    status: Consts.httpCodeNotFound,
                });
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

        // 3) Permission check: only admin or assigned agent
        function (ticket, done) {
            const isAdmin = authUser.role === "admin";
            const isAssignedAgent = ticket.assignedTo === authUser.userID;

            if (!isAdmin && !isAssignedAgent) {
            return done({
                message: "Forbidden: Only admins or assigned agents can add notes",
                status: Consts.httpCodeForbidden,
            });
            }

            done(null, ticket);
        },

        // 4) Normalize uploaded file path
        function (ticket, done) {
            let attachmentPath = null;

            if (file) {
            attachmentPath = file.path.replace(/\\/g, "/");
            }

            done(null, ticket, attachmentPath);
        },

        // 5) Create note + audit in one transaction
        function (ticket, attachmentPath, done) {
            DatabaseManager.sequelize
            .transaction(async (transaction) => {
                const notePayload = {
                ticketID: ticket.ticketID,
                note: String(body.note).trim(),
                attachment: attachmentPath,
                createdBy: authUser.userID,
                createdAt: new Date(),
                updatedAt: new Date(),
                };

                const note = await DatabaseManager.ticketNote.create(notePayload, {
                transaction,
                });

                await AuditService.log(
                {
                    ticketID: ticket.ticketID,
                    action: TicketActions.TICKET_NOTE_ADDED,
                    performedBy: authUser.userID,
                    reason: String(body.note).trim(),
                    description: `Note added to ticket ${ticket.ticketNumber} by ${authUser.name}`,
                    newValue: {
                    noteID: note.noteID,
                    note: note.note,
                    attachment: note.attachment,
                    originalFileName: file ? file.originalname : null,
                    },
                },
                { transaction }
                );

                await DatabaseManager.helpdesk.update(
                { updatedAt: new Date() },
                {
                    where: { ticketID: ticket.ticketID },
                    transaction,
                }
                );

                return { ticket, note };
            })
            .then((result) => done(null, result.ticket, result.note))
            .catch((err) =>
                done({
                message: "Failed to add ticket note",
                status: Consts.httpCodeServerError,
                error: err,
                })
            );
        },

        // 6) Fetch requester details
        function (ticket, note, done) {
            DatabaseManager.user
            .findOne({
                where: { userID: ticket.userID },
            })
            .then((requester) => {
                if (!requester) {
                return done({
                    message: "Requester not found",
                    status: Consts.httpCodeNotFound,
                });
                }

                done(null, ticket, note, requester);
            })
            .catch((err) =>
                done({
                message: "Failed to fetch requester",
                status: Consts.httpCodeServerError,
                error: err,
                })
            );
        },

        // 7) Notify requester
        function (ticket, note, requester, done) {
            if (!requester.email) {
            return done(null, ticket, note, {
                notificationSent: false,
                notificationMessage: "Note added successfully, but requester has no email",
            });
            }

            EmailService.sendTicketNoteAddedNotificationToRequester(
            {
                to: requester.email,
                requesterName: requester.name,
                agentName: authUser.name,
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                note: note.note,
                attachment: note.attachment,
                status: ticket.status,
            },
            function (err) {
                if (err) {
                return done(null, ticket, note, {
                    notificationSent: false,
                    notificationMessage: "Note added successfully, but notification failed",
                    notificationError: err,
                });
                }

                done(null, ticket, note, {
                notificationSent: true,
                notificationMessage: "Note added and requester notified successfully",
                });
            }
            );
        },
        ],
        function (err, ticket, note, notificationResult) {
        if (err) {
            return callback({
            status: err.status || Consts.httpCodeServerError,
            message: err.message || "Failed to add note",
            error: err.error || err,
            });
        }

        return callback({
            status: Consts.httpCodeSuccess,
            message:
            (notificationResult && notificationResult.notificationMessage) ||
            "Note added successfully",
            ticket: {
            ticketID: ticket.ticketID,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            status: ticket.status,
            },
            note,
            notificationSent:
            (notificationResult && notificationResult.notificationSent) || false,
            notificationError:
            notificationResult && notificationResult.notificationError
                ? notificationResult.notificationError
                : null,
        });
        }
    );
    }

    static listTicketNotes(authUser, ticketID, callback) {
        async.waterfall(
            [
                // 1) Validate auth + input
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({
                            message: "Unauthorized",
                            status: Consts.httpCodeUnauthorized,
                        });
                    }

                    if (Utils.isEmpty(ticketID)) {
                        return done({
                            message: "ticketID is required",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    done(null);
                },

                // 2) Fetch ticket
                function (done) {
                    DatabaseManager.helpdesk
                        .findOne({
                            where: { ticketID },
                            include: [
                                {
                                    model: DatabaseManager.user,
                                    as: "requester",
                                    attributes: ["userID", "name", "email", "phone", "role"],
                                    required: false,
                                },
                                {
                                    model: DatabaseManager.user,
                                    as: "agent",
                                    attributes: ["userID", "name", "email", "phone", "role"],
                                    required: false,
                                },
                            ],
                        })
                        .then((ticket) => {
                            if (!ticket) {
                                return done({
                                    message: "Ticket not found",
                                    status: Consts.httpCodeNotFound,
                                });
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

                // 3) Check access permissions
                function (ticket, done) {
                    const isAdmin = authUser.role === "admin";
                    const isOwner = ticket.userID === authUser.userID;
                    const isAssignedAgent = ticket.assignedTo === authUser.userID;

                    if (!isAdmin && !isOwner && !isAssignedAgent) {
                        return done({
                            message: "Forbidden",
                            status: Consts.httpCodeForbidden,
                        });
                    }

                    done(null, ticket);
                },

                // 4) Fetch notes
                function (ticket, done) {
                    DatabaseManager.ticketNote
                        .findAll({
                            where: { ticketID: ticket.ticketID },
                            include: [
                                {
                                    model: DatabaseManager.user,
                                    as: "author",
                                    attributes: ["userID", "name", "email", "role"],
                                    required: false,
                                },
                            ],
                            order: [["createdAt", "ASC"]],
                        })
                        .then((notes) => {
                            const baseUrl = process.env.BASE_URL || "";

                            const formattedNotes = (notes || []).map((note) => {
                                const plainNote = note.get({ plain: true });

                                return {
                                    ...plainNote,
                                    attachmentUrl: plainNote.attachment
                                        ? `${baseUrl.replace(/\/$/, "")}/${plainNote.attachment.replace(/^\/+/, "")}`
                                        : null,
                                };
                            });

                            done(null, ticket, formattedNotes);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch ticket notes",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },
            ],
            function (err, ticket, notes) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to fetch ticket notes",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket notes fetched successfully",
                    ticket: {
                        ticketID: ticket.ticketID,
                        ticketNumber: ticket.ticketNumber,
                        title: ticket.title,
                        status: ticket.status,
                        issueType: ticket.issueType,
                        priority: ticket.priority,
                        requester: ticket.requester || null,
                        agent: ticket.agent || null,
                        createdAt: ticket.createdAt,
                        updatedAt: ticket.updatedAt,
                    },
                    notes,
                });
            }
        );
    }

}

export default TicketNoteLogic;