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

class HelpDeskLogic {
    static raiseTicket(authUser, body, callback) {
        async.waterfall(
            [
                // 1) Validate authenticated user and input
                function (done) {
                    if (!authUser || Utils.isEmpty(authUser.userID)) {
                        return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
                    }

                    if (Utils.isEmpty(body.issueType)) {
                        return done({ message: "Issue type is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.title)) {
                        return done({ message: "Issue title is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.description)) {
                        return done({ message: "Description is required", status: Consts.httpCodeBadRequest });
                    }

                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: authUser.userID,
                                status: "active",
                            },
                        })
                        .then((user) => {
                            if (!user) {
                                return done({ message: "User not found or inactive", status: Consts.httpCodeBadRequest });
                            }
                            done(null, user);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch user",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 2) Generate unique ticket number
                function (user, done) {
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mm = String(now.getMonth() + 1).padStart(2, "0");
                    const dd = String(now.getDate()).padStart(2, "0");
                    const rand = Math.floor(1000 + Math.random() * 9000);
                    const ticketNumber = `TKT${yyyy}${mm}${dd}-${rand}`;

                    DatabaseManager.helpdesk
                        .findOne({ where: { ticketNumber } })
                        .then((existing) => {
                            if (existing) {
                                return done({
                                    message: "Ticket number collision, try again",
                                    status: Consts.httpCodeServerError,
                                });
                            }
                            done(null, user, ticketNumber);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to validate ticket number",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 3) Create ticket + audit
                function (user, ticketNumber, done) {
                    DatabaseManager.sequelize.transaction(async (transaction) => {
                        const params = {
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
                        };

                        const ticket = await DatabaseManager.helpdesk.create(params, { transaction });

                        await AuditService.log(
                            {
                                ticketID: ticket.ticketID,
                                action: TicketActions.TICKET_RAISED,
                                performedBy: user.userID,
                                description: `Ticket ${ticket.ticketNumber} was raised by ${user.name}`,
                                newValue: {
                                    status: "new",
                                    priority: ticket.priority,
                                    issueType: ticket.issueType,
                                    title: ticket.title,
                                },
                            },
                            { transaction }
                        );

                        return ticket;
                    })
                    .then((ticket) => done(null, ticket, user))
                    .catch((err) =>
                        done({
                            message: "Failed to create ticket",
                            status: Consts.httpCodeServerError,
                            error: err,
                        })
                    );
                },

                // 4) Fetch admins
                function (ticket, user, done) {
                    DatabaseManager.user
                        .findAll({
                            where: {
                                role: "admin",
                                status: "active",
                            },
                        })
                        .then((admins) => {
                            done(null, ticket, user, admins || []);
                        })
                        .catch((err) => {
                            console.error("Failed to fetch admins for notification:", err);
                            done(null, ticket, user, []);
                        });
                },

                // 5) Send notifications after successful ticket creation
                function (ticket, user, admins, done) {
                    const emailJobs = [];
                    const notificationErrors = [];

                    const requesterName = user.name || authUser.name || "User";
                    const requesterEmail = user.email || authUser.email || null;

                    // Notify all admins
                    admins.forEach((admin) => {
                        if (admin && !Utils.isEmpty(admin.email)) {
                            emailJobs.push(function (cb) {
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
                                    function (err) {
                                        if (err) {
                                            notificationErrors.push({
                                                recipient: "admin",
                                                email: admin.email,
                                                error: err,
                                            });
                                        }
                                        cb(null);
                                    }
                                );
                            });
                        }
                    });

                    // Notify logged-in user who raised the ticket
                    if (!Utils.isEmpty(requesterEmail)) {
                        emailJobs.push(function (cb) {
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
                                function (err) {
                                    if (err) {
                                        notificationErrors.push({
                                            recipient: "user",
                                            email: requesterEmail,
                                            error: err,
                                        });
                                    }
                                    cb(null);
                                }
                            );
                        });
                    } else {
                        notificationErrors.push({
                            recipient: "user",
                            email: null,
                            error: "Logged-in user email not found",
                        });
                    }

                    if (emailJobs.length === 0) {
                        return done(null, ticket, {
                            notificationSent: false,
                            notificationMessage: "Ticket raised successfully, but no valid email recipients found",
                            notificationErrors,
                        });
                    }

                    async.parallel(emailJobs, function () {
                        if (notificationErrors.length > 0) {
                            console.error("Ticket raised, but some email notifications failed:", notificationErrors);
                            return done(null, ticket, {
                                notificationSent: false,
                                notificationMessage: "Ticket raised successfully, but some email notifications failed",
                                notificationErrors,
                            });
                        }

                        done(null, ticket, {
                            notificationSent: true,
                            notificationMessage: "Ticket raised and notifications sent successfully",
                        });
                    });
                },            
            ],
            function (err, ticket, notificationResult) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to raise ticket",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: (notificationResult && notificationResult.notificationMessage) || "Ticket raised successfully",
                    ticket,
                    notificationSent: (notificationResult && notificationResult.notificationSent) || false,
                    notificationErrors:
                        notificationResult && notificationResult.notificationErrors
                            ? notificationResult.notificationErrors
                            : [],
                });
            }
        );
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

    static assignTicket(authUser, body, callback) {
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
                        return done({ message: "assignedTo is required", status: Consts.httpCodeBadRequest });
                    }

                    if (Utils.isEmpty(body.priority)) {
                        return done({ message: "priority is required", status: Consts.httpCodeBadRequest });
                    }

                    const allowedPriorities = ["low", "medium", "high", "urgent"];
                    if (!allowedPriorities.includes(body.priority)) {
                        return done({ message: "Invalid priority value", status: Consts.httpCodeBadRequest });
                    }

                    done(null);
                },

                // 2) Ensure the ticket exists
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
                        .catch((err) => done({ message: "Failed to fetch ticket", status: Consts.httpCodeServerError, error: err }));
                },

                // 3) Ensure the assigned user exists + is active
                function (ticket, done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: body.assignedTo,
                                status: "active",
                            },
                        })
                        .then((assignee) => {
                            if (!assignee) {
                                return done({ message: "Assigned user not found or inactive", status: Consts.httpCodeBadRequest });
                            }
                            done(null, ticket, assignee);
                        })
                        .catch((err) => done({ message: "Failed to fetch assignee", status: Consts.httpCodeServerError, error: err }));
                },

                // 4) Update ticket + audit
                function (ticket, assignee, done) {
                    DatabaseManager.sequelize.transaction(async (transaction) => {
                        const previousAssignedTo = ticket.assignedTo;
                        const previousStatus = ticket.status;
                        const previousPriority = ticket.priority;

                        const updates = {
                            assignedTo: assignee.userID,
                            priority: body.priority,
                            status: "open",
                            updatedAt: new Date(),
                        };

                        const result = await DatabaseManager.helpdesk.update(updates, {
                            where: { ticketID: ticket.ticketID },
                            transaction,
                        });

                        const affectedRows = Array.isArray(result) ? result[0] : result;

                        if (!affectedRows) {
                            throw new Error("Ticket update failed");
                        }

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
                    })
                    .then((updatedTicket) => done(null, updatedTicket, assignee))
                    .catch((err) =>
                        done({
                            message: err.message || "Failed to update ticket",
                            status: Consts.httpCodeServerError,
                            error: err,
                        })
                    );
                },

                // 5) Fetch assigner details, but do not fail assignment if this lookup fails
                function (updatedTicket, assignee, done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: authUser.userID,
                            },
                        })
                        .then((assigner) => {
                            done(null, updatedTicket, assignee, assigner || authUser);
                        })
                        .catch((err) => {
                            console.error("Failed to fetch assigner details:", err);
                            done(null, updatedTicket, assignee, authUser);
                        });
                },

                // 6) Send notifications AFTER successful assignment
                function (updatedTicket, assignee, assigner, done) {
                    const emailJobs = [];
                    const notificationErrors = [];

                    if (assigner && assigner.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketAssignmentNotificationToAssigner(
                                {
                                    to: assigner.email,
                                    assignerName: assigner.name || "Admin",
                                    assigneeName: assignee.name || "User",
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                },
                                function (err) {
                                    if (err) notificationErrors.push({ recipient: "assigner", error: err });
                                    cb(null);
                                }
                            );
                        });
                    }

                    if (assignee && assignee.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketAssignmentNotificationToAssignee(
                                {
                                    to: assignee.email,
                                    assigneeName: assignee.name || "User",
                                    assignerName: (assigner && assigner.name) || "Admin",
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                },
                                function (err) {
                                    if (err) notificationErrors.push({ recipient: "assignee", error: err });
                                    cb(null);
                                }
                            );
                        });
                    }

                    if (emailJobs.length === 0) {
                        return done(null, updatedTicket, {
                            notificationSent: false,
                            notificationMessage: "Ticket assigned successfully, but no valid email recipients found",
                        });
                    }

                    async.parallel(emailJobs, function () {
                        if (notificationErrors.length > 0) {
                            console.error("Ticket assigned, but some email notifications failed:", notificationErrors);
                            return done(null, updatedTicket, {
                                notificationSent: false,
                                notificationMessage: "Ticket assigned successfully, but some email notifications failed",
                                notificationErrors,
                            });
                        }

                        done(null, updatedTicket, {
                            notificationSent: true,
                            notificationMessage: "Ticket assigned and notifications sent successfully",
                        });
                    });
                },
            ],
            function (err, ticket, notificationResult) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to assign ticket",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: (notificationResult && notificationResult.notificationMessage) || "Ticket assigned successfully",
                    ticket,
                    notificationSent: (notificationResult && notificationResult.notificationSent) || false,
                    notificationErrors: notificationResult && notificationResult.notificationErrors
                        ? notificationResult.notificationErrors
                        : [],
                });
            }
        );
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
                        .catch((err) => done({ message: "Failed to fetch ticket", status: Consts.httpCodeServerError, error: err }));
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
                                return done({ message: "New assignee not found or inactive", status: Consts.httpCodeBadRequest });
                            }

                            done(null, ticket, previousAssigneeID, newAssignee);
                        })
                        .catch((err) => done({ message: "Failed to fetch new assignee", status: Consts.httpCodeServerError, error: err }));
                },

                // 4) Fetch previous assignee details
                function (ticket, previousAssigneeID, newAssignee, done) {
                    if (!previousAssigneeID) {
                        return done(null, ticket, null, newAssignee, null);
                    }

                    DatabaseManager.user
                        .findOne({ where: { userID: previousAssigneeID } })
                        .then((previousAssignee) => {
                            done(null, ticket, previousAssignee, newAssignee);
                        })
                        .catch((err) => {
                            console.error("Failed to fetch previous assignee:", err);
                            done(null, ticket, null, newAssignee);
                        });
                },

                // 5) Update ticket + audit reassignment
                function (ticket, previousAssignee, newAssignee, done) {
                    DatabaseManager.sequelize.transaction(async (transaction) => {
                        const updates = {
                            assignedTo: newAssignee.userID,
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

                // 6) Fetch reassigner (admin)
                function (updatedTicket, previousAssignee, newAssignee, done) {
                    DatabaseManager.user
                        .findOne({ where: { userID: authUser.userID } })
                        .then((reassigner) => {
                            done(null, updatedTicket, previousAssignee, newAssignee, reassigner || authUser);
                        })
                        .catch((err) => {
                            console.error("Failed to fetch reassigner:", err);
                            done(null, updatedTicket, previousAssignee, newAssignee, authUser);
                        });
                },

                // 7) Send notifications
                function (updatedTicket, previousAssignee, newAssignee, reassigner, done) {
                    const emailJobs = [];
                    const notificationErrors = [];

                    // Notify NEW assignee
                    if (newAssignee && newAssignee.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketReassignmentNotificationToNewAssignee(
                                {
                                    to: newAssignee.email,
                                    assigneeName: newAssignee.name,
                                    reassignerName: reassigner.name,
                                    previousAssigneeName: previousAssignee ? previousAssignee.name : "N/A",
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                    reason: updatedTicket.reassignmentReason,
                                },
                                function (err) {
                                    if (err) notificationErrors.push({ recipient: "newAssignee", error: err });
                                    cb(null);
                                }
                            );
                        });
                    }

                    // Notify PREVIOUS assignee
                    if (previousAssignee && previousAssignee.email) {
                        emailJobs.push(function (cb) {
                            EmailService.sendTicketReassignmentNotificationToPreviousAssignee(
                                {
                                    to: previousAssignee.email,
                                    previousAssigneeName: previousAssignee.name,
                                    reassignerName: reassigner.name,
                                    newAssigneeName: newAssignee.name,
                                    ticketNumber: updatedTicket.ticketNumber,
                                    priority: updatedTicket.priority,
                                    status: updatedTicket.status,
                                    reason: updatedTicket.reassignmentReason,
                                },
                                function (err) {
                                    if (err) notificationErrors.push({ recipient: "previousAssignee", error: err });
                                    cb(null);
                                }
                            );
                        });
                    }

                    if (emailJobs.length === 0) {
                        return done(null, updatedTicket, {
                            notificationSent: false,
                            notificationMessage: "Reassigned but no email recipients found",
                        });
                    }

                    async.parallel(emailJobs, function () {
                        if (notificationErrors.length > 0) {
                            return done(null, updatedTicket, {
                                notificationSent: false,
                                notificationMessage: "Reassigned but some notifications failed",
                                notificationErrors,
                            });
                        }

                        done(null, updatedTicket, {
                            notificationSent: true,
                            notificationMessage: "Ticket reassigned and notifications sent successfully",
                        });
                    });
                },
            ],
            function (err, ticket, notificationResult) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to reassign ticket",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: (notificationResult && notificationResult.notificationMessage) || "Ticket reassigned successfully",
                    ticket,
                    notificationSent: (notificationResult && notificationResult.notificationSent) || false,
                    notificationErrors: notificationResult && notificationResult.notificationErrors
                        ? notificationResult.notificationErrors
                        : [],
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
                        .catch((err) => done({ message: "Failed to fetch ticket", status: Consts.httpCodeServerError, error: err }));
                },

                // 3) Check permissions (admin or assigned agent)
                function (ticket, done) {
                    const isAdmin = authUser.role === "admin";
                    const isAssignedAgent = ticket.assignedTo === authUser.userID;

                    if (!isAdmin && !isAssignedAgent) {
                        return done({ message: "Forbidden: Only admins or assigned agents can resolve this ticket", status: Consts.httpCodeForbidden });
                    }

                    done(null, ticket);
                },

                // 4) Update ticket to resolved + audit
                function (ticket, done) {
                    DatabaseManager.sequelize.transaction(async (transaction) => {
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

                // 5) Fetch requester details
                function (updatedTicket, done) {
                    DatabaseManager.user
                        .findOne({ where: { userID: updatedTicket.userID } })
                        .then((requester) => {
                            if (!requester) {
                                return done({ message: "Requester not found", status: Consts.httpCodeNotFound });
                            }
                            done(null, updatedTicket, requester);
                        })
                        .catch((err) => done({ message: "Failed to fetch requester", status: Consts.httpCodeServerError, error: err }));
                },

                // 6) Send notification to requester
                function (updatedTicket, requester, done) {
                    if (!requester.email) {
                        return done(null, updatedTicket, { notificationSent: false, notificationMessage: "Resolved but requester has no email" });
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
                                return done(null, updatedTicket, {
                                    notificationSent: false,
                                    notificationMessage: "Ticket resolved but notification failed",
                                    notificationError: err,
                                });
                            }

                            done(null, updatedTicket, { notificationSent: true, notificationMessage: "Ticket resolved and notification sent successfully" });
                        }
                    );
                },
            ],
            function (err, ticket, notificationResult) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to resolve ticket",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: (notificationResult && notificationResult.notificationMessage) || "Ticket resolved successfully",
                    ticket,
                    notificationSent: (notificationResult && notificationResult.notificationSent) || false,
                    notificationError: notificationResult && notificationResult.notificationError ? notificationResult.notificationError : null,
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
                        .then((user) => {
                            if (!user) {
                                return done({
                                    message: "Assigned user not found or inactive",
                                    status: Consts.httpCodeFileNotFound,
                                });
                            }

                            if (user.team !== body.escalatedToTeam) {
                                return done({
                                    message: `User does not belong to ${body.escalatedToTeam} team`,
                                    status: Consts.httpCodeBadRequest,
                                });
                            }

                            done(null, ticket, user);
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

                // 5) Fetch escalation recipients
                function (ticket, assignedUser, done) {
                    DatabaseManager.user
                        .findAll({
                            where: {
                                status: "active",
                                [Op.or]: [
                                    { role: "admin" },
                                    { role: "agent", team: body.escalatedToTeam },
                                ],
                            },
                        })
                        .then((recipients) => {
                            done(null, ticket, assignedUser, recipients || []);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch escalation recipients",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 6) Escalate ticket + audit + SLA
                function (ticket, assignedUser, recipients, done) {
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
                                assignedTo: body.assignedTo, // ✅ FIXED
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

                            // Audit logs
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
                                recipients,
                            };
                        })
                        .then((result) => done(null, result.updatedTicket, result.recipients))
                        .catch((err) =>
                            done({
                                message: err.message || "Failed to escalate ticket",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 7) Fetch requester
                function (updatedTicket, recipients, done) {
                    DatabaseManager.user
                        .findOne({
                            where: { userID: updatedTicket.userID },
                        })
                        .then((requester) => {
                            done(null, updatedTicket, recipients, requester || null);
                        })
                        .catch((err) =>
                            done({
                                message: "Failed to fetch requester",
                                status: Consts.httpCodeServerError,
                                error: err,
                            })
                        );
                },

                // 8) Notifications
                function (updatedTicket, recipients, requester, done) {
                    const emailJobs = [];

                    // 1) Notify admins & agents 
                    recipients.forEach((recipient) => {
                        if (recipient?.email) {
                            emailJobs.push((cb) => {
                                EmailService.sendTicketEscalatedNotificationToAdminOrAgent(
                                    {
                                        to: recipient.email,
                                        recipientName: recipient.name,
                                        escalatorName: authUser.name,
                                        ticketNumber: updatedTicket.ticketNumber,
                                        title: updatedTicket.title,
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

                    // 2) Notify assigned user 
                    if (updatedTicket.assignedTo) {
                        emailJobs.push((cb) => {
                            DatabaseManager.user
                                .findOne({ where: { userID: updatedTicket.assignedTo } })
                                .then((assignee) => {
                                    if (assignee?.email) {
                                        return EmailService.sendTicketAssignmentNotificationToAssignee(
                                            {
                                                to: assignee.email,
                                                assigneeName: assignee.name,
                                                assignerName: authUser.name,
                                                ticketNumber: updatedTicket.ticketNumber,
                                                priority: updatedTicket.priority,
                                                status: updatedTicket.status,
                                            },
                                            () => cb(null)
                                        );
                                    }
                                    cb(null);
                                })
                                .catch(() => cb(null)); // fail silently like others
                        });
                    }

                    // 3) Notify requester 
                    if (requester?.email) {
                        emailJobs.push((cb) => {
                            EmailService.sendTicketEscalatedNotificationToRequester(
                                {
                                    to: requester.email,
                                    requesterName: requester.name,
                                    escalatorName: authUser.name,
                                    ticketNumber: updatedTicket.ticketNumber,
                                    status: updatedTicket.status,
                                    reason: updatedTicket.escalationReason,
                                },
                                () => cb(null)
                            );
                        });
                    }

                    async.parallel(emailJobs, () => {
                        done(null, updatedTicket);
                    });
                }           
            ],
            function (err, ticket) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to escalate ticket",
                        error: err.error || err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Ticket escalated successfully",
                    ticket,
                });
            }
        );
    }
}

export default HelpDeskLogic;    