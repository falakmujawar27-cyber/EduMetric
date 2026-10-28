const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    attendance: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    internalMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    externalMarks: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    assignmentMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    performanceCategory: {
      type: String,
      enum: ["At Risk", "Needs Improvement", "Performing Well"],
      default: "Needs Improvement",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);