import async from "async";
import { Op } from "sequelize";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
class ReceptionistDeskLogic {
static create(body, loggedInUser, callback) {
    async.waterfall(
        [
            function (done) {
                if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                    return done("Authenticated user is required");
                }

                if (Utils.isEmpty(body.deskName)) {
                    return done("Desk name is required");
                }

                if (Utils.isEmpty(body.deskCode)) {
                    return done("Desk code is required");
                }

                if (Utils.isEmpty(body.phoneNumber)) {
                    return done("Phone number is required");
                }

                if (Utils.isEmpty(body.receptionistUserID)) {
                    return done("Receptionist user is required");
                }

                const validStatuses = ["active", "inactive"];
                if (!Utils.isEmpty(body.status) && !validStatuses.includes(body.status)) {
                    return done("Invalid status selected");
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
                            return done("Only admins can create reception desks");
                        }

                        return done(null, user);
                    })
                    .catch((err) => {
                        return done(err);
                    });
            },

            function (adminUser, done) {
                DatabaseManager.user
                    .findOne({
                        where: {
                            userID: body.receptionistUserID,
                            role: "receptionist",
                            status: "active",
                        },
                    })
                    .then((receptionistUser) => {
                        if (!receptionistUser) {
                            return done("Selected receptionist was not found, inactive, or does not have receptionist role");
                        }

                        return done(null, adminUser, receptionistUser);
                    })
                    .catch((err) => {
                        return done(err);
                    });
            },

            function (adminUser, receptionistUser, done) {
                DatabaseManager.receptionDesk
                    .findOne({
                        where: {
                            [Op.or]: [
                                { deskName: body.deskName },
                                { deskCode: body.deskCode }
                            ]
                        },
                    })
                    .then((existingDesk) => {
                        if (existingDesk) {
                            if (existingDesk.deskName === body.deskName) {
                                return done("A reception desk with the same desk name already exists");
                            }

                            if (existingDesk.deskCode === body.deskCode) {
                                return done("A reception desk with the same desk code already exists");
                            }
                        }

                        return done(null, adminUser, receptionistUser);
                    })
                    .catch((err) => {
                        return done(err);
                    });
            },

            function (adminUser, receptionistUser, done) {
                DatabaseManager.receptionDesk
                    .findOne({
                        where: {
                            receptionistUserID: receptionistUser.userID,
                            status: "active",
                        },
                    })
                    .then((existingAssignment) => {
                        if (existingAssignment) {
                            return done("This receptionist is already assigned to another active reception desk");
                        }

                        return done(null, receptionistUser);
                    })
                    .catch((err) => {
                        return done(err);
                    });
            },

