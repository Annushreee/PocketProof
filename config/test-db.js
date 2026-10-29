require("dotenv").config();

const db = require("./db");

async function testConnection() {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS database_name, CURRENT_USER() AS db_user"
        );

        console.log("MySQL connected successfully!");
        console.log(rows[0]);
    } catch (error) {
        console.error("Connection failed:", error.message);
    } finally {
        await db.end();
    }
}

testConnection();