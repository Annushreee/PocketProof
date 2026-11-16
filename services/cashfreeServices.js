
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const logger = require("../config/logger");

// Select Cashfree environment from .env
const cashfreeEnvironment =
    process.env.CASHFREE_ENV === "PRODUCTION"
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;

const cashfree = new Cashfree(
    cashfreeEnvironment,
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
        const expiryDate = new Date(Date.now() + 60 * 60 * 1000);

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
                    `${process.env.APP_URL}/payment-status?order_id=${encodeURIComponent(orderId)}`,
                payment_methods: "cc,dc,upi"
            },

            order_expiry_time: expiryDate.toISOString()
        };

        const response = await cashfree.PGCreateOrder(orderRequest);

        logger.info("Cashfree order created successfully", {
            orderId
        });

        return response.data.payment_session_id;

    } catch (error) {
        logger.error("Cashfree order creation failed", {
            orderId,
            message: error.message
        });

        throw error;
    }
};

// Fetch payment details from Cashfree
exports.fetchPayments = async (orderId) => {
    try {
        const response = await cashfree.PGOrderFetchPayments(orderId);

        logger.info("Cashfree payment details fetched", {
            orderId
        });

        return response.data;

    } catch (error) {
        logger.error("Cashfree payment verification failed", {
            orderId,
            message: error.message
        });

        throw error;
    }
};
