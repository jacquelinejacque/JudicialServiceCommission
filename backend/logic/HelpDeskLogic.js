import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Op, Sequelize } from "sequelize";
import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";
import nodemailer from "nodemailer";
import EmailService from "../lib/EmailService.js";
import AuditService from "../lib/AuditService.js";
import { TicketActions } from "../lib/Consts.js";
import { title } from "process";

class HelpDeskLogic {
    static async raiseTicket(authUser, body, callback) {
        try {
            if (!authUser || Utils.isEmpty(authUser.userID)) {
                return callback({
                    status: Consts.httpCodeUnauthorized,
                    message: "Unauthorized",
                });
            }

            if (Utils.isEmpty(body.issueType)) {
                return callback({ status: Consts.httpCodeBadRequest, message: "Issue type is required" });
            }
            if (Utils.isEmpty(body.title)) {
                return callback({ status: Consts.httpCodeBadRequest, message: "Issue title is required" });
            }
            if (Utils.isEmpty(body.description)) {
                return callback({ status: Consts.httpCodeBadRequest, message: "Description is required" });
            }

            const user = await DatabaseManager.user.findOne({
                where: {
                    userID: authUser.userID,
                    status: "active",
                },
            });

            if (!user) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "User not found or inactive",
                });
            }

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");

            // Better: keep DB unique constraint on ticketNumber
            const ticketNumber = `TKT${yyyy}${mm}${dd}-${Date.now()}`;

            const ticket = await DatabaseManager.sequelize.transaction(async (transaction) => {
                const createdTicket = await DatabaseManager.helpdesk.create(
                    {
                        ticketNumber,
                        userID: user.userID,
                        issueType: body.issueType,
                        title: body.title,
                        description: body.description,
                        priority: body.priority || null,
                        status: "new",
                        assignedTo: null,
                        createdBy: user.name,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    { transaction }
                );

                await AuditService.log(
                    {
                        ticketID: createdTicket.ticketID,
                        action: TicketActions.TICKET_RAISED,
                        performedBy: user.userID,
                        description: `Ticket ${createdTicket.ticketNumber} was raised by ${user.name}`,
                        newValue: {
                            status: "new",
                            priority: createdTicket.priority,
                            issueType: createdTicket.issueType,
                            title: createdTicket.title,
                        },
                    },
                    { transaction }
                );

                return createdTicket;
            });

            // Respond immediately
            callback({
                status: Consts.httpCodeSuccess,
                message: "Ticket raised successfully",
                ticket,
                notificationSent: false,
                notificationErrors: [],
            });

            // Fire-and-forget notifications
            process.nextTick(async () => {
                try {
                    const admins = await DatabaseManager.user.findAll({
                        where: { role: "admin", status: "active" },
                    });

                    const requesterName = user.name || authUser.name || "User";
                    const requesterEmail = user.email || authUser.email || null;

                    const jobs = [];

                    for (const admin of admins) {
                        if (admin?.email) {
                            jobs.push(
                                new Promise((resolve) => {
                                    EmailService.sendTicketRaisedNotificationToAdmin(
                                        {
                                            to: admin.email,
                                            adminName: admin.name || "Admin",
                                            requesterName,
                                            ticketNumber: ticket.ticketNumber,
                                            issueType: ticket.issueType,
                                            title: ticket.title,
                                            description: ticket.description,
                                            status: ticket.status,
                                        },
                                        () => resolve()
                                    );
                                })
                            );
                        }
                    }

                    if (requesterEmail) {
                        jobs.push(
                            new Promise((resolve) => {
                                EmailService.sendTicketRaisedConfirmationToUser(
                                    {
                                        to: requesterEmail,
                                        requesterName,
                                        ticketNumber: ticket.ticketNumber,
                                        issueType: ticket.issueType,
                                        title: ticket.title,
                                        description: ticket.description,
                                        status: ticket.status,
                                    },
                                    () => resolve()
                                );
                            })
                        );
                    }

                    await Promise.allSettled(jobs);
                } catch (e) {
                    console.error("Background notification failed:", e);
                }
            });
        } catch (err) {
            return callback({
                status: err.status || Consts.httpCodeServerError,
                message: err.message || "Failed to raise ticket",
                error: err,
            });
        }
    }

    static listTickets(authUser, query, callback) {
        async.waterfall(
            [
            // 1) Validate auth + build WHERE filters (role scope + optional filters)
            function (done) {
                try {
                if (!authUser || Utils.isEmpty(authUser.userID)) return done("Unauthorized");

                const where = {};
                const isAdmin = authUser.role === "admin";

                // -----------------------------
                // ROLE-BASED VISIBILITY (scope)
                // -----------------------------
                if (!isAdmin) {
                    // Non-admin can see:
                    // 1) tickets they raised
                    // 2) tickets assigned to them
                    where[Op.or] = [
                    { userID: authUser.userID },
                    { assignedTo: authUser.userID },
                    ];
                } else {
                    // Admin sees ALL tickets by default
                    // Optional admin filters:
                    // ?requesterID=UUID   (tickets raised by a user)
                    // ?assignedTo=UUID    (tickets assigned to an agent/user)
                    if (!Utils.isEmpty(query.requesterID)) where.userID = query.requesterID;
                    if (!Utils.isEmpty(query.assignedTo)) where.assignedTo = query.assignedTo;
                }

                // -----------------------------
                // OPTIONAL FILTERS
                // -----------------------------
                if (!Utils.isEmpty(query.ticketNumber)) where.ticketNumber = query.ticketNumber;
                if (!Utils.isEmpty(query.status)) where.status = query.status;
                if (!Utils.isEmpty(query.priority)) where.priority = query.priority;
                if (!Utils.isEmpty(query.issueType)) where.issueType = query.issueType;

                // Date range filter (createdAt)
                if (!Utils.isEmpty(query.dateFrom) || !Utils.isEmpty(query.dateTo)) {
                    where.createdAt = {};
                    if (!Utils.isEmpty(query.dateFrom)) where.createdAt[Op.gte] = new Date(query.dateFrom);
                    if (!Utils.isEmpty(query.dateTo)) where.createdAt[Op.lte] = new Date(query.dateTo);
                }

                // Search across fields (ticketNumber/title/description)
                // IMPORTANT: This must NOT overwrite existing Op.or used for non-admin scope.
                if (!Utils.isEmpty(query.search)) {
                    const s = String(query.search).trim();

                    // Use Op.iLike for Postgres, Op.like for MySQL
                    const likeOp = Op.iLike || Op.like;

                    const searchOr = [
                    { ticketNumber: { [likeOp]: `%${s}%` } },
                    { title: { [likeOp]: `%${s}%` } },
                    { description: { [likeOp]: `%${s}%` } },
                    ];

                    // If scope already uses Op.or (non-admin), combine with Op.and
                    if (where[Op.or]) {
                    where[Op.and] = where[Op.and] || [];
                    where[Op.and].push({ [Op.or]: searchOr });
                    } else {
                    where[Op.or] = searchOr;
                    }
                }

                done(null, where);
                } catch (e) {
                done(e);
                }
            },

            // 2) Pagination + fetch
            function (where, done) {
                const page = !Utils.isEmpty(query.page) ? parseInt(query.page, 10) : 1;
                const limit = !Utils.isEmpty(query.limit) ? parseInt(query.limit, 10) : 20;

                if (Number.isNaN(page) || page < 1) return done("Invalid page value");
                if (Number.isNaN(limit) || limit < 1 || limit > 100) return done("Invalid limit value (1-100)");

                const offset = (page - 1) * limit;

                DatabaseManager.helpdesk
                .findAndCountAll({
                    where,
                    limit,
                    offset,
                    order: [["createdAt", "DESC"]],
                    include: [
                    {
                        model: DatabaseManager.user,
                        as: "requester",
                        attributes: ["userID", "name", "email", "phone"],
                        required: false,
                    },
                    {
                        model: DatabaseManager.user,
                        as: "agent",
                        attributes: ["userID", "name", "email", "phone"],
                        required: false,
                    },
                    ],
                })
                .then((result) => {
                    done(null, {
                    tickets: result.rows,
                    total: result.count,
                    page,
                    limit,
                    totalPages: Math.ceil(result.count / limit),
                    });
                })
                .catch((err) => done(err));
            },
            ],

            // Final callback
            function (err, data) {
            if (err)
                return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to fetch tickets",
                error: err,
                });

            return callback({
                status: Consts.httpCodeSuccess,
                message: "Tickets fetched successfully",
                ...data,
            });
            }
        );
    }

    static async assignTicket(authUser, body, callback) {
        try {
            if (!authUser || Utils.isEmpty(authUser.userID)) {
                return callback({
                    status: Consts.httpCodeUnauthorized,
                    message: "Unauthorized",
                });
            }

            if (authUser.role !== "admin") {
                return callback({
                    status: Consts.httpCodeForbidden,
                    message: "Forbidden: Admin only",
                });
            }

            if (Utils.isEmpty(body.ticketID) && Utils.isEmpty(body.ticketNumber)) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "ticketID or ticketNumber is required",
                });
            }

            if (Utils.isEmpty(body.assignedTo)) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "assignedTo is required",
                });
            }

            if (Utils.isEmpty(body.priority)) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "priority is required",
                });
            }

            const allowedPriorities = ["low", "medium", "high", "urgent"];
            if (!allowedPriorities.includes(body.priority)) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "Invalid priority value",
                });
            }

            const where = {};
            if (!Utils.isEmpty(body.ticketID)) where.ticketID = body.ticketID;
            if (!Utils.isEmpty(body.ticketNumber)) where.ticketNumber = body.ticketNumber;

            const ticket = await DatabaseManager.helpdesk.findOne({ where });
            if (!ticket) {
                return callback({
                    status: Consts.httpCodeNotFound,
                    message: "Ticket not found",
                });
            }

            const assignee = await DatabaseManager.user.findOne({
                where: {
                    userID: body.assignedTo,
                    status: "active",
                },
            });

            if (!assignee) {
                return callback({
                    status: Consts.httpCodeBadRequest,
                    message: "Assigned user not found or inactive",
                });
            }

            const updatedTicket = await DatabaseManager.sequelize.transaction(async (transaction) => {
                const previousAssignedTo = ticket.assignedTo;
                const previousStatus = ticket.status;
                const previousPriority = ticket.priority;

                const updates = {
                    assignedTo: assignee.userID,
                    priority: body.priority,
                    status: "open",
                    updatedAt: new Date(),
                };

                await DatabaseManager.helpdesk.update(updates, {
                    where: { ticketID: ticket.ticketID },
                    transaction,
                });

                await AuditService.log(
                    {
                        ticketID: ticket.ticketID,
                        action: TicketActions.TICKET_ASSIGNED,
                        performedBy: authUser.userID,
                        fromUserID: previousAssignedTo || null,
                        toUserID: assignee.userID,
                        description: `Ticket assigned to ${assignee.name}`,
                        previousValue: { assignedTo: previousAssignedTo },
                        newValue: { assignedTo: assignee.userID },
                    },
                    { transaction }
                );

                if (previousStatus !== "open") {
                    await AuditService.log(
                        {
                            ticketID: ticket.ticketID,
                            action: TicketActions.STATUS_CHANGED,
                            performedBy: authUser.userID,
                            fieldName: "status",
                            previousValue: previousStatus,
                            newValue: "open",
                            description: `Status changed from ${previousStatus} to open`,
                        },
                        { transaction }
                    );
                }

                if (previousPriority !== body.priority) {
                    await AuditService.log(
                        {
                            ticketID: ticket.ticketID,
                            action: TicketActions.PRIORITY_CHANGED,
                            performedBy: authUser.userID,
                            fieldName: "priority",
                            previousValue: previousPriority,
                            newValue: body.priority,
                            description: `Priority changed from ${previousPriority || "none"} to ${body.priority}`,
                        },
                        { transaction }
                    );
                }

                return {
                    ...ticket.get({ plain: true }),
                    ...updates,
                };
            });

            callback({
                status: Consts.httpCodeSuccess,
                message: "Ticket assigned successfully",
                ticket: updatedTicket,
                notificationSent: false,
                notificationErrors: [],
            });

            process.nextTick(async () => {
                try {
                    const assigner = {
                        name: authUser.name || "Admin",
                        email: authUser.email || null,
                    };

                    const jobs = [];

                    if (assigner.email) {
                        jobs.push(
                            new Promise((resolve) => {
                                EmailService.sendTicketAssignmentNotificationToAssigner(
                                    {
                                        to: assigner.email,
                                        assignerName: assigner.name,
                                        assigneeName: assignee.name || "User",
                                        ticketNumber: updatedTicket.ticketNumber,
                                        priority: updatedTicket.priority,
                                        status: updatedTicket.status,
                                    },
                                    () => resolve()
                                );
                            })
                        );
                    }

                    if (assignee.email) {
                        jobs.push(
                            new Promise((resolve) => {
                                EmailService.sendTicketAssignmentNotificationToAssignee(
                                    {
                                        to: assignee.email,
                                        assigneeName: assignee.name || "User",
                                        assignerName: assigner.name,
                                        ticketNumber: updatedTicket.ticketNumber,
                                        priority: updatedTicket.priority,
                                        status: updatedTicket.status,
                                    },
                                    () => resolve()
                                );
                            })
                        );
                    }

                    await Promise.allSettled(jobs);
                } catch (err) {
                    console.error("Background assignment notification error:", err);
                }
            });
        } catch (err) {
            return callback({
                status: err.status || Consts.httpCodeServerError,
                message: err.message || "Failed to assign ticket",
                error: err,
            });
        }
    }

    static reassignTicket(authUser, body, callback) {
        async.waterfall(
            [
                // 1) Auth + Admin-only + validate input
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
                    }

                    if (authUser.role !== "admin") {
                        return done({ message: "Forbidden: Admin only", status: Consts.httpCodeForbidden });
                    }

                    if (Utils.isEmpty(body.ticketID) && Utils.isEmpty(body.ticketNumber)) {
                        return done({ message: "ticketID or ticketNumber is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.assignedTo)) {
                        return done({ message: "assignedTo (new assignee) is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.reason)) {
                        return done({ message: "Reassignment reason is required", status: Consts.httpCodeBadRequest });
                    }

                    done(null);
                },

                // 2) Ensure ticket exists
                function (done) {
                    const where = {};
                    if (!Utils.isEmpty(body.ticketID)) where.ticketID = body.ticketID;
                    if (!Utils.isEmpty(body.ticketNumber)) where.ticketNumber = body.ticketNumber;

                    DatabaseManager.helpdesk
                        .findOne({ where })
                        .then((ticket) => {
                            if (!ticket) {
                                return done({ message: "Ticket not found", status: Consts.httpCodeNotFound });
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

                // 3) Get previous assignee + validate new assignee
                function (ticket, done) {
                    const previousAssigneeID = ticket.assignedTo;

                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: body.assignedTo,
                                status: "active",
                            },
                        })
                        .then((newAssignee) => {
                            if (!newAssignee) {
                                return done({
                                    message: "New assignee not found or inactive",
                                    status: Consts.httpCodeBadRequest,
                                });
                            }

                            done(null, ticket, previousAssigneeID, newAssignee);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch new assignee",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 4) Fetch previous assignee details
                function (ticket, previousAssigneeID, newAssignee, done) {
                    if (!previousAssigneeID) {
                        return done(null, ticket, null, newAssignee);
                    }

                    DatabaseManager.user
                        .findOne({ where: { userID: previousAssigneeID } })
                        .then((previousAssignee) => {
                            done(null, ticket, previousAssignee || null, newAssignee);
                        })
                        .catch((err) => {
                            console.error("Failed to fetch previous assignee:", err);
                            done(null, ticket, null, newAssignee);
                        });
                },

                // 5) Update ticket + audit reassignment
                function (ticket, previousAssignee, newAssignee, done) {
                    DatabaseManager.sequelize
                        .transaction(async (transaction) => {
                            const updates = {
                                assignedTo: newAssignee.userID,
                                reassignmentReason: body.reason,
                                updatedAt: new Date(),
                            };

                            const result = await DatabaseManager.helpdesk.update(updates, {
                                where: { ticketID: ticket.ticketID },
                                transaction,
                            });

                            const affectedRows = Array.isArray(result) ? result[0] : result;

                            if (!affectedRows) {
                                throw new Error("Ticket reassignment failed");
                            }

                            await AuditService.log(
                                {
                                    ticketID: ticket.ticketID,
                                    action: TicketActions.TICKET_REASSIGNED,
                                    performedBy: authUser.userID,
                                    fromUserID: previousAssignee ? previousAssignee.userID : null,
                                    toUserID: newAssignee.userID,
                                    reason: body.reason,
                                    description: `Ticket reassigned from ${previousAssignee ? previousAssignee.name : "unassigned"} to ${newAssignee.name}`,
                                    previousValue: {
                                        assignedTo: previousAssignee ? previousAssignee.userID : null,
                                    },
                                    newValue: {
                                        assignedTo: newAssignee.userID,
                                    },
                                },
                                { transaction }
                            );

                            return {
                                ...ticket.get({ plain: true }),
                                ...updates,
                            };
                        })
                        .then((updatedTicket) => done(null, updatedTicket, previousAssignee, newAssignee))
                        .catch((err) =>
                            done({
                                message: err.message || "Failed to update ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },
            ],
            function (err, updatedTicket, previousAssignee, newAssignee) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to reassign ticket",
                        error: err.error || err,
                    });
                }

                // Respond immediately after successful reassignment
                callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket reassigned successfully",
                    ticket: updatedTicket,
                    notificationSent: false,
                    notificationErrors: [],
                });

                // Run notifications in background
                process.nextTick(function () {
                    const reassigner = authUser || {};
                    const emailJobs = [];
                    const notificationErrors = [];

                    if (newAssignee && newAssignee.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketReassignmentNotificationToNewAssignee(
                                {
                                    to: newAssignee.email,
                                    assigneeName: newAssignee.name,
                                    reassignerName: reassigner.name || "Admin",
                                    previousAssigneeName: previousAssignee ? previousAssignee.name : "N/A",
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                    reason: updatedTicket.reassignmentReason,
                                },
                                function (err) {
                                    if (err) {
                                        notificationErrors.push({ recipient: "newAssignee", error: err });
                                    }
                                    cb(null);
                                }
                            );
                        });
                    }

                    if (previousAssignee && previousAssignee.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketReassignmentNotificationToPreviousAssignee(
                                {
                                    to: previousAssignee.email,
                                    previousAssigneeName: previousAssignee.name,
                                    reassignerName: reassigner.name || "Admin",
                                    newAssigneeName: newAssignee.name,
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                    reason: updatedTicket.reassignmentReason,
                                },
                                function (err) {
                                    if (err) {
                                        notificationErrors.push({ recipient: "previousAssignee", error: err });
                                    }
                                    cb(null);
                                }
                            );
                        });
                    }

                    if (emailJobs.length === 0) {
                        return;
                    }

                    async.parallel(emailJobs, function () {
                        if (notificationErrors.length > 0) {
                            console.error("Ticket reassigned, but some notifications failed:", notificationErrors);
                        }
                    });
                });
            }
        );
    }

    static resolveTicket(authUser, body, callback) {
        async.waterfall(
            [
                // 1) Auth + validate input
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
                    }

                    if (Utils.isEmpty(body.ticketID) && Utils.isEmpty(body.ticketNumber)) {
                        return done({ message: "ticketID or ticketNumber is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.resolutionDetails)) {
                        return done({ message: "Resolution reason is required", status: Consts.httpCodeBadRequest });
                    }

                    done(null);
                },

                // 2) Ensure ticket exists
                function (done) {
                    const where = {};
                    if (!Utils.isEmpty(body.ticketID)) where.ticketID = body.ticketID;
                    if (!Utils.isEmpty(body.ticketNumber)) where.ticketNumber = body.ticketNumber;

                    DatabaseManager.helpdesk
                        .findOne({ where })
                        .then((ticket) => {
                            if (!ticket) {
                                return done({ message: "Ticket not found", status: Consts.httpCodeNotFound });
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

                // 3) Check permissions (admin or assigned agent)
                function (ticket, done) {
                    const isAdmin = authUser.role === "admin";
                    const isAssignedAgent = ticket.assignedTo === authUser.userID;

                    if (!isAdmin && !isAssignedAgent) {
                        return done({
                            message: "Forbidden: Only admins or assigned agents can resolve this ticket",
                            status: Consts.httpCodeForbidden,
                        });
                    }

                    done(null, ticket);
                },

                // 4) Update ticket to resolved + audit
                function (ticket, done) {
                    DatabaseManager.sequelize
                        .transaction(async (transaction) => {
                            const updates = {
                                status: "resolved",
                                resolutionDetails: body.resolutionDetails,
                                resolutionDate: new Date(),
                                updatedAt: new Date(),
                            };

                            const result = await DatabaseManager.helpdesk.update(updates, {
                                where: { ticketID: ticket.ticketID },
                                transaction,
                            });

                            const affectedRows = Array.isArray(result) ? result[0] : result;

                            if (!affectedRows) {
                                throw new Error("Ticket resolution failed");
                            }

                            await AuditService.log(
                                {
                                    ticketID: ticket.ticketID,
                                    action: TicketActions.TICKET_RESOLVED,
                                    performedBy: authUser.userID,
                                    fieldName: "status",
                                    previousValue: ticket.status,
                                    newValue: "resolved",
                                    reason: body.resolutionDetails || null,
                                    description: `Ticket resolved by ${authUser.name}`,
                                },
                                { transaction }
                            );

                            return {
                                ...ticket.get({ plain: true }),
                                ...updates,
                            };
                        })
                        .then((updatedTicket) => done(null, updatedTicket))
                        .catch((err) =>
                            done({
                                message: err.message || "Failed to update ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },
            ],
            function (err, updatedTicket) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to resolve ticket",
                        error: err.error || err,
                    });
                }

                // Return immediately after successful DB update
                callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket resolved successfully",
                    ticket: updatedTicket,
                    notificationSent: false,
                    notificationError: null,
                });

                // Send notification in background
                process.nextTick(function () {
                    DatabaseManager.user
                        .findOne({ where: { userID: updatedTicket.userID } })
                        .then((requester) => {
                            if (!requester || !requester.email) {
                                return;
                            }

                            EmailService.sendTicketResolvedNotificationToRequester(
                                {
                                    to: requester.email,
                                    requesterName: requester.name,
                                    resolverName: authUser.name,
                                    ticketNumber: updatedTicket.ticketNumber,
                                    issueType: updatedTicket.issueType,
                                    title: updatedTicket.title,
                                    status: updatedTicket.status,
                                },
                                function (err) {
                                    if (err) {
                                        console.error("Ticket resolved, but notification failed:", err);
                                    }
                                }
                            );
                        })
                        .catch((err) => {
                            console.error("Failed to fetch requester for notification:", err);
                        });
                });
            }
        );
    }

    static escalateTicket(authUser, body, callback) {
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

                    if (authUser.role !== "admin") {
                        return done({
                            message: "Forbidden: Admin only",
                            status: Consts.httpCodeForbidden,
                        });
                    }

                    if (Utils.isEmpty(body.ticketID) && Utils.isEmpty(body.ticketNumber)) {
                        return done({
                            message: "ticketID or ticketNumber is required",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    if (Utils.isEmpty(body.escalatedToTeam)) {
                        return done({
                            message: "escalatedToTeam is required",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    if (Utils.isEmpty(body.assignedTo)) {
                        return done({
                            message: "assignedTo is required",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    if (Utils.isEmpty(body.reason) || String(body.reason).trim().length === 0) {
                        return done({
                            message: "Escalation reason is required",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    done(null);
                },

                // 2) Ensure ticket exists
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
                                    status: Consts.httpCodeFileNotFound,
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

                // 3) Validate assigned user belongs to escalated team
                function (ticket, done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: body.assignedTo,
                                status: "active",
                            },
                        })
                        .then((assignedUser) => {
                            if (!assignedUser) {
                                return done({
                                    message: "Assigned user not found or inactive",
                                    status: Consts.httpCodeFileNotFound,
                                });
                            }

                            if (assignedUser.team !== body.escalatedToTeam) {
                                return done({
                                    message: `User does not belong to ${body.escalatedToTeam} team`,
                                    status: Consts.httpCodeBadRequest,
                                });
                            }

                            done(null, ticket, assignedUser);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to validate assigned user",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 4) Validate ticket state
                function (ticket, assignedUser, done) {
                    if (ticket.status !== "open") {
                        return done({
                            message: "Only open tickets can be escalated",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    done(null, ticket, assignedUser);
                },

                // 5) Escalate ticket + audit + SLA
                function (ticket, assignedUser, done) {
                    DatabaseManager.sequelize
                        .transaction(async (transaction) => {
                            const previousStatus = ticket.status;
                            const previousPriority = ticket.priority;
                            const previousTeam = ticket.escalatedToTeam || null;
                            const previousAssignee = ticket.assignedTo || null;

                            let newPriority = "high";
                            if (previousPriority === "high" || previousPriority === "urgent") {
                                newPriority = "urgent";
                            }

                            const escalatedAt = new Date();
                            const slaTargetAt = new Date(escalatedAt.getTime() + 4 * 60 * 60 * 1000);

                            const updates = {
                                status: "escalated",
                                priority: newPriority,
                                escalatedToTeam: body.escalatedToTeam,
                                assignedTo: body.assignedTo,
                                escalatedBy: authUser.userID,
                                escalationReason: String(body.reason).trim(),
                                escalatedAt,
                                slaTargetAt,
                                slaStatus: "active",
                                updatedAt: new Date(),
                            };

                            const result = await DatabaseManager.helpdesk.update(updates, {
                                where: { ticketID: ticket.ticketID },
                                transaction,
                            });

                            const affectedRows = Array.isArray(result) ? result[0] : result;

                            if (!affectedRows) {
                                throw new Error("Ticket escalation failed");
                            }

                            await AuditService.log({
                                ticketID: ticket.ticketID,
                                action: TicketActions.TICKET_ESCALATED,
                                performedBy: authUser.userID,
                                fieldName: "status",
                                previousValue: previousStatus,
                                newValue: "escalated",
                                reason: body.reason,
                            }, { transaction });

                            await AuditService.log({
                                ticketID: ticket.ticketID,
                                action: TicketActions.TEAM_CHANGED,
                                performedBy: authUser.userID,
                                fieldName: "escalatedToTeam",
                                previousValue: previousTeam,
                                newValue: body.escalatedToTeam,
                                reason: body.reason,
                            }, { transaction });

                            await AuditService.log({
                                ticketID: ticket.ticketID,
                                action: TicketActions.TICKET_ASSIGNED,
                                performedBy: authUser.userID,
                                fieldName: "assignedTo",
                                previousValue: previousAssignee,
                                newValue: body.assignedTo,
                                reason: body.reason,
                            }, { transaction });

                            return {
                                updatedTicket: {
                                    ...ticket.get({ plain: true }),
                                    ...updates,
                                },
                                assignedUser,
                            };
                        })
                        .then((result) => done(null, result.updatedTicket, result.assignedUser))
                        .catch((err) =>
                            done({
                                message: err.message || "Failed to escalate ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },
            ],
            function (err, updatedTicket, assignedUser) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to escalate ticket",
                        error: err.error || err,
                    });
                }

                // Respond immediately after successful escalation
                callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket escalated successfully",
                    ticket: updatedTicket,
                });

                // Run notifications in background
                process.nextTick(function () {
                    async.parallel(
                        [
                            // Notify admins & agents in escalated team
                            function (done) {
                                DatabaseManager.user
                                    .findAll({
                                        where: {
                                            status: "active",
                                            [Op.or]: [
                                                { role: "admin" },
                                                { role: "agent", team: updatedTicket.escalatedToTeam },
                                            ],
                                        },
                                    })
                                    .then((recipients) => {
                                        const emailJobs = [];

                                        (recipients || []).forEach((recipient) => {
                                            if (recipient?.email) {
                                                emailJobs.push((cb) => {
                                                    EmailService.sendTicketEscalatedNotificationToAdminOrAgent(
                                                        {
                                                            to: recipient.email,
                                                            recipientName: recipient.name,
                                                            escalatorName: authUser.name,
                                                            ticketNumber: updatedTicket.ticketNumber,
                                                            title: updatedTicket.title,
                                                            issueType: updatedTicket.issueType,
                                                            priority: updatedTicket.priority,
                                                            status: updatedTicket.status,
                                                            escalatedToTeam: updatedTicket.escalatedToTeam,
                                                            reason: updatedTicket.escalationReason,
                                                        },
                                                        () => cb(null)
                                                    );
                                                });
                                            }
                                        });

                                        if (!emailJobs.length) return done(null);

                                        async.parallel(emailJobs, () => done(null));
                                    })
                                    .catch((err) => {
                                        console.error("Failed to fetch escalation recipients:", err);
                                        done(null);
                                    });
                            },

                            // Notify assigned user using already-fetched assignedUser
                            function (done) {
                                if (!assignedUser?.email) {
                                    return done(null);
                                }

                                EmailService.sendTicketAssignmentNotificationToAssignee(
                                    {
                                        to: assignedUser.email,
                                        assigneeName: assignedUser.name,
                                        assignerName: authUser.name,
                                        ticketNumber: updatedTicket.ticketNumber,
                                        priority: updatedTicket.priority,
                                        status: updatedTicket.status,
                                        issueType: updatedTicket.issueType,
                                        title: updatedTicket.title,
                                        reason: updatedTicket.escalationReason,
                                    },
                                    () => done(null)
                                );
                            },

                            // Notify requester
                            function (done) {
                                DatabaseManager.user
                                    .findOne({
                                        where: { userID: updatedTicket.userID },
                                    })
                                    .then((requester) => {
                                        if (!requester?.email) {
                                            return done(null);
                                        }

                                        EmailService.sendTicketEscalatedNotificationToRequester(
                                            {
                                                to: requester.email,
                                                requesterName: requester.name,
                                                escalatorName: authUser.name,
                                                ticketNumber: updatedTicket.ticketNumber,
                                                status: updatedTicket.status,
                                                reason: updatedTicket.escalationReason,
                                                issueType: updatedTicket.issueType,
                                                title: updatedTicket.title,
                                            },
                                            () => done(null)
                                        );
                                    })
                                    .catch((err) => {
                                        console.error("Failed to fetch requester:", err);
                                        done(null);
                                    });
                            },
                        ],
                        function () {
                            // Background only — no blocking
                        }
                    );
                });
            }
        );
    }

    static closeTicket(authUser, body, callback) {
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


                    done(null);
                },

                // 2) Ensure ticket exists
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

                // 3) Check permissions (admin or assigned agent)
                function (ticket, done) {
                    const isAdmin = authUser.role === "admin";
                    const isAssignedAgent = ticket.assignedTo === authUser.userID;

                    if (!isAdmin && !isAssignedAgent) {
                        return done({
                            message: "Forbidden: Only admins or assigned agents can close this ticket",
                            status: Consts.httpCodeForbidden,
                        });
                    }

                    done(null, ticket);
                },
                // 4) Ensure ticket is resolved before closing
                function (ticket, done) {
                    if (ticket.status !== "resolved") {
                        return done({
                            message: "Only resolved tickets can be closed",
                            status: Consts.httpCodeBadRequest,
                        });
                    }

                    done(null, ticket);
                },
                // 4) Update ticket to closed + audit
                function (ticket, done) {
                    DatabaseManager.sequelize
                        .transaction(async (transaction) => {
                            const updates = {
                                status: "closed",
                                closedDate: new Date(),
                                updatedAt: new Date(),
                            };

                            const result = await DatabaseManager.helpdesk.update(
                                updates,
                                {
                                    where: { ticketID: ticket.ticketID },
                                    transaction,
                                }
                            );

                            const affectedRows = Array.isArray(result)
                                ? result[0]
                                : result;

                            if (!affectedRows) {
                                throw new Error("Ticket closure failed");
                            }

                            await AuditService.log(
                                {
                                    ticketID: ticket.ticketID,
                                    action: TicketActions.TICKET_CLOSED,
                                    performedBy: authUser.userID,
                                    fieldName: "status",
                                    previousValue: ticket.status,
                                    newValue: "closed",
                                    description: `Ticket closed by ${authUser.name}`,
                                },
                                { transaction }
                            );

                            return {
                                ...ticket.get({ plain: true }),
                                ...updates,
                            };
                        })
                        .then((updatedTicket) => done(null, updatedTicket))
                        .catch((err) =>
                            done({
                                message: err.message || "Failed to close ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },
            ],

            function (err, updatedTicket) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to close ticket",
                        error: err.error || err,
                    });
                }

                callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket closed successfully",
                    ticket: updatedTicket,
                });
            }
        );
    }

}

export default HelpDeskLogic;    