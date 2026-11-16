
const expenseForm = document.getElementById("expense-form");
const noteInput = document.getElementById("expense-note");
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

// Pagination elements
const paginationContainer = document.getElementById("expense-pagination");
const previousPageButton = document.getElementById("previous-page");
const nextPageButton = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");
const pageSizeSelect = document.getElementById("page-size");
const paginationControls = document.querySelector(".pagination-controls");

// Dynamic page-size settings
const PAGE_SIZE_STORAGE_KEY = "pocketproof-expenses-page-size";
const ALLOWED_PAGE_SIZES = [5, 8, 10, 20, 30, 40];

// Read saved page size
function getSavedPageSize() {
    try {
        const savedSize = Number(
            localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
        );

        return ALLOWED_PAGE_SIZES.includes(savedSize)
            ? savedSize
            : 10;
    } catch (error) {
        console.warn("Could not read page size:", error);
        return 10;
    }
}

// Save selected page size
function savePageSize(size) {
    try {
        localStorage.setItem(
            PAGE_SIZE_STORAGE_KEY,
            String(size)
        );
    } catch (error) {
        console.warn("Could not save page size:", error);
    }
}

let pageSize = getSavedPageSize();
pageSizeSelect.value = String(pageSize);

let currentPage = 1;
let totalPages = 1;

// Expense subcategories
const subcategories = {
    Food: ["Breakfast", "Lunch", "Dinner", "Snacks", "Groceries", "Restaurant", "Custom"],
    Transport: ["Petrol", "Public transport", "Taxi / cab", "Parking", "Vehicle maintenance", "Custom"],
    Bills: ["Electricity", "Water", "Internet", "Mobile recharge", "Rent", "Custom"],
    Shopping: ["Clothing", "Electronics", "Household", "Personal care", "Custom"],
    Health: ["Medicine", "Doctor", "Medical tests", "Fitness", "Custom"],
    Entertainment: ["Movies", "Games", "Subscriptions", "Events", "Custom"],
    Other: ["Custom"]
};

// Load user membership
async function loadUserMembership() {
    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = "/";
            }
            return;
        }

        const data = await response.json();
        const isPremium = Boolean(data.user.is_premium);

        const badge = document.getElementById("membership-badge");
        const upgradeLink = document.getElementById("upgrade-link");
        const premiumLink = document.getElementById("premium-features-link");

        if (badge) badge.hidden = !isPremium;
        if (upgradeLink) upgradeLink.hidden = isPremium;
        if (premiumLink) premiumLink.hidden = !isPremium;

    } catch (error) {
        console.error("Membership check failed:", error);
    }
}

// Set today's date
dateInput.value = new Date().toLocaleDateString("en-CA");

// Display a message
function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("message-error", isError);
    message.classList.toggle("message-success", !isError);
}

// Update subcategories when category changes
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

// Load dynamically paginated expenses
async function loadExpenses(page = currentPage) {
    try {
        const response = await fetch(
            `/api/expenses?page=${page}&limit=${pageSize}`
        );

        if (response.status === 401) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load expenses.");
        }

        // Update pagination details from backend
        currentPage = data.currentPage;
        totalPages = data.totalPages;
        pageSize = data.limit;

        pageSizeSelect.value = String(pageSize);

        // Display expenses
        displayExpenses(data.expenses);

        // Show total for all expenses, not just current page
        expenseTotal.textContent =
            `Total: ₹${Number(data.totalAmount).toFixed(2)}`;

        updatePagination();

    } catch (error) {
        expenseList.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.textContent =
            error.message || "Unable to load expenses.";

        row.appendChild(cell);
        expenseList.appendChild(row);

        paginationContainer.hidden = true;
    }
}

// Update pagination controls
function updatePagination() {
    // Keep page-size selector visible
    paginationContainer.hidden = false;

    // Hide navigation if there is only one page
    paginationControls.hidden = totalPages <= 1;

    pageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;

    previousPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;
}

// Previous page
previousPageButton.addEventListener("click", () => {
    if (currentPage > 1) {
        loadExpenses(currentPage - 1);
    }
});

// Next page
nextPageButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
        loadExpenses(currentPage + 1);
    }
});

// Change expenses per page
pageSizeSelect.addEventListener("change", () => {
    const selectedSize = Number(pageSizeSelect.value);

    if (!ALLOWED_PAGE_SIZES.includes(selectedSize)) {
        pageSizeSelect.value = String(pageSize);
        return;
    }

    pageSize = selectedSize;

    savePageSize(pageSize);

    // Start from page 1 after changing page size
    loadExpenses(1);
});

// Display expense rows safely
function displayExpenses(expenses) {
    expenseList.replaceChildren();

    if (!expenses.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.textContent =
            "No expenses yet. Add your first expense!";

        row.appendChild(cell);
        expenseList.appendChild(row);
        return;
    }

    expenses.forEach((expense) => {
        const row = document.createElement("tr");

        const values = [
            new Date(expense.expense_date).toLocaleDateString("en-IN"),
            expense.description,
            expense.note || "—",
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

        deleteButton.addEventListener("click", () => {
            deleteExpense(expense.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        expenseList.appendChild(row);
    });
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
        showMessage(
            "Please complete all fields with valid values.",
            true
        );
        return;
    }

    addExpenseButton.disabled = true;

    try {
        const response = await fetch("/api/expenses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
    amount,
    description,
    note: noteInput.value.trim(),
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
            throw new Error(
                data.message || "Could not add expense."
            );
        }

        expenseForm.reset();
        noteInput.value = "";

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
        showMessage(
            error.message || "Unable to add expense.",
            true
        );
    } finally {
        addExpenseButton.disabled = false;
    }
});

// Delete an expense
async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense?")) {
        return;
    }

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
            throw new Error(
                data.message || "Could not delete expense."
            );
        }

        showMessage("Expense deleted successfully!");

        // Reload current page.
        // Backend will correct the page if it is now out of range.
        await loadExpenses(currentPage);

    } catch (error) {
        showMessage(
            error.message || "Unable to delete expense.",
            true
        );
    }
}

// Log out
document.getElementById("logout-button").addEventListener("click", async () => {
    const response = await fetch("/api/logout", {
        method: "POST"
    });

    if (response.ok) {
        window.location.href = "/";
    } else {
        showMessage(
            "Unable to log out. Please try again.",
            true
        );
    }
});

// Load expenses and membership when page opens
loadExpenses();
loadUserMembership();
