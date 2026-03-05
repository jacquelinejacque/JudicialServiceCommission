import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Op, Sequelize } from "sequelize";
import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";

class HelpDeskLogic {
    static raiseTicket(authUser, body, callback) {
        async.waterfall(
            [
            function (done) {
                // DO NOT accept userID from body
                if (!authUser || Utils.isEmpty(authUser.userID)) return done("Unauthorized");

                if (Utils.isEmpty(body.issueType)) return done("Issue type is required");
                if (Utils.isEmpty(body.title)) return done("Issue title is required");
                if (Utils.isEmpty(body.description)) return done("Description is required");

                const allowedPriorities = ["low", "medium", "high", "urgent"];
                if (!Utils.isEmpty(body.priority) && !allowedPriorities.includes(body.priority))
                return done("Invalid priority value");

                // Optionally re-check user is active in DB (extra safety)
                DatabaseManager.user
                .findOne({ where: { userID: authUser.userID, status: "active" } })
                .then((user) => {
                    if (!user) return done("User not found or inactive");
                    done(null, user);
                })
                .catch((err) => done(err));
            },

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
                    if (existing) return done("Ticket number collision, try again");
                    done(null, user, ticketNumber);
                })
                .catch((err) => done(err));
            },

            function (user, ticketNumber, done) {
                const params = {
                ticketNumber,
                userID: user.userID,              // ✅ comes from authenticated user
                issueType: body.issueType,
                title: body.title,
                description: body.description,
                priority: body.priority || "medium",
                status: "new",

                // IMPORTANT: don't allow normal users to assign tickets
                // only admins/agents should do assignment
                assignedTo: null,

                createdBy: user.name,
                createdAt: new Date(),
                updatedAt: new Date(),
                };

                DatabaseManager.helpdesk
                .create(params)
                .then((ticket) => done(null, ticket))
                .catch((err) => done(err));
            },
            ],
            function (err, ticket) {
            if (err)
                return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to raise ticket",
                error: err,
                });

            return callback({
                status: Consts.httpCodeSuccess,
                message: "Ticket raised successfully",
                ticket,
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
 
}

export default HelpDeskLogic;    