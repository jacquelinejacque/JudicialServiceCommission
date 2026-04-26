import { DataTypes } from "sequelize";

class ReceptionDesk {
  static init(sequelize) {
    return sequelize.define(
      "ReceptionDesks",
      {
        receptionDeskID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        deskName: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },

        deskCode: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },

        phoneNumber: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        receptionistUserID: {
          type: DataTypes.UUID,
          unique: true,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: ["active", "inactive"],
          defaultValue: "active",
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

export default ReceptionDesk;