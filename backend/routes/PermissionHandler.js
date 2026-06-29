import { Router } from "express";
import PermissionLogic from "../logic/PermissionLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var PermissionHandler = Router();

// create a permission
PermissionHandler.post("/create", function (req, res) {
  PermissionLogic.create(req.body, function (result) {
    res.json(result);
  });
});

PermissionHandler.get("/list", function (req, res) {
  PermissionLogic.list(req.query, function (result) {
    res.json(result);
  });
});

export default PermissionHandler;