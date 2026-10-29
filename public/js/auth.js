
const registerSection = document.getElementById("register-section");
const loginSection = document.getElementById("login-section");
const forgotSection = document.getElementById("forgot-section");

const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const forgotForm = document.getElementById("forgot-form");

const message = document.getElementById("message");

// Show success or error messages
function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
    message.hidden = false;
}

function hideMessage() {
    message.textContent = "";
    message.hidden = true;
}

// Switch between forms
function showSection(section) {
    registerSection.hidden = section !== "register";
    loginSection.hidden = section !== "login";
    forgotSection.hidden = section !== "forgot";

    hideMessage();
}

document.getElementById("show-login").addEventListener("click", () => {
    showSection("login");
});

document.getElementById("show-register").addEventListener("click", () => {
    showSection("register");
});

document.getElementById("forgot-password").addEventListener("click", () => {
    showSection("forgot");
});

document.getElementById("back-to-login").addEventListener("click", () => {
    showSection("login");
});

// SIGNUP
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", true);
        return;
    }

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                password,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Signup failed.", true);
            return;
        }

        window.location.href = result.redirect || "/home.html";

    } catch (error) {
        showMessage("Cannot connect to the server. Please try again.", true);
    }
});

// LOGIN
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Login failed.", true);
            return;
        }

        window.location.href = result.redirect || "/home.html";

    } catch (error) {
        showMessage("Cannot connect to the server. Please try again.", true);
    }
});

// FORGOT PASSWORD — placeholder for now
forgotForm.addEventListener("submit", (event) => {
    event.preventDefault();

    showMessage(
        "Password reset is not set up yet. We'll implement it later.",
        true
    );
});
