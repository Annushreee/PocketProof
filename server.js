require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./config/db");
const morgan = require("morgan");
const { logger } = require("./config/logger");

const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const reportRoutes = require("./routes/reportRoutes");
const premiumRoutes = require("./routes/premiumRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const { generateAIResponse } = require("./services/geminiService");
const passwordRoutes = require("./routes/passwordRoutes");



const app = express();
// HTTP request logging
app.use(
    morgan("combined", {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/password", passwordRoutes);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 1000
    }
  })
);

// API routes
app.use("/api", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/premium/leaderboard", leaderboardRoutes);
app.use("/api/reports", reportRoutes);

// Root page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Cashfree payment return
app.get("/payment-status", (req, res) => {
  const orderId = req.query.order_id;

  if (!orderId || typeof orderId !== "string") {
    return res.redirect("/premium.html");
  }

  return res.redirect(
    `/premium.html?order_id=${encodeURIComponent(orderId)}&payment_return=1`
  );
});

// Authentication middleware for protected pages
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/signup.html");
  }

  next();
}

//////////////////////////////
// Temporary Gemini connection test
app.get("/api/ai/test", requireLogin, async (req, res) => {
  try {
    const reply = await generateAIResponse(
      "Reply with: Gemini connection successful!"
    );
    logger.info("Gemini connection test successful");
    res.json({
      success: true,
      reply
    });
  } catch (error) {
    logger.error("Gemini connection error", {
    message: error.message,
    stack: error.stack
});

    res.status(500).json({
      success: false,
      message: "Gemini connection failed"
    });
  }
});

// Home page
app.get("/home.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Expenses page
app.get("/expenses.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "expenses.html"));
});

// Income page
app.get("/income.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "income.html"));
});

// Premium page
app.get("/premium.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "premium.html"));
});

// Premium dashboard page
app.get("/premium-dashboard.html", requireLogin, async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT is_premium FROM users WHERE id = ?",
      [req.session.userId]
    );

    if (users.length === 0 || !users[0].is_premium) {
      return res.redirect("/premium.html");
    }

    res.sendFile(
      path.join(__dirname, "public", "premium-dashboard.html")
    );
  } catch (error) {
    logger.error("Dashboard access error", {
    message: error.message,
    stack: error.stack
});
    res.status(500).send("Unable to load dashboard.");
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
// Global error handler
app.use((err, req, res, next) => {
    logger.error("Unhandled application error", {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        message: "Something went wrong. Please try again later."
    });
});

// Start server
async function startServer() {
  try {
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is missing in .env");
    }

    await db.execute("SELECT 1");

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      logger.info(`PocketProof server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Server startup failed", {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

startServer();