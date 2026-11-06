const bcrypt = require("bcrypt");
const express = require("express");
const db = require("../config/db");
const { sendEmail } = require("../services/emailService");

const router = express.Router();

// FORGOT PASSWORD — Generate UUID and send reset link
router.post("/forgotpassword", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                message: "Email address is required."
            });
        }

        const userEmail = email.trim().toLowerCase();

        // Check whether user exists
        const [users] = await db.execute(
            "SELECT id, username FROM users WHERE email = ?",
            [userEmail]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "No account found with this email address."
            });
        }

        // Generate UUID
        const { v4: uuidv4 } = await import("uuid");
        const requestId = uuidv4();

        // Store reset request in database
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(
                `INSERT INTO ForgotPasswordRequests
                 (id, userId, isActive)
                 VALUES (?, ?, TRUE)`,
                [requestId, users[0].id]
            );

            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;

        } finally {
            connection.release();
        }

        // Create reset URL
        const baseUrl = (
            process.env.APP_URL || "http://localhost:3000"
        ).replace(/\/$/, "");

        const resetUrl =
            `${baseUrl}/password/resetpassword/${requestId}`;

        // Send reset link through Brevo
        await sendEmail(
            userEmail,
            "PocketProof - Reset Your Password",
            `Hello ${users[0].username},

We received a request to reset your PocketProof password.

Click the link below to reset your password:

${resetUrl}

If you did not request this, please ignore this email.

Thank you,
PocketProof Team`
        );

        return res.status(200).json({
            message: "Password reset link has been sent to your email."
        });

    } catch (error) {
        console.error("Forgot password error:", error.message);

        return res.status(500).json({
            message: "Unable to process your request. Please try again."
        });
    }
});


// GET RESET PASSWORD PAGE — Validate UUID
router.get("/resetpassword/:requestId", async (req, res) => {
    try {
        const { requestId } = req.params;

        // Check whether the reset request exists and is active
        const [requests] = await db.execute(
            `SELECT id
             FROM ForgotPasswordRequests
             WHERE id = ? AND isActive = TRUE`,
            [requestId]
        );

        if (requests.length === 0) {
            return res.status(400).send(
                "This password reset link is invalid or has already been used."
            );
        }

        // Serve reset password page
        return res.sendFile(
            require("path").join(__dirname, "../public/reset-password.html")
        );

    } catch (error) {
        console.error("Reset link validation error:", error.message);

        return res.status(500).send(
            "Unable to validate the password reset link."
        );
    }
});

// UPDATE PASSWORD
router.post("/resetpassword", async (req, res) => {
    const { requestId, password } = req.body;

    if (!requestId || !password || password.length < 8) {
        return res.status(400).json({
            message: "A valid reset request and password of at least 8 characters are required."
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [requests] = await connection.execute(
            `SELECT userId
             FROM ForgotPasswordRequests
             WHERE id = ? AND isActive = TRUE
             FOR UPDATE`,
            [requestId]
        );

        if (requests.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                message: "Invalid or expired reset link."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [hashedPassword, requests[0].userId]
        );

        await connection.execute(
            `UPDATE ForgotPasswordRequests
             SET isActive = FALSE
             WHERE id = ?`,
            [requestId]
        );

        await connection.commit();

        return res.status(200).json({
            message: "Password updated successfully. You can now log in."
        });

    } catch (error) {
        await connection.rollback();

        console.error("Password update error:", error.message);

        return res.status(500).json({
            message: "Unable to update password."
        });

    } finally {
        connection.release();
    }
});

module.exports = router;
