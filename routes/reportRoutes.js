
const express = require("express");
const db = require("../config/db");
const {
    generateExpenseReport,
    getExpenseReportHistory
} = require("../services/reportService");
const { logger } = require("../config/logger");

const router = express.Router();

// Check login and premium membership
async function requirePremium(req, res, next) {
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

        if (users.length === 0 || !users[0].is_premium) {
            return res.status(401).json({
                message: "This feature is available only to premium users."
            });
        }

        next();

    } catch (error) {
        logger.error("Premium access check failed", {
            message: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Unable to verify premium membership."
        });
    }
}

// Generate and download expense report
router.post("/generate", requirePremium, async (req, res) => {
    try {
        const report = await generateExpenseReport(req.session.userId);

        return res.json({
            success: true,
            message: "Expense report generated successfully.",
            ...report
        });

    } catch (error) {
        logger.error("Expense report generation failed", {
            userId: req.session.userId,
            message: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Unable to generate expense report."
        });
    }
});

// Get previous expense reports
router.get("/history", requirePremium, async (req, res) => {
    try {
        const reports = await getExpenseReportHistory(req.session.userId);

        return res.json({
            success: true,
            reports
        });

    } catch (error) {
        logger.error("Expense report history fetch failed", {
            userId: req.session.userId,
            message: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            message: "Unable to fetch report history."
        });
    }
});

module.exports = router;
