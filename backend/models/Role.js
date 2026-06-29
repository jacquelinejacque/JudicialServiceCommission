import { DataTypes } from "sequelize";

class Role {
  static init(sequelize) {
    return sequelize.define(
      "Roles",
      {
        roleID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        roleName: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },

        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },

        status: {
          type: DataTypes.ENUM,
          values: ["active", "inactive"],
          defaultValue: "active",
        },
      },
      {
        timestamps: true,
      }
    );
  }
}

export default Role;


