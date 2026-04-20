export const Consts = {
    httpCodeSuccess: 200,
    httpCodeFileNotFound: 404,
    httpCodeServerError: 500,
    httpCodeAuthError: 503,
    unAuthorized: 403,


};

export const TicketActions = {
  TICKET_RAISED: "TICKET_RAISED",
  TICKET_ASSIGNED: "TICKET_ASSIGNED",
  TICKET_REASSIGNED: "TICKET_REASSIGNED",
  TICKET_RESOLVED: "TICKET_RESOLVED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  TICKET_NOTE_ADDED: "TICKET_NOTE_ADDED",
  TICKET_ESCALATED: "TICKET_ESCALATED",
  TICKET_ESCALATED: "TICKET_ESCALATED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  TEAM_CHANGED: "TEAM_CHANGED",
  SLA_CREATED: "SLA_CREATED",
};
export const STATUS_FLOW = {
  ADD_HEARING_DATE: {
    allowedFrom: ["Admitted", "Adjourned"],
    nextStatus: "Scheduled"
  },
  AUTO_START_HEARING: { allowedFrom: ["Scheduled"], nextStatus: "Hearing" },
  ADJOURN_CASE: {
    allowedFrom: ["Hearing"],
    nextStatus: "Adjourned"
  },

  JUDGMENT_RESERVED: {
    allowedFrom: ["Hearing"],
    nextStatus: "Judgment Reserved"
  },
  ADD_JUDGEMENT: {
    allowedFrom: ["Hearing", "Adjourned", "Judgment Reserved"],
    nextStatus: "Judgment Delivered"
  },
  CLOSE_CASE: {
    allowedFrom: ["Judgment Delivered"],
    nextStatus: "Closed"
  }
};