
const express = require("express");
const db = require("../config/db");
const { sendEmail } = require("../services/emailService");

const router = express.Router();

// FORGOT PASSWORD
router.post("/forgotpassword", async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !email.trim()) {
            return res.status(400).json({
                message: "Email address is required."
            });
        }

        const userEmail = email.trim().toLowerCase();

        // Check whether the user exists
        const [users] = await db.execute(
            "SELECT id, username FROM users WHERE email = ?",
            [userEmail]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "No account found with this email address."
            });
        }

        // Send dummy password reset email
        await sendEmail(
            userEmail,
            "PocketProof - Password Recovery",
            `Hello ${users[0].username},

We received a request to recover your PocketProof account.

This is a test email for the Forgot Password feature.

Thank you,
PocketProof Team`
        );

        return res.status(200).json({
            message: "A recovery email has been sent successfully."
        });

    } catch (error) {
        console.error("Forgot password error:", error.message);

        return res.status(500).json({
            message: "Unable to send recovery email. Please try again."
        });
    }
});

module.exports = router;
