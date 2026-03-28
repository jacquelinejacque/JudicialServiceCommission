import { Router } from "express";
import DisciplinaryHistoryLogic from "../logic/DisciplinaryHistoryLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";


var DisciplinaryHistoryHandler = Router();

DisciplinaryHistoryHandler.get("/list/:ticketID", authenticate, function (req, res) {
  DisciplinaryHistoryLogic.getDisciplinaryRecordHistory(req.user, req.params.ticketID, function (result) {
    res.status(result.status || 200).json(result);
  });
});


export default DisciplinaryHistoryHandler;