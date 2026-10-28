const express = require("express");
const Student = require("../models/Student");
const { classifyStudents, TARGETS } = require("../utils/id3");

const router = express.Router();

// GET all students
router.get("/", async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ID3 Classification Endpoint
router.get("/classify", async (req, res) => {
    try {
        const students = await Student.find();
        const target = String(req.query.target || "category");
        if (!TARGETS[target]) return res.status(400).json({ success: false, message: "Unknown classification target." });
        const { tree, results, diagnostics } = classifyStudents(students, target);
        res.status(200).json({ success: true, algorithm: "ID3 Decision Tree", target, targetLabel: TARGETS[target].label, totalStudents: results.length, decisionTree: tree, diagnostics, data: results });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// Bulk import validated student rows from a CSV parsed by the frontend.
router.post("/bulk-import", async (req, res) => {
  try {
    const rows = req.body?.students;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "Upload a CSV containing at least one student row." });
    }
    if (rows.length > 2000) {
      return res.status(400).json({ success: false, message: "Import is limited to 2,000 rows at a time." });
    }

    const valid = [];
    const errors = [];
    const seenRolls = new Set();
    rows.forEach((row, index) => {
      const line = index + 2;
      const rollNumber = String(row.rollNumber ?? "").trim();
      const name = String(row.name ?? "").trim();
      const attendance = Number(row.attendance);
      const internalMarks = Number(row.internalMarks);
      const externalRaw = row.externalMarks;
      const externalMarks = externalRaw === undefined || externalRaw === null || String(externalRaw).trim() === "" ? null : Number(externalRaw);
      const assignmentMarks = Number(row.assignmentMarks);
      const requiredNumbers = [attendance, internalMarks, assignmentMarks];
      if (!rollNumber || !name || requiredNumbers.some(value => !Number.isFinite(value))) {
        errors.push({ row: line, message: "Missing roll number/name or invalid required numeric value." }); return;
      }
      if ([attendance, internalMarks, assignmentMarks, ...(externalMarks === null ? [] : [externalMarks])].some(value => value < 0 || value > 100) || (externalMarks !== null && !Number.isFinite(externalMarks))) {
        errors.push({ row: line, message: "Attendance and marks must be between 0 and 100." }); return;
      }
      const normalizedRoll = rollNumber.toLowerCase();
      if (seenRolls.has(normalizedRoll)) { errors.push({ row: line, message: `Duplicate roll number in file: ${rollNumber}.` }); return; }
      seenRolls.add(normalizedRoll);
      valid.push({ rollNumber, name, attendance, internalMarks, externalMarks, assignmentMarks });
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: "Fix the listed CSV rows and upload again. No records were imported.", errors });
    }

    const existingRolls = await Student.find({ rollNumber: { $in: valid.map(row => row.rollNumber) } }).select("rollNumber").lean();
    if (existingRolls.length) {
      return res.status(409).json({ success: false, message: "Some roll numbers already exist. No records were imported.", errors: existingRolls.map(row => ({ row: "database", message: `Roll number already exists: ${row.rollNumber}.` })) });
    }

    const imported = await Student.insertMany(valid, { ordered: true });
    return res.status(201).json({ success: true, message: `${imported.length} students imported successfully.`, importedCount: imported.length });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// GET student by ID
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// ADD a student
router.post("/", async (req, res) => {
  try {
    const student = await Student.create(req.body);

    res.status(201).json({
      success: true,
      message: "Student added successfully",
      data: student,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// UPDATE a student
router.put("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: student,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// DELETE a student
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Classify all students

module.exports = router;