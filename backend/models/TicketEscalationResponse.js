import { DataTypes } from "sequelize";

class TicketEscalationResponse {
  static init(sequelize) {
    return sequelize.define("TicketEscalationResponse", {
      
      responseID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      ticketID: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      respondedBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      responseType: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: ["guidance", "resolve", "clarification"],
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      // optional: helps UI rendering (future-proofing)
      statusAfterResponse: {
        type: DataTypes.ENUM,
        allowNull: true,
        values: ["escalated", "resolved", "open"],
      },

      isResolution: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },

      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },

    });
  }
}

export default TicketEscalationResponse;