import { Router } from "express";
import GuestVisitsLogic from "../logic/GuestVisitsLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var GuestVisitsHandler = Router();
GuestVisitsHandler.post("/preRegister", authenticate, function (req, res) {
  GuestVisitsLogic.preRegisterGuest(req.body, req.user, function (result) {
    res.json(result);
  });
});

GuestVisitsHandler.post("/checkIn", authenticate, function (req, res) {
  GuestVisitsLogic.checkInGuest(req.body, req.user, function (result) {
    res.json(result);
  });
});
GuestVisitsHandler.get("/list", authenticate, function (req, res) {
  GuestVisitsLogic.list(req.query, function (result) {
    res.json(result);
  });
});
GuestVisitsHandler.post("/hostApproveGuest", authenticate, function (req, res) {
  GuestVisitsLogic.hostApproveGuest(req.body, req.user, function (result) {
    res.json(result);
  });
});

GuestVisitsHandler.post("/processVisitAlerts", authenticate, function (req, res) {
  GuestVisitsLogic.processVisitAlertSMS(function (result) {
    res.json(result);
  });
});

GuestVisitsHandler.post("/checkOut", authenticate, function (req, res) {
  GuestVisitsLogic.checkOutGuest(req.body, req.user, function (result) {
    res.json(result);
  });
});
export default GuestVisitsHandler;