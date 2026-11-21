
const  { logger } = require("../config/logger");

let brevoClient;

async function getBrevoClient() {
    if (!process.env.BREVO_API_KEY) {
        throw new Error("BREVO_API_KEY is missing from .env");
    }

    if (!brevoClient) {
        const { BrevoClient } = await import("@getbrevo/brevo");

        brevoClient = new BrevoClient({
            apiKey: process.env.BREVO_API_KEY
        });
    }

    return brevoClient;
}

async function sendEmail(to, subject, textContent) {
    try {
        if (!process.env.BREVO_SENDER_EMAIL) {
            throw new Error("BREVO_SENDER_EMAIL is missing from .env");
        }

        const brevo = await getBrevoClient();

        const result = await brevo.transactionalEmails.sendTransacEmail({
            sender: {
                name: "PocketProof",
                email: process.env.BREVO_SENDER_EMAIL
            },
            to: [{ email: to }],
            subject,
            textContent
        });

        logger.info("Email sent successfully", {
            recipient: to,
            subject
        });

        return result;

    } catch (error) {
        logger.error("Email sending failed", {
            recipient: to,
            subject,
            message: error.message
        });

        throw error;
    }
}

module.exports = { sendEmail };
