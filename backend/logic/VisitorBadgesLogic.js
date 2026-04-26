import { Op } from "sequelize";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";
class VisitorBadgesLogic {
    static createBadge(body, loggedInUser, callback) {
        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.badgeNumber)) {
                        return done("Badge number is required");
                    }

                    if (Utils.isEmpty(body.receptionDeskID)) {
                        return done("Reception desk is required");
                    }

                    const validStatuses = ["available", "issued", "lost", "inactive"];
                    if (body.status && !validStatuses.includes(body.status)) {
                        return done("Invalid badge status selected");
                    }

                    return done(null);
                },

                function (done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: loggedInUser.userID,
                                status: "active",
                            },
                        })
                        .then((user) => {
                            if (!user) return done("Logged in user not found");

                            if (user.role !== "admin") {
                                return done("Only admins can create visitor badges");
                            }

                            return done(null, user);
                        })
                        .catch((err) => done(err));
                },

                function (user, done) {
                    DatabaseManager.receptionDesk
                        .findOne({
                            where: {
                                receptionDeskID: body.receptionDeskID,
                                status: "active",
                            },
                        })
                        .then((receptionDesk) => {
                            if (!receptionDesk) {
                                return done("Selected reception desk was not found or is inactive");
                            }

                            return done(null, user, receptionDesk);
                        })
                        .catch((err) => done(err));
                },

                function (user, receptionDesk, done) {
                    DatabaseManager.visitorBadge
                        .findOne({
                            where: {
                                badgeNumber: body.badgeNumber,
                            },
                        })
                        .then((existingBadge) => {
                            if (existingBadge) {
                                return done("A visitor badge with this badge number already exists");
                            }

                            return done(null, user, receptionDesk);
                        })
                        .catch((err) => done(err));
                },

                function (user, receptionDesk, done) {
                    const params = {
                        badgeNumber: body.badgeNumber,
                        receptionDeskID: body.receptionDeskID,
                        status: body.status || "available",
                        currentVisitID: null,
                        issuedAt: null,
                        returnedAt: null,
                        remarks: body.remarks || null,
                    };

                    DatabaseManager.visitorBadge
                        .create(params)
                        .then((badge) => {
                            return done(null, badge, receptionDesk);
                        })
                        .catch((err) => done(err));
                },
            ],
            function (err, badge, receptionDesk) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to create visitor badge",
                        error: err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Visitor badge created successfully",
                    badge: badge,
                    receptionDesk: receptionDesk,
                });
            }
        );
    }

    static createBadges(body, loggedInUser, callback) {
        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.receptionDeskID)) {
                        return done("Reception desk is required");
                    }

                    if (Utils.isEmpty(body.quantity)) {
                        return done("Quantity is required");
                    }

                    if (isNaN(body.quantity) || parseInt(body.quantity) <= 0) {
                        return done("Quantity must be a valid positive number");
                    }

                    return done(null);
                },

                function (done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: loggedInUser.userID,
                                status: "active",
                            },
                        })
                        .then((user) => {
                            if (!user) return done("Logged in user not found");

                            if (user.role !== "admin") {
                                return done("Only admins can create visitor badges");
                            }

                            return done(null, user);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (user, done) {
                    DatabaseManager.receptionDesk
                        .findOne({
                            where: {
                                receptionDeskID: body.receptionDeskID,
                                status: "active",
                            },
                        })
                        .then((receptionDesk) => {
                            if (!receptionDesk) {
                                return done("Selected reception desk was not found or is inactive");
                            }

                            return done(null, user, receptionDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (user, receptionDesk, done) {
                    DatabaseManager.visitorBadge
                        .findAll({
                            order: [["badgeNumber", "DESC"]],
                            limit: 1,
                        })
                        .then((lastBadge) => {
                            let startNumber = 1;

                            if (lastBadge && lastBadge.length > 0) {
                                const badgeNumber = lastBadge[0].badgeNumber;
                                const numericPart = parseInt((badgeNumber || "").replace("V-", ""));
                                if (!isNaN(numericPart)) {
                                    startNumber = numericPart + 1;
                                }
                            }

                            return done(null, receptionDesk, startNumber);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (receptionDesk, startNumber, done) {
                    const quantity = parseInt(body.quantity);
                    const badges = [];

                    for (let i = 0; i < quantity; i++) {
                        const number = startNumber + i;
                        badges.push({
                            badgeNumber: `V-${String(number).padStart(3, "0")}`,
                            receptionDeskID: receptionDesk.receptionDeskID,
                            status: "available",
                            currentVisitID: null,
                            issuedAt: null,
                            returnedAt: null,
                            remarks: body.remarks || null,
                        });
                    }

                    DatabaseManager.visitorBadge
                        .bulkCreate(badges)
                        .then((createdBadges) => {
                            return done(null, createdBadges, receptionDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },
            ],
            function (err, badges, receptionDesk) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to create visitor badges",
                        error: err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Visitor badges created successfully",
                    receptionDesk: receptionDesk,
                    badges: badges,
                });
            }
        );
    }

static list(param, callback) {
    const baseQuery = {};
    let filteredQuery = { ...baseQuery };

    if (!Utils.isEmpty(param.status)) {
        filteredQuery.status = param.status;
    }

    if (!Utils.isEmpty(param.receptionDeskID)) {
        filteredQuery.receptionDeskID = param.receptionDeskID;
    }

    if (!Utils.isEmpty(param.badgeNumber)) {
        filteredQuery.badgeNumber = param.badgeNumber;
    }

    if (!Utils.isEmpty(param["search[value]"])) {
        const searchValue = param["search[value]"];

        filteredQuery = {
            ...filteredQuery,
            [Op.or]: [
                { badgeNumber: { [Op.like]: `%${searchValue}%` } },
                { receptionDeskID: { [Op.like]: `%${searchValue}%` } },
                { status: { [Op.like]: `%${searchValue}%` } },
                { remarks: { [Op.like]: `%${searchValue}%` } },
            ],
        };
    }

    async.waterfall(
        [
            function (done) {
                DatabaseManager.visitorBadge
                    .count({ where: baseQuery })
                    .then((totalRecords) => done(null, totalRecords))
                    .catch((err) => done(err));
            },

            function (totalRecords, done) {
                DatabaseManager.visitorBadge
                    .count({ where: filteredQuery })
                    .then((filteredRecords) => done(null, totalRecords, filteredRecords))
                    .catch((err) => done(err));
            },

            function (totalRecords, filteredRecords, done) {
                const offset = parseInt(param.start) || 0;
                const limit = parseInt(param.length) || 10;

                DatabaseManager.visitorBadge
                    .findAll({
                        where: filteredQuery,
                        attributes: [
                            "badgeID",
                            "badgeNumber",
                            "receptionDeskID",
                            "status",
                            "currentVisitID",
                            "issuedAt",
                            "returnedAt",
                            "remarks",
                            "createdAt",
                            "updatedAt",
                        ],
                        order: [["createdAt", "DESC"]],
                        offset: offset,
                        limit: limit,
                    })
                    .then((data) => done(null, totalRecords, filteredRecords, data))
                    .catch((err) => done(err));
            },
        ],
        function (err, totalRecords, filteredRecords, data) {
            if (err) {
                return callback({
                    status: Consts.httpCodeServerError,
                    message: "Failed to fetch Visitor Badges",
                    error: err,
                    data: [],
                    recordsTotal: 0,
                    recordsFiltered: 0,
                });
            }

            return callback({
                status: Consts.httpCodeSuccess,
                message: "Visitor Badges fetched successfully",
                data: data,
                draw: parseInt(param.draw),
                recordsTotal: totalRecords,
                recordsFiltered: filteredRecords,
            });
        }
    );
}
}
export default VisitorBadgesLogic;