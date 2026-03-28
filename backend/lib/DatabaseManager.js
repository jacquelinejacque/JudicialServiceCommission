import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

import User from '../models/Users.js';
import DisciplinaryRecord from '../models/DisciplinaryRecords.js'
import DisciplinaryHistory from '../models/DisciplinaryHistory.js';
import HelpDesk from '../models/HelpDesk.js'
import TicketHistory from '../models/TicketHistory.js'
import TicketNote from "../models/TicketNote.js";

dotenv.config();

class DatabaseManager {
  constructor() {
    this.sequelize = null;
    this.user = null;
    this.disciplinaryRecord = null;
    this.helpdesk = null;
    this.ticketHistory = null;
    this.ticketNote = null;
    this.disciplinaryHistory = null;
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
      this.ticketHistory = TicketHistory.init(this.sequelize);
      this.ticketNote = TicketNote.init(this.sequelize);
      this.disciplinaryHistory = DisciplinaryHistory.init(this.sequelize);

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
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.helpdesk.belongsTo(this.user, {
        as: "requester",
        foreignKey: { name: "userID", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // User (Agent/Admin) -> HelpDesk (Assigned Tickets)
      this.user.hasMany(this.helpdesk, {
        as: "assignedTickets",
        foreignKey: { name: "assignedTo", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.helpdesk.belongsTo(this.user, {
        as: "agent",
        foreignKey: { name: "assignedTo", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // HelpDesk -> TicketHistory
      this.helpdesk.hasMany(this.ticketHistory, {
        as: "history",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.ticketHistory.belongsTo(this.helpdesk, {
        as: "ticket",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // User (Actor / Person who performed action) -> TicketHistory
      this.user.hasMany(this.ticketHistory, {
        as: "performedActions",
        foreignKey: { name: "performedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.ticketHistory.belongsTo(this.user, {
        as: "actor",
        foreignKey: { name: "performedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // Optional historical references
      this.user.hasMany(this.ticketHistory, {
        as: "fromUserHistory",
        foreignKey: { name: "fromUserID", allowNull: true },
        constraints: false,
      });

      this.ticketHistory.belongsTo(this.user, {
        as: "fromUser",
        foreignKey: { name: "fromUserID", allowNull: true },
        constraints: false,
      });

      this.user.hasMany(this.ticketHistory, {
        as: "toUserHistory",
        foreignKey: { name: "toUserID", allowNull: true },
        constraints: false,
      });

      this.ticketHistory.belongsTo(this.user, {
        as: "toUser",
        foreignKey: { name: "toUserID", allowNull: true },
        constraints: false,
      });

      // HelpDesk -> TicketNote
      this.helpdesk.hasMany(this.ticketNote, {
        as: "notes",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.ticketNote.belongsTo(this.helpdesk, {
        as: "ticket",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // User -> TicketNote
      this.user.hasMany(this.ticketNote, {
        as: "ticketNotes",
        foreignKey: { name: "createdBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.ticketNote.belongsTo(this.user, {
        as: "author",
        foreignKey: { name: "createdBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // DisciplinaryRecord -> DisciplinaryHistory
      this.disciplinaryRecord.hasMany(this.disciplinaryHistory, {
        as: "history",
        foreignKey: { name: "recordID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.disciplinaryHistory.belongsTo(this.disciplinaryRecord, {
        as: "record",
        foreignKey: { name: "recordID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // User -> DisciplinaryHistory (who performed the action)
      this.user.hasMany(this.disciplinaryHistory, {
        as: "performedDisciplinaryActions",
        foreignKey: { name: "performedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.disciplinaryHistory.belongsTo(this.user, {
        as: "actor",
        foreignKey: { name: "performedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });      
    } catch (error) {
      console.error("Error in createRelationships method:", error);
    }
  }
  
}

export default new DatabaseManager();