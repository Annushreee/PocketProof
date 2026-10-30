
const premiumForm = document.getElementById("premium-form");
const phoneInput = document.getElementById("customer-phone");
const premiumButton = document.getElementById("premium-button");
const premiumMessage = document.getElementById("premium-message");

const cashfree = Cashfree({
    mode: "sandbox"
});

// =========================
// VERIFY PAYMENT AFTER RETURN
// =========================

async function verifyPayment(orderId) {
    try {
        premiumMessage.textContent = "Verifying your payment...";
        
        const response = await fetch("/api/premium/verify-payment", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ orderId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Payment verification failed.");
        }

        if (data.status === "SUCCESSFUL") {
            alert("Transaction successful!");
            premiumMessage.textContent =
                "Premium Membership activated successfully!";
            premiumButton.textContent = "Premium Activated";
            premiumButton.disabled = true;

        } else if (data.status === "FAILED") {
            alert("TRANSACTION FAILED");
            premiumMessage.textContent = "Your payment was unsuccessful.";
            premiumButton.disabled = false;
            premiumButton.textContent = "Buy Premium Membership – ₹99";

        } else {
            premiumMessage.textContent =
                "Payment is still pending. Please check again shortly.";
            premiumButton.disabled = false;
            premiumButton.textContent = "Buy Premium Membership – ₹99";
        }

    } catch (error) {
        console.error("Verification error:", error);
        premiumMessage.textContent = error.message;
        premiumButton.disabled = false;
        premiumButton.textContent = "Buy Premium Membership – ₹99";
    }
}

// =========================
// CHECK CASHFREE RETURN
// =========================

const urlParams = new URLSearchParams(window.location.search);
const returnedOrderId = urlParams.get("order_id");
const paymentReturned = urlParams.get("payment_return");

if (returnedOrderId && paymentReturned === "1") {
    premiumForm.style.display = "none";
    verifyPayment(returnedOrderId);

    // Remove payment parameters from browser URL
    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );
}

// =========================
// CREATE ORDER AND OPEN CHECKOUT
// =========================

premiumForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const customerPhone = phoneInput.value.trim();

    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
        premiumMessage.textContent =
            "Enter a valid 10-digit mobile number.";
        return;
    }

    try {
        premiumButton.disabled = true;
        premiumButton.textContent = "Creating payment...";
        premiumMessage.textContent = "";

        const response = await fetch("/api/premium/create-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ customerPhone })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to create payment order."
            );
        }

        // Open Cashfree checkout
        const result = await cashfree.checkout({
            paymentSessionId: data.paymentSessionId,
            redirectTarget: "_self"
        });

        console.log("Cashfree checkout result:", result);

    } catch (error) {
        console.error("Payment error:", error);

        premiumMessage.textContent =
            error.message || "Unable to start payment.";

        premiumButton.disabled = false;
        premiumButton.textContent = "Buy Premium Membership – ₹99";
    }
});
