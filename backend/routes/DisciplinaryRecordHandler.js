// routes to handle customer requests

import { Router } from "express";
import DisciplinaryRecordLogic from "../logic/DisciplinaryRecordLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var DisciplinaryRecordHandler = Router();
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