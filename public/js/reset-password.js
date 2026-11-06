
const resetForm = document.getElementById("reset-password-form");
const resetMessage = document.getElementById("reset-message");

// Extract UUID from the URL
const pathParts = window.location.pathname.split("/");
const requestId = pathParts[pathParts.length - 1];

function showResetMessage(message, isError = false) {
    resetMessage.textContent = message;
    resetMessage.style.color = isError ? "red" : "green";
    resetMessage.hidden = false;
}

// Submit new password
resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-new-password").value;

    if (password !== confirmPassword) {
        showResetMessage("Passwords do not match.", true);
        return;
    }

    try {
        const response = await axios.post("/password/resetpassword", {
            requestId,
            password
        });

        showResetMessage(
            response.data.message || "Password updated successfully!"
        );

        resetForm.reset();

    } catch (error) {
        showResetMessage(
            error.response?.data?.message ||
            "Unable to update password. Please try again.",
            true
        );
    }
});
