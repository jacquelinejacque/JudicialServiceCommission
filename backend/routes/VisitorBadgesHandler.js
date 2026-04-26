import { Router } from "express";
import VisitorBadgesLogic from "../logic/VisitorBadgesLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var VisitorBadgesHandler = Router();

VisitorBadgesHandler.post("/create", authenticate, function (req, res) {
  VisitorBadgesLogic.createBadge(req.body, req.user, function (result) {
    res.json(result);
  });
});

VisitorBadgesHandler.post("/createBulk", authenticate, function (req, res) {
  VisitorBadgesLogic.createBadges(req.body, req.user, function (result) {
    res.json(result);
  });
});

VisitorBadgesHandler.get("/list", authenticate, function (req, res) {
  VisitorBadgesLogic.list(req.query, function (result) {
    res.json(result);
  });
});

export default VisitorBadgesHandler;