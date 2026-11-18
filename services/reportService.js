
const {
    PutObjectCommand,
    GetObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = require("../config/s3");
const db = require("../config/db");
const { logger } = require("../config/logger");

const BUCKET = process.env.AWS_S3_BUCKET;

// Escape CSV values safely
function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '""';
    }

    const text = String(value).replace(/"/g, '""');
    return `"${text}"`;
}

// Generate and upload a user's expense report
async function generateExpenseReport(userId) {
    // Fetch the user's expenses
    const [expenses] = await db.execute(
        `SELECT
            id,
            amount,
            description,
            note,
            category,
            subcategory,
            expense_date
         FROM expenses
         WHERE user_id = ?
           AND category != 'Salary'
         ORDER BY expense_date DESC, id DESC`,
        [userId]
    );

    const headers = [
        "Expense ID",
        "Amount",
        "Description",
        "Note",
        "Category",
        "Subcategory",
        "Expense Date"
    ];

    const rows = expenses.map(expense => [
        expense.id,
        expense.amount,
        expense.description,
        expense.note,
        expense.category,
        expense.subcategory,
        expense.expense_date
    ]);

    const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const fileBuffer = Buffer.from(csvContent, "utf8");

    const fileName = `expense-report-${Date.now()}.csv`;
    const s3Key = `expense-reports/user-${userId}/${fileName}`;

    // Upload report to S3
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: "text/csv"
        })
    );

    // Save report history
    await db.execute(
        `INSERT INTO expense_reports (user_id, s3_key)
         VALUES (?, ?)`,
        [userId, s3Key]
    );

    logger.info("Expense report uploaded to S3", {
        userId,
        s3Key
    });

    // Generate temporary download URL
    const downloadUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            ResponseContentDisposition: `attachment; filename="${fileName}"`
        }),
        { expiresIn: 300 }
    );

    return {
        downloadUrl,
        fileName,
        totalExpenses: expenses.length
    };
}

async function getExpenseReportHistory(userId) {
    const [reports] = await db.execute(
        `SELECT id, s3_key, created_at
         FROM expense_reports
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
    );

    const history = await Promise.all(
        reports.map(async (report) => {
            const fileName = report.s3_key.split("/").pop();

            const downloadUrl = await getSignedUrl(
                s3,
                new GetObjectCommand({
                    Bucket: BUCKET,
                    Key: report.s3_key,
                    ResponseContentDisposition:
                        `attachment; filename="${fileName}"`
                }),
                { expiresIn: 300 }
            );

            return {
                id: report.id,
                fileName,
                createdAt: report.created_at,
                downloadUrl
            };
        })
    );

    return history;
}


module.exports = {
    generateExpenseReport,
    getExpenseReportHistory
};
