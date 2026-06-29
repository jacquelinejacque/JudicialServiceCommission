import { DataTypes } from "sequelize";

class Permission {
  static init(sequelize) {
    return sequelize.define(
      "Permissions",
      {
        permissionID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        code: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
        },

        module: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        action: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        description: {
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

export default Permission;