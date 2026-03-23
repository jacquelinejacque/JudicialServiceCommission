
import DatabaseManager from "../lib/DatabaseManager.js";

class AuditService {
  static log(
    {
      ticketID,
      action,
      performedBy,
      fromUserID = null,
      toUserID = null,
      fieldName = null,
      previousValue = null,
      newValue = null,
      reason = null,
      description = null,
    },
    options = {}
  ) {
    return DatabaseManager.ticketHistory.create(
      {
        ticketID,
        action,
        performedBy,
        fromUserID,
        toUserID,
        fieldName,
        previousValue:
          previousValue !== null ? JSON.stringify(previousValue) : null,
        newValue:
          newValue !== null ? JSON.stringify(newValue) : null,
        reason,
        description,
      },
      options
    );
  }
}

export default AuditService;