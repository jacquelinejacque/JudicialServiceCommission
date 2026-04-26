import { DataTypes } from "sequelize";

class GuestVisitApproval {
  static init(sequelize) {
    return sequelize.define(
      "GuestVisitApprovals",
      {
        approvalID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        visitID: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        action: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: ["approved", "denied"],
        },

        approvalReason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        denialReason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        approvedBy: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        approvalTime: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },

        previousStatus: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        newStatus: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        timestamps: true,
      }
    );
  }
}

export default GuestVisitApproval;