
async function loadHomePage() {
    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            window.location.href = "/";
            return;
        }

        const data = await response.json();

        document.getElementById("username").textContent =
            data.user.username;

        document.getElementById("welcome-user").textContent =
            `Welcome, ${data.user.username}`;

        const isPremium = Boolean(data.user.is_premium);

        document.getElementById("membership-badge").hidden = !isPremium;
        document.getElementById("upgrade-link").hidden = isPremium;
        document.getElementById("premium-features-link").hidden = !isPremium;

    } catch (error) {
        console.error("Home page error:", error);
    }
}

document.getElementById("logout-button").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
});

loadHomePage();
