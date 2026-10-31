
// =========================
// INCOME FORM
// =========================

const incomeForm = document.getElementById("income-form");
const incomeAmount = document.getElementById("income-amount");
const incomeSource = document.getElementById("income-source");
const incomeDescription = document.getElementById("income-description");
const incomeDate = document.getElementById("income-date");
const incomeMessage = document.getElementById("income-message");
const logoutButton = document.getElementById("logout-button");

// Set today's date
incomeDate.value = new Date().toLocaleDateString("en-CA");

// Display message
function showIncomeMessage(message, isError = false) {
    incomeMessage.textContent = message;
    incomeMessage.hidden = false;
    incomeMessage.style.color = isError ? "#dc2626" : "#16a34a";
}

// Add income
incomeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const amount = Number(incomeAmount.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        showIncomeMessage("Please enter a valid amount.", true);
        return;
    }

    const incomeData = {
        amount,
        description: incomeDescription.value.trim(),
        category: "Salary",
        subcategory: incomeSource.value,
        expense_date: incomeDate.value
    };

    try {
        const response = await fetch("/api/expenses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(incomeData)
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Unable to add income.");
        }

        showIncomeMessage("Income added successfully!");

        incomeForm.reset();
        incomeDate.value = new Date().toLocaleDateString("en-CA");

    } catch (error) {
        console.error("Add income error:", error);
        showIncomeMessage(error.message, true);
    }
});

// Logout
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
