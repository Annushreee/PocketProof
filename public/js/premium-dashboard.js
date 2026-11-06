
// =====================================
// POCKETPROOF PREMIUM DASHBOARD
// =====================================

// DOM ELEMENTS
const totalIncome = document.getElementById("total-income");
const totalExpenses = document.getElementById("total-expenses");
const totalSavings = document.getElementById("total-savings");

const ledgerBody = document.getElementById("daily-ledger-body");
const yearlyBody = document.getElementById("yearly-summary-body");
const notesBody = document.getElementById("notes-report-body");
const leaderboardList = document.getElementById("leaderboard-list");

let categoryChart;
let reportData = null;

// =====================================
// HELPER FUNCTIONS
// =====================================

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(Number(amount) || 0);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function showTableMessage(element, columns, message) {
    element.innerHTML = `
        <tr>
            <td colspan="${columns}">${escapeHTML(message)}</td>
        </tr>
    `;
}

// =====================================
// LOAD ANALYTICS
// =====================================

async function loadAnalytics() {
    try {
        const response = await fetch("/api/premium/analytics");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (response.status === 403) {
            alert("Premium membership required.");
            window.location.href = "/premium.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load analytics.");
        }

        const data = await response.json();

        displaySummary(data.summary);
        displayCategoryChart(data.categoryData);

    } catch (error) {
        console.error("Analytics error:", error);
        alert("Unable to load analytics. Please try again.");
    }
}

// =====================================
// SUMMARY CARDS
// =====================================

function displaySummary(summary) {
    totalIncome.textContent = formatCurrency(summary.totalIncome);
    totalExpenses.textContent = formatCurrency(summary.totalExpenses);
    totalSavings.textContent = formatCurrency(summary.savings);
}

// =====================================
// CATEGORY PIE CHART
// =====================================

