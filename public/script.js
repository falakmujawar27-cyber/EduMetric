const API_URL = "/api/students";

let students = [];
let marksChart = null;
let categoryChart = null;
let classificationResults = [];
let classifiedTarget = null;
const targetConfig = {
 category:{label:"Performance Category", classes:["At Risk","Needs Improvement","Performing Well"], features:[["Attendance level","Good / Moderate / Low"],["Overall marks level","High / Medium / Low"]]},
 attendance:{label:"Attendance Status", classes:["Low Attendance","Moderate Attendance","High Attendance"], features:[["Marks level","High / Medium / Low"],["Assignment level","High / Medium / Low"],["Internal marks level","High / Medium / Low"]]},
 internal:{label:"Internal Exam Result", classes:["Fail","Pass","Distinction"], features:[["Attendance level","Good / Moderate / Low"],["External marks level","High / Medium / Low"],["Assignment level","High / Medium / Low"]]},
 external:{label:"External Exam Result", classes:["Fail","Pass","Distinction"], features:[["Attendance level","Good / Moderate / Low"],["Internal marks level","High / Medium / Low"],["Assignment level","High / Medium / Low"]]},
 assignment:{label:"Assignment Status", classes:["Incomplete","Satisfactory","Excellent"], features:[["Attendance level","Good / Moderate / Low"],["Internal marks level","High / Medium / Low"],["External marks level","High / Medium / Low"]]}
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
    initializeIcons();
    updateTargetControls();
    attachEventListeners();
    loadStudents();
    const initialPage = location.hash.replace("#", "");
    if (["dashboard", "students", "analytics", "classification"].includes(initialPage)) navigateTo(initialPage);
});

function initializeIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

function attachEventListeners() {
    document.querySelectorAll(".nav-link[data-page]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            navigateTo(link.dataset.page);
        });
    });
    document.querySelectorAll("[data-go]").forEach(button => {
        button.addEventListener("click", () => navigateTo(button.dataset.go));
    });
    const addAlt = $("addStudentBtnAlt");
    if (addAlt) addAlt.addEventListener("click", openAddModal);

    $("addStudentBtn").addEventListener("click", openAddModal);
    $("closeModalBtn").addEventListener("click", closeModal);
    $("cancelBtn").addEventListener("click", closeModal);
    $("refreshBtn").addEventListener("click", loadStudents);
    $("studentForm").addEventListener("submit", saveStudent);
    if ($("importCsvBtn")) $("importCsvBtn").addEventListener("click", () => $("csvFileInput").click());
    if ($("csvFileInput")) $("csvFileInput").addEventListener("change", importCsvFile);
    if ($("downloadCsvTemplateBtn")) $("downloadCsvTemplateBtn").addEventListener("click", downloadCsvTemplate);
    $("searchInput").addEventListener("input", renderStudents);
    if ($("categoryFilter")) $("categoryFilter").addEventListener("change", renderStudents);
    if ($("exportFilteredBtn")) $("exportFilteredBtn").addEventListener("click", exportFilteredStudents);
    if ($("targetAttribute")) $("targetAttribute").addEventListener("change", () => {
        updateTargetControls();
        runClassification();
    });

 const classificationButton = $("classificationBtn");
 if (classificationButton) {
    classificationButton.addEventListener("click", runClassification);
 }

    $("studentModal").addEventListener("click", (event) => {
        if (event.target === $("studentModal")) {
            closeModal();
        }
    });
}

