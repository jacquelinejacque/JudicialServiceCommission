import nodemailer from "nodemailer";

class EmailService {
    static getTransporter() {
        if (!process.env.SMTP_HOST) {
            throw new Error("SMTP_HOST is not configured");
        }
        if (!process.env.SMTP_PORT) {
            throw new Error("SMTP_PORT is not configured");
        }
        if (!process.env.SMTP_USER) {
            throw new Error("SMTP_USER is not configured");
        }
        if (!process.env.SMTP_PASS) {
            throw new Error("SMTP_PASS is not configured");
        }
        if (!process.env.SMTP_FROM) {
            throw new Error("SMTP_FROM is not configured");
        }

        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    static async sendMail({ to, subject, html }) {
        const transporter = this.getTransporter();

        return transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            html,
        });
    }
    static sendTicketRaisedNotificationToAdmin(data, callback) {
        const {
            to,
            adminName,
            requesterName,
            ticketNumber,
            issueType,
            title,
            description,
            status,
        } = data;

        const subject = `New Help Desk Ticket Raised - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${adminName || "Admin"},</p>
                <p>A new help desk ticket has been raised.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Raised By:</strong> ${requesterName || "User"}</p>
                <p><strong>Issue Type:</strong> ${issueType}</p>
                <p><strong>Title:</strong> ${title}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Status:</strong> ${status}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketRaisedConfirmationToUser(data, callback) {
        const {
            to,
            requesterName,
            ticketNumber,
            issueType,
            title,
            description,
            status,
        } = data;

        const subject = `Ticket Raised Successfully - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${requesterName || "User"},</p>
                <p>Your help desk ticket has been raised successfully.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Issue Type:</strong> ${issueType}</p>
                <p><strong>Title:</strong> ${title}</p>
                <p><strong>Description:</strong> ${description}</p>
                <p><strong>Status:</strong> ${status}</p>
                <p>Our support team will review it and assign it shortly.</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }    

    static sendTicketAssignmentNotificationToAssigner(data, callback) {
        const {
            to,
            assignerName,
            assigneeName,
            ticketNumber,
            priority,
            status,
        } = data;

        const subject = `Ticket Assigned - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${assignerName || "Admin"},</p>
                <p>You have successfully assigned ticket <strong>${ticketNumber}</strong>.</p>
                <p><strong>Assignee:</strong> ${assigneeName || "User"}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Status:</strong> ${status}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketAssignmentNotificationToAssignee(data, callback) {
        const {
            to,
            assigneeName,
            assignerName,
            ticketNumber,
            priority,
            status,
        } = data;

        const subject = `New Ticket Assigned - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${assigneeName || "User"},</p>
                <p>A ticket has been assigned to you.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Assigned By:</strong> ${assignerName || "Admin"}</p>
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Status:</strong> ${status}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }
    static sendTicketReassignmentNotificationToNewAssignee(data, callback) {
        const {
            to,
            assigneeName,
            reassignerName,
            previousAssigneeName,
            ticketNumber,
            priority,
            status,
            reason,
        } = data;

        const subject = `Ticket Reassigned - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${assigneeName || "Agent"},</p>
                <p>A help desk ticket has been reassigned to you.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Reassigned By:</strong> ${reassignerName || "Admin"}</p>
                <p><strong>Previous Assignee:</strong> ${previousAssigneeName || "Previous Assignee"}</p>
                <p><strong>Priority:</strong> ${priority || "_"}</p>
                <p><strong>Status:</strong> ${status || "_"}</p>
                <p><strong>Reason:</strong> ${reason || "_"}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketReassignmentNotificationToPreviousAssignee(data, callback) {
        const {
            to,
            previousAssigneeName,
            reassignerName,
            newAssigneeName,
            ticketNumber,
            priority,
            status,
            reason,
        } = data;

        const subject = `Ticket Reassigned - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${previousAssigneeName || "Agent"},</p>
                <p>This help desk ticket has been reassigned to another agent.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Reassigned By:</strong> ${reassignerName || "Admin"}</p>
                <p><strong>New Assignee:</strong> ${newAssigneeName || "Agent"}</p>
                <p><strong>Priority:</strong> ${priority || "_"}</p>
                <p><strong>Status:</strong> ${status || "_"}</p>
                <p><strong>Reason:</strong> ${reason || "_"}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }  
    
    static sendTicketResolvedNotificationToRequester(data, callback) {
        const { to, requesterName, resolverName, ticketNumber, issueType, title, status } = data;

        // Async wrapper
        (async () => {
            try {
                await this.sendMail({
                    to,
                    subject: `Ticket Resolved - ${ticketNumber}`,
                    html: `
                        <div>
                            <p>Hello ${requesterName || "User"},</p>
                            <p>Your help desk ticket has been resolved.</p>
                            <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                            <p><strong>Issue Type:</strong> ${issueType || "_"}</p>
                            <p><strong>Title:</strong> ${title || "_"}</p>
                            <p><strong>Resolved By:</strong> ${resolverName || "Support Team"}</p>
                            <p><strong>Status:</strong> ${status || "resolved"}</p>
                        </div>
                    `
                });
                callback(null); // called only once
            } catch (err) {
                callback(err); // called only once
            }
        })();
    }

    static sendTicketNoteAddedNotificationToRequester(data, callback) {
        const {
            to,
            requesterName,
            agentName,
            ticketNumber,
            title,
            note,
            attachment,
            status,
        } = data;

        const subject = `Ticket Updated With Note - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${requesterName || "User"},</p>
                <p>A new note has been added to your help desk ticket.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Title:</strong> ${title || "_"}</p>
                <p><strong>Added By:</strong> ${agentName || "Support Team"}</p>
                <p><strong>Note:</strong> ${note || "_"}</p>
                <p><strong>Attachment:</strong> ${attachment || "No attachment"}</p>
                <p><strong>Status:</strong> ${status || "_"}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketEscalatedNotificationToRequester(data, callback) {
        const {
            to,
            requesterName,
            escalatorName,
            ticketNumber,
            issueType,
            title,
            status,
            reason,
        } = data;

        const subject = `Your Ticket Has Been Escalated - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${requesterName || "User"},</p>
                <p>Your help desk ticket has been escalated for further attention.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Issue Type:</strong> ${issueType || "_"}</p>
                <p><strong>Title:</strong> ${title || "_"}</p>
                <p><strong>Escalated By:</strong> ${escalatorName || "Admin"}</p>
                <p><strong>Status:</strong> ${status || "escalated"}</p>
                <p><strong>Reason:</strong> ${reason || "_"}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketEscalatedNotificationToAdminOrAgent(data, callback) {
        const {
            to,
            recipientName,
            escalatorName,
            ticketNumber,
            issueType,
            title,
            priority,
            status,
            escalatedToTeam,
            reason,
            slaTargetAt,
        } = data;

        const subject = `Escalated Ticket Requires Attention - ${ticketNumber}`;
        const html = `
            <div>
                <p>Hello ${recipientName || "Support Team"},</p>
                <p>A help desk ticket has been escalated and requires attention.</p>
                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Issue Type:</strong> ${issueType || "_"}</p>
                <p><strong>Title:</strong> ${title || "_"}</p>
                <p><strong>Escalated By:</strong> ${escalatorName || "Admin"}</p>
                <p><strong>Escalated To Team:</strong> ${escalatedToTeam || "_"}</p>
                <p><strong>Priority:</strong> ${priority || "_"}</p>
                <p><strong>Status:</strong> ${status || "escalated"}</p>
                <p><strong>Reason:</strong> ${reason || "_"}</p>
                <p><strong>SLA Target:</strong> ${slaTargetAt ? new Date(slaTargetAt).toLocaleString() : "_"}</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendTicketEscalatedNotificationToAssignedUser(data, callback) {
        const {
            to,
            assigneeName,
            escalatorName,
            ticketNumber,
            issueType,
            title,
            priority,
            status,
            escalatedToTeam,
            reason,
            slaTargetAt,
            team,
        } = data;

        const subject = `New Escalated Ticket Assigned - ${ticketNumber}`;

        const html = `
            <div>
                <p>Hello ${assigneeName || "Agent"},</p>
                <p>A help desk ticket has been <strong>escalated and assigned to you</strong>.</p>

                <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
                <p><strong>Issue Type:</strong> ${issueType || "_"}</p>
                <p><strong>Title:</strong> ${title || "_"}</p>

                <p><strong>Escalated By:</strong> ${escalatorName || "Admin"}</p>
                <p><strong>Escalated To Team:</strong> ${escalatedToTeam || "_"}</p>

                <p><strong>Priority:</strong> ${priority || "_"}</p>
                <p><strong>Status:</strong> ${status || "escalated"}</p>

                <p><strong>Reason:</strong> ${reason || "_"}</p>
                <p><strong>Team:</strong> ${team || "_"}</p>
                <p><strong>SLA Target:</strong> ${
                    slaTargetAt ? new Date(slaTargetAt).toLocaleString() : "_"
                }</p>

                <p>Please take the necessary action within the SLA timeframe.</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }

    static sendReportCreatedNotificationToRegistrar(data, callback) {
        const {
            to,
            registrarName,
            title,
            source,
            complainantName,
            receivedBy,
            receivedDate,
            recordID,
        } = data;

        const subject = `New Disciplinary Report Received - ${title || recordID}`;

        const html = `
            <div>
                <p>Hello ${registrarName || "Registrar"},</p>

                <p>A new disciplinary report has been created successfully and requires your attention.</p>

                <p><strong>Report ID:</strong> ${recordID || "_"}</p>
                <p><strong>Title:</strong> ${title || "_"}</p>
                <p><strong>Source:</strong> ${source || "_"}</p>
                <p><strong>Complainant Name:</strong> ${complainantName || "_"}</p>
                <p><strong>Received By:</strong> ${receivedBy || "_"}</p>
                <p><strong>Received Date:</strong> ${
                    receivedDate ? new Date(receivedDate).toLocaleString() : "_"
                }</p>

                <p>Please go to the site and assign this report to the Director Legal Services for further action.</p>
            </div>
        `;

        this.sendMail({ to, subject, html })
            .then(() => callback(null))
            .catch((err) => callback(err));
    }
}


export default EmailService;