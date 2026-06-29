import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Op, Sequelize } from "sequelize";
import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";

class PermissionLogic {
    static create(body, callback) {
        async.waterfall(
            [
                function (done) {

                    if (Utils.isEmpty(body.code))
                        return done("Permission code cannot be empty");

                    if (Utils.isEmpty(body.module))
                        return done("Module cannot be empty");

                    if (Utils.isEmpty(body.action))
                        return done("Action cannot be empty");

                    DatabaseManager.permission
                        .findOne({
                            where: {
                                code: body.code,
                            },
                        })
                        .then((res) => {
                            if (res)
                                return done("Permission with similar code already exists");

                            done(null);
                        })
                        .catch((err) => done(err));
                },

                function (done) {

                    const params = {
                        code: body.code.trim(),
                        module: body.module.trim(),
                        action: body.action.trim(),
                        description: body.description || null,
                    };

                    DatabaseManager.permission
                        .create(params)
                        .then((res) => done(null, res))
                        .catch((err) => done(err));
                },
            ],

            function (err, data) {

                if (err)
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to create permission",
                        error: err,
                    });

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Permission created successfully",
                    permission: data,
                });
            }
        );
    }

    static list(param, callback) {
        const baseQuery = {};
        let filteredQuery = { ...baseQuery };

        if (!Utils.isEmpty(param.module)) {
            filteredQuery.module = String(param.module).trim();
        }

        if (!Utils.isEmpty(param.action)) {
            filteredQuery.action = String(param.action).trim();
        }

        if (!Utils.isEmpty(param["search[value]"])) {

            const searchValue = param["search[value]"];

            filteredQuery = {
                ...filteredQuery,
                [Op.or]: [
                    {
                        code: {
                            [Op.like]: `%${searchValue}%`,
                        },
                    },
                    {
                        module: {
                            [Op.like]: `%${searchValue}%`,
                        },
                    },
                    {
                        action: {
                            [Op.like]: `%${searchValue}%`,
                        },
                    },
                    {
                        description: {
                            [Op.like]: `%${searchValue}%`,
                        },
                    },
                ],
            };
        }

        async.waterfall(
            [
                function (done) {

                    DatabaseManager.permission
                        .count({
                            where: baseQuery,
                        })
                        .then((totalRecords) =>
                            done(null, totalRecords)
                        )
                        .catch((err) => done(err));
                },

                function (totalRecords, done) {

                    DatabaseManager.permission
                        .count({
                            where: filteredQuery,
                        })
                        .then((filteredRecords) =>
                            done(
                                null,
                                totalRecords,
                                filteredRecords
                            )
                        )
                        .catch((err) => done(err));
                },

                function (
                    totalRecords,
                    filteredRecords,
                    done
                ) {

                    const offset =
                        parseInt(param.start) || 0;

                    const limit =
                        parseInt(param.length) || 100;

                    DatabaseManager.permission
                        .findAll({
                            where: filteredQuery,

                            attributes: [
                                "permissionID",
                                "code",
                                "module",
                                "action",
                                "description",
                                "createdAt",
                            ],

                            order: [
                                ["createdAt", "DESC"],
                            ],

                            offset,
                            limit,
                        })
                        .then((data) => {
                            done(
                                null,
                                totalRecords,
                                filteredRecords,
                                data
                            );
                        })
                        .catch((err) => done(err));
                },
            ],

            function (
                err,
                totalRecords,
                filteredRecords,
                data
            ) {

                if (err) {
                    return callback({
                        status:
                            Consts.httpCodeServerError,
                        message:
                            "Failed to fetch permissions",
                        error: err,
                        data: [],
                        recordsTotal: 0,
                        recordsFiltered: 0,
                    });
                }

                return callback({
                    status:
                        Consts.httpCodeSuccess,
                    message:
                        "Permissions fetched successfully",
                    data,
                    draw:
                        parseInt(param.draw) || 1,
                    recordsTotal:
                        totalRecords,
                    recordsFiltered:
                        filteredRecords,
                });
            }
        );
    }
}

export default PermissionLogic;