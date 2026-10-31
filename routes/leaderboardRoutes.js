
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// =========================
// PREMIUM MONTHLY LEADERBOARD
// =========================

router.get("/", async (req, res) => {
    try {
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

        // Get monthly spending of premium users only
        const [leaderboard] = await db.execute(
            `SELECT
                u.username,
                SUM(e.amount) AS total_spending,
                RANK() OVER (
                    ORDER BY SUM(e.amount) DESC
                ) AS user_rank
             FROM users u
             INNER JOIN expenses e
                 ON u.id = e.user_id
             WHERE u.is_premium = TRUE
               AND e.category != 'Salary'
               AND e.expense_date >= DATE_FORMAT(
                   CURDATE(), '%Y-%m-01'
               )
               AND e.expense_date < DATE_FORMAT(
                   DATE_ADD(CURDATE(), INTERVAL 1 MONTH),
                   '%Y-%m-01'
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

module.exports = router;
