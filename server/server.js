const express = require("express");
const cors = require("cors");
const fileRoutes = require("./routes/fileRoutes");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
const uploadRoutes = require("./routes/uploadRoutes");
app.use("/api/uploads", uploadRoutes);



app.get("/", (req, res) => {
  res.send("Secure File Transfer Backend Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
