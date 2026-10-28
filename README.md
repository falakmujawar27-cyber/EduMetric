# EduMetric — Student Analytics & ID3 Classification Lab

A Node.js, Express, MongoDB and vanilla JavaScript mini-project for student record management and an educational demonstration of the ID3 decision-tree algorithm.

## Theme and interface
- Deep Atlas Navy `#0E1D61`, Ivory `#E8E0D2`, and Gold `#B89A5A`
- Separate Overview, Students, Analytics, and ID3 Classification Lab views
- Interactive charts, student CRUD, CSV bulk import, entropy/information-gain diagnostics, decision-tree visualization, prediction paths, and raw tree JSON
- Student fields: roll number, name, attendance, internal marks, external marks, and assignment marks (marks are currently entered as percentages out of 100)

## Setup
1. Install Node.js LTS and ensure MongoDB Atlas is reachable from your current IP.
2. In this folder, create a `.env` file based on `.env.example`.
3. Set `MONGO_URI` to your own MongoDB connection string and `PORT=5000`.
4. In the terminal, run:
   ```bash
   npm install
   npm run dev
   ```
5. Open `http://localhost:5000`.

## Add students in bulk
On the Students page, choose **CSV template** to download the expected format, fill it with student records, then choose **Import CSV**. The required columns are `rollNumber,name,attendance,internalMarks,externalMarks,assignmentMarks`. Each marks/attendance value must be between 0 and 100. The importer validates the complete file and refuses to import if it contains invalid rows or roll numbers that already exist; it does not overwrite existing records. After a successful import, dashboard data refreshes from MongoDB.

Never commit or share your `.env` file. `.env.example` intentionally contains no credentials.

## API routes
- `GET /api/students` — list records
- `GET /api/students/:id` — fetch one record by MongoDB `_id`
- `POST /api/students` — create record
- `POST /api/students/bulk-import` — validate and import multiple student records
- `PUT /api/students/:id` — update record
- `DELETE /api/students/:id` — delete record
- `GET /api/students/classify` — return ID3 tree, information-gain diagnostics and classified rows

## ID3 demonstration limitation
This project currently creates training labels from predefined thresholds:
- At Risk if attendance is below 75% OR average marks are below 40%
- Performing Well if attendance is at least 75% AND average marks are at least 75%
- Needs Improvement otherwise

The ID3 tree is built from categorical attendance and marks features using those labels. This is useful for demonstrating entropy, information gain, tree construction and prediction paths, but it is **not an independently validated predictive model**. Do not report accuracy, precision, recall or F1 as model performance unless a suitable held-out evaluation dataset and evaluation procedure are implemented.

## Validation
Run `npm test` to perform JavaScript syntax checks.
