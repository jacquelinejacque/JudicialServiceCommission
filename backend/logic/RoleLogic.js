
import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Op, Sequelize } from "sequelize";
import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";

class RoleLogic {
    static create(body, callback) {
        async.waterfall(
            [
                function (done) {

                    if (Utils.isEmpty(body.roleName))
                        return done("Role name cannot be empty");

                    DatabaseManager.role
                        .findOne({
                            where: {
                                roleName: body.roleName,
                            },
                        })
                        .then((res) => {
                            if (res)
                                return done("Role with similar name already exists");

                            done(null);
                        })
                        .catch((err) => done(err));
                },

                function (done) {

                    const params = {
                        roleName: body.roleName,
                        description: body.description || null,
                        status: body.status || "active",
                    };

                    DatabaseManager.role
                        .create(params)
                        .then((res) => done(null, res))
                        .catch((err) => done(err));
                },
            ],
            function (err, data) {
                if (err)
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to create role",
                        error: err,
                    });

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Role created successfully",
                    role: data,
                });
            }
        );
    }

    static list(body, callback) {
        async.waterfall(
            [
                // Step 1: Validate inputs / prepare filters
                function (done) {
                    const limit = parseInt(body.limit, 10) || 10;
                    const offset = parseInt(body.offset, 10) || 0;

                    const whereClause = {};

                    // Optional filters
                    if (!Utils.isEmpty(body.roleName)) {
                        whereClause.roleName = {
                            [Op.like]: `%${body.roleName}%`,
                        };
                    }

                    if (!Utils.isEmpty(body.status)) {
                        whereClause.status = body.status;
                    }

                    done(null, { limit, offset, whereClause });
                },

                // Step 2: Fetch roles from DB
                function (params, done) {
                    DatabaseManager.role
                        .findAndCountAll({
                            where: params.whereClause,
                            limit: params.limit,
                            offset: params.offset,
                            order: [["createdAt", "DESC"]],
                        })
                        .then((res) => {
                            done(null, {
                                rows: res.rows,
                                count: res.count,
                                limit: params.limit,
                                offset: params.offset,
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
                        message: "Failed to fetch roles",
                        error: err,
                    });

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Roles fetched successfully",
                    data: {
                        roles: data.rows,
                        total: data.count,
                        limit: data.limit,
                        offset: data.offset,
                    },
                });
            }
        );
    }

    static update(body, callback) {
        async.waterfall(
            [
                function (done) {

                    if (Utils.isEmpty(body.roleID))
                        return done("Role ID is required");

                    if (Utils.isEmpty(body.roleName))
                        return done("Role name cannot be empty");

                    DatabaseManager.role
                        .findOne({
                            where: {
                                roleID: body.roleID,
                            },
                        })
                        .then((res) => {
                            if (Utils.isEmpty(res))
                                return done("Role not found");

                            done(null);
                        })
                        .catch((err) => {
                            console.error("Find error:", err);
                            done(err);
                        });
                },

                function (done) {

                    DatabaseManager.role
                        .findOne({
                            where: {
                                roleName: body.roleName,
                                roleID: {
                                    [Op.ne]: body.roleID,
                                },
                            },
                        })
                        .then((res) => {
                            if (res)
                                return done("Role with similar name already exists");

                            done(null);
                        })
                        .catch((err) => {
                            console.error("Validation error:", err);
                            done(err);
                        });
                },

                function (done) {

                    const params = {
                        roleName: body.roleName,
                        description: body.description || null,
                        status: body.status || "active",
                    };

                    DatabaseManager.role
                        .update(params, {
                            where: {
                                roleID: body.roleID,
                            },
                        })
                        .then((res) => {
                            done(null, res);
                        })
                        .catch((err) => {
                            console.error("Update error:", err);
                            done(err);
                        });
                },
            ],

            function (err, data) {

                if (err) {
                    const errorMessage =
                        typeof err === "string"
                            ? err
                            : err.message || "Internal server error";

                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to update role",
                        error: errorMessage,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Role updated successfully",
                });
            }
        );
    }
}

export default RoleLogic;