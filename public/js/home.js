
async function loadUser() {
    const response = await fetch("/api/me");

    if (!response.ok) {
        window.location.href = "/index.html";
        return;
    }

    const result = await response.json();

    document.getElementById("welcome-message").textContent =
        `Welcome, ${result.user.username}!`;
}

document.getElementById("logout-button").addEventListener("click", async () => {
    const response = await fetch("/api/logout", {
        method: "POST"
    });

    if (response.ok) {
        window.location.href = "/index.html";
    }
});

loadUser();