function displayCategoryChart(categoryData) {
    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(
        document.getElementById("category-chart"),
        {
            type: "pie",

            data: {
                labels: categoryData.map(item => item.category),

                datasets: [{
                    data: categoryData.map(item => Number(item.total))
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );
}

// =====================================
// LOAD FINANCIAL REPORTS
// =====================================

async function loadReports() {
    try {
        const response = await fetch("/api/premium/reports");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (response.status === 403) {
            alert("Premium membership required.");
            window.location.href = "/premium.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load reports.");
        }

        reportData = await response.json();

        displayDailyLedger(reportData.ledger);
        displayYearlySummary(reportData.yearlySummary);
        displayNotesReport(reportData.notes);

    } catch (error) {
        console.error("Reports error:", error);

        showTableMessage(ledgerBody, 5, "Unable to load daily ledger.");
        showTableMessage(yearlyBody, 4, "Unable to load yearly summary.");
        showTableMessage(notesBody, 2, "Unable to load notes.");
    }
}

// =====================================
// DAILY LEDGER
// =====================================

function displayDailyLedger(ledger) {
    ledgerBody.innerHTML = "";

    if (!ledger || ledger.length === 0) {
        showTableMessage(ledgerBody, 5, "No transactions available.");
        document.getElementById("ledger-total-savings").textContent =
            formatCurrency(0);
        return;
    }

    let dailyIncome = 0;
    let dailyExpense = 0;

    let totalIncome = 0;
    let totalExpense = 0;

    let currentDate = null;

    function addSubtotal() {
        if (currentDate === null) return;

        const row = document.createElement("tr");
        row.className = "ledger-subtotal";

        row.innerHTML = `
            <td colspan="3"><strong>Daily Subtotal</strong></td>
            <td><strong>${formatCurrency(dailyIncome)}</strong></td>
            <td><strong>${formatCurrency(dailyExpense)}</strong></td>
        `;

        ledgerBody.appendChild(row);
    }

    ledger.forEach(item => {
        const dateKey = String(item.expense_date).slice(0, 10);

        if (currentDate !== dateKey) {
            addSubtotal();

            currentDate = dateKey;
            dailyIncome = 0;
            dailyExpense = 0;

            const dateRow = document.createElement("tr");
            dateRow.className = "ledger-date";

            dateRow.innerHTML = `
                <td colspan="5">
                    <strong>${formatDate(dateKey)}</strong>
                </td>
            `;

            ledgerBody.appendChild(dateRow);
        }

        const income = Number(item.income) || 0;
        const expense = Number(item.expense) || 0;

        dailyIncome += income;
        dailyExpense += expense;

        totalIncome += income;
        totalExpense += expense;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatDate(dateKey)}</td>
            <td>${escapeHTML(item.description)}</td>
            <td>${escapeHTML(item.category)}</td>
            <td>${income ? formatCurrency(income) : "-"}</td>
            <td>${expense ? formatCurrency(expense) : "-"}</td>
        `;

        ledgerBody.appendChild(row);
    });

    addSubtotal();

    const savings = totalIncome - totalExpense;

    document.getElementById("ledger-total-savings").textContent =
        formatCurrency(savings);
}

// =====================================
// YEARLY SUMMARY
// =====================================

function displayYearlySummary(monthlyData) {
    yearlyBody.innerHTML = "";

    if (!monthlyData || monthlyData.length === 0) {
        showTableMessage(yearlyBody, 4, "No financial data available this year.");
        return;
    }

    monthlyData.forEach(item => {
        const income = Number(item.income) || 0;
        const expense = Number(item.expenses) || 0;
        const savings = income - expense;

        const [year, month] = item.month.split("-").map(Number);

        const monthName = new Date(Date.UTC(year, month - 1, 1))
            .toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            });

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${monthName}</td>
            <td>${formatCurrency(income)}</td>
            <td>${formatCurrency(expense)}</td>
            <td>${formatCurrency(savings)}</td>
        `;

        yearlyBody.appendChild(row);
    });
}

// =====================================
// NOTES REPORT
// =====================================

function displayNotesReport(notes) {
    notesBody.innerHTML = "";

    if (!notes || notes.length === 0) {
        showTableMessage(notesBody, 2, "No notes available.");
        return;
    }

    notes.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatDate(String(item.expense_date).slice(0, 10))}</td>
            <td>${escapeHTML(item.description)}</td>
        `;

        notesBody.appendChild(row);
    });
}

// =====================================
// MONTHLY SPENDING LEADERBOARD
// =====================================

async function loadLeaderboard() {
    try {
        const response = await fetch("/api/premium/leaderboard");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (response.status === 403) {
            showTableMessage(
                leaderboardList,
                3,
                "Premium membership required."
            );
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load leaderboard.");
        }

        const data = await response.json();
        const leaderboard = data.leaderboard;

        leaderboardList.innerHTML = "";

        if (!leaderboard || leaderboard.length === 0) {
            showTableMessage(
                leaderboardList,
                3,
                "No spending data available this month."
            );
            return;
        }

        leaderboard.forEach(user => {
            const row = document.createElement("tr");

            const rankCell = document.createElement("td");
            rankCell.textContent = user.user_rank;

            const usernameCell = document.createElement("td");
            usernameCell.textContent = user.username;

            const spendingCell = document.createElement("td");
            spendingCell.textContent = formatCurrency(user.total_spending);

            row.append(rankCell, usernameCell, spendingCell);

            leaderboardList.appendChild(row);
        });

    } catch (error) {
        console.error("Leaderboard error:", error);

        showTableMessage(
            leaderboardList,
            3,
            "Unable to load leaderboard."
        );
    }
}

// =====================================
// DOWNLOAD REPORT AS CSV
// =====================================

function downloadReports() {
    if (!reportData) {
        alert("Reports are still loading. Please try again.");
        return;
    }

    const rows = [
        ["DAILY LEDGER"],
        ["Date", "Description", "Category", "Income", "Expense"]
    ];

    reportData.ledger.forEach(item => {
        rows.push([
            String(item.expense_date).slice(0, 10),
            item.description,
            item.category,
            item.income,
            item.expense
        ]);
    });

    rows.push([]);
    rows.push(["YEARLY SUMMARY"]);
    rows.push(["Month", "Income", "Expense", "Savings"]);

    reportData.yearlySummary.forEach(item => {
        const income = Number(item.income) || 0;
        const expense = Number(item.expenses) || 0;

        rows.push([
            item.month,
            income,
            expense,
            income - expense
        ]);
    });

    rows.push([]);
    rows.push(["NOTES REPORT"]);
    rows.push(["Date", "Notes"]);

    reportData.notes.forEach(item => {
        rows.push([
            String(item.expense_date).slice(0, 10),
            item.description
        ]);
    });

    const csvContent = rows.map(row =>
        row.map(value => {
            let text = String(value ?? "");

            // Prevent spreadsheet formula injection.
            if (/^[=+\-@\t\r]/.test(text)) {
                text = "'" + text;
            }

            return `"${text.replace(/"/g, '""')}"`;
        }).join(",")
    ).join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "PocketProof-Financial-Report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// =====================================
// LOGOUT
// =====================================

const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await fetch("/api/logout", {
                method: "POST"
            });

            window.location.href = "/";
        } catch (error) {
            console.error("Logout error:", error);
        }
    });
}

// =====================================
// DOWNLOAD BUTTON EVENT
// =====================================

const downloadButton = document.getElementById("download-report");

if (downloadButton) {
    downloadButton.addEventListener("click", downloadReports);
}

// =====================================
// INITIALIZE DASHBOARD
// =====================================

loadAnalytics();
loadReports();
loadLeaderboard();
