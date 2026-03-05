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
      decision: {
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

      
    });
  }
}

export default DisciplinaryRecord;