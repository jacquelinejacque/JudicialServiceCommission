import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";
import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";

class RolePermissionLogic {    
    static assign(body, callback) {
        async.waterfall(
            [
                function (done) {

                    if (Utils.isEmpty(body.roleID))
                        return done("Role ID is required");

                    if (Utils.isEmpty(body.permissionID))
                        return done("Permission ID is required");

                    DatabaseManager.role
                        .findOne({
                            where: {
                                roleID: body.roleID
                            }
                        })
                        .then((role) => {
                            if (!role)
                                return done("Role not found");

                            done(null);
                        })
                        .catch((err) => done(err));
                },

                function (done) {

                    DatabaseManager.permission
                        .findOne({
                            where: {
                                permissionID: body.permissionID
                            }
                        })
                        .then((permission) => {
                            if (!permission)
                                return done("Permission not found");

                            done(null);
                        })
                        .catch((err) => done(err));
                },

                function (done) {

                    DatabaseManager.rolePermission
                        .findOne({
                            where: {
                                roleID: body.roleID,
                                permissionID: body.permissionID
                            }
                        })
                        .then((existing) => {

                            if (existing)
                                return done(
                                    "Permission already assigned to this role"
                                );

                            done(null);
                        })
                        .catch((err) => done(err));
                },

                function (done) {

                    const params = {
                        roleID: body.roleID,
                        permissionID: body.permissionID
                    };

                DatabaseManager.rolePermission
                    .create(params)
                    .then((res) => {

                        DatabaseManager.rolePermission.findOne({
                            where: {
                                rolePermissionID: res.rolePermissionID
                            },
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role",
                                    attributes: [
                                        "roleID",
                                        "roleName"
                                    ]
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: [
                                        "permissionID",
                                        "code",
                                        "module",
                                        "action"
                                    ]
                                }
                            ]
                        })
                        .then((result) => {

                            const response = {
                                rolePermissionID: result.rolePermissionID,

                                role: {
                                    roleID: result.role.roleID,
                                    roleName: result.role.roleName
                                },

                                permission: {
                                    permissionID: result.permission.permissionID,
                                    code: result.permission.code,
                                    module: result.permission.module,
                                    action: result.permission.action
                                }
                            };

                            done(null, response);

                        })
                        .catch((err) => done(err));
                        

                    })
                    .catch((err) => done(err));
                }
            ],

