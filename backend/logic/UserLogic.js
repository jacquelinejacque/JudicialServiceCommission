
import async from "async";
import DatabaseManager from "../lib/DatabaseManager.js";
import { Op, Sequelize } from "sequelize";
import { Consts } from "../lib/Consts.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Utils from "../lib/Utils.js";
import { where } from "sequelize";

class UserLogic {

static create(body, callback) {
    async.waterfall(
        [
            function (done) {
                if (Utils.isEmpty(body.name)) return done("Name cannot be empty");
                if (Utils.isEmpty(body.phone)) return done("Phone number is required");
                if (Utils.isEmpty(body.email)) return done("Email is required");

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(body.email)) return done("Please enter a valid email address");

                if (Utils.isEmpty(body.password)) return done("Password is required");

                const validTeams = ['JSC', 'eboard', 'tonerSupport', 'networkSupport', 'softwareSupport'];
                if (body.team && !validTeams.includes(body.team)) {
                    return done("Invalid team selected");
                }

                DatabaseManager.user
                    .findOne({ where: { email: body.email } })
                    .then((res) => {
                        if (res) return done("User with similar details already exists");
                        done(null);
                    })
                    .catch((err) => done(err));
            },

            function (done) {
                const params = {
                    name: body.name,
                    phone: body.phone,
                    email: body.email,
                    password: bcrypt.hashSync(body.password, 8),
                    role: body.role || "normalUser",
                    team: body.team || "JSC",
                };

                DatabaseManager.user
                    .create(params)
                    .then((res) => done(null, res))
                    .catch((err) => done(err));
            },
        ],
        function (err, data) {
            if (err)
                return callback({
                    status: Consts.httpCodeServerError,
                    message: "Failed to create user",
                    error: err,
                });

            // Remove sensitive fields
            const user = data.get({ plain: true });
            delete user.password;
        
            return callback({
                status: Consts.httpCodeSuccess,
                message: "User created successfully",
                user: user,
            });
        }
    );
}

    static login(body, callback) {
        async.waterfall(
            [
                function (done) {
                    if (Utils.isEmpty(body.password)) return done("Password cannot be empty");
                    if (Utils.isEmpty(body.username)) return done("Username is required");
                    
                    DatabaseManager.user
                        .findOne({
                            attributes: ["userID", "name", "phone", "email", "password", "role"],
                            where: { email: body.username }
                        })
                        .then((user) => {
                            if (!user) return done("Invalid credentials");
                            done(null, user);
                        })
                        .catch((err) => done(err));
                },
                function (user, done) {
                    if (!bcrypt.compareSync(body.password, user.password)) {
                        return done("Invalid credentials");
                    }

                    const session = Utils.randomString(40);
                    const expiry = Utils.addTimeToDate(0, 0, 1, 0, 0); // 1 hour expiry

                    DatabaseManager.user
                        .update({ session, expiry }, {
                            where: { email: user.email }
                        })
                        .then(() => done(null, user, session, expiry))
                        .catch((err) => done(err));
                },
                function (user, session, expiry, done) {
                    const payload = {
                        session,
                        expiry,
                        role: user.role,
                        name: user.name,
                        email: user.email,
                        userID: user.userID
                    };

                    jwt.sign(
                        payload,
                        process.env["JWT_KEY"],
                        { expiresIn: process.env["JWT_EXPIRY_TIME"] },
                        (err, token) => {
                            if (err) return done(err);
                            done(null, token, user);
                        }
                    );
                }
            ],
            function (err, token, user) {
                if (err) {
                    console.error('Login error:', err);
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Failed to login",
                        error: err.message || err
                    });
                }

                callback({
                    status: Consts.httpCodeSuccess,
                    jwtToken: token,
                    user: {
                        userID: user.userID,
                        name: user.name,
                        phone: user.phone,
                        role: user.role,
                        session: user.session,
                        email: user.email,
                        expiry: user.expiry
                    }
                });
            }
        );
    } 
    static findById(userId, callback) {
        async.waterfall(
            [
                function (done) {
                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: userId,
                            },
                            attributes: ["userID", "name", "phone", "email", "password", "role", "status"],
                        })
                        .then((res) => {
                            done(null, res);
                        })
                        .catch((err) => {
                            done(err);
                        });
                },
            ],

            function (err, data) {
                if (err)
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: "Error fetching user",
                        error: err,
                    });

                return callback({
                    status: Consts.httpCodeSuccess,
                    user: data,
                });
            }
        );
    }
    static list(param, callback) {
        const baseQuery = {}; // No restriction: fetch all users
        let filteredQuery = { ...baseQuery };
        if (!Utils.isEmpty(param.role)) {
            filteredQuery.role = param.role;
        }    

        if (!Utils.isEmpty(param["search[value]"])) {
            const searchValue = param["search[value]"];
            filteredQuery = {
                ...filteredQuery,
                [Op.or]: [
                    { email: { [Op.like]: `%${searchValue}%` } },
                    { phone: { [Op.like]: `%${searchValue}%` } },
                    { name: { [Op.like]: `%${searchValue}%` } },
                    { status: { [Op.like]: `%${searchValue}%` } }, // allow search by status too
                    { role: { [Op.like]: `%${searchValue}%` } },
                    { team: { [Op.like]: `%${searchValue}%` } }
                ],
            };
        }

        async.waterfall(
            [
            function (done) {
                // Count ALL users regardless of search
                DatabaseManager.user
                .count({ where: baseQuery })
                .then((totalRecords) => done(null, totalRecords))
                .catch((err) => done(err));
            },
            function (totalRecords, done) {
                // Count filtered users (if search applied)
                DatabaseManager.user
                .count({ where: filteredQuery })
                .then((filteredRecords) => done(null, totalRecords, filteredRecords))
                .catch((err) => done(err));
            },
            function (totalRecords, filteredRecords, done) {
                const offset = parseInt(param.start) || 0;
                const limit = parseInt(param.length) || 10;

                DatabaseManager.user
                .findAll({
                    where: filteredQuery,
                    attributes: ["userID", "name", "phone", "email", "role", "status","team"],
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
                message: "Failed to fetch User Contacts",
                error: err,
                data: [],
                recordsTotal: 0,
                recordsFiltered: 0,
                });
            }

            return callback({
                status: Consts.httpCodeSuccess,
                message: "User Contacts fetched successfully",
                data: data,
                draw: parseInt(param.draw),
                recordsTotal: totalRecords,
                recordsFiltered: filteredRecords,
            });
            }
        );
    }

    static update(body, callback) {
        async.waterfall(
            [
            function (done) {
                if (Utils.isEmpty(body.name)) return done("Name cannot be empty");
                if (Utils.isEmpty(body.phone)) return done("Phone number is required");
                if (Utils.isEmpty(body.email)) return done("Email is required");
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(body.email)) return done("Please enter a valid email address");

                DatabaseManager.user
                .findOne({
                    attributes: ["userID", "name", "phone", "email","role"],
                    where: { userID: body.userId },
                })
                .then((res) => {
                    if (Utils.isEmpty(res)) {
                    return done("User not found");
                    }
                    done(null);
                })
                .catch((err) => {
                    console.error("Find error:", err);
                    done(err);
                });
            },
        
            function (done) {
                const params = {
                name: body.name,
                phone: body.phone,
                email: body.email,
                role: body.role,
                };
        
                DatabaseManager.user
                .update(params, { where: { userID: body.userId } })
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
                const errorMessage = typeof err === 'string' ? err : (err.message || "Internal server error");
                return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to update user",
                error: errorMessage,
                });
            }
        
            return callback({
                status: Consts.httpCodeSuccess,
                message: "User updated successfully",
            });
            }
        );
    }
    static delete(body, callback) {
        async.waterfall(
        [
            function (done) {
            if (Utils.isEmpty(body.userId)) {
                done("User ID cannot be empty");
                return;
            }
            DatabaseManager.user
                .findOne({
                attributes: ["userID", "name", "phone", "email", "role", "status"],
                where: { userID: body.userId, status: { [Sequelize.Op.in]: ["active"] } },
                })
                .then((res) => {
                if (Utils.isEmpty(res)) {
                    done("User not found or already inactive");
                    return;
                }
                done(null, res);
                })
                .catch((err) => done(err));
            },
            function (user, done) {
            DatabaseManager.user
                .update({ status: "inactive" }, { where: { userID: user.userID } })
                .then(() => {
                user.status = "inactive"; 
                done(null, user);
                })              
                .catch((err) => done(err));
            }
        ],
        function (err, updatedUser) {
            if (err)
            return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to inactivate User",
                error: err,
            });

            return callback({
            status: Consts.httpCodeSuccess,
            message: "User successfully marked as inactive",
            data: updatedUser,
            });
        }
        );
    }
    static reactivate(body, callback) {
        async.waterfall(
        [
            function (done) {
            if (Utils.isEmpty(body.userId)) {
                done("User ID cannot be empty");
                return;
            }
            DatabaseManager.user
                .findOne({
                attributes: ["userID", "name", "phone", "email", "role", "status"],
                where: { userID: body.userId, status: { [Sequelize.Op.in]: ["inactive"] } },
                })
                .then((res) => {
                if (Utils.isEmpty(res)) {
                    done("User not in an inactive state");
                    return;
                }
                done(null, res);
                })
                .catch((err) => done(err));
            },
            function (user, done) {
            DatabaseManager.user
                .update({ status: "active" }, { where: { userID: user.userID } })
                .then(() => {
                user.status = "active"; 
                done(null, user);
                })              
                .catch((err) => done(err));
            }
        ],
        function (err, updatedUser) {
            if (err)
            return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to reactivate User",
                error: err,
            });

            return callback({
            status: Consts.httpCodeSuccess,
            message: "User successfully reactivated",
            data: updatedUser,
            });
        }
        );
    }  
    static deletePermanently(body, callback) {
        async.waterfall(
            [
            function (done) {
                if (Utils.isEmpty(body.userId)) {
                return done("user ID cannot be empty");
                }
                DatabaseManager.user
                .findOne({
                    attributes: ["userID", "name", "phone", "email", ],
                    where: { userID: body.userId, status: "deleted" },
                })
                .then((res) => {
                    if (Utils.isEmpty(res)) {
                    return done("User not in a deleted state");
                    }
                    done(null, res); 
                })
                .catch((err) => done(err)); 
            },
            function (user, done) {
                if (body.feedback.toLowerCase() === 'yes') {
                DatabaseManager.user
                    .destroy({ where: { userID: user.userID } })
                    .then(() => {
                    done(null, user); 
                    })
                    .catch((err) => done(err)); 
                } else {
                done("Permanent Deletion cancelled by user"); 
                }
            },
            ],
            function (err, result) {
            if (err) {
                return callback({
                status: Consts.httpCodeServerError,
                message: "Failed to delete user permanently",
                error: err,
                });
            }
    
            return callback({
                status: Consts.httpCodeSuccess,
                message: "User deleted permanently",
                data: result,
            });
            }
        );
    }
    static resetPassword(body, callback) {
        async.waterfall(
            [
                function (done) {
                    if (Utils.isEmpty(body.userId)) {
                        done("UserId is required");
                        return;
                    }
                    if (Utils.isEmpty(body.password)) {
                        done("password is required");
                        return;
                    }

                    done(null);
                },

                function (done) {
                    DatabaseManager.user
                        .findOne({
                            attributes: ["userID", "name", "phone", "email", "session", "expiry", ],
                            where: { userID: body.userId },
                        })
                        .then((user) => {
                            if (user === null) {
                                done("user not found!");
                                return;
                            }
                            done(null, user);
                        })
                        .catch((err) => {
                            console.log("error");
                            done(err, null);
                        });
                },

                function (user, done) {
                    DatabaseManager.user
                        .update(
                            {
                                password: bcrypt.hashSync(body.password, 8),
                            },
                            { where: { userID: user.userID } }
                        )
                        .then((res) => {
                            done(null, "Password reset succesfull");
                        })
                        .catch((error) => {
                            done("Error resetting password", null);
                        });
                },
            ],
            function (err, data) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeServerError,
                        message: err,
                    });
                } else {
                    return callback({
                        status: Consts.httpCodeSuccess,
                        message: data,
                    });
                }
            }
        );
    }
}

export default UserLogic;