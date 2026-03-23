import { Router } from "express";
import TicketHistoryLogic from "../logic/TicketHistoryLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";


var TicketHistoryHandler = Router();

TicketHistoryHandler.get("/list/:ticketID", authenticate, function (req, res) {
  TicketHistoryLogic.getTicketHistory(req.user, req.params.ticketID, function (result) {
    res.status(result.status || 200).json(result);
  });
});


export default TicketHistoryHandler;