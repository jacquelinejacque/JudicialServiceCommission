import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

import User from '../models/Users.js';
import DisciplinaryRecord from '../models/DisciplinaryRecords.js'
import DisciplinaryHistory from '../models/DisciplinaryHistory.js';
import HelpDesk from '../models/HelpDesk.js'
import TicketHistory from '../models/TicketHistory.js'
import TicketNote from "../models/TicketNote.js";
import GuestVisit from '../models/GuestVisits.js';
import GuestVisitApproval from "../models/GuestVisitApprovals.js";
import VisitorBadge from "../models/VisitorBadges.js";
import ReceptionDesk from "../models/ReceptionistDesks.js";
import TicketEscalationResponse from "../models/TicketEscalationResponse.js";

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
    this.guestVisit = null;
    this.visitorBadge = null;
    this.guestVisitApproval = null;
    this.receptionDesk = null;
    this.ticketEscalationResponse = null;
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
      this.guestVisit = GuestVisit.init(this.sequelize);
      this.guestVisitApproval = GuestVisitApproval.init(this.sequelize);
      this.visitorBadge = VisitorBadge.init(this.sequelize);
      this.receptionDesk = ReceptionDesk.init(this.sequelize);
      this.ticketEscalationResponse = TicketEscalationResponse.init(this.sequelize);
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
            
      // User (Host) -> GuestVisits
      this.user.hasMany(this.guestVisit, {
        as: "hostedGuestVisits",
        foreignKey: { name: "hostUserID", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.user, {
        as: "host",
        foreignKey: { name: "hostUserID", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // User (Creator) -> GuestVisits
      this.user.hasMany(this.guestVisit, {
        as: "createdGuestVisits",
        foreignKey: { name: "createdBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.user, {
        as: "creator",
        foreignKey: { name: "createdBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // User (Check-in Officer) -> GuestVisits
      this.user.hasMany(this.guestVisit, {
        as: "checkedInGuestVisits",
        foreignKey: { name: "checkedInBy", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.user, {
        as: "checkInOfficer",
        foreignKey: { name: "checkedInBy", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // User (Check-out Officer) -> GuestVisits
      this.user.hasMany(this.guestVisit, {
        as: "checkedOutGuestVisits",
        foreignKey: { name: "checkedOutBy", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.user, {
        as: "checkOutOfficer",
        foreignKey: { name: "checkedOutBy", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });      

      // GuestVisit -> GuestVisitApprovals
      this.guestVisit.hasMany(this.guestVisitApproval, {
        as: "approvals",
        foreignKey: { name: "visitID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.guestVisitApproval.belongsTo(this.guestVisit, {
        as: "guestVisit",
        foreignKey: { name: "visitID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // User -> GuestVisitApprovals (approver)
      this.user.hasMany(this.guestVisitApproval, {
        as: "guestVisitApprovalActions",
        foreignKey: { name: "approvedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.guestVisitApproval.belongsTo(this.user, {
        as: "approver",
        foreignKey: { name: "approvedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      // VisitorBadge -> GuestVisit
      this.visitorBadge.hasMany(this.guestVisit, {
        as: "visits",
        foreignKey: { name: "badgeID", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.visitorBadge, {
        as: "badge",
        foreignKey: { name: "badgeID", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.receptionDesk.hasMany(this.guestVisit, {
        as: "guestVisits",
        foreignKey: { name: "receptionDeskID", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.guestVisit.belongsTo(this.receptionDesk, {
        as: "receptionDesk",
        foreignKey: { name: "receptionDeskID", allowNull: true },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      this.receptionDesk.hasMany(this.visitorBadge, {
        as: "visitorBadges",
        foreignKey: { name: "receptionDeskID", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.visitorBadge.belongsTo(this.receptionDesk, {
        as: "receptionDesk",
        foreignKey: { name: "receptionDeskID", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.receptionDesk.belongsTo(this.user, {
          foreignKey: "receptionistUserID",
          as: "receptionist",
      });

      this.user.hasMany(this.receptionDesk, {
          foreignKey: "receptionistUserID",
          as: "assignedReceptionDesks",
      });

      // HelpDesk -> TicketEscalationResponse
      this.helpdesk.hasMany(this.ticketEscalationResponse, {
        as: "escalationResponses",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // TicketEscalationResponse -> HelpDesk
      this.ticketEscalationResponse.belongsTo(this.helpdesk, {
        as: "ticket",
        foreignKey: { name: "ticketID", allowNull: false },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.user.hasMany(this.ticketEscalationResponse, {
        as: "escalationResponses",
        foreignKey: { name: "respondedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });

      this.ticketEscalationResponse.belongsTo(this.user, {
        as: "responder",
        foreignKey: { name: "respondedBy", allowNull: false },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
    } catch (error) {
      console.error("Error in createRelationships method:", error);
    }
  }
  
}

export default new DatabaseManager();