import { DataTypes } from "sequelize";

class TicketNote {
  static init(sequelize) {
    return sequelize.define("TicketNote", {
      noteID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      ticketID: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      note: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      attachment: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
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

export default TicketNote;