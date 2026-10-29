
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
    res.json({ message: "PocketProof server is running!" });
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`PocketProof running at http://localhost:${PORT}`);
});
