import cron from "node-cron";
import { Op } from "sequelize";
import DatabaseManager from "../lib/DatabaseManager.js";
import Utils from "../lib/Utils.js";
import {Consts} from "../lib/Consts.js";

export function startHearingCron() {
  // Run every 1 minute (adjust as needed)
  cron.schedule("*/1 * * * *", async () => {
    console.log("Cron: Checking for hearings to start...");

    try {
      const now = new Date();

      // Find all Scheduled cases where hearingDate <= now
      const recordsToUpdate = await DatabaseManager.disciplinaryRecord.findAll({
        where: {
          status: "Scheduled",
          hearingDate: { [Op.lte]: now },
        },
      });

      for (const record of recordsToUpdate) {
        const previousValue = record.toJSON();

        await record.update({ status: "Hearing" });

        // Save audit trail
        await DatabaseManager.disciplinaryHistory.create({
          recordID: record.recordID,
          action: "AUTO_START_HEARING",
          performedBy: null, // system action
          previousValue,
          newValue: record.toJSON(),
        });

        console.log(`Record ${record.fileNumber} status updated to "Hearing"`);
      }

      if (recordsToUpdate.length === 0) {
        console.log("No hearings to start at this time.");
      }
    } catch (err) {
      console.error("Error in Hearing cron job:", err);
    }
  });
}