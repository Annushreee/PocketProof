
const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");

const {
    createOrder,
    fetchPayments
} = require("../services/cashfreeServices");

const router = express.Router();

// =========================
// DATABASE TRANSACTION HELPER
// =========================

async function runTransaction(callback) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const result = await callback(connection);

        await connection.commit();

        return result;

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

// =========================
// CHECK PREMIUM ACCESS
// =========================

async function checkPremium(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
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
                message: "Premium Membership is required."
            });
        }

        return next();

    } catch (error) {
        console.error("Premium access error:", error.message);

        return res.status(500).json({
            message: "Unable to verify premium access."
        });
    }
}

// =========================
// CREATE PREMIUM ORDER
// =========================

router.post("/create-order", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

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

        const amount = 99.00;

        const orderId = `PP_${userId}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

        // Save the pending order inside a transaction.
        await runTransaction(async (connection) => {
            await connection.execute(
                `INSERT INTO orders (user_id, order_id, amount, status)
                 VALUES (?, ?, ?, 'PENDING')`,
                [userId, orderId, amount]
            );
        });

        try {
            // External API call stays outside the DB transaction.
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
            // Mark the order as failed inside a transaction.
            await runTransaction(async (connection) => {
                await connection.execute(
                    `UPDATE orders
                     SET status = 'FAILED'
                     WHERE order_id = ?
                       AND user_id = ?
                       AND status = 'PENDING'`,
                    [orderId, userId]
                );
            });

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
// VERIFY PREMIUM PAYMENT
// =========================

router.post("/verify-payment", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    const userId = req.session.userId;
    const { orderId } = req.body;

    if (typeof orderId !== "string" || !orderId.trim()) {
        return res.status(400).json({
            message: "Order ID is required."
        });
    }

    const cleanOrderId = orderId.trim();

    try {
        const [orders] = await db.execute(
            `SELECT id, user_id, order_id, amount, status
             FROM orders
             WHERE order_id = ? AND user_id = ?`,
            [cleanOrderId, userId]
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

        // Check payment status with Cashfree.
        const payments = await fetchPayments(cleanOrderId);

        if (!Array.isArray(payments) || payments.length === 0) {
            return res.json({
                status: "PENDING",
                message: "Payment is still pending."
            });
        }

        const successfulPayment = payments.find(
            payment => payment.payment_status === "SUCCESS"
        );

        if (successfulPayment) {
            // Update order and user atomically.
            const result = await runTransaction(async (connection) => {
                const [lockedOrders] = await connection.execute(
                    `SELECT status
                     FROM orders
                     WHERE order_id = ? AND user_id = ?
                     FOR UPDATE`,
                    [cleanOrderId, userId]
                );

                if (lockedOrders.length === 0) {
                    throw new Error("Order not found during verification.");
                }

                if (lockedOrders[0].status === "SUCCESSFUL") {
                    return "SUCCESSFUL";
                }

                if (lockedOrders[0].status !== "PENDING") {
                    return lockedOrders[0].status;
                }

                const [orderUpdate] = await connection.execute(
                    `UPDATE orders
                     SET status = 'SUCCESSFUL'
                     WHERE order_id = ?
                       AND user_id = ?
                       AND status = 'PENDING'`,
                    [cleanOrderId, userId]
                );

                if (orderUpdate.affectedRows !== 1) {
                    throw new Error("Unable to update payment order.");
                }

                const [userUpdate] = await connection.execute(
                    `UPDATE users
                     SET is_premium = TRUE
                     WHERE id = ?`,
                    [userId]
                );

                if (userUpdate.affectedRows !== 1) {
                    throw new Error("Unable to activate Premium Membership.");
                }

                return "SUCCESSFUL";
            });

            if (result !== "SUCCESSFUL") {
                return res.json({
                    status: result,
                    message: "Payment status has changed. Please try again."
                });
            }

            return res.json({
                status: "SUCCESSFUL",
                message: "Transaction successful! Premium Membership activated."
            });
        }

        const hasPendingPayment = payments.some(
            payment => payment.payment_status === "PENDING"
        );

        const hasFailedPayment = payments.some(
            payment =>
                ["FAILED", "USER_DROPPED", "CANCELLED"].includes(
                    payment.payment_status
                )
        );

        if (!hasPendingPayment && hasFailedPayment) {
            await runTransaction(async (connection) => {
                await connection.execute(
                    `UPDATE orders
                     SET status = 'FAILED'
                     WHERE order_id = ?
                       AND user_id = ?
                       AND status = 'PENDING'`,
                    [cleanOrderId, userId]
                );
            });

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

// =========================
// PREMIUM EXPENSE ANALYTICS
// =========================

router.get("/analytics", checkPremium, async (req, res) => {
    try {
        const userId = req.session.userId;

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

module.exports = router;
