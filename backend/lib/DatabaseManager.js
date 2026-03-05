import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

import User from '../models/Users.js';
import DisciplinaryRecord from '../models/DisciplinaryRecords.js'
import HelpDesk from '../models/HelpDesk.js'
// import Invoice from '../models/Invoices.js'
// import InvoiceItem from '../models/InvoiceItems.js';

dotenv.config();

class DatabaseManager {
  constructor() {
    this.sequelize = null;
    this.user = null;
    this.disciplinaryRecord = null;
    this.helpdesk = null;
    // this.service = null;
    // this.invoice = null;
    // this.invoiceItem = null;
  }

  connect(callback) {
    try {
      const timezone = 'Africa/Nairobi';
      this.sequelize = new Sequelize(
        process.env.DATABASE_NAME,
        process.env.DATABASE_USER,
        process.env.DATABASE_PASSWORD,
        {
          host: process.env.DATABASE_HOST,
          dialect: process.env.DATABASE_DIALECT,
          logging: false,
        }
      );

      this.sequelize
        .authenticate()
        .then(() => {
          console.log('Connection has been established successfully.');
          this.initModels(() => callback(null, this.sequelize));
        })
        .catch((error) => {
          console.error('Unable to connect to the database:', error);
          callback(error, this.sequelize);
        });
    } catch (e) {
      console.error('Error in connect method:', e);
      callback(e, null);
    }
  }

  initModels(callback) {
    try {
      this.user = User.init(this.sequelize);
      this.disciplinaryRecord = DisciplinaryRecord.init(this.sequelize);
      this.helpdesk = HelpDesk.init(this.sequelize);

      this.createRelationships();

      this.sequelize
        .sync({ alter: false })
        .then(() => {
          console.log('Tables created!');
          callback(1);
        })
        .catch((error) => {
          console.error('Unable to create tables:', error);
          callback(0);
        });
    } catch (error) {
      console.error('Error in initModels method:', error);
      callback(0);
    }
  }

  createRelationships() {
    try {
      // User (Requester) -> HelpDesk (Tickets)
      this.user.hasMany(this.helpdesk, {
        as: "raisedTickets",
        foreignKey: { name: "userID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.helpdesk.belongsTo(this.user, {
        as: "requester",
        foreignKey: { name: "userID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // User (Agent/Admin) -> HelpDesk (Assigned Tickets)
      this.user.hasMany(this.helpdesk, {
        as: "assignedTickets",
        foreignKey: { name: "assignedTo", allowNull: true },
        constraints: false, 
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.helpdesk.belongsTo(this.user, {
        as: "agent",
        foreignKey: { name: "assignedTo", allowNull: true },
        constraints: false,
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

    } catch (error) {
      console.error("Error in createRelationships method:", error);
    }
  }
  


  
}

export default new DatabaseManager();