import async from "async";
import { Consts, STATUS_FLOW } from "../lib/Consts.js"; 
import Utils from "../lib/Utils.js";          
import DatabaseManager from "../lib/DatabaseManager.js"; 
import PDFDocument from "pdfkit";
import EmailService from "../lib/EmailService.js";
import { Op } from 'sequelize';
import fs from "fs";
import path from "path";
import mime from "mime-types";
import ExcelJS from "exceljs";
import PermissionService from "../lib/PermissionService.js";

class DisciplinaryRecordLogic {
  static async createReport(body, authUser, file, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        });
      }

      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.create"
      );

  if (!permissionCheck.allowed) {
    const roleName = authUser?.role?.roleName || authUser?.roleName || "this role";

    return callback({
      status: permissionCheck.status,
      message: `Access denied, users with role '${roleName}' are not allowed to create reports`
    });
  }

      if (Utils.isEmpty(body.source)) {
        return callback({
          status: 400,
          message: "source is required"
        });
      }

      if (!["OCJ", "PUBLIC"].includes(body.source)) {
        return callback({
          status: 400,
          message: "source must be either 'OCJ' or 'PUBLIC'"
        });
      }

      if (body.source === "PUBLIC" && Utils.isEmpty(body.complainantName)) {
        return callback({
          status: 400,
          message: "complainantName is required for public reports"
        });
      }

      if (Utils.isEmpty(body.title)) {
        return callback({
          status: 400,
          message: "title is required"
        });
      }

      if (!file) {
        return callback({
          status: 400,
          message: "report file is required"
        });
      }

      const now = new Date();
      const reportFilePath = file.path;

      const record = await DatabaseManager.disciplinaryRecord.create({
        stage: "REPORT",
        status: "Received",
        source: body.source,
        complainantName: body.source === "PUBLIC" ? body.complainantName : null,
        title: body.title,
        reportFile: reportFilePath,
        receivedBy: authUser.name,
        receivedDate: now
      });

      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "REPORT_RECEIVED",
        performedBy: authUser.userID,
        previousValue: null,
        newValue: {
          source: record.source,
          complainantName: record.complainantName,
          title: record.title,
          reportFile: record.reportFile,
          receivedBy: record.receivedBy,
          receivedDate: record.receivedDate
        }
      });

      callback({
        status: Consts.httpCodeSuccess,
        message: "Report received successfully",
        record
      });

      setImmediate(async () => {
        try {
          const registrars = await DatabaseManager.user.findAll({
            attributes: ["userID", "name", "email"],
            include: [
              {
                model: DatabaseManager.role,
                as: "role",
                attributes: ["roleID", "roleName"],
                where: {
                  roleName: "registrar"
                },
                required: true
              }
            ]
          });

          const validRegistrars = (registrars || []).filter(
            (user) => user.email
          );

          await Promise.all(
            validRegistrars.map((registrar) =>
              new Promise((resolve, reject) => {
                EmailService.sendReportCreatedNotificationToRegistrar(
                  {
                    to: registrar.email,
                    registrarName: registrar.name,
                    title: record.title,
                    source: record.source,
                    complainantName: record.complainantName,
                    receivedBy: authUser.name,
                    receivedDate: record.receivedDate,
                    recordID: record.recordID
                  },
                  function (err) {
                    if (err) return reject(err);
                    resolve();
                  }
                );
              })
            )
          );
        } catch (emailErr) {
          console.error("Failed to send registrar notification email:", emailErr);
        }
      });
    } catch (err) {
      console.error("Create report error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to receive report",
        error: err.message || err
      });
    }
  }
  static async viewReport(authUser, recordID, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({ status: 401, message: "Unauthorized" });
      }

      if (Utils.isEmpty(recordID)) {
        return callback({ status: 400, message: "recordID is required" });
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record) {
        return callback({ status: 404, message: "Report not found" });
      }

      return callback({
        status: 200,
        message: "Report fetched successfully",
        record: {
          recordID: record.recordID,
          title: record.title,
          source: record.source,
          complainantName: record.complainantName,
          receivedBy: record.receivedBy,
          receivedDate: record.receivedDate,
          status: record.status,
          fileUrl: `/api/reports/file/${record.recordID}`
        }
      });

    } catch (err) {
      return callback({
        status: 500,
        message: "Failed to fetch report",
        error: err
      });
    }
  }

  static async updateReport(body, authUser, file, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        });
      }
      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.update"
      );

      if (!permissionCheck.allowed) {
        return callback({
          status: permissionCheck.status,
          message: "You do not have permission to update disciplinary records"
        });
      }
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      if (Utils.isEmpty(body.source)) {
        return callback({
          status: 400,
          message: "source is required"
        });
      }

      if (!["OCJ", "PUBLIC"].includes(body.source)) {
        return callback({
          status: 400,
          message: "source must be either 'OCJ' or 'PUBLIC'"
        });
      }

      if (body.source === "PUBLIC" && Utils.isEmpty(body.complainantName)) {
        return callback({
          status: 400,
          message: "complainantName is required for public reports"
        });
      }

      if (Utils.isEmpty(body.title)) {
        return callback({
          status: 400,
          message: "title is required"
        });
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      if (record.stage !== "REPORT") {
        return callback({
          status: 400,
          message: `Only records at REPORT stage can be updated. Current stage is ${record.stage}`
        });
      }

      const nonEditableStatuses = ["Under_review", "Registered", "Processing", "submitted_to_JSC", "Closed"];
      if (nonEditableStatuses.includes(record.status)) {
        return callback({
          status: 400,
          message: `Cannot update report in status ${record.status}`
        });
      }

      const previousValue = record.toJSON();
      const editedAt = new Date();

      let reportFilePath = record.reportFile;
      if (file) {
        reportFilePath = file.path;
      }

      await record.update({
        source: body.source,
        complainantName: body.source === "PUBLIC" ? body.complainantName : null,
        title: body.title,
        reportFile: reportFilePath
      });

      const historyEntry = await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "REPORT_UPDATED",
        performedBy: authUser.userID,
        previousValue,
        newValue: {
          source: record.source,
          complainantName: record.complainantName,
          title: record.title,
          reportFile: record.reportFile,
          receivedBy: record.receivedBy,
          receivedDate: record.receivedDate,
          updatedBy: authUser.userID,
          updatedByName: authUser.name || null,
          updatedAt: editedAt,
          fileUpdated: !!file
        }
      });

      return callback({
        status: Consts.httpCodeSuccess,
        message: "Report updated successfully",
        record,
        history: historyEntry
      });
    } catch (err) {
      console.error("Update report error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to update report",
        error: err.message || err
      });
    }
  }

  static async getRecordDetails(recordID, authUser, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        })
      }

      if (Utils.isEmpty(recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        })
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      })

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        })
      }

      return callback({
        status: 200,
        message: "Record fetched successfully",
        record
      })
    } catch (err) {
      return callback({
        status: 500,
        message: "Failed to fetch record details",
        error: err.message
      })
    }
  }

  static buildReportsQuery(param) {
    const baseQuery = {
      reportFile: { [Op.ne]: null },
    };

    let filteredQuery = { ...baseQuery };

    // direct filter by stage
    if (!Utils.isEmpty(param.stage)) {
      filteredQuery.stage = param.stage;
    }

    // direct filter by source
    if (!Utils.isEmpty(param.source)) {
      filteredQuery.source = param.source;
    }

    // direct filter by status
    if (!Utils.isEmpty(param.status)) {
      filteredQuery.status = param.status;
    }

    // direct filter by title
    if (!Utils.isEmpty(param.title)) {
      filteredQuery.title = { [Op.like]: `%${param.title}%` };
    }

    // direct filter by complainantName
    if (!Utils.isEmpty(param.complainantName)) {
      filteredQuery.complainantName = { [Op.like]: `%${param.complainantName}%` };
    }

    if (!Utils.isEmpty(param.fileNumber)) {
      filteredQuery.fileNumber = { [Op.like]: `%${param.fileNumber}%` };
    }

    if (!Utils.isEmpty(param.assignedTo)) {
      filteredQuery.assignedTo = { [Op.like]: `%${param.assignedTo}%` };
    }

    if (!Utils.isEmpty(param.panel)) {
      filteredQuery.panel = { [Op.like]: `%${param.panel}%` };
    }

    // direct filter by receivedBy
    if (!Utils.isEmpty(param.receivedBy)) {
      filteredQuery.receivedBy = { [Op.like]: `%${param.receivedBy}%` };
    }

    // direct filter by receivedDate using custom range or preset range
    if (!Utils.isEmpty(param.startDate) || !Utils.isEmpty(param.endDate)) {
      const receivedDateFilter = {};

      if (!Utils.isEmpty(param.startDate)) {
        const startDate = new Date(param.startDate);
        startDate.setHours(0, 0, 0, 0);
        receivedDateFilter[Op.gte] = startDate;
      }

      if (!Utils.isEmpty(param.endDate)) {
        const endDate = new Date(param.endDate);
        endDate.setHours(23, 59, 59, 999);
        receivedDateFilter[Op.lte] = endDate;
      }

      filteredQuery.receivedDate = receivedDateFilter;
    } else if (!Utils.isEmpty(param.dateRange)) {
      const now = new Date();
      const startDate = new Date();

      switch (param.dateRange) {
        case "1_month":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "3_months":
          startDate.setDate(startDate.getDate() - (3 * 30));
          break;
        case "6_months":
          startDate.setDate(startDate.getDate() - (6 * 30));
          break;
        case "12_months":
          startDate.setDate(startDate.getDate() - (12 * 30));
          break;
        default:
          break;
      }

      if (["1_month", "3_months", "6_months", "12_months"].includes(param.dateRange)) {
        startDate.setHours(0, 0, 0, 0);
        now.setHours(23, 59, 59, 999);

        filteredQuery.receivedDate = {
          [Op.gte]: startDate,
          [Op.lte]: now
        };
      }
    }

    // DataTables/global search
    if (!Utils.isEmpty(param["search[value]"])) {
      const searchValue = param["search[value]"];

      filteredQuery = {
        [Op.and]: [
          filteredQuery,
          {
            [Op.or]: [
              { stage: { [Op.like]: `%${searchValue}%` } },
              { source: { [Op.like]: `%${searchValue}%` } },
              { complainantName: { [Op.like]: `%${searchValue}%` } },
              { fileNumber: { [Op.like]: `%${searchValue}%` } },
              { reportFile: { [Op.like]: `%${searchValue}%` } },
              { status: { [Op.like]: `%${searchValue}%` } },
              { receivedBy: { [Op.like]: `%${searchValue}%` } },
              { title: { [Op.like]: `%${searchValue}%` } },
              { panel: { [Op.like]: `%${searchValue}%` } },
              { assignedTo: { [Op.like]: `%${searchValue}%` } },
            ],
          },
        ],
      };
    }

    return {
      baseQuery,
      filteredQuery
    };
  }

  static listReports(param, callback) {
    const { baseQuery, filteredQuery } = this.buildReportsQuery(param);

    async.waterfall(
      [
        function (done) {
          DatabaseManager.disciplinaryRecord
            .count({ where: baseQuery })
            .then((totalRecords) => done(null, totalRecords))
            .catch((err) => done(err));
        },

        function (totalRecords, done) {
          DatabaseManager.disciplinaryRecord
            .count({ where: filteredQuery })
            .then((filteredRecords) => done(null, totalRecords, filteredRecords))
            .catch((err) => done(err));
        },

        function (totalRecords, filteredRecords, done) {
          const offset = parseInt(param.start, 10) || 0;
          const limit = parseInt(param.length, 10) || 10;

          DatabaseManager.disciplinaryRecord
            .findAll({
              where: filteredQuery,
              attributes: [
                "recordID",
                "stage",
                "title",
                "fileNumber",
                "status",
                "source",
                "complainantName",
                "panel",
                "assignedTo",
                "reportFile",
                "receivedBy",
                "receivedDate",
                "createdAt",
              ],
              order: [["receivedDate", "DESC"]],
              offset,
              limit,
            })
            .then((data) => done(null, totalRecords, filteredRecords, data))
            .catch((err) => done(err));
        },
      ],
      function (err, totalRecords, filteredRecords, data) {
        if (err) {
          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to fetch reports",
            error: err,
            data: [],
            recordsTotal: 0,
            recordsFiltered: 0,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "Reports fetched successfully",
          data,
          draw: parseInt(param.draw, 10) || 0,
          recordsTotal: totalRecords,
          recordsFiltered: filteredRecords,
        });
      }
    );
  }

  static exportReports(param, callback) {
    const { filteredQuery } = this.buildReportsQuery(param);

    async.waterfall(
      [
        function (done) {
          DatabaseManager.disciplinaryRecord
            .findAll({
              where: filteredQuery,
              attributes: [
                "recordID",
                "stage",
                "title",
                "fileNumber",
                "status",
                "source",
                "complainantName",
                "panel",
                "assignedTo",
                "receivedBy",
                "receivedDate",
                "createdAt",
              ],
              order: [["receivedDate", "DESC"]],
            })
            .then((reports) => done(null, reports))
            .catch((err) => done(err));
        },

        function (reports, done) {
          try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Filtered Reports");

            worksheet.columns = [
              { header: "No", key: "no", width: 8 },
              { header: "Record ID", key: "recordID", width: 40 },
              { header: "Stage", key: "stage", width: 15 },
              { header: "Title", key: "title", width: 30 },
              { header: "File Number", key: "fileNumber", width: 25 },
              { header: "Status", key: "status", width: 25 },
              { header: "Source", key: "source", width: 15 },
              { header: "Complainant Name", key: "complainantName", width: 25 },
              { header: "Panel", key: "panel", width: 15 },
              { header: "Assigned To", key: "assignedTo", width: 40 },
              { header: "Received By", key: "receivedBy", width: 40 },
              { header: "Received Date", key: "receivedDate", width: 22 },
              { header: "Created At", key: "createdAt", width: 22 },
            ];

            reports.forEach((item, index) => {
              worksheet.addRow({
                no: index + 1,
                recordID: item.recordID || "",
                stage: item.stage || "",
                title: item.title || "",
                fileNumber: item.fileNumber || "",
                status: item.status || "",
                source: item.source || "",
                complainantName: item.complainantName || "",
                panel: item.panel || "",
                assignedTo: item.assignedTo || "",
                receivedBy: item.receivedBy || "",
                receivedDate: item.receivedDate
                  ? new Date(item.receivedDate).toLocaleString()
                  : "",
                createdAt: item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : "",
              });
            });

            worksheet.getRow(1).font = { bold: true };

            workbook.xlsx.writeBuffer()
              .then((fileBuffer) => done(null, fileBuffer))
              .catch((err) => done(err));
          } catch (err) {
            done(err);
          }
        }
      ],
      function (err, fileBuffer) {
        if (err) {
          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to export reports",
            error: err.message || err,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "Reports exported successfully",
          fileBuffer,
        });
      }
    );
  }

  static async assignToHRM(body, authUser, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        });
      }

      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.assignToHRM"
      );

      if (!permissionCheck.allowed) {
        return callback({
          status: permissionCheck.status,
          message: "You do not have permission to assign reports to Human Resource Manager"
        });
      }

      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      const allowedStatuses = ["Received", "Registered"];
      if (!allowedStatuses.includes(record.status)) {
        return callback({
          status: 400,
          message: `Cannot assign record in status ${record.status}`
        });
      }

      const HRM = await DatabaseManager.user.findOne({
        where: {
          status: "active"
        },
        include: [
          {
            model: DatabaseManager.role,
            as: "role",
            where: {
              roleName: "humanResourceManager"
            },
            attributes: ["roleID", "roleName"]
          }
        ]
      });

      if (!HRM) {
        return callback({
          status: 404,
          message: "Human Resource Manager not found"
        });
      }

      const previousValue = record.toJSON();
      const now = new Date();

      await DatabaseManager.disciplinaryRecord.update(
        {
          assignedTo: HRM.userID,
          status: "Under_review",
          receivedAt: now
        },
        {
          where: { recordID: body.recordID }
        }
      );

      const updatedRecord = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "ASSIGNED_TO_HUMAN_RESOURCE_MANAGER",
        performedBy: authUser.userID,
        previousValue,
        newValue: {
          assignedTo: HRM.userID,
          status: "Under_review",
          stage: record.stage
        }
      });

      callback({
        status: Consts.httpCodeSuccess,
        message: "Report successfully assigned to Human Resource Manager",
        record: updatedRecord
      });

      setImmediate(async () => {
        try {
          if (HRM.email) {
            await EmailService.sendMail({
              to: HRM.email,
              subject: "New Disciplinary Report Assigned",
              html: `
                <div>
                  <p>Hello ${HRM.name || "Human Resource Manager"},</p>
                  <p>A disciplinary report has been assigned to you for further action.</p>
                  <p><strong>Report ID:</strong> ${record.recordID}</p>
                  <p><strong>Title:</strong> ${record.title || "_"}</p>
                  <p><strong>Source:</strong> ${record.source || "_"}</p>
                  <p><strong>Assigned By:</strong> ${authUser.name || "Registrar"}</p>
                  <p><strong>Date Assigned:</strong> ${now.toLocaleString()}</p>
                  <p>Please log into the system to review and take action.</p>
                </div>
              `
            });
          }
        } catch (emailErr) {
          console.error("Failed to send Human Resource Manager email:", emailErr);
        }
      });

    } catch (err) {
      console.error("Assign to Human Resource Manager error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to assign report",
        error: err.message || err
      });
    }
  }

  static async registerCase(body, authUser, callback) {
    try {
      // 1️⃣ Validate authenticated user
      if (!authUser || !authUser.userID) {
        throw new Error("Unauthorized: Missing user context");
      }

      // Only HR practitioners can register case
      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.registerCase"
      );

      if (!permissionCheck.allowed) {
        return callback({
          status: Consts.unAuthorized,
          message: "Only HR practitioners can register a case"
        });
      }

      // 2️⃣ Validate inputs
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      const requiredFields = [
        "officerName",
        "designation",
        "natureOfCharges",
        "pjNumber",
        "dateEscalated",
        "caseAgainst",
        
      ];

      for (const field of requiredFields) {
        if (Utils.isEmpty(body[field])) {
          return callback({
            status: 400,
            message: `${field} is required`
          });
        }
      }

      if (!["Judicial Officer", "Judicial Staff"].includes(body.caseAgainst)) {
        return callback({
          status: 400,
          message: "caseAgainst must be either 'Judicial Officer' or 'Judicial Staff'"
        });
      }

      const dateEscalated = new Date(body.dateEscalated);
      if (Number.isNaN(dateEscalated.getTime())) {
        return callback({
          status: 400,
          message: "dateEscalated must be a valid date"
        });
      }

      // 3️⃣ Find existing record
      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      // Ensure correct stage + status
      if (record.stage !== "REPORT" || record.status !== "Under_review") {
        return callback({
          status: 400,
          message: `Cannot register case at stage ${record.stage} with status ${record.status}`
        });
      }

      const directorLegal = await DatabaseManager.user.findOne({
        include: [
          {
            model: DatabaseManager.role,
            as: "role",
            where: {
              roleName: "directorLegal"
            }
          }
        ]
      });

      if (!directorLegal) {
        return callback({
          status: 400,
          message: "No Director Legal user configured in the system"
        });
      }

      // 4️⃣ Generate file number
      const dateFiled = new Date();
      const year = dateFiled.getFullYear();
      const prefix = body.caseAgainst === "Judicial Staff" ? "JS" : "JO";

      const lastRecord = await DatabaseManager.disciplinaryRecord.findOne({
        where: {
          caseAgainst: body.caseAgainst,
          fileNumber: { [Op.ne]: null },
        },
        order: [["createdAt", "DESC"]],
      });

      let newFileNo = "001";

      if (lastRecord && lastRecord.fileNumber) {
        const parts = lastRecord.fileNumber.split("/");
        const lastNo = parseInt(parts[4], 10);
        if (!isNaN(lastNo)) {
          newFileNo = String(lastNo + 1).padStart(3, "0");
        }
      }

      const fileNumber = `JSC/ESC/${prefix}/${body.pjNumber}/${newFileNo}/${year}`;

      // Ensure uniqueness
      const existing = await DatabaseManager.disciplinaryRecord.findOne({
        where: { fileNumber }
      });

      if (existing) {
        return callback({
          status: 400,
          message: `File number ${fileNumber} already exists`
        });
      }

      // 5️⃣ Store previous values (for audit)
      const previousValue = record.toJSON();

      // 6️⃣ Update record → REGISTER CASE
      await record.update({
        stage: "CASE",
        status: "Registered",
        officerName: body.officerName,
        designation: body.designation,
        natureOfCharges: body.natureOfCharges,
        pjNumber: body.pjNumber,
        dateEscalated,
        caseAgainst: body.caseAgainst,
        assignedTo: body.assignedTo,
        fileNumber,
        dateFiled
      });

      // 7️⃣ Audit trail
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "CASE_REGISTERED",
        performedBy: authUser.userID,
        previousValue,
        newValue: record.toJSON()
      });

      // 8️⃣ Return success
      return callback({
        status: Consts.httpCodeSuccess,
        message: "Case registered successfully",
        record
      });

    } catch (err) {
      console.error("Register case error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to register case",
        error: err.message || err
      });
    }
  }

  static async assignLegalTeam(body, authUser, callback) {
    try {
      // 1️⃣ Validate authenticated user
      if (!authUser || !authUser.userID) {
        throw new Error("Unauthorized: Missing user context");
      }

      // Only Director Legal can assign report
      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.assignLegalTeam"
      );

      if (!permissionCheck.allowed) {
        return callback({
          status: Consts.unAuthorized,
          message: "Only Director Legal can assign a report"
        });
      } 

      // 2️⃣ Validate inputs
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      if (Utils.isEmpty(body.assignedTo)) {
        return callback({
          status: 400,
          message: "assignedTo is required"
        });
      }

      // 3️⃣ Find existing disciplinary record
      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      // Ensure report is assignable
      if (record.stage !== "CASE") {
        return callback({
          status: 400,
          message: `Cannot assign record at stage ${record.case}`
        });
      }

      // 4️⃣ Confirm assigned user exists and is legalTeam
      const legalTeamUser = await DatabaseManager.user.findOne({
        where: {
          userID: body.assignedTo
        },
        include: [
          {
            model: DatabaseManager.role,
            as: "role",
            where: {
              roleName: "legalTeam"
            }
          }
        ]
      });

      if (!legalTeamUser) {
        return callback({
          status: 400,
          message: "Assigned user must be a Legal Team member"
        });
      }

      // 5️⃣ Store previous values for audit
      const previousValue = record.toJSON();

      // 6️⃣ Update record assignment
      await record.update({
        assignedTo: legalTeamUser.userID,
        status: "Assigned"
      });

      // 7️⃣ Audit trail
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "REPORT_ASSIGNED",
        performedBy: authUser.userID,
        previousValue,
        newValue: record.toJSON()
      });

      // 8️⃣ Return success
      return callback({
        status: Consts.httpCodeSuccess,
        message: "Report assigned successfully",
        record
      });

    } catch (err) {
      console.error("Assign report error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to assign report",
        error: err.message || err
      });
    }
  }

  static async processCase(body, authUser, files, callback) {
    try {
      // 1️⃣ Validate auth user
      if (!authUser || !authUser.userID) {
        return callback({
          status: Consts.unAuthorized,
          message: "Unauthorized"
        });
      }

      // 2️⃣ Validate input
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      // 3️⃣ Find record
      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: Consts.httpCodeFileNotFound,
          message: "Record not found"
        });
      }

      //  Authorization:
      // DirectorLegal can process a case in registered state.
      // legalTeam can only process cases assigned to them.
      const canLegalTeamProcess =
        PermissionService.hasPermission(
          authUser,
          "disciplinaryRecords.processCase"
        ) &&
        record.status === "Assigned" &&
        record.assignedTo === authUser.userID;

      const canDirectorProcess =
        PermissionService.hasPermission(
          authUser,
          "disciplinaryRecords.directorProcessCase"
        ) &&
        record.status === "Registered";

      if (!canLegalTeamProcess && !canDirectorProcess) {
        return callback({
          status: 403,
          message: "You do not have permission to process this case at its current status"
        });
      } 

      //  Validate stage + status
      if (record.stage !== "CASE") {
        return callback({
          status: 400,
          message: `Cannot process record at stage ${record.stage}`
        });
      }

      if (!["Assigned", "Registered"].includes(record.status)) {
        return callback({
          status: 400,
          message: `Cannot process case with status ${record.status}`
        });
      }

      //  Handle inputs (text OR file)
      const summaryText = body.summary || null;
      const boardBriefText = body.boardBrief || null;

      const summaryFile = files?.summaryFile?.[0]?.path || null;
      const boardBriefFile = files?.boardBriefFile?.[0]?.path || null;

      if (!summaryText && !summaryFile) {
        return callback({
          status: 400,
          message: "Provide either summary text or upload summary document"
        });
      }

      if (!boardBriefText && !boardBriefFile) {
        return callback({
          status: 400,
          message: "Provide either board brief text or upload board brief document"
        });
      }

      // 7️⃣ Store previous values
      const previousValue = record.toJSON();

      // 8️⃣ Update record
      await record.update({
        status: "Processed",
        summary: summaryText,
        summaryFile,
        boardBrief: boardBriefText,
        boardBriefFile
      });

      // 9️⃣ Audit trail
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "CASE_PROCESSED",
        performedBy: authUser.userID,
        previousValue,
        newValue: record.toJSON()
      });

      // 🔟 Success
      return callback({
        status: Consts.httpCodeSuccess,
        message: "Case processed successfully",
        record
      });

    } catch (err) {
      console.error("Process case error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to process case",
        error: err.message || err
      });
    }
  }

  static async viewCaseFile(authUser, recordID, fileType, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        });
      }

      if (Utils.isEmpty(recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      if (Utils.isEmpty(fileType)) {
        return callback({
          status: 400,
          message: "fileType is required"
        });
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      let filePath = null;

      if (fileType === "summary") {
        filePath = record.summaryFile;
      } else if (fileType === "boardBrief") {
        filePath = record.boardBriefFile;
      } else {
        return callback({
          status: 400,
          message: "fileType must be either 'summary' or 'boardBrief'"
        });
      }

      if (!filePath) {
        return callback({
          status: 404,
          message: `${fileType} file not found`
        });
      }

      return callback({
        status: 200,
        message: `${fileType} file found`,
        fileType,
        filePath
      });

    } catch (err) {
      return callback({
        status: 500,
        message: "Failed to view file",
        error: err.message
      });
    }
  }

  static async preliminaryReview(body, authUser, files, callback) {
    try {
      // 1️⃣ Validate auth user
      if (!authUser || !authUser.userID) {
        return callback({
          status: Consts.unAuthorized,
          message: "Unauthorized"
        });
      }

      const permissionCheck = PermissionService.authorize(
        authUser,
        "disciplinaryRecords.preliminaryReview"
      );

      if (!permissionCheck.allowed) {
        return callback({
          status: Consts.unAuthorized,
          message: "Only Director Legal can submit a preliminary report"
        });
      }
      // 2️⃣ Validate input
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      // 3️⃣ Validate file (MANDATORY)
      const preliminaryReportFile = files?.preliminaryReport?.[0]?.path;

      if (!preliminaryReportFile) {
        return callback({
          status: 400,
          message: "Preliminary report file is required"
        });
      }

      // 4️⃣ Find record
      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: Consts.httpCodeFileNotFound,
          message: "Record not found"
        });
      }

      // 5️⃣ Validate stage + status
      if (record.stage !== "CASE" || record.status !== "Processed") {
        return callback({
          status: 400,
          message: `Cannot perform preliminary review at stage ${record.stage} with status ${record.status}`
        });
      }

      // 6️⃣ Store previous values
      const previousValue = record.toJSON();

      // 7️⃣ Update record → ONLY status + preliminary report
      await record.update({
        status: "Preliminary_review_completed",
        preliminaryReport: preliminaryReportFile
      });

      // 8️⃣ Audit trail
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "PRELIMINARY_REVIEW_COMPLETED",
        performedBy: authUser.userID,
        previousValue,
        newValue: record.toJSON()
      });

      // 9️⃣ Success
      return callback({
        status: Consts.httpCodeSuccess,
        message: "Preliminary review completed successfully",
        record
      });

    } catch (err) {
      console.error("Preliminary review error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to complete preliminary review",
        error: err.message || err
      });
    }
  }

  static async viewPreliminaryReport(authUser, recordID, callback) {
    try {
      if (!authUser || !authUser.userID) {
        return callback({
          status: 401,
          message: "Unauthorized"
        });
      }

      if (Utils.isEmpty(recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record) {
        return callback({
          status: 404,
          message: "Record not found"
        });
      }

      if (record.status !== "submitted_to_JSC") {
        return callback({
          status: 400,
          message: `Preliminary report can only be viewed when status is submitted_to_JSC. Current status is ${record.status}`
        });
      }

      if (!record.preliminaryReport) {
        return callback({
          status: 404,
          message: "Preliminary report file not found"
        });
      }

      return callback({
        status: 200,
        message: "Preliminary report file found",
        fileType: "preliminaryReport",
        filePath: record.preliminaryReport
      });

    } catch (err) {
      return callback({
        status: 500,
        message: "Failed to view preliminary report",
        error: err.message
      });
    }
  }

  static async reviewCaseDecision(body, authUser, callback) {
    try {
      // 1️⃣ Validate auth
      if (!authUser || !authUser.userID) {
        return callback({
          status: Consts.unAuthorized,
          message: "Unauthorized"
        });
      }

      // 2️⃣ Validate input
      if (Utils.isEmpty(body.recordID)) {
        return callback({
          status: 400,
          message: "recordID is required"
        });
      }

      if (Utils.isEmpty(body.decision)) {
        return callback({
          status: 400,
          message: "decision is required (admit or terminate)"
        });
      }

      const decision = body.decision.toLowerCase();

      if (!["admit", "terminate"].includes(decision)) {
        return callback({
          status: 400,
          message: "Invalid decision. Use admit or terminate"
        });
      }

      // optional but recommended
      const reviewNote = body.reviewNote || null;

      // 2.1️⃣ If admitted, panel is required
      const allowedPanels = [
        "Panel_1",
        "Panel_2",
        "Panel_3",
        "Panel_4",
        "Panel_5",
        "Panel_6",
        "Panel_7"
      ];

      if (decision === "admit") {
        if (Utils.isEmpty(body.panel)) {
          return callback({
            status: 400,
            message: "panel is required when admitting a case"
          });
        }

        if (!allowedPanels.includes(body.panel)) {
          return callback({
            status: 400,
            message: "Invalid panel selected"
          });
        }
      }

      // 3️⃣ Find record
      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID: body.recordID }
      });

      if (!record) {
        return callback({
          status: Consts.httpCodeFileNotFound,
          message: "Record not found"
        });
      }

      // 4️⃣ Validate stage + status
      if (record.stage !== "CASE" || record.status !== "Preliminary_review_completed") {
        return callback({
          status: 400,
          message: `Cannot review case at stage ${record.stage} with status ${record.status}`
        });
      }

      // 5️⃣ Store previous state
      const previousValue = record.toJSON();

      // 6️⃣ Determine outcome
      let newStatus = "";
      let action = "";

      if (decision === "admit") {
        newStatus = "Admitted";
        action = "CASE_ADMITTED";
      } else {
        newStatus = "Closed";
        action = "CASE_TERMINATED";
      }

      // 7️⃣ Update record
      const updatePayload = {
        status: newStatus,
        reservedNote: reviewNote // reuse field for decision notes OR create new column later if needed
      };

      if (decision === "admit") {
        updatePayload.panel = body.panel;
      }

      await record.update(updatePayload);

      // 8️⃣ Audit trail
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action,
        performedBy: authUser.userID,
        previousValue,
        newValue: record.toJSON()
      });

      // 9️⃣ Success response
      return callback({
        status: Consts.httpCodeSuccess,
        message: `Case successfully ${decision === "admit" ? "admitted" : "terminated"}`,
        record
      });

    } catch (err) {
      console.error("Review case decision error:", err);

      return callback({
        status: Consts.httpCodeServerError,
        message: "Failed to process case decision",
        error: err.message || err
      });
    }
  }

  static list(param, callback) {
    const baseQuery = {}; // fetch all records
    let filteredQuery = { ...baseQuery };

    // DataTables search
    if (!Utils.isEmpty(param["search[value]"])) {
      const searchValue = param["search[value]"];

      filteredQuery = {
        [Op.or]: [
          { pjNumber: { [Op.like]: `%${searchValue}%` } },
          { officerName: { [Op.like]: `%${searchValue}%` } },
          { designation: { [Op.like]: `%${searchValue}%` } },
          { natureOfCharges: { [Op.like]: `%${searchValue}%` } },
          { panel: { [Op.like]: `%${searchValue}%` } },
          { status: { [Op.like]: `%${searchValue}%` } },
          { dateFiled: { [Op.like]: `%${searchValue}%` } },
          { dateEscalated: { [Op.like]: `%${searchValue}%` } },
          { fileNumber: { [Op.like]: `%${searchValue}%` } },
          { assignedTo: { [Op.like]: `%${searchValue}%` } },
          { caseAgainst: { [Op.like]: `%${searchValue}%` } },
        ],
      };
    }

    async.waterfall(
      [
        // 1) Count ALL records
        function (done) {
          DatabaseManager.disciplinaryRecord
            .count({ where: baseQuery })
            .then((totalRecords) => done(null, totalRecords))
            .catch((err) => done(err));
        },

        // 2) Count FILTERED records
        function (totalRecords, done) {
          DatabaseManager.disciplinaryRecord
            .count({ where: filteredQuery })
            .then((filteredRecords) => done(null, totalRecords, filteredRecords))
            .catch((err) => done(err));
        },

        // 3) Fetch paginated data
        function (totalRecords, filteredRecords, done) {
          const offset = parseInt(param.start, 10) || 0;
          const limit = parseInt(param.length, 10) || 10;

          DatabaseManager.disciplinaryRecord
            .findAll({
              where: filteredQuery,
              attributes: [
                "recordID",          // change to your PK field name if different
                "officerName",
                "pjNumber",
                "caseAgainst",
                "designation",
                "dateFiled",
                "dateEscalated",
                "natureOfCharges",
                "fileNumber",
                "assignedTo",
                "panel",
                "judgement",
                "judgementDate",
                "status",
                "createdAt",
              ],
              order: [["createdAt", "DESC"]],
              offset,
              limit,
            })
            .then((data) => done(null, totalRecords, filteredRecords, data))
            .catch((err) => done(err));
        },
      ],
      // 4) Final response
      function (err, totalRecords, filteredRecords, data) {
        if (err) {
          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to fetch disciplinary records",
            error: err,
            data: [],
            recordsTotal: 0,
            recordsFiltered: 0,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "Disciplinary records fetched successfully",
          data,
          draw: parseInt(param.draw, 10) || 0,
          recordsTotal: totalRecords,
          recordsFiltered: filteredRecords,
        });
      }
    );
  }  
    
  static update(body, callback) {
    async.waterfall(
      [
        // 1) Validate inputs + confirm record exists
        function (done) {
          if (!body) return done("Request body is missing");
          if (Utils.isEmpty(body.recordID)) return done("recordID is required");

          const allowedStatuses = [
            "Filed", "Pending", "Scheduled", "Hearing", "Adjourned",
            "Judgment Reserved", "Judgment Delivered", "Appeal Pending",
            "Concluded", "Dismissed", "Withdrawn", "Closed",
          ];

          if (!Utils.isEmpty(body.status) && !allowedStatuses.includes(body.status)) {
            return done(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`);
          }

          let dateFiled = null;
          if (!Utils.isEmpty(body.dateFiled)) {
            dateFiled = new Date(body.dateFiled);
            if (Number.isNaN(dateFiled.getTime())) return done("dateFiled must be a valid date");
          }

          DatabaseManager.disciplinaryRecord
            .findOne({ where: { recordID: body.recordID } })
            .then((res) => {
              if (Utils.isEmpty(res)) return done("Disciplinary record not found");
              done(null, dateFiled);
            })
            .catch((err) => done(err));
        },

        // 2) Update record
        function (dateFiled, done) {
          const params = {};

          if (!Utils.isEmpty(body.officerName)) params.officerName = body.officerName;
          if (!Utils.isEmpty(body.designation)) params.designation = body.designation;
          if (!Utils.isEmpty(body.natureOfCharges)) params.natureOfCharges = body.natureOfCharges;
          if (!Utils.isEmpty(body.panel)) params.panel = body.panel;

          // allow setting judgement to null intentionally
          if (body.judgement !== undefined) {
            params.judgement = Utils.isEmpty(body.judgement) ? null : body.judgement;
          }

          if (!Utils.isEmpty(body.status)) params.status = body.status;
          if (dateFiled) params.dateFiled = dateFiled;

          if (Object.keys(params).length === 0) return done("No fields provided to update");

          DatabaseManager.disciplinaryRecord
            .update(params, { where: { recordID: body.recordID } })
            .then(([affectedRows]) => {
              if (!affectedRows) return done("No record was updated");
              done(null);
            })
            .catch((err) => done(err));
        },

        // 3) Fetch updated record (MySQL needs this step)
        function (done) {
          DatabaseManager.disciplinaryRecord
            .findOne({ where: { recordID: body.recordID } })
            .then((record) => done(null, record))
            .catch((err) => done(err));
        },
      ],

      // 4) Final response
      function (err, record) {
        if (err) {
          const errorMessage =
            typeof err === "string" ? err : (err.message || "Internal server error");

          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to update disciplinary record",
            error: errorMessage,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "Disciplinary record updated successfully",
          record, 
        });
      }
    );
  }

  static downloadPdf(recordID, callback) {
    async.waterfall(
      [
        // 1) Validate input + fetch record
        function (done) {
          if (Utils.isEmpty(recordID)) return done("recordID is required");

          DatabaseManager.disciplinaryRecord
            .findOne({ where: { recordID } })
            .then((record) => {
              if (Utils.isEmpty(record)) return done("Disciplinary record not found");
              done(null, record);
            })
            .catch((err) => done(err));
        },

        // 2) Build PDF (return a Buffer)
        function (record, done) {
          try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });

            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => {
              const pdfBuffer = Buffer.concat(chunks);
              done(null, record, pdfBuffer);
            });

            // ---- PDF content ----
            doc.fontSize(18).text("Disciplinary Record", { align: "center" });
            doc.moveDown(1);

            doc.fontSize(12);
            doc.text(`Record ID: ${record.recordID}`);
            doc.text(`Officer Name: ${record.officerName || ""}`);
            doc.text(`Designation: ${record.designation || ""}`);
            doc.text(`Date Filed: ${record.dateFiled ? new Date(record.dateFiled).toISOString() : ""}`);
            doc.text(`Nature of Charges: ${record.natureOfCharges || ""}`);
            doc.text(`Panel: ${record.panel || ""}`);
            doc.text(`Judgement: ${record.judgement || ""}`);
            doc.text(`Status: ${record.status || ""}`);

            doc.moveDown(1);
            doc.text(`Generated On: ${new Date().toISOString()}`);

            doc.end();
          } catch (e) {
            done(e);
          }
        },
      ],
      // 3) Final response
      function (err, record, pdfBuffer) {
        if (err) {
          const errorMessage = typeof err === "string" ? err : (err.message || "Internal server error");
          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to generate PDF",
            error: errorMessage,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "PDF generated successfully",
          recordID: record.recordID,
          fileName: `disciplinary-record-${record.recordID}.pdf`,
          pdfBuffer, 
        });
      }
    );
  }

  static updateCaseAction(authUser, recordID, action, payload, callback) {
    async.waterfall(
      [
        // 1. Validate input
        function (done) {
          // Only require authUser for normal actions
          if (!authUser && action !== "AUTO_START_HEARING") {
            return done({ message: "Unauthorized", status: Consts.httpCodeUnauthorized });
          }

          if (Utils.isEmpty(recordID)) return done({ message: "recordID is required", status: Consts.httpCodeBadRequest });
          if (Utils.isEmpty(action)) return done({ message: "action is required", status: Consts.httpCodeBadRequest });
          if (!STATUS_FLOW[action]) return done({ message: "Invalid action", status: Consts.httpCodeBadRequest });

          done(null);
        },

        // 2. Fetch record
        function (done) {
          DatabaseManager.disciplinaryRecord.findOne({ where: { recordID } })
            .then((record) => {
              if (!record) {
                return done({
                  message: "Record not found",
                  status: Consts.httpCodeNotFound
                });
              }

              // ONLY AUTH CHECK (no role, no assignment restriction)
              if (!authUser || !authUser.userID) {
                return done({
                  message: "Unauthorized",
                  status: Consts.httpCodeUnauthorized
                });
              }

              done(null, record);
            })
            .catch((err) =>
              done({
                message: "Failed to fetch record",
                status: Consts.httpCodeServerError,
                error: err
              })
            );
        },

        // 3. Validate transition + prepare update
        function (record, done) {
          const config = STATUS_FLOW[action];
          if (!config.allowedFrom.includes(record.status)) {
            return done({ message: `Invalid action. Cannot ${action} when status is ${record.status}`, status: Consts.httpCodeBadRequest });
          }

          let updateData = {};
          const previousValue = record.toJSON();

          if (action === "ADD_HEARING_DATE") {
            if (Utils.isEmpty(payload.hearingDate)) return done({ message: "hearingDate is required", status: Consts.httpCodeBadRequest });
            const parsedDate = new Date(payload.hearingDate);
            if (Number.isNaN(parsedDate.getTime())) return done({ message: "Invalid hearingDate", status: Consts.httpCodeBadRequest });
            updateData.hearingDate = parsedDate;
          }

          if (action === "ADJOURN_CASE") {
            if (Utils.isEmpty(payload.reason)) {
              return done({
                message: "Adjourn reason is required",
                status: Consts.httpCodeBadRequest
              });
            }

            updateData.adjournReason = payload.reason;
          }

          if (action === "JUDGMENT_RESERVED") {
            if (Utils.isEmpty(payload.note)) {
              return done({
                message: "Reservation note is required",
                status: Consts.httpCodeBadRequest
              });
            }

            updateData.reservedNote = payload.note;
            updateData.reservedDate = new Date();
          }

          if (action === "ADD_JUDGEMENT") {
            if (Utils.isEmpty(payload.judgement)) return done({ message: "judgement is required", status: Consts.httpCodeBadRequest });
            updateData.judgement = payload.judgement;
            updateData.judgementDate = new Date();
          }

          // AUTO_START_HEARING doesn't need payload, just updates status
          if (action === "CLOSE_CASE") {
            // no extra data
          }

          updateData.status = config.nextStatus;
          done(null, record, previousValue, updateData);
        },

        // 4. Update record
        function (record, previousValue, updateData, done) {
          record.update(updateData)
            .then((updatedRecord) => done(null, previousValue, updatedRecord))
            .catch((err) => done({ message: "Failed to update record", status: Consts.httpCodeServerError, error: err }));
        },

        // 5. Audit trail
        function (previousValue, updatedRecord, done) {
          DatabaseManager.disciplinaryHistory.create({
            recordID: updatedRecord.recordID,
            action: action,
            performedBy: authUser ? authUser.userID : null, // null for system
            previousValue,
            newValue: updatedRecord.toJSON(),
          })
          .then(() => done(null, updatedRecord))
          .catch((err) => done({ message: "Failed to save audit trail", status: Consts.httpCodeServerError, error: err }));
        },
      ],

      // 6. Final response
      function (err, updatedRecord) {
        if (err) return callback(err);

        return callback({
          status: Consts.httpCodeSuccess,
          message: `${action} completed successfully`,
          record: updatedRecord,
        });
      }
    );
  }
}

export default DisciplinaryRecordLogic;