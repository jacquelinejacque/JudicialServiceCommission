// routes to handle customer requests

import { Router } from "express";
import UserLogic from "../logic/UserLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import Utils from "../lib/Utils.js";
import { Consts } from "../lib/Consts.js";
import async from "async";

var UserHandler = Router();
// list users
UserHandler.get("/list",authenticate, function (req, res) {
  UserLogic.list(req.query,function (result) {   
    res.json(result);
  });
});
// create a user
UserHandler.post("/create", function (req, res) {
  UserLogic.create(req.body, function (result) {
    res.json(result);
  });
});
//user login
UserHandler.post("/login", function (req, res) {
  UserLogic.login(req.body, function (result) {
    res.json(result);
  });
});
//update a user
UserHandler.post("/update",authenticate, function (req, res) {
  UserLogic.update(req.body, function (result) {
    res.json(result);
  });
});
//temporary delete user
UserHandler.post("/delete", authenticate,function (req, res) {
  UserLogic.delete(req.body, function (result) {
    res.json(result);
  });
});
//activating an inactive user
UserHandler.post("/reactivate",authenticate, function (req, res) {
  UserLogic.reactivate(req.body, function (result) {
    res.json(result);
  });
});
// permanently deleting an inactive user- remocving a user from the system
UserHandler.post("/deletePermanently",authenticate, function (req, res) {
  UserLogic.deletePermanently(req.body, function (result) {
    res.json(result);
  });
});
//userDetails
UserHandler.get("/details/:userId", authenticate,function (req, res) {
  UserLogic.findById(req.params.userId, function (result) {
    res.json(result);
  });
});
//password reset
UserHandler.post("/passwordReset", authenticate,function (req, res) {
  UserLogic.resetPassword(req.body, function (result) {
    res.json(result);
  });
});

export default UserHandler;