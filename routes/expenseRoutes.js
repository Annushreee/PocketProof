
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
            message: "Transaction added successfully.",
            expenseId: result.insertId
        });

    } catch (error) {
        console.error("Add transaction error:", error.message);

        return res.status(500).json({
            message: "Unable to add transaction."
        });
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

    try {
        const expenseId = Number(req.params.id);

        if (!Number.isSafeInteger(expenseId) || expenseId <= 0) {
            return res.status(400).json({
                message: "Invalid transaction ID."
            });
        }

        const [result] = await db.execute(
            `DELETE FROM expenses
             WHERE id = ? AND user_id = ?`,
            [expenseId, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Transaction not found."
            });
        }

        return res.json({
            message: "Transaction deleted successfully."
        });

    } catch (error) {
        console.error("Delete transaction error:", error.message);

        return res.status(500).json({
            message: "Unable to delete transaction."
        });
    }
});

module.exports = router;
