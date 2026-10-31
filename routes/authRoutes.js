
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const router = express.Router();

// =========================
// CREATE USER SESSION
// =========================

function createUserSession(req, userId) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) return reject(error);

            req.session.userId = userId;

            req.session.save((saveError) => {
                if (saveError) return reject(saveError);
                resolve();
            });
        });
    });
}

// =========================
// SIGNUP API
// =========================

router.post("/register", async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            confirmPassword
        } = req.body;

        if (
            typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return res.status(400).json({
                message: "Please fill in all fields."
            });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanUsername.length < 2 || cleanUsername.length > 100) {
            return res.status(400).json({
                message: "Username must be 2–100 characters."
            });
        }

        if (
            cleanEmail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                message: "Please enter a valid email."
            });
        }

        if (
            password.length < 8 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Password must be at least 8 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match."
            });
        }

        const [existing] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            [cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "This email is already registered. Please log in."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.execute(
            `INSERT INTO users (username, email, password_hash)
             VALUES (?, ?, ?)`,
            [cleanUsername, cleanEmail, passwordHash]
        );

        await createUserSession(req, result.insertId);

        return res.status(201).json({
            message: "Account created successfully!",
            redirect: "/home.html"
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email is already registered. Please log in."
            });
        }

        console.error("Signup error:", error.message);

        return res.status(500).json({
            message: "Unable to create your account."
        });
    }
});

// =========================
// LOGIN API
// =========================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            email.trim() === "" ||
            email.length > 255 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Please provide valid login details."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [users] = await db.execute(
            `SELECT id, username, email, password_hash
             FROM users
             WHERE email = ?`,
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            users[0].password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "User not authorized."
            });
        }

        await createUserSession(req, users[0].id);

        return res.status(200).json({
            message: "User login successful.",
            redirect: "/home.html"
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Unable to log in. Please try again."
        });
    }
});

// =========================
// CURRENT USER API
// =========================

router.get("/me", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const [users] = await db.execute(
            `SELECT id, username, email, is_premium
             FROM users
             WHERE id = ?`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "User not found."
            });
        }

        return res.json({ user: users[0] });

    } catch (error) {
        console.error("User lookup error:", error.message);

        return res.status(500).json({
            message: "Unable to load your account."
        });
    }
});

// =========================
// LOGOUT API
// =========================

router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: "Unable to log out."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            message: "Logged out successfully."
        });
    });
});

module.exports = router;
