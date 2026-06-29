import { DataTypes } from "sequelize";

class RolePermission {
  static init(sequelize) {
    return sequelize.define(
      "RolePermissions",
      {
        rolePermissionID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        roleID: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        permissionID: {
          type: DataTypes.UUID,
          allowNull: false,
        },
      },
      {
        timestamps: true,
      }
    );
  }
}

export default RolePermission;