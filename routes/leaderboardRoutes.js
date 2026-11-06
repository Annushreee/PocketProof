
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// =========================
// PREMIUM MONTHLY LEADERBOARD
// =========================

router.get("/", async (req, res) => {
    try {
        // Check login
        if (!req.session.userId) {
            return res.status(401).json({
                message: "Please log in first."
            });
        }

        // Check premium membership
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

        // Get current month's leaderboard
        const [leaderboard] = await db.execute(
            `SELECT
                u.username,
                m.total_spending,
                RANK() OVER (
                    ORDER BY m.total_spending DESC
                ) AS user_rank
             FROM users u
             INNER JOIN monthly_expense_totals m
                 ON u.id = m.user_id
             WHERE u.is_premium = TRUE
               AND m.year = YEAR(CURDATE())
               AND m.month = MONTH(CURDATE())
               AND m.total_spending > 0
             ORDER BY m.total_spending DESC
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

module.exports = router;
