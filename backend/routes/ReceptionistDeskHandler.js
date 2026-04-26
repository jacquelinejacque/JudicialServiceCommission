import { Router } from "express";
import ReceptionistDeskLogic from "../logic/ReceptionistDeskLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var ReceptionistDeskHandler = Router();

ReceptionistDeskHandler.post("/create", authenticate, function (req, res) {
  ReceptionistDeskLogic.create(req.body, req.user, function (result) {
    res.json(result);
  });
});

ReceptionistDeskHandler.get("/list", authenticate, function (req, res) {
  ReceptionistDeskLogic.list(req.query, function (result) {
    res.json(result);
  });
});

ReceptionistDeskHandler.post("/update", authenticate, function (req, res) {
  ReceptionistDeskLogic.updateReceptionDesk(req.body, req.user, function (result) {
    res.json(result);
  });
});
export default ReceptionistDeskHandler;