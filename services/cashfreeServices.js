
const { Cashfree, CFEnvironment } = require("cashfree-pg");

const cashfree = new Cashfree(
    CFEnvironment.SANDBOX,
    process.env.CASHFREE_APP_ID,
    process.env.CASHFREE_SECRET_KEY
);

// Create Cashfree order
exports.createOrder = async (
    orderId,
    orderAmount,
    customerId,
    customerPhone,
    customerEmail
) => {
    try {
        // Set order expiry to 1 hour
        const expiryDate = new Date(Date.now() + 60 * 60 * 1000);
        const formattedExpiryDate = expiryDate.toISOString();

        // Prepare Cashfree order request
        const orderRequest = {
            order_id: orderId,
            order_amount: Number(orderAmount),
            order_currency: "INR",

            customer_details: {
                customer_id: String(customerId),
                customer_phone: customerPhone,
                customer_email: customerEmail
            },

            order_meta: {
                return_url:
                    `${process.env.APP_URL}/payment-status?order_id=${orderId}`,
                payment_methods: "cc,dc,upi"
            },

            order_expiry_time: formattedExpiryDate
        };

        // Create order in Cashfree
        const response = await cashfree.PGCreateOrder(orderRequest);

        console.log("Cashfree order created successfully:", orderId);

        // Return payment session ID for checkout
        return response.data.payment_session_id;

    } catch (error) {
        console.error(
            "Cashfree order creation failed:",
            error.response?.data || error.message
        );

        throw error;
    }
};

// Fetch payment details from Cashfree
exports.fetchPayments = async (orderId) => {
    try {
        const response = await cashfree.PGOrderFetchPayments(orderId);

        console.log("Payment details fetched:", orderId);

        return response.data;
    } catch (error) {
        console.error(
            "Payment verification failed:",
            error.response?.data || error.message
        );

        throw error;
    }
};
