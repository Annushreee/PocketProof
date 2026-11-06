
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

    return result;
}

module.exports = { sendEmail };
