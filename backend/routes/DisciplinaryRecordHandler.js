// routes to handle customer requests

import { Router } from "express";
import DisciplinaryRecordLogic from "../logic/DisciplinaryRecordLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import DatabaseManager from "../lib/DatabaseManager.js"; 
import async from "async";
import uploadDocument from "../middleware/UploadDocument.js";
import path from "path";
import mime from "mime-types";

var DisciplinaryRecordHandler = Router();
//create report
DisciplinaryRecordHandler.post( "/createReport", authenticate, uploadDocument.single("reportFile"), function (req, res) {
    const authUser = req.user;
    DisciplinaryRecordLogic.createReport(req.body, authUser, req.file, function (result) {
      res.json(result);
    });
  }
);

DisciplinaryRecordHandler.post("/viewReport", authenticate, function (req, res) {
  const authUser = req.user;
  const recordID = req.body?.recordID;
  DisciplinaryRecordLogic.viewReport(
    authUser, recordID,
    function (result) {
      res.status(result.status || 200).json(result);
    }
  );
});

DisciplinaryRecordHandler.get( "/file/:recordID", authenticate, async function (req, res) {
    try {
      const { recordID } = req.params;

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record || !record.reportFile) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = record.reportFile;
      const ext = path.extname(filePath); // preserve original uploaded extension
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      const safeTitle = (record.title || "Report")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      const fileName = `${safeTitle}_Report${ext}`;

      res.setHeader("Content-Type", mimeType);

      return res.download(filePath, fileName);

    } catch (err) {
      return res.status(500).json({
        message: "Failed to load file",
        error: err.message
      });
    }
  }
);

DisciplinaryRecordHandler.post( "/updateReport", authenticate,  uploadDocument.single("reportFile"), function (req, res) {
    const authUser = req.user;
    const body = req.body;
    const file = req.file;
    DisciplinaryRecordLogic.updateReport(body, authUser, file, function (result) {
      res.status(result.status || 200).json(result);
    });
  }
);

DisciplinaryRecordHandler.get("/details/:recordID", authenticate, function (req, res) {
  const authUser = req.user
  const recordID = req.params?.recordID
  DisciplinaryRecordLogic.getRecordDetails(recordID, authUser, function (result) {
    res.status(result.status || 200).json(result)
  })
});
// list Reports
DisciplinaryRecordHandler.get("/listReports",authenticate, function (req, res) {
  DisciplinaryRecordLogic.listReports(req.query,function (result) {   
    res.json(result);
  });
});
// export Reports
DisciplinaryRecordHandler.get("/exportReports", authenticate, function (req, res) {
  DisciplinaryRecordLogic.exportReports(req.query, function (result) {
    if (result.status !== Consts.httpCodeSuccess) {
      return res.status(result.status).json(result);
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="filtered_reports.xlsx"');

    return res.end(result.fileBuffer);
  });
});

DisciplinaryRecordHandler.post( "/assignToDirectorLegal", authenticate, function (req, res) {
    const authUser = req.user;
    DisciplinaryRecordLogic.assignToDirectorLegal( req.body, authUser, function (result) {
        res.json(result);
      }
    );
  }
);

DisciplinaryRecordHandler.post( "/registerCase", authenticate, function (req, res) {
    const authUser = req.user;
    DisciplinaryRecordLogic.registerCase( req.body, authUser,  function (result) {
        res.json(result);
      }
    );
  }
);

DisciplinaryRecordHandler.post( "/processCase", authenticate,  uploadDocument.fields([
    { name: "summaryFile", maxCount: 1 },
    { name: "boardBriefFile", maxCount: 1 }
  ]),
  function (req, res) {
    const authUser = req.user; 
    DisciplinaryRecordLogic.processCase( req.body, authUser, req.files,
      function (result) {
        res.json(result);
      }
    );
  }
);

DisciplinaryRecordHandler.post("/viewCaseFile", authenticate, function (req, res) {
  const authUser = req.user;
  const recordID = req.body?.recordID;
  const fileType = req.body?.fileType; // summary or boardBrief

  DisciplinaryRecordLogic.viewCaseFile( authUser, recordID, fileType, function (result) {
      res.status(result.status || 200).json(result);
    }
  );
});


DisciplinaryRecordHandler.get("/caseFile/:recordID/:fileType", authenticate,async function (req, res) {
    try {
      const { recordID, fileType } = req.params;

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      let filePath = null;
      let label = null;

      if (fileType === "summary") {
        filePath = record.summaryFile;
        label = "Summary";
      } else if (fileType === "boardBrief") {
        filePath = record.boardBriefFile;
        label = "BoardBrief";
      } else {
        return res.status(400).json({
          message: "fileType must be either 'summary' or 'boardBrief'"
        });
      }

      if (!filePath) {
        return res.status(404).json({ message: `${fileType} file not found` });
      }

      const ext = path.extname(filePath);
      const safeTitle = (record.title || "Case_File")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      const fileName = `${safeTitle}_${record.fileNumber || "NoFileNumber"}_${label}${ext}`;
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);

      return res.download(filePath, fileName);

    } catch (err) {
      return res.status(500).json({
        message: "Failed to load file",
        error: err.message
      });
    }
  }
);

