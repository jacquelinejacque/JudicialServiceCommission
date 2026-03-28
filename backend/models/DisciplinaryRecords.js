import { DataTypes } from "sequelize";

class DisciplinaryRecord {
  static init(sequelize) {
    return sequelize.define("DisciplinaryRecords", {
      recordID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      officerName: {
        type: DataTypes.STRING,
      },
      designation: {
        type: DataTypes.STRING,
      },
      dateFiled: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      natureOfCharges:{
        type: DataTypes.STRING,
      },
      panel: {
        type: DataTypes.STRING,
      },         
      status: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: [
            'Filed', 'Pending', 'Scheduled', 'Hearing' , 'Adjourned', 'Judgment Reserved', 
            'Judgment Delivered', 'Appeal Pending', 'Concluded', 'Dismissed', 'Withdrawn', 'Closed'
        ],
        defaultValue: 'Filed'
      },
      pjNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      dateEscalated: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      caseAgainst: {
        type: DataTypes.ENUM,
        values: ["Judicial Officer", "Judicial Staff"],
        allowNull: false,
      },
      assignedTo: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      fileNumber: {
        type: DataTypes.STRING,
        unique: true,
      },
      hearingDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      judgementDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },      
      judgement: {
        type: DataTypes.STRING,
      },
      adjournReason: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      reservedNote: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      reservedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  }
}

export default DisciplinaryRecord;