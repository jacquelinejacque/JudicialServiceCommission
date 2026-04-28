import { Router } from "express";
import HelpDeskLogic from "../logic/HelpDeskLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var HelpDeskHandler = Router();

HelpDeskHandler.post("/raiseTicket", authenticate, function (req, res) {
  HelpDeskLogic.raiseTicket(req.user, req.body, function (result) {
    res.status(result.status || 200).json(result);
  });
});

HelpDeskHandler.get("/list", authenticate, function (req, res) {
  HelpDeskLogic.listTickets(req.user, req.query, function (result) {
    res.status(result.status || 200).json(result);
  });
});

HelpDeskHandler.post("/assign", authenticate, function (req, res) {
  HelpDeskLogic.assignTicket(req.user, req.body, function (result) {
    res.status(result.status || 200).json(result);
  });
});

HelpDeskHandler.post("/reassignTicket", authenticate, function (req, res) {
  HelpDeskLogic.reassignTicket(req.user, req.body, function (result) {
    res.status(result.status || 200).json(result);
  });
});

HelpDeskHandler.post("/resolveTicket", authenticate, function (req, res) {
  HelpDeskLogic.resolveTicket(req.user, req.body, function (result) {
    res.status(result.status || 200).json(result);
  });
});

HelpDeskHandler.post("/escalate", authenticate, function (req, res) {
    HelpDeskLogic.escalateTicket(req.user, req.body, function (result) {
        res.status(result.status || 200).json(result);
    });
});
HelpDeskHandler.post("/close", authenticate, function (req, res) {
    HelpDeskLogic.closeTicket(req.user, req.body, function (result) {
        res.status(result.status || 200).json(result);
    });
});
export default HelpDeskHandler;