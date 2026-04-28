import { DataTypes } from "sequelize";

class GuestVisit {
  static init(sequelize) {
    return sequelize.define(
      "GuestVisits",
      {
        visitID: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },

        guestName: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        phone: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        email: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: {
            isEmail: true,
          },
        },

        idType: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: ["nationalID", "passport", "workID"],
          defaultValue: "nationalID",
        },

        idNumber: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        organization: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        purpose: {
          type: DataTypes.TEXT,
          allowNull: false,
        },

        department: {
          type: DataTypes.ENUM,
          allowNull: true,
          values: [
            "administration",
            "officeOfRegistrar",
            "legal",
            "complaints",
            "communication",
            "HR",
            "accounts",
            "finance",
            "procurement",
            "supplyChain",
            "inspectorate",
            "ICT",
            "records",
          ],
        },

        visitCategory: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: [
            "officialMeeting",
            "vendor",
            "contractor",
            "interview",
            "delivery",
            "walkIn",
            "personalVisit",
            
          ],
          defaultValue: "personalVisit",
        },

        status: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: [
            "preRegistered",
            "pendingApproval",
            "approved",
            "rejected",
            "checkedIn",
            "inMeeting",
            "overdue",
            "checkedOut",
            "denied",
            "cancelled",
          ],
          defaultValue: "preRegistered",
        },

        expectedArrival: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        expectedDeparture: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        checkInTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        checkOutTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        timeIn: {
          type: DataTypes.INTEGER // store minutes
        },
        expiryTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        passNumber: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        badgeID: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        badgeNumber: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        badgeReturned: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        hostNotified: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        approvalRequired: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        remarks: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        preExpiryAlertSent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        preExpiryAlertSentAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        expiryAlertSent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        expiryAlertSentAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        overstayAlertSent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        overstayAlertSentAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        // FK fields to Users model
        receptionDeskID: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        hostUserID: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        createdBy: {
          type: DataTypes.UUID,
          allowNull: false,
        },

        checkedInBy: {
          type: DataTypes.UUID,
          allowNull: true,
        },

        checkedOutBy: {
          type: DataTypes.UUID,
          allowNull: true,
        },
      },
      {
        timestamps: true,
      }
    );
  }
}

export default GuestVisit;