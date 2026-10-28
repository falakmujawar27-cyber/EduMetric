require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const studentRoutes = require("./routes/studentRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Student Analytics API is running!",
  });
});

// Student routes
app.use("/api/students", studentRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas connected successfully!");

    app.listen(process.env.PORT || 5000, () => {
      console.log(
        `Server running at http://localhost:${process.env.PORT || 5000}`
      );
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });