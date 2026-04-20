import { Router } from "express";
import TicketNoteLogic from "../logic/TicketNoteLogic.js";
import authenticate from "../middleware/AuthMiddleware.js";
import uploadTicketNoteAttachment from "../middleware/UploadDocument.js";
var TicketNoteHandler = Router();

TicketNoteHandler.post(  "/add",  authenticate,  uploadTicketNoteAttachment.single("attachment"),  function (req, res) {
    TicketNoteLogic.addTicketNote(req.user, req.body, req.file, function (result) {
      res.status(result.status || 200).json(result);
    });
  }
);

TicketNoteHandler.get("/list/:ticketID", authenticate, function (req, res) {
    TicketNoteLogic.listTicketNotes(req.user, req.params.ticketID, function (result) {
        res.status(result.status || 200).json(result);
    });
});
export default TicketNoteHandler;