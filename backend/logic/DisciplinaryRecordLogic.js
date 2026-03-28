import async from "async";
import { Consts, STATUS_FLOW } from "../lib/Consts.js"; 
import Utils from "../lib/Utils.js";          
import DatabaseManager from "../lib/DatabaseManager.js"; 
import PDFDocument from "pdfkit";

class DisciplinaryRecordLogic {
  static async create(body, authUser, callback) {
    try {
      // 1️⃣ Validate inputs
      if (!authUser || !authUser.userID) throw new Error("Unauthorized: Missing user context");

      const requiredFields = [
        "officerName",
        "designation",
        "natureOfCharges",
        "panel",
        "pjNumber",
        "dateEscalated",
        "caseAgainst",
        "assignedTo"
      ];
      for (const field of requiredFields) {
        if (Utils.isEmpty(body[field])) throw new Error(`${field} is required`);
      }

      if (!["Judicial Officer", "Judicial Staff"].includes(body.caseAgainst)) {
        throw new Error("caseAgainst must be either 'Judicial Officer' or 'Judicial Staff'");
      }

      const dateEscalated = new Date(body.dateEscalated);
      if (Number.isNaN(dateEscalated.getTime())) throw new Error("dateEscalated must be a valid date");

      // 2️⃣ Generate unique file number
      const dateFiled = new Date();
      const year = dateFiled.getFullYear();
      const prefix = body.caseAgainst === "Judicial Staff" ? "JS" : "JO";

      const lastRecord = await DatabaseManager.disciplinaryRecord.findOne({
        where: {
          caseAgainst: body.caseAgainst,
          dateFiled: DatabaseManager.sequelize.where(
            DatabaseManager.sequelize.fn("YEAR", DatabaseManager.sequelize.col("dateFiled")),
            year
          )
        },
        order: [["createdAt", "DESC"]],
      });

      let newFileNo = "001";
      if (lastRecord && lastRecord.fileNumber) {
        const parts = lastRecord.fileNumber.split("/");
        const lastNo = parseInt(parts[4], 10);
        newFileNo = String(lastNo + 1).padStart(3, "0");
      }

      const fileNumber = `JSC/ESC/${prefix}/${body.pjNumber}/${newFileNo}/${year}`;

      // Ensure uniqueness
      const existing = await DatabaseManager.disciplinaryRecord.findOne({ where: { fileNumber } });
      if (existing) throw new Error(`File number ${fileNumber} already exists`);

      // 3️⃣ Create disciplinary record
      const record = await DatabaseManager.disciplinaryRecord.create({
        officerName: body.officerName,
        designation: body.designation,
        dateFiled,
        natureOfCharges: body.natureOfCharges,
        panel: body.panel,
        status: Utils.isEmpty(body.status) ? undefined : body.status,
        pjNumber: body.pjNumber,
        dateEscalated,
        caseAgainst: body.caseAgainst,
        assignedTo: body.assignedTo,
        fileNumber,
      });

      // 4️⃣ Record audit trail in DisciplinaryHistory
      await DatabaseManager.disciplinaryHistory.create({
        recordID: record.recordID,
        action: "CREATE",
        performedBy: authUser.userID,
        previousValue: null,
        newValue: record.toJSON(), // store full created record
      });

      // 5️⃣ Return success
      callback({
        status: Consts.httpCodeSuccess,
        message: "Disciplinary record created successfully",
        record,
      });

    } catch (err) {
      console.error("Disciplinary record creation error:", err);
      callback({
        status: Consts.httpCodeServerError,
        message: "Failed to create disciplinary record",
        error: err.message || err,
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
              if (!record) return done({ message: "Record not found", status: Consts.httpCodeNotFound });

              // Only check authorization for normal actions
              if (action !== "AUTO_START_HEARING") {
                const isAdmin = authUser.role === "admin";
                const isAssignee = record.assignedTo === authUser.userID;
                if (!isAdmin && !isAssignee) return done({ message: "Forbidden", status: Consts.httpCodeForbidden });
              }

              done(null, record);
            })
            .catch((err) => done({ message: "Failed to fetch record", status: Consts.httpCodeServerError, error: err }));
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