function navigateTo(page) {
    document.querySelectorAll(".page-view").forEach(view => {
        view.classList.toggle("active", view.dataset.view === page);
    });
    document.querySelectorAll(".nav-link[data-page]").forEach(link => {
        link.classList.toggle("active", link.dataset.page === page);
    });
    const titles = {
        dashboard: "Student Dashboard",
        students: "Student Records",
        analytics: "Academic Analytics",
        classification: "ID3 Classification Lab"
    };
    document.title = `${titles[page] || "EduMetric"} | EduMetric`;
    history.replaceState(null, "", `#${page}`);
    if (page === "classification") runClassification();
    if (page === "analytics") {
        setTimeout(() => { if (marksChart) marksChart.resize(); if (categoryChart) categoryChart.resize(); }, 80);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function runClassification() {
    const button = $("classificationBtn");
    if (button) { button.disabled = true; button.dataset.originalText ||= button.innerHTML; button.innerHTML = '<i data-lucide="loader-circle"></i> Building tree…'; }
    try {
        const selectedTarget = $("targetAttribute")?.value || "category";
        const response = await fetch(`${API_URL}/classify?target=${encodeURIComponent(selectedTarget)}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Classification failed.");
        const rows = result.data || [];
        classificationResults = rows;
        classifiedTarget = selectedTarget;
        updateTargetControls(result.diagnostics);
        $("labRecordCount").textContent = result.totalStudents ?? rows.length;
        $("classificationSummary").textContent = `${rows.length} records classified`;
        $("treeStatus").textContent = rows.length ? "Tree generated" : "No records";
        $("treeRaw").textContent = JSON.stringify(result.decisionTree, null, 2);
        renderDecisionTree(result.decisionTree);
        renderGainAnalysis(result.diagnostics);
        $("classificationTableBody").innerHTML = rows.length ? rows.map(student => `
          <tr>
            <td><span class="roll-number">${escapeHTML(student.rollNumber || "—")}</span></td>
            <td><span class="student-name">${escapeHTML(student.name || "Unnamed")}</span></td>
            <td>${getNumber(student.attendance).toFixed(0)}%</td>
            <td><strong>${getNumber(student.averageMarks).toFixed(1)}%</strong></td>
            <td><span class="performance-badge ${getBadgeClass(student.predictedCategory)}">${escapeHTML(student.predictedCategory || "Unclassified")}</span></td>
            <td class="decision-path">${escapeHTML(student.decisionPath || "No split required")}</td>
          </tr>`).join("") : '<tr><td colspan="6" class="empty-message">No students found. Add records before running ID3.</td></tr>';
        renderStudents();
        initializeIcons();
    } catch (error) {
        console.error("Classification error:", error);
        $("treeStatus").textContent = "Run failed";
        $("decisionTreeView").innerHTML = `<div class="error-message">Unable to build the tree: ${escapeHTML(error.message)}</div>`;
        $("classificationSummary").textContent = "Classification failed";
    } finally {
        if (button) { button.disabled = false; button.innerHTML = button.dataset.originalText || "Build decision tree"; initializeIcons(); }
    }
}

function renderGainAnalysis(diagnostics) {
    const host = $("gainAnalysis");
    if (!host) return;
    if (!diagnostics || !Array.isArray(diagnostics.gains)) {
        host.innerHTML = '<div class="placeholder-state"><p>Information-gain diagnostics are unavailable.</p></div>';
        return;
    }
    const maxGain = Math.max(...diagnostics.gains.map(item => item.gain), 0.000001);
    host.innerHTML = `<div class="entropy-summary"><span>Base entropy</span><strong>${getNumber(diagnostics.baseEntropy).toFixed(4)} bits</strong></div>
      ${diagnostics.gains.map((item, index) => `<div class="gain-row ${index === 0 ? "best-gain" : ""}">
        <div class="gain-row-head"><span>${escapeHTML(item.label)}</span><strong>${getNumber(item.gain).toFixed(4)}</strong></div>
        <div class="gain-track"><span style="width:${Math.max(0, Math.min(100, item.gain / maxGain * 100))}%"></span></div>
        <small>${index === 0 ? "Highest information gain in this split comparison" : "Candidate attribute"}</small>
      </div>`).join("")}`;
}

function renderDecisionTree(tree) {
    const host = $("decisionTreeView");
    if (!host) return;
    if (!tree) {
        host.innerHTML = '<div class="placeholder-state"><i data-lucide="database"></i><p>No tree can be generated from an empty dataset.</p></div>';
        initializeIcons(); return;
    }
    const labelFor = attr => attr === "attendanceLevel" ? "Attendance level" : attr === "marksLevel" ? "Marks level" : attr;
    function nodeMarkup(node, branchLabel = "") {
        if (!node) return "";
        if (node.type === "leaf") {
            const cls = node.category === "At Risk" ? "leaf-risk" : node.category === "Performing Well" ? "leaf-good" : "leaf-mid";
            return `<div class="tree-node-wrap">${branchLabel ? `<span class="branch-label">${escapeHTML(branchLabel)}</span>` : ""}<div class="tree-node tree-leaf ${cls}"><span class="node-kind">PREDICTED CLASS</span><strong>${escapeHTML(node.category)}</strong></div></div>`;
        }
        const children = Object.entries(node.branches || {});
        return `<div class="tree-node-wrap">${branchLabel ? `<span class="branch-label">${escapeHTML(branchLabel)}</span>` : ""}<div class="tree-node tree-split"><span class="node-kind">SPLIT ATTRIBUTE</span><strong>${escapeHTML(labelFor(node.attribute))}</strong></div>${children.length ? `<div class="tree-children">${children.map(([key, child]) => `<div class="tree-child">${nodeMarkup(child, key)}</div>`).join("")}</div>` : ""}</div>`;
    }
    host.innerHTML = `<div class="tree-canvas">${nodeMarkup(tree)}</div>`;
}

// LOAD STUDENTS FROM BACKEND

async function loadStudents() {
    const tbody = $("studentsTableBody");

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-message">
                Loading student records...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.message || "Unable to load students.");
        }

        // Supports both { success, data: [...] } and [...] responses.
        students = Array.isArray(result)
            ? result
            : Array.isArray(result.data)
                ? result.data
                : [];

        updateDashboard();
        renderStudents();
        renderCharts();
        initializeIcons();

    } catch (error) {
        console.error("Error loading students:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="error-message">
                    Could not load student records.
                    Check the server and MongoDB connection, then refresh.
                </td>
            </tr>
        `;

        updateDashboard();
        renderCharts();
    }
}

// DASHBOARD SUMMARY

function updateDashboard() {
    const total = students.length;

    const averageMarks = total
        ? students.reduce((sum, student) => {
            return sum + getAverageMarks(student);
        }, 0) / total
        : 0;

    const averageAttendance = total
        ? students.reduce((sum, student) => {
            return sum + getNumber(student.attendance);
        }, 0) / total
        : 0;

    const atRisk = students.filter(isAtRisk).length;

    $("totalStudents").textContent = total;
    $("averageMarks").innerHTML =
        `${averageMarks.toFixed(1)}<span>%</span>`;

    $("averageAttendance").innerHTML =
        `${averageAttendance.toFixed(1)}<span>%</span>`;

    $("atRiskStudents").textContent = atRisk;
    if ($("studentPageCount")) $("studentPageCount").textContent = total;
    if ($("studentPageAverage")) $("studentPageAverage").innerHTML = `${averageMarks.toFixed(1)}<span>%</span>`;
    if ($("analyticsTotal")) $("analyticsTotal").textContent = total;
    if ($("analyticsRisk")) $("analyticsRisk").textContent = atRisk;
    if ($("overviewInsight")) {
        $("overviewInsight").textContent = total
          ? `${atRisk} of ${total} students currently meet the rule-based at-risk threshold. Cohort average marks are ${averageMarks.toFixed(1)}% and average attendance is ${averageAttendance.toFixed(1)}%.`
          : "No student records are available yet. Add a student to begin exploring the cohort.";
    }
}

// MARKS CALCULATION

function getNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function getAverageMarks(student) {
    const internal = getNumber(student.internalMarks);
    const assignment = getNumber(student.assignmentMarks);
    // Backward-compatible with older records created before externalMarks was added.
    if (student.externalMarks === undefined || student.externalMarks === null || student.externalMarks === "") {
        return (internal + assignment) / 2;
    }
    return (internal + getNumber(student.externalMarks) + assignment) / 3;
}

function isAtRisk(student) {
    return (
        getNumber(student.attendance) < 75 ||
        getAverageMarks(student) < 40
    );
}

function getPerformanceCategory(student) {
    const average = getAverageMarks(student);
    const attendance = getNumber(student.attendance);

    if (attendance < 75 || average < 40) {
        return "At Risk";
    }

    if (average >= 75 && attendance >= 75) {
        return "Performing Well";
    }

    return "Needs Improvement";
}

function getBadgeClass(category) {
    const value = String(category).toLowerCase();

    if (
        value.includes("performing well") ||
        value.includes("excellent") ||
        value.includes("good")
    ) {
        return "good";
    }

    if (
        value.includes("improvement") ||
        value.includes("risk") ||
        value.includes("poor")
    ) {
        return "risk";
    }

    return "average";
}

// DISPLAY STUDENT TABLE

function renderStudents() {
    const tbody = $("studentsTableBody");
    const search = $("searchInput").value.trim().toLowerCase();

    const selectedCategory = $("categoryFilter")?.value || "";
    const resultByRoll = new Map((classifiedTarget === ($("targetAttribute")?.value || "category") ? classificationResults : []).map(r => [String(r.rollNumber).toLowerCase(), r]));
    const filteredStudents = students.filter((student) => {
        const name = String(student.name || "").toLowerCase();
        const roll = String(student.rollNumber || "").toLowerCase();
        const result = resultByRoll.get(roll);
        const matchesSearch = name.includes(search) || roll.includes(search);
        const matchesCategory = !selectedCategory || (result && result.predictedCategory === selectedCategory);
        return matchesSearch && matchesCategory;
    });

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    ${students.length === 0
                        ? "No students found. Click Add Student to begin."
                        : "No matching students found."}
                </td>
            </tr>
        `;

        $("tableCount").textContent = "Showing 0 students";
        return;
    }

    tbody.innerHTML = filteredStudents.map((student) => {
        const id = String(student._id || "");
        const roll = escapeHTML(student.rollNumber || "N/A");
        const name = escapeHTML(student.name || "Unnamed Student");
        const attendance = Math.min(
            100,
            Math.max(0, getNumber(student.attendance))
        );

        const average = getAverageMarks(student);
        const result = resultByRoll.get(String(student.rollNumber || "").toLowerCase());
        const category = result ? result.predictedCategory : "Not classified";
        const badgeClass = getBadgeClass(category);

        return `
            <tr>
                <td>
                    <span class="roll-number">${roll}</span>
                </td>

                <td>
                    <span class="student-name">${name}</span>
                    <span class="student-subtitle">
                        Academic Record
                    </span>
                </td>

                <td>
                    <span class="attendance-value">
                        ${attendance.toFixed(0)}%
                    </span>

                    <div class="progress-track">
                        <div
                            class="progress-fill"
                            style="width: ${attendance}%"
                        ></div>
                    </div>
                </td>

                <td>
                    <strong>${average.toFixed(1)}%</strong>
                </td>

                <td>
                    <span class="performance-badge ${badgeClass}">
                        ${escapeHTML(category)}
                    </span>
                </td>

                <td>
                    <div class="row-actions">
                        <button
                            class="icon-button"
                            title="Edit student"
                            aria-label="Edit ${name}"
                            data-action="edit"
                            data-id="${escapeHTML(id)}"
                        >
                            <i data-lucide="pencil"></i>
                        </button>

                        <button
                            class="icon-button delete"
                            title="Delete student"
                            aria-label="Delete ${name}"
                            data-action="delete"
                            data-id="${escapeHTML(id)}"
                        >
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    const hasRun = classifiedTarget === ($("targetAttribute")?.value || "category");
    $("tableCount").textContent = `${hasRun ? "Showing" : "Run classification to enable category filters · showing"} ${filteredStudents.length} of ${students.length} students`;

    initializeIcons();
}

function updateTargetControls(diagnostics) {
    const key = $("targetAttribute")?.value || "category";
    const config = targetConfig[key] || targetConfig.category;
    const featureHost = $("featureChips");
    if (featureHost) featureHost.innerHTML = config.features.map(([label, values]) => `<div class="feature-chip"><i data-lucide="check-circle-2"></i> ${escapeHTML(label)} <span>${escapeHTML(values)}</span></div>`).join("");
    if ($("featureCount")) $("featureCount").textContent = config.features.length;
    if ($("targetClassCount")) $("targetClassCount").textContent = config.classes.length;
    const filter = $("categoryFilter");
    if (filter) {
        const previous = filter.value;
        filter.innerHTML = `<option value="">All ${escapeHTML(config.label.toLowerCase())} classes</option>` + config.classes.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
        filter.value = config.classes.includes(previous) ? previous : "";
        filter.disabled = classifiedTarget !== key;
        filter.title = filter.disabled ? "Build classification for this target first." : "Filter by the selected target's class.";
    }
    initializeIcons();
}

function getFilteredStudentRows() {
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const category = $("categoryFilter")?.value || "";
    const key = $("targetAttribute")?.value || "category";
    const byRoll = new Map((classifiedTarget === key ? classificationResults : []).map(r => [String(r.rollNumber).toLowerCase(), r]));
    return students.filter(s => {
        const roll = String(s.rollNumber || "");
        const result = byRoll.get(roll.toLowerCase());
        return (String(s.name || "").toLowerCase().includes(search) || roll.toLowerCase().includes(search)) && (!category || result?.predictedCategory === category);
    });
}

function exportFilteredStudents() {
    if (classifiedTarget !== ($("targetAttribute")?.value || "category")) {
        alert("Build classification for the selected target before exporting filtered results.");
        return;
    }
    const key = $("targetAttribute")?.value || "category";
    const config = targetConfig[key] || targetConfig.category;
    const byRoll = new Map(classificationResults.map(r => [String(r.rollNumber).toLowerCase(), r]));
    const rows = getFilteredStudentRows().map(s => {
        const result = byRoll.get(String(s.rollNumber).toLowerCase()) || {};
        return [s.rollNumber,s.name,s.attendance,s.internalMarks,s.externalMarks ?? "",s.assignmentMarks,result.predictedCategory || "",result.decisionPath || ""];
    });
    const header = ["Roll Number","Name","Attendance","Internal Marks","External Marks","Assignment Marks",config.label,"Decision Path"];
    const csv = [header,...rows].map(row=>row.map(value=>`"${String(value ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download=`edumetric-${key}-filtered.csv`; a.click(); URL.revokeObjectURL(url);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

// ADD AND EDIT STUDENTS

function openAddModal() {
    $("studentForm").reset();
    $("studentId").value = "";
    $("modalTitle").textContent = "Add New Student";
    $("saveStudentBtn").textContent = "Save Student";
    $("formMessage").textContent = "";
    $("formMessage").className = "form-message";

    $("studentModal").classList.add("show");
}

function closeModal() {
    $("studentModal").classList.remove("show");
}

function showFormMessage(message, type) {
    $("formMessage").textContent = message;
    $("formMessage").className = `form-message ${type}`;
}

async function saveStudent(event) {
    event.preventDefault();

    const id = $("studentId").value;

    const studentData = {
        rollNumber: $("rollNumber").value.trim(),
        name: $("studentName").value.trim(),
        attendance: Number($("attendance").value),
        internalMarks: Number($("internalMarks").value),
        externalMarks: Number($("externalMarks").value),
        assignmentMarks: Number($("assignmentMarks").value)
    };

    if (
        !studentData.rollNumber ||
        !studentData.name ||
        !Number.isFinite(studentData.attendance) ||
        !Number.isFinite(studentData.internalMarks) ||
        !Number.isFinite(studentData.externalMarks) ||
        !Number.isFinite(studentData.assignmentMarks)
    ) {
        showFormMessage("Please enter valid student details.", "error");
        return;
    }

    if (
        studentData.attendance < 0 ||
        studentData.attendance > 100 ||
        studentData.internalMarks < 0 ||
        studentData.internalMarks > 100 ||
        studentData.externalMarks < 0 ||
        studentData.externalMarks > 100 ||
        studentData.assignmentMarks < 0 ||
        studentData.assignmentMarks > 100
    ) {
        showFormMessage(
            "All percentages and marks must be between 0 and 100.",
            "error"
        );
        return;
    }

    const button = $("saveStudentBtn");
    button.disabled = true;

    try {
        const response = await fetch(
            id ? `${API_URL}/${encodeURIComponent(id)}` : API_URL,
            {
                method: id ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(studentData)
            }
        );

        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || "Unable to save student."
            );
        }

        closeModal();
        await loadStudents();

    } catch (error) {
        console.error("Error saving student:", error);

        showFormMessage(
            error.message || "Could not save student. Please try again.",
            "error"
        );
    } finally {
        button.disabled = false;
    }
}

// BULK CSV IMPORT (expected headers: rollNumber,name,attendance,internalMarks,externalMarks,assignmentMarks)
function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
        else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && text[i + 1] === "\n") i++;
            row.push(field.trim());
            if (row.some(value => value !== "")) rows.push(row);
            row = []; field = "";
        } else field += char;
    }
    row.push(field.trim());
    if (row.some(value => value !== "")) rows.push(row);
    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    if (rows.length < 2) throw new Error("CSV must contain a header row and at least one student.");
    const headers = rows.shift().map(header => header.replace(/^\uFEFF/, "").trim().toLowerCase());
    const aliases = { "roll no": "rollnumber", "roll number": "rollnumber", "student name": "name", "attendance (%)": "attendance", "internal marks (%)": "internalmarks", "external marks (%)": "externalmarks", "assignment marks (%)": "assignmentmarks" };
    const normalized = headers.map(header => aliases[header] || header.replace(/[ _-]/g, ""));
    const required = ["rollnumber", "name", "attendance", "internalmarks", "externalmarks", "assignmentmarks"];
    const missing = required.filter(header => !normalized.includes(header));
    if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(", ")}`);
    return rows.map(values => {
        const record = {};
        normalized.forEach((header, index) => { record[header] = values[index] ?? ""; });
        return { rollNumber: record.rollnumber, name: record.name, attendance: record.attendance, internalMarks: record.internalmarks, externalMarks: record.externalmarks, assignmentMarks: record.assignmentmarks };
    });
}

async function importCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const studentsToImport = parseCSV(await file.text());
        const preview = studentsToImport.slice(0, 5).map(row => `${row.rollNumber} — ${row.name}`).join("\n");
        const proceed = confirm(`Ready to validate ${studentsToImport.length} student rows.\n\nFirst rows:\n${preview}\n\nContinue with import? Existing roll numbers will not be overwritten.`);
        if (!proceed) return;
        const response = await fetch(`${API_URL}/bulk-import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ students: studentsToImport }) });
        const result = await response.json();
        if (!response.ok || !result.success) {
            const detail = Array.isArray(result.errors) ? "\n" + result.errors.slice(0, 8).map(error => `Row ${error.row}: ${error.message}`).join("\n") : "";
            throw new Error((result.message || "Import failed.") + detail);
        }
        alert(result.message);
        await loadStudents();
        navigateTo("students");
    } catch (error) {
        alert(`CSV import failed:\n${error.message}`);
    } finally {
        event.target.value = "";
    }
}

function downloadCsvTemplate() {
    const csv = "rollNumber,name,attendance,internalMarks,externalMarks,assignmentMarks\nTYIT001,Aarav Sharma,85,80,78,88\nTYIT002,Priya Patel,92,88,91,95\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "edumetric_student_template.csv";
    link.click();
    URL.revokeObjectURL(url);
}

// EDIT AND DELETE BUTTONS

$("studentsTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const student = students.find(
        (item) => String(item._id) === id
    );

    if (!student) return;

    if (button.dataset.action === "edit") {
        $("studentForm").reset();
        $("studentId").value = id;
        $("rollNumber").value = student.rollNumber || "";
        $("studentName").value = student.name || "";
        $("attendance").value = getNumber(student.attendance);
        $("internalMarks").value = getNumber(student.internalMarks);
        $("externalMarks").value = student.externalMarks == null ? "" : getNumber(student.externalMarks);
        $("assignmentMarks").value = getNumber(student.assignmentMarks);

        $("modalTitle").textContent = "Edit Student";
        $("saveStudentBtn").textContent = "Update Student";
        $("formMessage").textContent = "";
        $("formMessage").className = "form-message";

        $("studentModal").classList.add("show");
    }

    if (button.dataset.action === "delete") {
        const confirmed = confirm(
            `Are you sure you want to delete ${student.name}?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(id)}`,
                { method: "DELETE" }
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message || "Unable to delete student."
                );
            }

            await loadStudents();

        } catch (error) {
            console.error("Error deleting student:", error);
            alert(error.message || "Could not delete student.");
        }
    }
});

// CHARTS

function renderCharts() {
    if (!window.Chart) {
        console.warn("Chart.js could not load.");
        return;
    }

    const performingWell = students.filter((student) =>
        getPerformanceCategory(student) === "Performing Well"
    ).length;

    const atRisk = students.filter((student) =>
        getPerformanceCategory(student) === "At Risk"
    ).length;

    const needsImprovement = students.filter((student) =>
        getPerformanceCategory(student) === "Needs Improvement"
    ).length;

    if (marksChart) marksChart.destroy();
    if (categoryChart) categoryChart.destroy();

    marksChart = new Chart($("marksChart"), {
        type: "bar",

        data: {
            labels: students.map((student) => {
                return String(student.rollNumber || student.name || "")
                    .slice(0, 12);
            }),

            datasets: [{
                label: "Average Marks (%)",

                data: students.map(getAverageMarks),

                backgroundColor: "rgba(184, 154, 90, 0.82)",
                borderColor: "#B89A5A",
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 38
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    },
                    grid: {
                        color: "#e5dccb"
                    }
                },

                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    categoryChart = new Chart($("categoryChart"), {
        type: "doughnut",

        data: {
            labels: [
                "Performing Well",
                "Needs Improvement",
                "At Risk"
            ],

            datasets: [{
                data: [performingWell, needsImprovement, atRisk],

                backgroundColor: [
                    "#0E1D61",
                    "#B89A5A",
                    "#8C6B5D"
                ],

                borderWidth: 3,
                borderColor: "#F8F6F0",
                hoverOffset: 5
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",

            plugins: {
                legend: {
                    position: "bottom",

                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 17,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}
