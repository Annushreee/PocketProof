const expenseForm = document.getElementById("expense-form");
const amountInput = document.getElementById("expense-amount");
const descriptionInput = document.getElementById("expense-description");
const categorySelect = document.getElementById("expense-category");
const subcategorySelect = document.getElementById("expense-subcategory");
const customSubcategoryField = document.getElementById("custom-subcategory-field");
const customSubcategoryInput = document.getElementById("custom-subcategory");
const dateInput = document.getElementById("expense-date");
const message = document.getElementById("expense-message");
const expenseList = document.getElementById("expense-list");
const expenseTotal = document.getElementById("expense-total");
const addExpenseButton = document.getElementById("add-expense-button");

const subcategories = {
    Food: ["Breakfast", "Lunch", "Dinner", "Snacks", "Groceries", "Restaurant", "Custom"],
    Transport: ["Petrol", "Public transport", "Taxi / cab", "Parking", "Vehicle maintenance", "Custom"],
    Bills: ["Electricity", "Water", "Internet", "Mobile recharge", "Rent", "Custom"],
    Shopping: ["Clothing", "Electronics", "Household", "Personal care", "Custom"],
    Health: ["Medicine", "Doctor", "Medical tests", "Fitness", "Custom"],
    Salary: ["Monthly salary", "Bonus", "Freelance income", "Other income", "Custom"],
    Entertainment: ["Movies", "Games", "Subscriptions", "Events", "Custom"],
    Other: ["Custom"]
};

// Set today's date
dateInput.value = new Date().toLocaleDateString("en-CA");

// Display a message
function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("message-error", isError);
    message.classList.toggle("message-success", !isError);
}

// Update subcategories when the category changes
categorySelect.addEventListener("change", () => {
    const category = categorySelect.value;
    const options = subcategories[category] || [];

    subcategorySelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a subcategory";
    subcategorySelect.appendChild(placeholder);

    options.forEach((subcategory) => {
        const option = document.createElement("option");
        option.value = subcategory;
        option.textContent = subcategory;
        subcategorySelect.appendChild(option);
    });

    subcategorySelect.disabled = options.length === 0;
    customSubcategoryField.hidden = true;
    customSubcategoryInput.value = "";
    customSubcategoryInput.required = false;
});

// Show custom input when Custom is selected
subcategorySelect.addEventListener("change", () => {
    const isCustom = subcategorySelect.value === "Custom";

    customSubcategoryField.hidden = !isCustom;
    customSubcategoryInput.required = isCustom;

    if (!isCustom) {
        customSubcategoryInput.value = "";
    }
});

// Load saved expenses
async function loadExpenses() {
    try {
        const response = await fetch("/api/expenses");

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load expenses.");
        }

        displayExpenses(data.expenses);
    } catch (error) {
        expenseList.replaceChildren();
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = error.message || "Unable to load expenses.";
        row.appendChild(cell);
        expenseList.appendChild(row);
    }
}

// Display expense rows safely
function displayExpenses(expenses) {
    expenseList.replaceChildren();

    let total = 0;

    if (!expenses.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = "No expenses yet. Add your first expense!";
        row.appendChild(cell);
        expenseList.appendChild(row);
    }

    expenses.forEach((expense) => {
        const row = document.createElement("tr");

        const values = [
            new Date(expense.expense_date).toLocaleDateString(),
            expense.description,
            expense.category,
            expense.subcategory,
            `₹${Number(expense.amount).toFixed(2)}`
        ];

        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteExpense(expense.id));
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        expenseList.appendChild(row);
        total += Number(expense.amount);
    });

    expenseTotal.textContent = `Total: ₹${total.toFixed(2)}`;
}

// Add expense
expenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const category = categorySelect.value;
    const selectedSubcategory = subcategorySelect.value;
    const subcategory = selectedSubcategory === "Custom"
        ? customSubcategoryInput.value.trim()
        : selectedSubcategory;

    const amount = Number(amountInput.value);
    const description = descriptionInput.value.trim();

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !description ||
        !category ||
        !subcategory ||
        !dateInput.value
    ) {
        showMessage("Please complete all fields with valid values.", true);
        return;
    }

    addExpenseButton.disabled = true;

    try {
        const response = await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount,
                description,
                category,
                subcategory,
                expense_date: dateInput.value
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Could not add expense.");
        }

        expenseForm.reset();
        dateInput.value = new Date().toLocaleDateString("en-CA");
        subcategorySelect.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a category first";
        subcategorySelect.appendChild(placeholder);
        subcategorySelect.disabled = true;
        customSubcategoryField.hidden = true;
        customSubcategoryInput.required = false;

        showMessage("Expense added successfully!");
        await loadExpenses();
    } catch (error) {
        showMessage(error.message || "Unable to add expense.", true);
    } finally {
        addExpenseButton.disabled = false;
    }
});

// Delete an expense
async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Could not delete expense.");
        }

        showMessage("Expense deleted successfully!");
        await loadExpenses();
    } catch (error) {
        showMessage(error.message || "Unable to delete expense.", true);
    }
}

// Log out
document.getElementById("logout-button").addEventListener("click", async () => {
    const response = await fetch("/api/logout", { method: "POST" });

    if (response.ok) {
        window.location.href = "/";
    } else {
        showMessage("Unable to log out. Please try again.", true);
    }
});

// Load existing expenses when the page opens
loadExpenses();