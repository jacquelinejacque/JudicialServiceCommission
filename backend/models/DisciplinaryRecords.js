import { DataTypes } from "sequelize";

class DisciplinaryRecord {
  static init(sequelize) {
    return sequelize.define("DisciplinaryRecords", {
      recordID: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      stage: {
        type: DataTypes.ENUM,
        values: ['REPORT', 'CASE'],
        defaultValue: 'REPORT'
      },      
      source: {
        type: DataTypes.ENUM,
        values: ['OCJ', 'PUBLIC']
      },

      complainantName: {
        type: DataTypes.STRING
      },
      title: {
        type: DataTypes.STRING
      },
      reportFile: {
        type: DataTypes.STRING
      },
      officerName: {
        type: DataTypes.STRING,
      },
      designation: {
        type: DataTypes.STRING,
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      natureOfCharges:{
        type: DataTypes.STRING,
      },
      panel: {
        type: DataTypes.ENUM,
        values: ['Panel_1', 'Panel_2', 'Panel_3', 'Panel_4', 'Panel_5', 'Panel_6', 'Panel_7'],
      },         
      status: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: [
            'Received', 'Registered', 'Under_review', 'Processed','Preliminary_review_completed', 'Admitted', 
            'Pending', 'Scheduled', 'Hearing' , 'Adjourned', 'Judgment Reserved', 'Judgment Delivered',  'Closed'
        ],
        defaultValue: 'Received'
      },
      pjNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dateEscalated: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      dateFiled: {
        type: DataTypes.DATE,
        allowNull: true
      },
      caseAgainst: {
        type: DataTypes.ENUM,
        values: ["Judicial Officer", "Judicial Staff"],
        allowNull: true,
      },
      assignedTo: {
        type: DataTypes.UUID,
        allowNull: true,
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
      summary: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      summaryFile: {
        type: DataTypes.STRING,
        allowNull: true
      },
      boardBriefFile: {
        type: DataTypes.STRING,
        allowNull: true
      },  

      boardBrief: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      preliminaryReport: {
        type: DataTypes.STRING,
        allowNull: true
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
      receivedBy: {
        type: DataTypes.UUID,
        allowNull: false
      },
      receivedDate: {
        type: DataTypes.DATE,
        allowNull: false
      }     
    });
  }
}

export default DisciplinaryRecord;