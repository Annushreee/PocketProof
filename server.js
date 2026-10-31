
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("./config/db");

const {
    createOrder,
    fetchPayments
} = require("./services/cashfreeServices");

const app = express();

// =========================
// MIDDLEWARE
// =========================

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

// =========================
// ROOT PAGE
// =========================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

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

app.post("/api/register", async (req, res) => {
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
            redirect: "/expenses.html"
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

app.get("/api/me", async (req, res) => {
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

// =========================
// GET ALL USER EXPENSES
// =========================

app.get("/api/expenses", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const [expenses] = await db.execute(
            `SELECT id, amount, description, category,
                    subcategory, expense_date
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

// =========================
// ADD EXPENSE API
// =========================

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
             (user_id, amount, description, category,
              subcategory, expense_date)
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

// =========================
// DELETE EXPENSE API
// =========================

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
            `DELETE FROM expenses
             WHERE id = ? AND user_id = ?`,
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

// =========================
// CASHFREE: CREATE PREMIUM ORDER
// =========================

app.post("/api/premium/create-order", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    let orderId;

    try {
        const userId = req.session.userId;
        const { customerPhone } = req.body;

        if (
            typeof customerPhone !== "string" ||
            !/^[6-9]\d{9}$/.test(customerPhone)
        ) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit mobile number."
            });
        }

        const [users] = await db.execute(
            `SELECT id, username, email, is_premium
             FROM users
             WHERE id = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const user = users[0];

        if (user.is_premium) {
            return res.status(409).json({
                message: "You already have Premium Membership."
            });
        }

        // Fixed membership price
        const amount = 99.00;

        // Generate unique order ID
        orderId = `PP_${userId}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

        // Save order as PENDING in MySQL
        await db.execute(
            `INSERT INTO orders (user_id, order_id, amount, status)
             VALUES (?, ?, ?, 'PENDING')`,
            [userId, orderId, amount]
        );

        try {
            const paymentSessionId = await createOrder(
                orderId,
                amount,
                userId,
                customerPhone,
                user.email
            );

            return res.status(201).json({
                message: "Payment order created successfully.",
                orderId,
                paymentSessionId
            });

        } catch (cashfreeError) {
            await db.execute(
                `UPDATE orders
                 SET status = 'FAILED'
                 WHERE order_id = ? AND user_id = ?`,
                [orderId, userId]
            );

            throw cashfreeError;
        }

    } catch (error) {
        console.error("Premium order error:", error.message);

        return res.status(500).json({
            message: "Unable to create payment order."
        });
    }
});

// =========================
// CASHFREE: VERIFY PAYMENT
// =========================

app.post("/api/premium/verify-payment", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    const userId = req.session.userId;
    const { orderId } = req.body;

    if (
        typeof orderId !== "string" ||
        !orderId.trim()
    ) {
        return res.status(400).json({
            message: "Order ID is required."
        });
    }

    try {
        // Check that the order belongs to this user
        const [orders] = await db.execute(
            `SELECT id, user_id, order_id, amount, status
             FROM orders
             WHERE order_id = ? AND user_id = ?`,
            [orderId, userId]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                message: "Order not found."
            });
        }

        const order = orders[0];

        if (order.status === "SUCCESSFUL") {
            return res.json({
                status: "SUCCESSFUL",
                message: "Premium Membership is already active."
            });
        }

        if (order.status === "FAILED") {
            return res.json({
                status: "FAILED",
                message: "TRANSACTION FAILED"
            });
        }
console.log("Verifying order:", orderId);
        // Fetch payment details directly from Cashfree
        const payments = await fetchPayments(orderId);
        console.log("Cashfree payment response:");
console.log(JSON.stringify(payments, null, 2));

        if (!Array.isArray(payments) || payments.length === 0) {
            return res.json({
                status: "PENDING",
                message: "Payment is still pending."
            });
        }

        // Check whether Cashfree confirms a successful payment
        const successfulPayment = payments.find(
            payment => payment.payment_status === "SUCCESS"
        );

        if (successfulPayment) {
            // Update order status
            await db.execute(
                `UPDATE orders
                 SET status = 'SUCCESSFUL'
                 WHERE order_id = ? AND user_id = ?
                   AND status = 'PENDING'`,
                [orderId, userId]
            );

            // Activate Premium Membership
            await db.execute(
                `UPDATE users
                 SET is_premium = TRUE
                 WHERE id = ?`,
                [userId]
            );

            return res.json({
                status: "SUCCESSFUL",
                message: "Transaction successful! Premium Membership activated."
            });
        }

        // Check whether any payment is still pending
        const hasPendingPayment = payments.some(
            payment => payment.payment_status === "PENDING"
        );

        // Check for failed or cancelled payments
        const hasFailedPayment = payments.some(
            payment =>
                ["FAILED", "USER_DROPPED", "CANCELLED"].includes(
                    payment.payment_status
                )
        );

        if (!hasPendingPayment && hasFailedPayment) {
            await db.execute(
                `UPDATE orders
                 SET status = 'FAILED'
                 WHERE order_id = ? AND user_id = ?
                   AND status = 'PENDING'`,
                [orderId, userId]
            );

            return res.json({
                status: "FAILED",
                message: "TRANSACTION FAILED"
            });
        }

        return res.json({
            status: "PENDING",
            message: "Payment is still pending."
        });

    } catch (error) {
        console.error("Payment verification error:", error.message);

        return res.status(500).json({
            message: "Unable to verify payment right now."
        });
    }
});

/* =========================
   PREMIUM EXPENSE ANALYTICS API
========================= */

app.get("/api/premium/analytics", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        const userId = req.session.userId;

        // Check Premium Membership
        const [users] = await db.execute(
            "SELECT is_premium FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (!users[0].is_premium) {
            return res.status(403).json({
                message: "Premium Membership is required to access analytics."
            });
        }

        // Calculate total income and expenses
        const [summary] = await db.execute(
            `SELECT
                COALESCE(SUM(
                    CASE WHEN category = 'Salary'
                    THEN amount ELSE 0 END
                ), 0) AS totalIncome,

                COALESCE(SUM(
                    CASE WHEN category != 'Salary'
                    THEN amount ELSE 0 END
                ), 0) AS totalExpenses

             FROM expenses
             WHERE user_id = ?`,
            [userId]
        );

        // Category-wise expenses for pie chart
        const [categoryData] = await db.execute(
            `SELECT
                category,
                SUM(amount) AS total
             FROM expenses
             WHERE user_id = ?
               AND category != 'Salary'
             GROUP BY category
             ORDER BY total DESC`,
            [userId]
        );

        // Monthly income and expenses for the last six months
        const [monthlyData] = await db.execute(
            `SELECT
                DATE_FORMAT(expense_date, '%Y-%m') AS month,

                SUM(
                    CASE WHEN category = 'Salary'
                    THEN amount ELSE 0 END
                ) AS income,

                SUM(
                    CASE WHEN category != 'Salary'
                    THEN amount ELSE 0 END
                ) AS expenses

             FROM expenses
             WHERE user_id = ?
               AND expense_date >= DATE_FORMAT(
                   DATE_SUB(CURDATE(), INTERVAL 5 MONTH),
                   '%Y-%m-01'
               )
             GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
             ORDER BY month ASC`,
            [userId]
        );

        const totalIncome = Number(summary[0].totalIncome);
        const totalExpenses = Number(summary[0].totalExpenses);

        return res.json({
            summary: {
                totalIncome,
                totalExpenses,
                savings: totalIncome - totalExpenses
            },
            categoryData,
            monthlyData
        });

    } catch (error) {
        console.error("Premium analytics error:", error.message);

        return res.status(500).json({
            message: "Unable to load expense analytics."
        });
    }
});


// =========================
// PROTECT HOME PAGE
// =========================

app.get("/home.html", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    return res.sendFile(
        path.join(__dirname, "public", "home.html")
    );
});

// =========================
// PROTECT EXPENSE PAGE
// =========================

app.get("/expenses.html", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    return res.sendFile(
        path.join(__dirname, "public", "expenses.html")
    );
});

// =========================
// PROTECT PREMIUM PAGE
// =========================

app.get("/premium.html", (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    return res.sendFile(
        path.join(__dirname, "public", "premium.html")
    );
});

// =========================
// STATIC FILES
// =========================

app.use(express.static(path.join(__dirname, "public")));
// =========================
// CASHFREE PAYMENT RETURN
// =========================

app.get("/payment-status", (req, res) => {
    const orderId = req.query.order_id;

    if (!orderId || typeof orderId !== "string") {
        return res.redirect("/premium.html");
    }

    return res.redirect(
        `/premium.html?order_id=${encodeURIComponent(orderId)}&payment_return=1`
    );
});

// =========================
// PREMIUM MONTHLY LEADERBOARD
// =========================

app.get("/api/premium/leaderboard", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                message: "Please log in first."
            });
        }

        const [users] = await db.execute(
            "SELECT is_premium FROM users WHERE id = ?",
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (!users[0].is_premium) {
            return res.status(403).json({
                message: "Premium membership required."
            });
        }

        const [leaderboard] = await db.execute(
            `SELECT
                u.username,
                SUM(e.amount) AS total_spending
             FROM users u
             INNER JOIN expenses e ON u.id = e.user_id
             WHERE e.category != 'Salary'
             AND e.expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
             AND e.expense_date < DATE_FORMAT(
                 DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01'
             )
             GROUP BY u.id, u.username
             ORDER BY total_spending DESC
             LIMIT 10`
        );

        return res.json({
            leaderboard
        });

    } catch (error) {
        console.error("Leaderboard error:", error.message);

        return res.status(500).json({
            message: "Unable to load leaderboard."
        });
    }
});

// =========================
// START SERVER
// =========================

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        if (!process.env.SESSION_SECRET) {
            throw new Error(
                "SESSION_SECRET is missing from your .env file."
            );
        }

        await db.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(
                `PocketProof running at http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
