import async from "async";
import { Op } from "sequelize";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
class GuestVisitsLogic {
    static preRegisterGuest(body, loggedInUser, callback) {
        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.guestName)) return done("Guest name is required");
                    if (Utils.isEmpty(body.phone)) return done("Guest phone number is required");
                    if (Utils.isEmpty(body.idType)) return done("ID type is required");
                    if (Utils.isEmpty(body.idNumber)) return done("ID number is required");
                    if (Utils.isEmpty(body.purpose)) return done("Purpose of visit is required");
                    if (Utils.isEmpty(body.receptionDeskID)) return done("Reception desk is required");

                    const validIdTypes = ["nationalID", "passport", "workID"];
                    if (!validIdTypes.includes(body.idType)) {
                        return done("Invalid ID type selected");
                    }

                    const validVisitCategories = [
                        "officialMeeting",
                        "vendor",
                        "contractor",
                        "interviewee",
                        "delivery",
                        "walkIn",
                        "personalVisit",
                        "other",
                    ];

                    if (body.visitCategory && !validVisitCategories.includes(body.visitCategory)) {
                        return done("Invalid visit category selected");
                    }

                    if (body.email) {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(body.email)) {
                            return done("Please enter a valid email address");
                        }
                    }

                    if (
                        body.expectedArrival &&
                        body.expectedDeparture &&
                        new Date(body.expectedDeparture) <= new Date(body.expectedArrival)
                    ) {
                        return done("Expected departure must be later than expected arrival");
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

                            if (user.role !== "normalUser" && user.role !== "hostStaff") {
                                return done("Only staff/host users can pre-register guests");
                            }

                            return done(null, user);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, done) {
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

                            return done(null, hostUser, receptionDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, receptionDesk, done) {
                    DatabaseManager.guestVisit
                        .findOne({
                            where: {
                                idNumber: body.idNumber,
                                status: {
                                    [Op.in]: [
                                        "preRegistered",
                                        "pendingApproval",
                                        "approved",
                                        "checkedIn",
                                        "inMeeting",
                                        "overdue",
                                    ],
                                },
                            },
                        })
                        .then((existingVisit) => {
                            if (existingVisit) {
                                return done("This guest already has an active visit record");
                            }

                            return done(null, hostUser, receptionDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, receptionDesk, done) {
                    const approvalRequired =
                        body.approvalRequired === true || body.approvalRequired === "true";

                    const params = {
                        guestName: body.guestName,
                        phone: body.phone,
                        email: body.email || null,
                        idType: body.idType,
                        idNumber: body.idNumber,
                        organization: body.organization || null,
                        purpose: body.purpose,
                        department: body.department || "Administration",
                        visitCategory: body.visitCategory || "personalVisit",
                        expectedArrival: body.expectedArrival || null,
                        expectedDeparture: body.expectedDeparture || null,
                        checkInTime: null,
                        checkOutTime: null,
                        timeIn: body.timeIn || null,
                        expiryTime: null,
                        passNumber: null,
                        badgeID: null,
                        badgeNumber: null,
                        badgeReturned: false,
                        hostNotified: false,
                        approvalRequired: approvalRequired,
                        remarks: body.remarks || null,
                        status: approvalRequired ? "pendingApproval" : "preRegistered",
                        preExpiryAlertSent: false,
                        preExpiryAlertSentAt: null,
                        expiryAlertSent: false,
                        expiryAlertSentAt: null,
                        overstayAlertSent: false,
                        overstayAlertSentAt: null,
                        receptionDeskID: receptionDesk.receptionDeskID,
                        hostUserID: hostUser.userID,
                        createdBy: hostUser.userID,
                        checkedInBy: null,
                        checkedOutBy: null,
                    };

                    DatabaseManager.guestVisit
                        .create(params)
                        .then((res) => {
                            return DatabaseManager.guestVisit.findOne({
                                where: {
                                    visitID: res.visitID,
                                },
                                include: [
                                    {
                                        model: DatabaseManager.receptionDesk,
                                        as: "receptionDesk",
                                        attributes: ["receptionDeskID", "deskName", "deskCode", "phoneNumber"]
                                    }
                                ]
                            });
                        })
                        .then((visitWithDesk) => {
                            return done(null, hostUser, visitWithDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, guestVisit, done) {
                    const visit = guestVisit.get({ plain: true });

                    const smsMessage = Utils.approvalRequiredMessage(
                        visit.guestName,
                        hostUser.name,
                        visit.expectedArrival,
                        visit.status
                    );

                    let callbackCalled = false;

                    try {
                        Utils.sendSMS(visit.phone, smsMessage, function (smsErr, smsResponse) {
                            if (callbackCalled) return;
                            callbackCalled = true;

                            return done(null, guestVisit, {
                                smsSent: !smsErr,
                                smsError: smsErr || null,
                                smsResponse: smsResponse || null,
                            });
                        });
                    } catch (error) {
                        if (callbackCalled) return;
                        callbackCalled = true;

                        return done(null, guestVisit, {
                            smsSent: false,
                            smsError: error.message || error,
                            smsResponse: null,
                        });
                    }
                },
            ],
            function (err, guestVisitRecord, smsMeta) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to pre-register guest",
                        error: err,
                    });
                }

                const guestVisit = guestVisitRecord.get({ plain: true });

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Guest pre-registered successfully",
                    guestVisit: guestVisit,
                    smsStatus: smsMeta || {
                        smsSent: false,
                        smsError: "SMS status unavailable",
                        smsResponse: null,
                    },
                });
            }
        );
    }

    static checkInGuest(body, loggedInUser, callback) {
        let transaction = null;

        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.guestName)) return done("Guest name is required");
                    if (Utils.isEmpty(body.phone)) return done("Guest phone number is required");
                    if (Utils.isEmpty(body.idType)) return done("ID type is required");
                    if (Utils.isEmpty(body.idNumber)) return done("ID number is required");
                    if (Utils.isEmpty(body.receptionDeskID)) return done("Reception desk is required");

                    const validIdTypes = ["nationalID", "passport", "workID", "other"];
                    if (!validIdTypes.includes(body.idType)) {
                        return done("Invalid ID type selected");
                    }

                    if (body.timeIn && (isNaN(body.timeIn) || parseInt(body.timeIn) <= 0)) {
                        return done("Time in must be a valid positive number of minutes");
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

                            if (user.role !== "receptionist" && user.role !== "admin") {
                                return done("Only a receptionist or admin can check in guests");
                            }

                            return done(null, user);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (receptionistUser, done) {
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

                            return done(null, receptionistUser, receptionDesk);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (receptionistUser, receptionDesk, done) {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    const todayEnd = new Date();
                    todayEnd.setHours(23, 59, 59, 999);

                    DatabaseManager.guestVisit
                        .findOne({
                            where: {
                                idNumber: body.idNumber,
                                status: {
                                    [Op.in]: ["preRegistered", "approved", "pendingApproval", "checkedIn"]
                                },
                                createdAt: {
                                    [Op.gte]: todayStart,
                                    [Op.lte]: todayEnd
                                }
                            },
                            include: [
                                {
                                    model: DatabaseManager.user,
                                    as: "host",
                                    attributes: ["userID", "name", "email", "phone", "role", "status"]
                                },
                                {
                                    model: DatabaseManager.receptionDesk,
                                    as: "receptionDesk",
                                    attributes: ["receptionDeskID", "deskName", "deskCode", "phoneNumber", "status"]
                                }
                            ],
                            order: [["createdAt", "DESC"]]
                        })
                        .then((existingVisit) => {
                            return done(null, receptionistUser, receptionDesk, existingVisit);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (receptionistUser, receptionDesk, existingVisit, done) {
                    if (existingVisit) {
                        const detailsMatch = Utils.isGuestDetailsMatch(existingVisit, body);

                        if (!detailsMatch) {
                            return existingVisit
                                .update({
                                    status: "rejected",
                                    remarks: body.remarks
                                        ? `${body.remarks} | Rejected at check-in due to detail mismatch`
                                        : "Rejected at check-in due to detail mismatch",
                                    receptionDeskID: receptionDesk.receptionDeskID,
                                })
                                .then((updatedVisit) => {
                                    return done(null, {
                                        flow: "rejected",
                                        receptionistUser,
                                        receptionDesk,
                                        guestVisit: updatedVisit,
                                        hostUser: updatedVisit.host || null,
                                        smsStatus: null,
                                    });
                                })
                                .catch((err) => {
                                    return done(err);
                                });
                        }

                        if (existingVisit.status === "checkedIn") {
                            return done("This guest is already checked in");
                        }

                        if (existingVisit.status === "pendingApproval") {
                            return done("This guest is still pending approval and cannot be checked in yet");
                        }

                        const checkInTime = new Date();
                        const durationMinutes = parseInt(existingVisit.timeIn || body.timeIn || 60);
                        const expiryTime = Utils.addMinutesToDate(checkInTime, durationMinutes);

                        return done(null, {
                            flow: "checkin-preregistered",
                            receptionistUser,
                            receptionDesk,
                            guestVisit: existingVisit,
                            hostUser: existingVisit.host || null,
                            checkInTime,
                            expiryTime,
                            durationMinutes,
                        });
                    }

                    if (Utils.isEmpty(body.hostUserID)) {
                        return done("Host user is required for walk-in visitors");
                    }

                    if (Utils.isEmpty(body.purpose)) {
                        return done("Purpose of visit is required for walk-in visitors");
                    }

                    DatabaseManager.user
                        .findOne({
                            where: {
                                userID: body.hostUserID,
                                status: "active",
                            },
                        })
                        .then((hostUser) => {
                            if (!hostUser) return done("Selected host was not found");

                            return DatabaseManager.guestVisit.findOne({
                                where: {
                                    idNumber: body.idNumber,
                                    status: {
                                        [Op.in]: ["pendingApproval", "approved", "checkedIn", "inMeeting", "overdue"]
                                    }
                                }
                            }).then((duplicateVisit) => {
                                if (duplicateVisit) {
                                    return done("This visitor already has an active visit record");
                                }

                                const params = {
                                    guestName: body.guestName,
                                    phone: body.phone,
                                    email: body.email || null,
                                    idType: body.idType,
                                    idNumber: body.idNumber,
                                    organization: body.organization || null,
                                    purpose: body.purpose,
                                    department: body.department || "Administration",
                                    visitCategory: "walkIn",
                                    expectedArrival: null,
                                    expectedDeparture: null,
                                    checkInTime: null,
                                    checkOutTime: null,
                                    timeIn: null,
                                    expiryTime: null,
                                    passNumber: null,
                                    badgeID: null,
                                    badgeNumber: null,
                                    badgeReturned: false,
                                    hostNotified: false,
                                    approvalRequired: true,
                                    remarks: body.remarks || "Walk-in visitor awaiting host approval",
                                    status: "pendingApproval",
                                    receptionDeskID: receptionDesk.receptionDeskID,
                                    hostUserID: hostUser.userID,
                                    createdBy: receptionistUser.userID,
                                    checkedInBy: null,
                                    checkedOutBy: null,
                                };

                                return DatabaseManager.guestVisit
                                    .create(params)
                                    .then((visit) => {
                                        return done(null, {
                                            flow: "walkin-pending-approval",
                                            receptionistUser,
                                            receptionDesk,
                                            guestVisit: visit,
                                            hostUser,
                                        });
                                    });
                            });
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (payload, done) {
                    if (payload.flow === "rejected") {
                        return done(null, payload);
                    }

                    if (payload.flow === "walkin-pending-approval") {
                        const visit = payload.guestVisit.get({ plain: true });

                        const smsMessage = `A walk-in visitor ${visit.guestName} (${visit.idNumber}) is at ${payload.receptionDesk.deskName} requesting to see you for ${visit.purpose}. Please confirm approval.`;

                        let callbackCalled = false;

                        try {
                            Utils.sendSMS(payload.hostUser.phone, smsMessage, function (smsErr, smsResponse) {
                                if (callbackCalled) return;
                                callbackCalled = true;

                                payload.guestVisit
                                    .update({
                                        hostNotified: !smsErr,
                                        remarks: !smsErr
                                            ? visit.remarks
                                            : `${visit.remarks} | Host notification failed`,
                                    })
                                    .then((updatedVisit) => {
                                        return done(null, {
                                            flow: payload.flow,
                                            receptionDesk: payload.receptionDesk,
                                            guestVisit: updatedVisit,
                                            hostUser: payload.hostUser,
                                            smsStatus: {
                                                smsSent: !smsErr,
                                                smsError: smsErr || null,
                                                smsResponse: smsResponse || null,
                                            },
                                        });
                                    })
                                    .catch((err) => {
                                        return done(err);
                                    });
                            });
                        } catch (error) {
                            if (callbackCalled) return;
                            callbackCalled = true;

                            payload.guestVisit
                                .update({
                                    hostNotified: false,
                                    remarks: `${visit.remarks} | Host notification failed`,
                                })
                                .then((updatedVisit) => {
                                    return done(null, {
                                        flow: payload.flow,
                                        receptionDesk: payload.receptionDesk,
                                        guestVisit: updatedVisit,
                                        hostUser: payload.hostUser,
                                        smsStatus: {
                                            smsSent: false,
                                            smsError: error.message || error,
                                            smsResponse: null,
                                        },
                                    });
                                })
                                .catch((err) => {
                                    return done(err);
                                });
                        }

                        return;
                    }

                    if (payload.flow === "checkin-preregistered") {
                        DatabaseManager.sequelize
                            .transaction()
                            .then((t) => {
                                transaction = t;

                                const visit = payload.guestVisit;
                                const deskCode = payload.receptionDesk.deskCode;
                                const dateCode = Utils.getDateStringForPass(payload.checkInTime);

                                const tryGeneratePassAndAssignBadge = (attempt = 0) => {
                                    if (attempt > 5) {
                                        return Promise.reject("Failed to generate unique pass number");
                                    }

                                    return DatabaseManager.guestVisit
                                        .count({
                                            where: {
                                                receptionDeskID: payload.receptionDesk.receptionDeskID,
                                                checkInTime: {
                                                    [Op.gte]: new Date(`${dateCode.substring(0,4)}-${dateCode.substring(4,6)}-${dateCode.substring(6,8)}T00:00:00.000Z`),
                                                    [Op.lt]: new Date(`${dateCode.substring(0,4)}-${dateCode.substring(4,6)}-${dateCode.substring(6,8)}T23:59:59.999Z`)
                                                },
                                                passNumber: {
                                                    [Op.ne]: null
                                                }
                                            },
                                            transaction: transaction
                                        })
                                        .then((count) => {
                                            const sequence = count + 1 + attempt;
                                            const passNumber = `VIS/JSC/${deskCode}/${dateCode}/${Utils.padSequence(sequence)}`;

                                            return DatabaseManager.visitorBadge.findOne({
                                                where: {
                                                    receptionDeskID: payload.receptionDesk.receptionDeskID,
                                                    status: "available",
                                                },
                                                order: [["badgeNumber", "ASC"]],
                                                transaction: transaction
                                            })
                                            .then((availableBadge) => {
                                                if (!availableBadge) {
                                                    return Promise.reject("No available visitor badge at this reception desk");
                                                }

                                                return visit.update({
                                                    checkInTime: payload.checkInTime,
                                                    timeIn: payload.durationMinutes,
                                                    expiryTime: payload.expiryTime,
                                                    receptionDeskID: payload.receptionDesk.receptionDeskID,
                                                    checkedInBy: payload.receptionistUser.userID,
                                                    passNumber: passNumber,
                                                    badgeID: availableBadge.badgeID,
                                                    badgeNumber: availableBadge.badgeNumber,
                                                    status: "checkedIn",
                                                    remarks: body.remarks || visit.remarks,
                                                }, { transaction: transaction })
                                                .then((updatedVisit) => {
                                                    return availableBadge.update({
                                                        status: "issued",
                                                        currentVisitID: updatedVisit.visitID,
                                                        issuedAt: payload.checkInTime,
                                                        returnedAt: null,
                                                    }, { transaction: transaction })
                                                    .then(() => updatedVisit);
                                                });
                                            });
                                        })
                                        .catch((err) => {
                                            if (
                                                err &&
                                                (err.name === "SequelizeUniqueConstraintError" ||
                                                    `${err}`.includes("unique"))
                                            ) {
                                                return tryGeneratePassAndAssignBadge(attempt + 1);
                                            }
                                            return Promise.reject(err);
                                        });
                                };

                                return tryGeneratePassAndAssignBadge();
                            })
                            .then((updatedVisit) => {
                                return transaction.commit()
                                    .then(() => {
                                        return done(null, {
                                            flow: payload.flow,
                                            receptionDesk: payload.receptionDesk,
                                            guestVisit: updatedVisit,
                                            hostUser: payload.hostUser,
                                            smsStatus: null,
                                        });
                                    });
                            })
                            .catch((err) => {
                                if (transaction) {
                                    return transaction.rollback()
                                        .then(() => {
                                            transaction = null;
                                            return done(err);
                                        })
                                        .catch(() => {
                                            transaction = null;
                                            return done(err);
                                        });
                                }

                                return done(err);
                            });

                        return;
                    }

                    return done("Invalid guest check-in flow");
                },
            ],
            function (err, result) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to check in guest",
                        error: err,
                    });
                }

                const guestVisit = result.guestVisit.get({ plain: true });

                const badge = result.flow === "checkin-preregistered"
                    ? {
                        badgeID: guestVisit.badgeID,
                        badgeNumber: guestVisit.badgeNumber,
                        passNumber: guestVisit.passNumber,
                        guestName: guestVisit.guestName,
                        host: result.hostUser ? result.hostUser.name : guestVisit.hostUserID,
                        receptionDesk: result.receptionDesk ? result.receptionDesk.deskName : null,
                        department: guestVisit.department,
                        timeIn: guestVisit.checkInTime,
                        expiryTime: guestVisit.expiryTime,
                    }
                    : null;

                let message = "Guest processed successfully";

                if (result.flow === "rejected") {
                    message = "Guest rejected due to mismatch with pre-registered details";
                }

                if (result.flow === "walkin-pending-approval") {
                    message = "Walk-in visitor registered and host notified for approval";
                }

                if (result.flow === "checkin-preregistered") {
                    message = "Guest checked in successfully";
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: message,
                    guestVisit: guestVisit,
                    badge: badge,
                    smsStatus: result.smsStatus || null,
                });
            }
        );
    }

    static list(param, callback) {
        const baseQuery = {};
        let filteredQuery = { ...baseQuery };

        if (!Utils.isEmpty(param.receptionDeskID)) {
            filteredQuery.receptionDeskID = param.receptionDeskID;
        }

        if (!Utils.isEmpty(param.department)) {
            filteredQuery.department = param.department;
        }

        if (!Utils.isEmpty(param.status)) {
            filteredQuery.status = param.status;
        }

        if (!Utils.isEmpty(param.passNumber)) {
            filteredQuery.passNumber = param.passNumber;
        }

        if (!Utils.isEmpty(param.visitCategory)) {
            filteredQuery.visitCategory = param.visitCategory;
        }

        if (!Utils.isEmpty(param.idNumber)) {
            filteredQuery.idNumber = param.idNumber;
        }

        if (!Utils.isEmpty(param.date)) {
            const startDate = new Date(param.date);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(param.date);
            endDate.setHours(23, 59, 59, 999);

            filteredQuery.createdAt = {
                [Op.gte]: startDate,
                [Op.lte]: endDate,
            };
        }

        if (!Utils.isEmpty(param["search[value]"])) {
            const searchValue = param["search[value]"];

            filteredQuery = {
                ...filteredQuery,
                [Op.or]: [
                    { guestName: { [Op.like]: `%${searchValue}%` } },
                    { phone: { [Op.like]: `%${searchValue}%` } },
                    { email: { [Op.like]: `%${searchValue}%` } },
                    { idNumber: { [Op.like]: `%${searchValue}%` } },
                    { idType: { [Op.like]: `%${searchValue}%` } },
                    { organization: { [Op.like]: `%${searchValue}%` } },
                    { purpose: { [Op.like]: `%${searchValue}%` } },
                    { department: { [Op.like]: `%${searchValue}%` } },
                    { visitCategory: { [Op.like]: `%${searchValue}%` } },
                    { status: { [Op.like]: `%${searchValue}%` } },
                    { passNumber: { [Op.like]: `%${searchValue}%` } },
                    { receptionDeskID: { [Op.like]: `%${searchValue}%` } },
                ],
            };
        }

        async.waterfall(
            [
                function (done) {
                    DatabaseManager.guestVisit
                        .count({ where: baseQuery })
                        .then((totalRecords) => done(null, totalRecords))
                        .catch((err) => done(err));
                },

                function (totalRecords, done) {
                    DatabaseManager.guestVisit
                        .count({ where: filteredQuery })
                        .then((filteredRecords) => done(null, totalRecords, filteredRecords))
                        .catch((err) => done(err));
                },

                function (totalRecords, filteredRecords, done) {
                    const offset = parseInt(param.start) || 0;
                    const limit = parseInt(param.length) || 10;

                    DatabaseManager.guestVisit
                        .findAll({
                            where: filteredQuery,
                            attributes: [
                                "visitID",
                                "guestName",
                                "phone",
                                "email",
                                "idType",
                                "idNumber",
                                "organization",
                                "purpose",
                                "department",
                                "visitCategory",
                                "status",
                                "expectedArrival",
                                "expectedDeparture",
                                "checkInTime",
                                "checkOutTime",
                                "timeIn",
                                "expiryTime",
                                "passNumber",
                                "badgeReturned",
                                "hostNotified",
                                "approvalRequired",
                                "remarks",
                                "receptionDeskID",
                                "hostUserID",
                                "createdBy",
                                "checkedInBy",
                                "checkedOutBy",
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
                        message: "Failed to fetch Guest Visits",
                        error: err,
                        data: [],
                        recordsTotal: 0,
                        recordsFiltered: 0,
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Guest Visits fetched successfully",
                    data: data,
                    draw: parseInt(param.draw),
                    recordsTotal: totalRecords,
                    recordsFiltered: filteredRecords,
                });
            }
        );
    }

    static hostApproveGuest(body, loggedInUser, callback) {
        let transaction = null;

        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.visitID)) {
                        return done("Visit ID is required");
                    }

                    if (Utils.isEmpty(body.approvalAction)) {
                        return done("Approval action is required");
                    }

                    if (body.approvalAction === "approved" && Utils.isEmpty(body.approvalReason)) {
                        return done("Approval reason is required");
                    }

                    if (body.approvalAction === "denied" && Utils.isEmpty(body.denialReason)) {
                        return done("Denial reason is required");
                    }

                    const validActions = ["approved", "denied"];
                    if (!validActions.includes(body.approvalAction)) {
                        return done("Invalid approval action");
                    }

                    if (body.approvalAction === "approved") {
                        if (Utils.isEmpty(body.timeIn)) {
                            return done("Time in is required when approving a guest");
                        }

                        if (isNaN(body.timeIn) || parseInt(body.timeIn) <= 0) {
                            return done("Time in must be a valid positive number of minutes");
                        }
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
                        .then((hostUser) => {
                            if (!hostUser) return done("Logged in host user not found");

                            if (
                                hostUser.role !== "normalUser" &&
                                hostUser.role !== "admin"
                            ) {
                                return done("Only a host user or admins can approve or deny a guestVisit");
                            }

                            return done(null, hostUser);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, done) {
                    DatabaseManager.guestVisit
                        .findOne({
                            where: {
                                visitID: body.visitID
                            },
                            include: [
                                {
                                    model: DatabaseManager.user,
                                    as: "host",
                                    attributes: ["userID", "name", "email", "phone"]
                                }
                            ]
                        })
                        .then((guestVisit) => {
                            if (!guestVisit) {
                                return done("Guest visit not found at all");
                            }

                            // console.log("Found guest visit:", guestVisit.visitID);
                            // console.log("Guest visit status:", guestVisit.status);
                            // console.log("Guest visit hostUserID:", guestVisit.hostUserID);
                            // console.log("Logged in host userID:", hostUser.userID);

                            if (guestVisit.hostUserID !== hostUser.userID) {
                                return done("This guest visit belongs to a different host");
                            }

                            if (!["pendingApproval", "rejected"].includes(guestVisit.status)) {
                                return done(`Guest visit is in '${guestVisit.status}' state, not pendingApproval/rejected`);
                            }

                            return done(null, hostUser, guestVisit);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (hostUser, guestVisit, done) {
                    // DENY FLOW
                    if (body.approvalAction === "denied") {
                        const previousStatus = guestVisit.status;
                        const newStatus = "denied";

                        DatabaseManager.sequelize
                            .transaction()
                            .then((t) => {
                                transaction = t;

                                return guestVisit.update(
                                    {
                                        status: newStatus,
                                        approvalRequired: false,
                                        hostNotified: true,
                                        remarks: guestVisit.remarks
                                            ? `${guestVisit.remarks} | Host decision recorded`
                                            : "Host decision recorded",
                                    },
                                    { transaction: transaction }
                                )
                                .then((updatedVisit) => {
                                    return DatabaseManager.guestVisitApproval.create(
                                        {
                                            visitID: guestVisit.visitID,
                                            action: "denied",
                                            denialReason: body.denialReason,
                                            approvalReason: null,
                                            approvedBy: hostUser.userID,
                                            approvalTime: new Date(),
                                            previousStatus: previousStatus,
                                            newStatus: newStatus,
                                        },
                                        { transaction: transaction }
                                    ).then(() => updatedVisit);
                                });
                            })
                            .then((updatedVisit) => {
                                return transaction.commit()
                                    .then(() => {
                                        transaction = null;

                                        return done(null, {
                                            flow: "denied",
                                            hostUser,
                                            guestVisit: updatedVisit,
                                            badge: null,
                                            denialReason: body.denialReason,
                                            approvalReason: null,
                                        });
                                    });
                            })
                            .catch((err) => {
                                if (transaction) {
                                    return transaction.rollback()
                                        .then(() => {
                                            transaction = null;
                                            return done(err);
                                        })
                                        .catch(() => {
                                            transaction = null;
                                            return done(err);
                                        });
                                }

                                return done(err);
                            });

                        return;
                    }

                    // APPROVE FLOW
                    if (Utils.isEmpty(guestVisit.receptionDeskID)) {
                        return done("Reception desk is missing on this guest record");
                    }

                    const approvedCheckInTime = body.checkInTime
                        ? new Date(body.checkInTime)
                        : new Date();

                    if (isNaN(approvedCheckInTime.getTime())) {
                        return done("Invalid check-in time");
                    }

                    const durationMinutes = parseInt(body.timeIn);
                    const expiryTime = Utils.addMinutesToDate(approvedCheckInTime, durationMinutes);

                    return done(null, {
                        flow: "approved",
                        hostUser,
                        guestVisit,
                        checkInTime: approvedCheckInTime,
                        durationMinutes,
                        expiryTime,
                        approvalReason: body.approvalReason,
                        denialReason: null,
                    });
                },

                function (payload, done) {
                    if (payload.flow === "denied") {
                        return done(null, payload);
                    }

                    DatabaseManager.sequelize
                        .transaction()
                        .then((t) => {
                            transaction = t;

                            const visit = payload.guestVisit;
                            const previousStatus = visit.status;
                            const newStatus = "checkedIn";
                            const deskCode = Utils.getReceptionDeskCode(visit.receptionDeskID);
                            const dateCode = Utils.getDateStringForPass(payload.checkInTime);

                            const tryGeneratePassAndAssignBadge = (attempt = 0) => {
                                if (attempt > 5) {
                                    return Promise.reject("Failed to generate unique pass number");
                                }

                                return DatabaseManager.guestVisit
                                    .count({
                                        where: {
                                            receptionDeskID: visit.receptionDeskID,
                                            checkInTime: {
                                                [Op.gte]: new Date(`${dateCode.substring(0, 4)}-${dateCode.substring(4, 6)}-${dateCode.substring(6, 8)}T00:00:00.000Z`),
                                                [Op.lt]: new Date(`${dateCode.substring(0, 4)}-${dateCode.substring(4, 6)}-${dateCode.substring(6, 8)}T23:59:59.999Z`)
                                            },
                                            passNumber: {
                                                [Op.ne]: null
                                            }
                                        },
                                        transaction: transaction
                                    })
                                    .then((count) => {
                                        const sequence = count + 1 + attempt;
                                        const passNumber = `VIS/JSC/${deskCode}/${dateCode}/${Utils.padSequence(sequence)}`;

                                        return DatabaseManager.visitorBadge.findOne({
                                            where: {
                                                receptionDeskID: visit.receptionDeskID,
                                                status: "available",
                                            },
                                            order: [["badgeNumber", "ASC"]],
                                            transaction: transaction
                                        })
                                        .then((availableBadge) => {
                                            if (!availableBadge) {
                                                return Promise.reject("No available visitor badge at this reception desk");
                                            }

                                            return visit.update(
                                                {
                                                    status: newStatus,
                                                    timeIn: payload.durationMinutes,
                                                    checkInTime: payload.checkInTime,
                                                    expiryTime: payload.expiryTime,
                                                    passNumber: passNumber,
                                                    badgeID: availableBadge.badgeID,
                                                    badgeNumber: availableBadge.badgeNumber,
                                                    approvalRequired: false,
                                                    hostNotified: true,
                                                    remarks: visit.remarks
                                                        ? `${visit.remarks} | Host decision recorded`
                                                        : "Host decision recorded",
                                                },
                                                { transaction: transaction }
                                            )
                                            .then((updatedVisit) => {
                                                return availableBadge.update({
                                                    status: "issued",
                                                    currentVisitID: updatedVisit.visitID,
                                                    issuedAt: payload.checkInTime,
                                                    returnedAt: null,
                                                }, { transaction: transaction })
                                                .then(() => {
                                                    return DatabaseManager.guestVisitApproval.create(
                                                        {
                                                            visitID: visit.visitID,
                                                            action: "approved",
                                                            approvalReason: body.approvalReason,
                                                            denialReason: null,
                                                            approvedBy: payload.hostUser.userID,
                                                            approvalTime: new Date(),
                                                            previousStatus: previousStatus,
                                                            newStatus: newStatus,
                                                        },
                                                        { transaction: transaction }
                                                    ).then(() => updatedVisit);
                                                });
                                            });
                                        });
                                    })
                                    .catch((err) => {
                                        if (
                                            err &&
                                            (err.name === "SequelizeUniqueConstraintError" ||
                                                `${err}`.includes("unique"))
                                        ) {
                                            return tryGeneratePassAndAssignBadge(attempt + 1);
                                        }

                                        return Promise.reject(err);
                                    });
                            };

                            return tryGeneratePassAndAssignBadge();
                        })
                        .then((updatedVisit) => {
                            return transaction.commit()
                                .then(() => {
                                    transaction = null;

                                    return done(null, {
                                        flow: "approved",
                                        hostUser: payload.hostUser,
                                        guestVisit: updatedVisit,
                                        approvalReason: payload.approvalReason,
                                        denialReason: null,
                                    });
                                });
                        })
                        .catch((err) => {
                            if (transaction) {
                                return transaction.rollback()
                                    .then(() => {
                                        transaction = null;
                                        return done(err);
                                    })
                                    .catch(() => {
                                        transaction = null;
                                        return done(err);
                                    });
                            }

                            return done(err);
                        });
                },
            ],
            function (err, result) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to process host approval",
                        error: err,
                    });
                }

                const guestVisit = result.guestVisit.get({ plain: true });

                const badge = result.flow === "approved"
                    ? {
                        badgeID: guestVisit.badgeID,
                        badgeNumber: guestVisit.badgeNumber,
                        passNumber: guestVisit.passNumber,
                        guestName: guestVisit.guestName,
                        host: result.hostUser ? result.hostUser.name : guestVisit.hostUserID,
                        department: guestVisit.department,
                        timeIn: guestVisit.checkInTime,
                        expiryTime: guestVisit.expiryTime,
                    }
                    : null;

                const message =
                    result.flow === "approved"
                        ? "Guest approved and checked in successfully"
                        : "Guest denied successfully";

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: message,
                    guestVisit: guestVisit,
                    badge: badge,
                    approvalReason: result.flow === "approved" ? result.approvalReason : null,
                    denialReason: result.flow === "denied" ? result.denialReason : null,
                });
            }
        );
    }

    static processVisitAlertSMS(callback) {
        const now = new Date();

        async.waterfall(
            [
                function (done) {
                    DatabaseManager.guestVisit
                        .findAll({
                            where: {
                                status: {
                                    [Op.in]: ["checkedIn", "inMeeting", "overdue"]
                                },
                                expiryTime: {
                                    [Op.ne]: null
                                }
                            },
                            include: [
                                {
                                    model: DatabaseManager.user,
                                    as: "host",
                                    attributes: ["userID", "name", "email", "phone", "role", "status"]
                                },
                                {
                                    model: DatabaseManager.receptionDesk,
                                    as: "receptionDesk",
                                    attributes: ["receptionDeskID", "deskName", "deskCode", "phoneNumber", "status"]
                                }
                            ],
                            order: [["expiryTime", "ASC"]],
                        })
                        .then((visits) => {
                            return done(null, visits);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (visits, done) {
                    const processedResults = [];

                    async.eachSeries(
                        visits,
                        function (visit, nextVisit) {
                            const visitPlain = visit.get({ plain: true });
                            const expiryTime = new Date(visitPlain.expiryTime);

                            const diffMs = expiryTime.getTime() - now.getTime();
                            const diffMinutes = Math.floor(diffMs / (1000 * 60));

                            // 1. 5 minutes before expiry -> visitor
                            if (
                                diffMinutes <= 5 &&
                                diffMinutes > 0 &&
                                !visitPlain.preExpiryAlertSent
                            ) {
                                const smsMessage = Utils.getVisitorPreExpiryAlertMessage();

                                return Utils.sendSMS(visitPlain.phone, smsMessage, function (smsErr, smsResponse) {
                                    visit.update({
                                        preExpiryAlertSent: !smsErr,
                                        preExpiryAlertSentAt: !smsErr ? new Date() : null,
                                    })
                                    .then(() => {
                                        processedResults.push({
                                            visitID: visitPlain.visitID,
                                            alertStage: "preExpiryVisitorAlert",
                                            smsSent: !smsErr,
                                            smsError: smsErr || null,
                                            smsResponse: smsResponse || null,
                                        });
                                        return nextVisit();
                                    })
                                    .catch((err) => {
                                        return nextVisit(err);
                                    });
                                });
                            }

                            //  ALWAYS enforce overdue at expiry
                            if (diffMinutes <= 0 && visitPlain.status !== "overdue") {
                                visit.update({
                                    status: "overdue"
                                }).catch(() => {});
                            }

                            // 2. At expiry -> host SMS
                            if (
                                diffMinutes <= 0 &&
                                diffMinutes > -5 &&
                                !visitPlain.expiryAlertSent
                            ) {
                                const smsMessage = Utils.getHostExpiryAlertMessage(
                                    visitPlain.guestName,
                                    visitPlain.passNumber
                                );

                                if (!visitPlain.host || Utils.isEmpty(visitPlain.host.phone)) {
                                    processedResults.push({
                                        visitID: visitPlain.visitID,
                                        alertStage: "expiryHostAlert",
                                        smsSent: false,
                                        smsError: "Host phone number not available",
                                        smsResponse: null,
                                    });
                                    return nextVisit();
                                }

                                return Utils.sendSMS(visitPlain.host.phone, smsMessage, function (smsErr, smsResponse) {
                                    visit.update({
                                        expiryAlertSent: !smsErr,
                                        expiryAlertSentAt: !smsErr ? new Date() : null,
                                    })
                                    .then(() => {
                                        processedResults.push({
                                            visitID: visitPlain.visitID,
                                            alertStage: "expiryHostAlert",
                                            smsSent: !smsErr,
                                            smsError: smsErr || null,
                                            smsResponse: smsResponse || null,
                                        });
                                        return nextVisit();
                                    })
                                    .catch((err) => nextVisit(err));
                                });
                            }

                            // 3. 5 minutes after expiry -> reception desk
                            if (
                                diffMinutes <= -5 &&
                                !visitPlain.overstayAlertSent
                            ) {
                                const smsMessage = Utils.getReceptionOverstayAlertMessage(
                                    visitPlain.guestName,
                                    visitPlain.passNumber
                                );

                                const receptionPhone = visitPlain.receptionDesk?.phoneNumber || null;

                                if (
                                    !visitPlain.receptionDesk ||
                                    visitPlain.receptionDesk.status !== "active" ||
                                    Utils.isEmpty(receptionPhone)
                                ) {
                                    processedResults.push({
                                        visitID: visitPlain.visitID,
                                        alertStage: "overstayReceptionAlert",
                                        smsSent: false,
                                        smsError: "Reception desk phone number not available or desk inactive",
                                        smsResponse: null,
                                    });
                                    return nextVisit();
                                }

                                return Utils.sendSMS(receptionPhone, smsMessage, function (smsErr, smsResponse) {
                                    visit.update({
                                        overstayAlertSent: !smsErr,
                                        overstayAlertSentAt: !smsErr ? new Date() : null,
                                        status: "overdue",
                                    })
                                    .then(() => {
                                        processedResults.push({
                                            visitID: visitPlain.visitID,
                                            alertStage: "overstayReceptionAlert",
                                            smsSent: !smsErr,
                                            smsError: smsErr || null,
                                            smsResponse: smsResponse || null,
                                        });
                                        return nextVisit();
                                    })
                                    .catch((err) => {
                                        return nextVisit(err);
                                    });
                                });
                            }

                            return nextVisit();
                        },
                        function (err) {
                            if (err) return done(err);
                            return done(null, processedResults);
                        }
                    );
                },
            ],
            function (err, results) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeServerError || 500,
                        message: "Failed to process visit alert SMS",
                        error: err,
                        data: [],
                    });
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Visit alert SMS processed successfully",
                    data: results || [],
                });
            }
        );
    }

    static checkOutGuest(body, loggedInUser, callback) {
        let transaction = null;

        async.waterfall(
            [
                function (done) {
                    if (!loggedInUser || Utils.isEmpty(loggedInUser.userID)) {
                        return done("Authenticated user is required");
                    }

                    if (Utils.isEmpty(body.visitID)) {
                        return done("Visit ID is required");
                    }

                    if (typeof body.badgeReturned !== "boolean") {
                        return done("badgeReturned must be provided as true or false");
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

                            if (user.role !== "receptionist" && user.role !== "admin") {
                                return done("Only a receptionist or admin can check out a guest");
                            }

                            return done(null, user);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (user, done) {
                    DatabaseManager.guestVisit
                        .findOne({
                            where: {
                                visitID: body.visitID,
                                status: {
                                    [Op.in]: ["checkedIn", "inMeeting", "overdue"]
                                }
                            },
                            include: [
                                {
                                    model: DatabaseManager.visitorBadge,
                                    as: "badge",
                                    attributes: [
                                        "badgeID",
                                        "badgeNumber",
                                        "status",
                                        "receptionDeskID",
                                        "currentVisitID",
                                        "issuedAt",
                                        "returnedAt"
                                    ],
                                    required: false
                                },
                                {
                                    model: DatabaseManager.receptionDesk,
                                    as: "receptionDesk",
                                    attributes: ["receptionDeskID", "deskName", "deskCode", "phoneNumber", "status"],
                                    required: false
                                }
                            ]
                        })
                        .then((guestVisit) => {
                            if (!guestVisit) {
                                return done("Active checked-in guest visit not found");
                            }

                            if (guestVisit.status === "checkedOut") {
                                return done("Guest has already been checked out");
                            }

                            return done(null, user, guestVisit);
                        })
                        .catch((err) => {
                            return done(err);
                        });
                },

                function (user, guestVisit, done) {
                    const checkOutTime = body.checkOutTime ? new Date(body.checkOutTime) : new Date();

                    if (isNaN(checkOutTime.getTime())) {
                        return done("Invalid check-out time");
                    }

                    DatabaseManager.sequelize
                        .transaction()
                        .then((t) => {
                            transaction = t;

                            const visitUpdatePayload = {
                                status: "checkedOut",
                                checkOutTime: checkOutTime,
                                checkedOutBy: user.userID,
                                badgeReturned: body.badgeReturned,
                                remarks: body.remarks
                                    ? (guestVisit.remarks
                                        ? `${guestVisit.remarks} | ${body.remarks}`
                                        : body.remarks)
                                    : (guestVisit.remarks || null),
                            };

                            return guestVisit.update(visitUpdatePayload, { transaction: transaction })
                                .then((updatedVisit) => {
                                    if (!updatedVisit.badgeID) {
                                        return Promise.resolve({
                                            updatedVisit,
                                            updatedBadge: null
                                        });
                                    }

                                    return DatabaseManager.visitorBadge
                                        .findOne({
                                            where: {
                                                badgeID: updatedVisit.badgeID,
                                            },
                                            transaction: transaction
                                        })
                                        .then((badge) => {
                                            if (!badge) {
                                                return Promise.resolve({
                                                    updatedVisit,
                                                    updatedBadge: null
                                                });
                                            }

                                            const badgeUpdatePayload = body.badgeReturned
                                                ? {
                                                    status: "available",
                                                    currentVisitID: null,
                                                    returnedAt: checkOutTime,
                                                    remarks: body.badgeRemarks
                                                        ? body.badgeRemarks
                                                        : badge.remarks
                                                }
                                                : {
                                                    status: "lost",
                                                    currentVisitID: null,
                                                    returnedAt: null,
                                                    remarks: body.badgeRemarks
                                                        ? body.badgeRemarks
                                                        : (badge.remarks
                                                            ? `${badge.remarks} | Badge not returned at checkout`
                                                            : "Badge not returned at checkout")
                                                };

                                            return badge.update(badgeUpdatePayload, { transaction: transaction })
                                                .then((updatedBadge) => {
                                                    return {
                                                        updatedVisit,
                                                        updatedBadge
                                                    };
                                                });
                                        });
                                });
                        })
                        .then(({ updatedVisit, updatedBadge }) => {
                            return transaction.commit()
                                .then(() => {
                                    transaction = null;
                                    return done(null, user, updatedVisit, updatedBadge);
                                });
                        })
                        .catch((err) => {
                            if (transaction) {
                                return transaction.rollback()
                                    .then(() => {
                                        transaction = null;
                                        return done(err);
                                    })
                                    .catch(() => {
                                        transaction = null;
                                        return done(err);
                                    });
                            }

                            return done(err);
                        });
                },

                function (user, updatedVisit, updatedBadge, done) {
                    if (Utils.isEmpty(updatedVisit.phone)) {
                        return done(null, {
                            guestVisit: updatedVisit,
                            badge: updatedBadge,
                            smsStatus: {
                                smsSent: false,
                                smsError: "Visitor phone number not available",
                                smsResponse: null,
                            }
                        });
                    }

                    const smsMessage = `Dear ${updatedVisit.guestName}, thank you for visiting Judicial Service Commission offices. We appreciate your visit and wish you a safe journey.`;

                    return Utils.sendSMS(updatedVisit.phone, smsMessage, function (smsErr, smsResponse) {
                        return done(null, {
                            guestVisit: updatedVisit,
                            badge: updatedBadge,
                            smsStatus: {
                                smsSent: !smsErr,
                                smsError: smsErr || null,
                                smsResponse: smsResponse || null,
                            }
                        });
                    });
                },
            ],
            function (err, result) {
                if (err) {
                    return callback({
                        status: Consts.httpCodeBadRequest || 400,
                        message: "Failed to check out guest",
                        error: err,
                    });
                }

                const guestVisit =
                    result.guestVisit && typeof result.guestVisit.get === "function"
                        ? result.guestVisit.get({ plain: true })
                        : result.guestVisit;

                if (guestVisit && guestVisit.badge) {
                    delete guestVisit.badge;
                }

                return callback({
                    status: Consts.httpCodeSuccess,
                    message: "Guest checked out successfully",
                    guestVisit: guestVisit,
                    badge: result.badge,
                    smsStatus: result.smsStatus || null,
                });
            }
        );
    }
}
export default GuestVisitsLogic;    