import { DataTypes } from "sequelize";

class DisciplinaryCounter {
  static init(sequelize) {
    return sequelize.define(
      "DisciplinaryCounters",
      {
        counterID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        recordYear: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        caseAgainstWho: {
          type: DataTypes.ENUM("Judicial Officer", "Judicial Staff"),
          allowNull: false,
        },
        lastNumber: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      },
      {
        indexes: [
          {
            unique: true,
            fields: ["recordYear", "caseAgainstWho"],
          },
        ],
      }
    );
  }
}

export default DisciplinaryCounter;