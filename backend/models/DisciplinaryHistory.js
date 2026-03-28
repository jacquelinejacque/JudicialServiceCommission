import { DataTypes } from "sequelize";
class DisciplinaryHistory {
  static init(sequelize) {
    return sequelize.define("DisciplinaryHistory", {
      historyID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      recordID: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING,
      },
      performedBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      previousValue: {
        type: DataTypes.JSON,
      },
      newValue: {
        type: DataTypes.JSON,
      },
    });
  }
}
export default DisciplinaryHistory;