import { Router } from "express";
import RoleLogic from "../logic/RoleLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var RoleHandler = Router();

// create a role
RoleHandler.post("/create", function (req, res) {
  RoleLogic.create(req.body, function (result) {
    res.json(result);
  });
});

RoleHandler.get("/list", function (req, res) {
  RoleLogic.list(req.query,function (result) {   
    res.json(result);
  });
});

//update a role
RoleHandler.post("/update",authenticate, function (req, res) {
  RoleLogic.update(req.body, function (result) {
    res.json(result);
  });
});

export default RoleHandler;