import cron from "node-cron";
import GuestVisitLogic from "../logic/GuestVisitsLogic.js";

let visitAlertSMSCronStarted = false;
let isRunning = false;

const startVisitAlertSMSCronJob = () => {
    if (visitAlertSMSCronStarted) {
        // console.log("Visit Alert SMS cron job already started");
        return;
    }

    visitAlertSMSCronStarted = true;

    cron.schedule("* * * * *", () => {
        if (isRunning) {
            // console.log("[VisitAlertSMSCronJob] Previous job still running, skipping this cycle");
            return;
        }

        isRunning = true;

        // console.log(`[VisitAlertSMSCronJob] Running at ${new Date().toISOString()}`);

        try {
            GuestVisitLogic.processVisitAlertSMS((response) => {
                if (!response) {
                    // console.error("[VisitAlertSMSCronJob] No response returned from processVisitAlertSMS");
                    isRunning = false;
                    return;
                }

                if (response.status !== 200) {
                    // console.error("[VisitAlertSMSCronJob] Failed:", {
                    //     status: response.status,
                    //     message: response.message,
                    //     error: response.error || null,
                    // });
                    isRunning = false;
                    return;
                }

                // console.log("[VisitAlertSMSCronJob] Success:", {
                //     message: response.message,
                //     processedCount: Array.isArray(response.data) ? response.data.length : 0,
                // });

                isRunning = false;
            });
        } catch (error) {
            // console.error("[VisitAlertSMSCronJob] Unexpected error:", error);
            isRunning = false;
        }
    });

    // console.log("Visit Alert SMS cron job started and scheduled for every 1 minute");
};

export default startVisitAlertSMSCronJob;