DisciplinaryRecordHandler.post( "/preliminaryReview", authenticate, uploadDocument.fields([
    { name: "preliminaryReport", maxCount: 1 }
  ]), function (req, res) {
    const authUser = req.user;
    DisciplinaryRecordLogic.preliminaryReview( req.body, authUser, req.files, function (result) {
        res.json(result);
      }
    );
  }
);

DisciplinaryRecordHandler.post("/viewPreliminaryReport", authenticate, function (req, res) {
  const authUser = req.user;
  const recordID = req.body?.recordID;
  DisciplinaryRecordLogic.viewPreliminaryReport(
    authUser,
    recordID,
    function (result) {
      res.status(result.status || 200).json(result);
    }
  );
});

DisciplinaryRecordHandler.get( "/preliminaryReport/:recordID",authenticate, async function (req, res) {
    try {
      const { recordID } = req.params;

      const record = await DatabaseManager.disciplinaryRecord.findOne({
        where: { recordID }
      });

      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      if (record.status !== "submitted_to_JSC") {
        return res.status(400).json({
          message: `Preliminary report can only be downloaded when status is submitted_to_JSC. Current status is ${record.status}`
        });
      }

      if (!record.preliminaryReport) {
        return res.status(404).json({ message: "Preliminary report file not found" });
      }

      const filePath = record.preliminaryReport;
      const ext = path.extname(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      const safeTitle = (record.title || "Preliminary_Report")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      const fileName = `${safeTitle}_PreliminaryReport${ext}`;

      res.setHeader("Content-Type", mimeType);

      return res.download(filePath, fileName);

    } catch (err) {
      return res.status(500).json({
        message: "Failed to load preliminary report",
        error: err.message
      });
    }
  }
);

DisciplinaryRecordHandler.post( "/reviewPreliminaryReport", authenticate, function (req, res) {
    const authUser = req.user;
    DisciplinaryRecordLogic.reviewCaseDecision( req.body,  authUser,  function (result) {
        res.json(result);
      }
    );
  }
);


// list records
DisciplinaryRecordHandler.get("/list",authenticate, function (req, res) {
  DisciplinaryRecordLogic.list(req.query,function (result) {   
    res.json(result);
  });
});
// create a record
DisciplinaryRecordHandler.post("/create", authenticate, function (req, res) {
  const authUser = req.user; // get logged-in user from auth middleware

  if (!authUser || !authUser.userID) {
    return res.status(401).json({ status: 401, message: "Unauthorized" });
  }

  DisciplinaryRecordLogic.create(req.body, authUser, function (result) {
    res.json(result);
  });
});
//update a record
DisciplinaryRecordHandler.post("/update",authenticate, function (req, res) {
  DisciplinaryRecordLogic.update(req.body, function (result) {
    res.json(result);
  });
});

// Download record as PDF
DisciplinaryRecordHandler.get("/download/:recordID", authenticate, function (req, res) {
  DisciplinaryRecordLogic.downloadPdf(req.params.recordID, function (result) {
    if (result.status !== Consts.httpCodeSuccess) {
      return res.status(result.status).json(result);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return res.send(result.pdfBuffer);
  });
});

DisciplinaryRecordHandler.post("/update-action", authenticate, function (req, res) {
  const { recordID, action, payload } = req.body;
  DisciplinaryRecordLogic.updateCaseAction(req.user,recordID,action,payload || {}, 
    function (result) {res.status(result.status || 200).json(result);
    }
  );

});
export default DisciplinaryRecordHandler;