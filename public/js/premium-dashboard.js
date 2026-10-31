
// =========================
// PREMIUM ANALYTICS DASHBOARD
// =========================

const totalIncome = document.getElementById("total-income");
const totalExpenses = document.getElementById("total-expenses");
const totalSavings = document.getElementById("total-savings");

let categoryChart;
let monthlyChart;
let comparisonChart;

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(Number(amount) || 0);
}

// =========================
// LOAD ANALYTICS DATA
// =========================

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
        displayMonthlyChart(data.monthlyData);
        displayComparisonChart(data.monthlyData);

    } catch (error) {
        console.error("Analytics error:", error);
        alert("Unable to load analytics. Please try again.");
    }
}

// =========================
// SUMMARY CARDS
// =========================

function displaySummary(summary) {
    totalIncome.textContent = formatCurrency(summary.totalIncome);
    totalExpenses.textContent = formatCurrency(summary.totalExpenses);
    totalSavings.textContent = formatCurrency(summary.savings);
}

// =========================
// CATEGORY PIE CHART
// =========================

function displayCategoryChart(categoryData) {
    if (categoryChart) categoryChart.destroy();

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
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        }
    );
}

// =========================
// MONTHLY EXPENSE BAR CHART
// =========================

function displayMonthlyChart(monthlyData) {
    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(
        document.getElementById("monthly-chart"),
        {
            type: "bar",
            data: {
                labels: monthlyData.map(item => item.month),
                datasets: [{
                    label: "Monthly Expenses",
                    data: monthlyData.map(item => Number(item.expenses))
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );
}

// =========================
// INCOME VS EXPENSES CHART
// =========================

function displayComparisonChart(monthlyData) {
    if (comparisonChart) comparisonChart.destroy();

    comparisonChart = new Chart(
        document.getElementById("comparison-chart"),
        {
            type: "bar",
            data: {
                labels: monthlyData.map(item => item.month),
                datasets: [
                    {
                        label: "Income",
                        data: monthlyData.map(item => Number(item.income))
                    },
                    {
                        label: "Expenses",
                        data: monthlyData.map(item => Number(item.expenses))
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }
    );
}

// =========================
// LOGOUT
// =========================

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

// LOAD DASHBOARD
loadAnalytics();
async function loadLeaderboard() {
  const leaderboardList = document.getElementById("leaderboard-list");

  try {
    const response = await fetch("/api/premium/leaderboard");

    if (!response.ok) {
      throw new Error("Unable to load leaderboard");
    }

    const data = await response.json();
    const leaderboard = data.leaderboard;

    leaderboardList.innerHTML = "";

    if (!leaderboard || leaderboard.length === 0) {
      leaderboardList.innerHTML = `
        <tr>
          <td colspan="3">No spending data available this month.</td>
        </tr>
      `;
      return;
    }

    leaderboard.forEach((user) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${user.user_rank}</td>
        <td></td>
        <td>₹${Number(user.total_spending).toLocaleString("en-IN")}</td>
      `;

      row.children[1].textContent = user.username;

      leaderboardList.appendChild(row);
    });

  } catch (error) {
    console.error("Leaderboard error:", error);

    leaderboardList.innerHTML = `
      <tr>
        <td colspan="3">Unable to load leaderboard.</td>
      </tr>
    `;
  }
}
loadLeaderboard();