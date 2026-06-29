import { Router } from "express";
import RolePermissionLogic from "../logic/RolePermissionLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var RolePermissionHandler = Router();

// create a role permission
RolePermissionHandler.post("/assign", function (req, res) {
  RolePermissionLogic.assign(req.body, function (result) {
    res.json(result);
  });
});

// remove a role permission
RolePermissionHandler.post("/remove", function (req, res) {
  RolePermissionLogic.remove(req.body, function (result) {
    res.json(result);
  });
});

RolePermissionHandler.get("/list", function (req, res) {
  RolePermissionLogic.list(req.query,function (result) {   
    res.json(result);
  });
});
export default RolePermissionHandler;