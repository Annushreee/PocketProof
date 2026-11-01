
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// =========================
// GET ALL USER TRANSACTIONS
// =========================

router.get("/", async (req, res) => {
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
// ADD TRANSACTION API
// =========================

router.post("/", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    let connection;

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
                message: "Please provide valid transaction details."
            });
        }

        const parsedDate = new Date(`${expense_date}T00:00:00Z`);

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== expense_date
        ) {
            return res.status(400).json({
                message: "Please provide a valid transaction date."
            });
        }

        const userId = req.session.userId;
        const transactionAmount = Number(amount);

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Insert transaction into expenses table
        const [result] = await connection.execute(
            `INSERT INTO expenses
             (user_id, amount, description, category,
              subcategory, expense_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                transactionAmount,
                description.trim(),
                category,
                subcategory.trim(),
                expense_date
            ]
        );

        // Update precomputed monthly total
        // Salary is income, so it is excluded.
        if (category !== "Salary") {
            await connection.execute(
                `INSERT INTO monthly_expense_totals
                    (user_id, year, month, total_spending)
                 VALUES (?, YEAR(?), MONTH(?), ?)
                 ON DUPLICATE KEY UPDATE
                    total_spending = total_spending + ?`,
                [
                    userId,
                    expense_date,
                    expense_date,
                    transactionAmount,
                    transactionAmount
                ]
            );
        }

        await connection.commit();

        return res.status(201).json({
            message: "Transaction added successfully.",
            expenseId: result.insertId
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Add transaction error:", error.message);

        return res.status(500).json({
            message: "Unable to add transaction."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// =========================
// DELETE TRANSACTION API
// =========================

router.delete("/:id", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    let connection;

    try {
        const expenseId = Number(req.params.id);
        const userId = req.session.userId;

        if (!Number.isSafeInteger(expenseId) || expenseId <= 0) {
            return res.status(400).json({
                message: "Invalid transaction ID."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get transaction details before deleting
        const [expenses] = await connection.execute(
            `SELECT amount, category, expense_date
             FROM expenses
             WHERE id = ? AND user_id = ?
             FOR UPDATE`,
            [expenseId, userId]
        );

        if (expenses.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: "Transaction not found."
            });
        }

        const expense = expenses[0];

        // Delete transaction
        await connection.execute(
            `DELETE FROM expenses
             WHERE id = ? AND user_id = ?`,
            [expenseId, userId]
        );

        // Decrease precomputed monthly total
        // Salary is excluded because it was never added.
        if (expense.category !== "Salary") {
            await connection.execute(
                `UPDATE monthly_expense_totals
                 SET total_spending = total_spending - ?
                 WHERE user_id = ?
                   AND year = YEAR(?)
                   AND month = MONTH(?)`,
                [
                    expense.amount,
                    userId,
                    expense.expense_date,
                    expense.expense_date
                ]
            );
        }

        await connection.commit();

        return res.json({
            message: "Transaction deleted successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Delete transaction error:", error.message);

        return res.status(500).json({
            message: "Unable to delete transaction."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