            function (err, data) {

                if (err) {
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to assign permission",
                        error: err
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Permission assigned successfully",
                    rolePermission: data
                });
            }
        );
    }

    static reassignPermissionToRole(body, callback) {
        async.waterfall(
            [
                // Step 1: Validate input
                function (done) {
                    if (Utils.isEmpty(body.rolePermissionID)) {
                        return done({
                            status: Consts.httpCodeBadRequest,
                            message: "rolePermissionID is required"
                        });
                    }

                    if (Utils.isEmpty(body.permissionID)) {
                        return done({
                            status: Consts.httpCodeBadRequest,
                            message: "permissionID is required"
                        });
                    }

                    done(null);
                },

                // Step 2: Find existing rolePermission
                function (done) {
                    DatabaseManager.rolePermission
                        .findOne({
                            where: {
                                rolePermissionID: body.rolePermissionID
                            },
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role",
                                    attributes: ["roleID", "roleName"]
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: ["permissionID", "code", "module", "action"]
                                }
                            ]
                        })
                        .then((rolePermission) => {
                            if (!rolePermission) {
                                return done({
                                    status: Consts.httpCodeNotFound,
                                    message: "Role permission not found"
                                });
                            }

                            done(null, rolePermission);
                        })
                        .catch((err) => done(err));
                },

                // Step 3: Confirm new permission exists
                function (rolePermission, done) {
                    DatabaseManager.permission
                        .findOne({
                            where: {
                                permissionID: body.permissionID
                            }
                        })
                        .then((permission) => {
                            if (!permission) {
                                return done({
                                    status: Consts.httpCodeNotFound,
                                    message: "Permission not found"
                                });
                            }

                            done(null, rolePermission, permission);
                        })
                        .catch((err) => done(err));
                },

                // Step 4: Prevent duplicate role-permission assignment
                function (rolePermission, permission, done) {
                    DatabaseManager.rolePermission
                        .findOne({
                            where: {
                                roleID: rolePermission.roleID,
                                permissionID: body.permissionID
                            }
                        })
                        .then((existingAssignment) => {
                            if (
                                existingAssignment &&
                                existingAssignment.rolePermissionID !== rolePermission.rolePermissionID
                            ) {
                                return done({
                                    status: Consts.httpCodeConflict || 409,
                                    message: "This role already has the selected permission"
                                });
                            }

                            done(null, rolePermission, permission);
                        })
                        .catch((err) => done(err));
                },

                // Step 5: Update permission
                function (rolePermission, permission, done) {
                    const previousValue = {
                        rolePermissionID: rolePermission.rolePermissionID,
                        roleID: rolePermission.roleID,
                        permissionID: rolePermission.permissionID
                    };

                    rolePermission
                        .update({
                            permissionID: body.permissionID
                        })
                        .then((updatedRolePermission) => {
                            done(null, updatedRolePermission, previousValue);
                        })
                        .catch((err) => done(err));
                },

                // Step 6: Fetch updated record cleanly
                function (updatedRolePermission, previousValue, done) {
                    DatabaseManager.rolePermission
                        .findOne({
                            where: {
                                rolePermissionID: updatedRolePermission.rolePermissionID
                            },
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role",
                                    attributes: ["roleID", "roleName"]
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: ["permissionID", "code", "module", "action"]
                                }
                            ]
                        })
                        .then((finalRecord) => {
                            done(null, finalRecord, previousValue);
                        })
                        .catch((err) => done(err));
                }
            ],

            function (err, data, previousValue) {
                if (err) {
                    return callback({
                        status: err.status || Consts.httpCodeServerError,
                        message: err.message || "Failed to reassign permission to role",
                        error: err,
                    });
                }

                const cleanedData = {
                    rolePermissionID: data.rolePermissionID,

                    role: {
                        roleID: data.role?.roleID,
                        roleName: data.role?.roleName
                    },

                    permission: {
                        permissionID: data.permission?.permissionID,
                        code: data.permission?.code,
                        module: data.permission?.module,
                        action: data.permission?.action
                    },

                    previousValue,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                };

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Permission reassigned to role successfully",
                    data: cleanedData
                });
            }
        );
    }  
      
    static remove(body, callback) {
        async.waterfall(
            [
                function (done) {

                    if (Utils.isEmpty(body.rolePermissionID))
                        return done("Role Permission ID is required");

                    DatabaseManager.rolePermission
                        .findOne({
                            where: {
                                rolePermissionID: body.rolePermissionID
                            },
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role",
                                    attributes: [
                                        "roleID",
                                        "roleName"
                                    ]
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: [
                                        "permissionID",
                                        "code",
                                        "module",
                                        "action"
                                    ]
                                }
                            ]
                        })
                        .then((res) => {

                            if (!res)
                                return done(
                                    "Role permission assignment not found"
                                );

                            done(null, res);
                        })
                        .catch((err) => done(err));
                },

                function (rolePermission, done) {

                    DatabaseManager.rolePermission
                        .destroy({
                            where: {
                                rolePermissionID:
                                    rolePermission.rolePermissionID
                            }
                        })
                        .then(() => {
                            done(null, rolePermission);
                        })
                        .catch((err) => done(err));
                }
            ],

            function (err, rolePermission) {

                if (err) {
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to remove permission",
                        error: err
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Permission removed successfully",

                    rolePermission: {
                        rolePermissionID:
                            rolePermission.rolePermissionID,

                        role: {
                            roleID:
                                rolePermission.role.roleID,
                            roleName:
                                rolePermission.role.roleName
                        },

                        permission: {
                            permissionID:
                                rolePermission.permission.permissionID,
                            code:
                                rolePermission.permission.code,
                            module:
                                rolePermission.permission.module,
                            action:
                                rolePermission.permission.action
                        }
                    }
                });
            }
        );
    }

    static list(param, callback) {
        const baseQuery = {};
        let filteredQuery = { ...baseQuery };

        // Filter by role
        if (!Utils.isEmpty(param.roleID)) {
            filteredQuery.roleID = param.roleID;
        }

        // Filter by permission
        if (!Utils.isEmpty(param.permissionID)) {
            filteredQuery.permissionID = param.permissionID;
        }

        // Search
        if (!Utils.isEmpty(param["search[value]"])) {

            const searchValue = param["search[value]"];

            filteredQuery = {
                ...filteredQuery,
                [Op.or]: [
                    { "$role.roleName$": { [Op.like]: `%${searchValue}%` } },
                    { "$permission.code$": { [Op.like]: `%${searchValue}%` } },
                    { "$permission.module$": { [Op.like]: `%${searchValue}%` } },
                    { "$permission.action$": { [Op.like]: `%${searchValue}%` } }
                ]
            };
        }

        async.waterfall(
            [
                function (done) {

                    DatabaseManager.rolePermission
                        .count({
                            where: baseQuery,
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role"
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission"
                                }
                            ]
                        })
                        .then((totalRecords) =>
                            done(null, totalRecords)
                        )
                        .catch((err) => done(err));
                },

                function (totalRecords, done) {

                    DatabaseManager.rolePermission
                        .count({
                            where: filteredQuery,
                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role"
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission"
                                }
                            ]
                        })
                        .then((filteredRecords) =>
                            done(null, totalRecords, filteredRecords)
                        )
                        .catch((err) => done(err));
                },

                function (totalRecords, filteredRecords, done) {

                    const offset = parseInt(param.start) || 0;
                    const limit = parseInt(param.length) || 100;

                    DatabaseManager.rolePermission
                        .findAll({
                            where: filteredQuery,

                            include: [
                                {
                                    model: DatabaseManager.role,
                                    as: "role",
                                    attributes: ["roleID", "roleName"]
                                },
                                {
                                    model: DatabaseManager.permission,
                                    as: "permission",
                                    attributes: [
                                        "permissionID",
                                        "code",
                                        "module",
                                        "action"
                                    ]
                                }
                            ],

                            order: [["createdAt", "DESC"]],
                            offset,
                            limit
                        })
                        .then((data) => {
                            done(null, totalRecords, filteredRecords, data);
                        })
                        .catch((err) => done(err));
                }
            ],

            function (err, totalRecords, filteredRecords, data) {

                if (err) {
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to fetch role permissions",
                        error: err,
                        data: [],
                        recordsTotal: 0,
                        recordsFiltered: 0
                    });
                }

                // CLEAN TRANSFORMATION (remove duplication)
                const cleanedData = data.map(item => ({
                    rolePermissionID: item.rolePermissionID,

                    role: {
                        roleID: item.role?.roleID,
                        roleName: item.role?.roleName
                    },

                    permission: {
                        permissionID: item.permission?.permissionID,
                        code: item.permission?.code,
                        module: item.permission?.module,
                        action: item.permission?.action
                    },

                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                }));

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Role permissions fetched successfully",
                    data: cleanedData,
                    draw: parseInt(param.draw),
                    recordsTotal: totalRecords,
                    recordsFiltered: filteredRecords
                });
            }
        );
    }
}

export default RolePermissionLogic;