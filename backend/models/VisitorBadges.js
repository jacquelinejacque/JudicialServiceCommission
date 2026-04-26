import { DataTypes } from "sequelize";

class VisitorBadge {
  static init(sequelize) {
    return sequelize.define(
      "VisitorBadges",
      {
        badgeID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        badgeNumber: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },

        receptionDeskID: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        status: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: ["available", "issued", "lost", "inactive"],
          defaultValue: "available",
        },

        currentVisitID: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        issuedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        returnedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        remarks: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        timestamps: true,
      }
    );
  }
}

export default VisitorBadge;