            function (receptionistUser, done) {
                const params = {
                    deskName: body.deskName,
                    deskCode: body.deskCode,
                    phoneNumber: body.phoneNumber,
                    receptionistUserID: body.receptionistUserID,
                    status: body.status || "active",
                    remarks: body.remarks || null,
                };

                DatabaseManager.receptionDesk
                    .create(params)
                    .then((desk) => {
                        return done(null, desk, receptionistUser);
                    })
                    .catch((err) => {
                        return done(err);
                    });
            },
        ],
        function (err, desk, receptionistUser) {
            if (err) {
                return callback({
                    status: Consts.httpCodeBadRequest || 400,
                    message: "Failed to create reception desk",
                    error: err,
                });
            }

            return callback({
                status: Consts.httpCodeSuccess,
                message: "Reception desk created successfully",
                data: {
                    ...desk.get({ plain: true }),
                    receptionist: receptionistUser
                        ? {
                              userID: receptionistUser.userID,
                              name: receptionistUser.name,
                              email: receptionistUser.email,
                              phone: receptionistUser.phone,
                              role: receptionistUser.role,
                              status: receptionistUser.status,
                          }
                        : null,
                },
            });
        }
    );
}
    
    static list(param, callback) {
        const baseQuery = {};
        let filteredQuery = { ...baseQuery };

        if (!Utils.isEmpty(param.deskName)) {
            filteredQuery.deskName = param.deskName;
        }

        if (!Utils.isEmpty(param.deskCode)) {
            filteredQuery.deskCode = param.deskCode;
        }

        if (!Utils.isEmpty(param.phoneNumber)) {
            filteredQuery.phoneNumber = param.phoneNumber;
        }

        if (!Utils.isEmpty(param.receptionistUserID)) {
            filteredQuery.receptionistUserID = param.receptionistUserID;
        }

        if (!Utils.isEmpty(param.status)) {
            filteredQuery.status = param.status;
        }

        if (!Utils.isEmpty(param["search[value]"])) {
            const searchValue = param["search[value]"];

            filteredQuery = {
                ...filteredQuery,
                [Op.or]: [
                    { deskName: { [Op.like]: `%${searchValue}%` } },
                    { deskCode: { [Op.like]: `%${searchValue}%` } },
                    { phoneNumber: { [Op.like]: `%${searchValue}%` } },
                    { status: { [Op.like]: `%${searchValue}%` } },
                    { remarks: { [Op.like]: `%${searchValue}%` } },
                    { receptionistUserID: { [Op.like]: `%${searchValue}%` } },
                ],
            };
        }

        async.waterfall(
            [
                function (done) {
                    DatabaseManager.receptionDesk
                        .count({ where: baseQuery })
                        .then((totalRecords) => done(null, totalRecords))
                        .catch((err) => done(err));
                },

                function (totalRecords, done) {
                    DatabaseManager.receptionDesk
                        .count({ where: filteredQuery })
                        .then((filteredRecords) => done(null, totalRecords, filteredRecords))
                        .catch((err) => done(err));
                },

                function (totalRecords, filteredRecords, done) {
                    const offset = parseInt(param.start) || 0;
                    const limit = parseInt(param.length) || 10;

                    DatabaseManager.receptionDesk
                        .findAll({
                            where: filteredQuery,
                            attributes: [
                                "receptionDeskID",
                                "deskName",
                                "deskCode",
                                "phoneNumber",
                                "receptionistUserID",
                                "status",
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
                        message: "Failed to fetch Reception Desks",
                        error: err,
                        data: [],
                        recordsTotal: 0,
                        recordsFiltered: 0,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Reception Desks fetched successfully",
                    data: data,
                    draw: parseInt(param.draw),
                    recordsTotal: totalRecords,
                    recordsFiltered: filteredRecords,
                });
            }
        );
    }

    static updateReceptionDesk(body, loggedInUser, callback) {
        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.receptionDeskID)) {
                        return done("Reception desk ID is required");
                    }

                    if (
                        Utils.isEmpty(body.deskName) &&
                        Utils.isEmpty(body.deskCode) &&
                        Utils.isEmpty(body.phoneNumber) &&
                        Utils.isEmpty(body.receptionistUserID) &&
                        Utils.isEmpty(body.status) &&
                        Utils.isEmpty(body.remarks)
                    ) {
                        return done("Provide at least one field to update");
                    }

                    const validStatuses = ["active", "inactive"];
                    if (!Utils.isEmpty(body.status) && !validStatuses.includes(body.status)) {
                        return done("Invalid reception desk status");
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
                                return done("Only admins can update reception desks");
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
                            },
                        })
                        .then((desk) => {
                            if (!desk) {
                                return done("Reception desk not found");
                            }

                            return done(null, desk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (desk, done) {
                    const checks = [];

                    if (!Utils.isEmpty(body.deskName) && body.deskName !== desk.deskName) {
                        checks.push(
                            DatabaseManager.receptionDesk.findOne({
                                where: {
                                    deskName: body.deskName,
                                    receptionDeskID: {
                                        [Op.ne]: body.receptionDeskID,
                                    },
                                },
                            }).then((existingDesk) => {
                                if (existingDesk) {
                                    throw "Another reception desk with this name already exists";
                                }
                            })
                        );
                    }

                    if (!Utils.isEmpty(body.deskCode) && body.deskCode !== desk.deskCode) {
                        checks.push(
                            DatabaseManager.receptionDesk.findOne({
                                where: {
                                    deskCode: body.deskCode,
                                    receptionDeskID: {
                                        [Op.ne]: body.receptionDeskID,
                                    },
                                },
                            }).then((existingDesk) => {
                                if (existingDesk) {
                                    throw "Another reception desk with this code already exists";
                                }
                            })
                        );
                    }
                    // receptionistUserID validation + uniqueness enforcement
                    if (body.hasOwnProperty("receptionistUserID") && body.receptionistUserID) {
                        checks.push(
                            DatabaseManager.user
                                .findOne({
                                    where: {
                                        userID: body.receptionistUserID,
                                        role: "receptionist",
                                        status: "active",
                                    },
                                })
                                .then((user) => {
                                    if (!user) {
                                        throw "Receptionist user not found or not an active receptionist";
                                    }

                                    return DatabaseManager.receptionDesk.findOne({
                                        where: {
                                            receptionistUserID: body.receptionistUserID,
                                            receptionDeskID: {
                                                [Op.ne]: body.receptionDeskID,
                                            },
                                        },
                                    });
                                })
                                .then((existingDesk) => {
                                    if (existingDesk) {
                                        throw "This receptionist is already assigned to another desk";
                                    }
                                })
                        );
                    }

                    Promise.all(checks)
                        .then(() => done(null, desk))
                        .catch((err) => done(err));
                },

                function (desk, done) {
                    const params = {};

                    if (!Utils.isEmpty(body.deskName)) {
                        params.deskName = body.deskName;
                    }

                    if (!Utils.isEmpty(body.deskCode)) {
                        params.deskCode = body.deskCode;
                    }

                    if (!Utils.isEmpty(body.phoneNumber)) {
                        params.phoneNumber = body.phoneNumber;
                    }

                    if (body.hasOwnProperty("receptionistUserID")) {
                        params.receptionistUserID = body.receptionistUserID || null;
                    }

                    if (!Utils.isEmpty(body.status)) {
                        params.status = body.status;
                    }

                    if (!Utils.isEmpty(body.remarks)) {
                        params.remarks = body.remarks;
                    }

                    DatabaseManager.receptionDesk
                        .update(params, {
                            where: {
                                receptionDeskID: body.receptionDeskID,
                            },
                        })
                        .then(() => {
                            return DatabaseManager.receptionDesk.findOne({
                                where: {
                                    receptionDeskID: body.receptionDeskID,
                                },
                            });
                        })
                        .then((updatedDesk) => {
                            return done(null, updatedDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },
            ],
            function (err, desk) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to update reception desk",
                        error: err,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Reception desk updated successfully",
                    data: desk,
                });
            }
        );
    }
}
export default ReceptionistDeskLogic; 