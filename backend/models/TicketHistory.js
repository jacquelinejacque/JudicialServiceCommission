import { DataTypes } from "sequelize";

class TicketHistory {
  static init(sequelize) {
    return sequelize.define(
      "TicketHistory",
      {
        historyID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        ticketID: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        action: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        performedBy: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        fromUserID: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        toUserID: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        fieldName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        previousValue: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        newValue: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        tableName: "ticket_history",
        timestamps: true,
        createdAt: true,
        updatedAt: false,
      }
    );
  }
}

export default TicketHistory;