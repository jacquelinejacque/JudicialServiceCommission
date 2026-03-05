import async from "async";
import { Consts } from "../lib/Consts.js"; 
import Utils from "../lib/Utils.js";          
import DatabaseManager from "../lib/DatabaseManager.js"; 
import PDFDocument from "pdfkit";

class DisciplinaryRecordLogic {
  static create(body, callback) {
    async.waterfall(
      [
        // 1) Validate inputs
        function (done) {
          if (Utils.isEmpty(body.officerName)) return done("Officer name cannot be empty");
          if (Utils.isEmpty(body.designation)) return done("Designation is required");
          if (Utils.isEmpty(body.dateFiled)) return done("DateFiled is required");
          if (Utils.isEmpty(body.natureOfCharges)) return done("Nature of charges is required");
          if (Utils.isEmpty(body.panel)) return done("Panel is required");

          // Optional fields: decision, status
          // Validate DateFiled is a valid date
          const dateFiled = new Date(body.dateFiled);
          if (Number.isNaN(dateFiled.getTime())) return done("DateFiled must be a valid date");

          // Validate status (must be one of the ENUM values if provided)
          const allowedStatuses = [
            "Filed", "Pending", "Scheduled", "Hearing", "Adjourned",
            "Judgment Reserved", "Judgment Delivered", "Appeal Pending",
            "Concluded", "Dismissed", "Withdrawn", "Closed",
          ];

          if (!Utils.isEmpty(body.status) && !allowedStatuses.includes(body.status)) {
            return done(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`);
          }

          // (Optional) prevent duplicate records for same officer & date & charges
          DatabaseManager.disciplinaryRecord
            .findOne({
              where: {
                officerName: body.officerName,
                dateFiled: dateFiled,
                natureOfCharges: body.natureOfCharges,
              },
            })
            .then((res) => {
              if (res) return done("A similar disciplinary record already exists");
              done(null, dateFiled);
            })
            .catch((err) => done(err));
        },

        // 2) Create record
        function (dateFiled, done) {
          const params = {
            officerName: body.officerName,
            designation: body.designation,
            dateFiled: dateFiled,
            natureOfCharges: body.natureOfCharges,
            panel: body.panel,
            decision: Utils.isEmpty(body.decision) ? null : body.decision,
            status: Utils.isEmpty(body.status) ? undefined : body.status, 
          };

          DatabaseManager.disciplinaryRecord
            .create(params)
            .then((record) => done(null, record))
            .catch((err) => done(err));
        },
      ],
      // 3) Final response
      function (err, record) {
        if (err) {
          return callback({
            status: Consts.httpCodeServerError,
            message: "Failed to create disciplinary record",
            error: err,
          });
        }

        return callback({
          status: Consts.httpCodeSuccess,
          message: "Disciplinary record created successfully",
          record,
        });
      }
    );
  }

  static list(param, callback) {
    const baseQuery = {}; // fetch all records
    let filteredQuery = { ...baseQuery };

    // DataTables search
    if (!Utils.isEmpty(param["search[value]"])) {
      const searchValue = param["search[value]"];

      filteredQuery = {
        [Op.or]: [
          { officerName: { [Op.like]: `%${searchValue}%` } },
          { designation: { [Op.like]: `%${searchValue}%` } },
          { natureOfCharges: { [Op.like]: `%${searchValue}%` } },
          { panel: { [Op.like]: `%${searchValue}%` } },
          { decision: { [Op.like]: `%${searchValue}%` } },
          { status: { [Op.like]: `%${searchValue}%` } },
          { dateFiled: { [Op.like]: `%${searchValue}%` } },
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
                "designation",
                "dateFiled",
                "natureOfCharges",
                "panel",
                "decision",
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

          // allow setting decision to null intentionally
          if (body.decision !== undefined) {
            params.decision = Utils.isEmpty(body.decision) ? null : body.decision;
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
          doc.text(`Decision: ${record.decision || ""}`);
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

}

export default DisciplinaryRecordLogic;