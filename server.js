
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./config/db");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 60 * 60 * 1000
        }
    })
);

// ROOT: Open signup page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Create a session after successful authentication
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

// SIGNUP
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

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

// LOGIN

app.post("/api/login", async (req, res) => {
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

        // 1. Check whether the user exists
        const [users] = await db.execute(
            `SELECT id, username, email, password_hash
             FROM users
             WHERE email = ?`,
            [cleanEmail]
        );

        // 2. Return 404 if the user does not exist
        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        // 3. Match the submitted password
        const passwordMatches = await bcrypt.compare(
            password,
            users[0].password_hash
        );

        // 4. Return 401 if the password is incorrect
        if (!passwordMatches) {
            return res.status(401).json({
                message: "User not authorized."
            });
        }

        // 5. Create a session after successful authentication
        await createUserSession(req, users[0].id);

        // 6. Send the success response
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


// CURRENT USER
app.get("/api/me", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, username, email FROM users WHERE id = ?",
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

// LOGOUT
app.post("/api/logout", (req, res) => {
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

/* =========================
   EXPENSE API ROUTES
========================= */

// GET: Fetch expenses belonging to the logged-in user
app.get("/api/expenses", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const [expenses] = await db.execute(
            `SELECT id, amount, description, category, subcategory, expense_date
             FROM expenses
             WHERE user_id = ?
             ORDER BY expense_date DESC, id DESC`,
            [req.session.userId]
        );

        return res.json({ expenses });
    } catch (error) {
        console.error("Fetch expenses error:", error.message);

        return res.status(500).json({
            message: "Unable to fetch expenses."
        });
    }
});

// POST: Add an expense
app.post("/api/expenses", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const {
            amount,
            description,
            category,
            subcategory,
            expense_date
        } = req.body;

        const validCategories = [
            "Food",
            "Transport",
            "Bills",
            "Shopping",
            "Health",
            "Salary",
            "Entertainment",
            "Other"
        ];

        if (
            amount === undefined ||
            amount === null ||
            amount === "" ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            Number(amount) > 99999999.99 ||
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 255 ||
            typeof category !== "string" ||
            !validCategories.includes(category) ||
            typeof subcategory !== "string" ||
            !subcategory.trim() ||
            subcategory.trim().length > 100 ||
            typeof expense_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)
        ) {
            return res.status(400).json({
                message: "Please provide valid expense details."
            });
        }

        const parsedDate = new Date(`${expense_date}T00:00:00Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== expense_date
        ) {
            return res.status(400).json({
                message: "Please provide a valid expense date."
            });
        }

        const [result] = await db.execute(
            `INSERT INTO expenses
             (user_id, amount, description, category, subcategory, expense_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                Number(amount),
                description.trim(),
                category,
                subcategory.trim(),
                expense_date
            ]
        );

        return res.status(201).json({
            message: "Expense added successfully.",
            expenseId: result.insertId
        });
    } catch (error) {
        console.error("Add expense error:", error.message);

        return res.status(500).json({
            message: "Unable to add expense."
        });
    }
});

// DELETE: Delete an expense belonging to the logged-in user
app.delete("/api/expenses/:id", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const expenseId = Number(req.params.id);

        if (!Number.isSafeInteger(expenseId) || expenseId <= 0) {
            return res.status(400).json({
                message: "Invalid expense ID."
            });
        }

        const [result] = await db.execute(
            "DELETE FROM expenses WHERE id = ? AND user_id = ?",
            [expenseId, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Expense not found."
            });
        }

        return res.json({
            message: "Expense deleted successfully."
        });
    } catch (error) {
        console.error("Delete expense error:", error.message);

        return res.status(500).json({
            message: "Unable to delete expense."
        });
    }
});


// PROTECT HOME PAGE
app.get("/home.html", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    return res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/expenses.html", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    return res.sendFile(
        path.join(__dirname, "public", "expenses.html")
    );
});


// Serve CSS, JavaScript and other public assets
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        if (!process.env.SESSION_SECRET) {
            throw new Error("SESSION_SECRET is missing from your .env file.");
        }

        await db.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(`PocketProof running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();