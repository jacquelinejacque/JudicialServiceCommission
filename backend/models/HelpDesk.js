import { DataTypes } from "sequelize";

class HelpDesk {
  static init(sequelize) {
    return sequelize.define("HelpDesk", {
      ticketID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      ticketNumber: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },

      userID: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      issueType: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: [ "hardware",  "software",  "network",  "email",  "account_access",  "printer",  "internet",  "security",  "system_error",  "other"],
      },

      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      description: {
        type: DataTypes.TEXT,
      },

      assignedTo: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      priority: {
        type: DataTypes.ENUM,
        allowNull: true,
        values: ['low', 'medium', 'high', 'urgent'],
      },

      status: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: ['new', 'open', 'inProgress', 'resolved', 'closed', 'reopened', 'escalated'],
        defaultValue: 'new'
      },

      resolutionDetails: {
        type: DataTypes.TEXT,
      },

      resolutionDate: {
        type: DataTypes.DATE,
      },

      attachments: {
        type: DataTypes.STRING,
      },
      reassignmentReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.STRING,
      },

      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },

      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      escalatedToTeam: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      escalatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      escalationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      escalatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },

      slaTargetAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      slaStatus: {
        type: DataTypes.ENUM,
        allowNull: true,
        values: ["active", "breached", "met"],
        defaultValue: "active",
      },

    });
  }
}

export default HelpDesk;