import {
  calculateSemesterGPA,
  calculateCredits,
  getCourseCredits,
} from "../constants/gpa";
import { supabase } from "../services/supabase";
import * as XLSX from "xlsx";

const STATUS_COLORS = {
  previous: "#f97316",
  present: "#10b981",
  future: "#2563eb",
};

const LOAD_LABELS = {
  underload: "Underload",
  normal: "Normal",
  overload: "Overload",
};

function difficultyLabel(value) {
  if (value < 1.5) return "Very Light";
  if (value < 2.5) return "Light";
  if (value < 3.5) return "Moderate";
  if (value < 4.5) return "Hard";
  return "Very Hard";
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[m]);
}

function capitalize(s) {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1);
}

function formatCourseCode(course) {
  const code = course.courses?.code ?? "ELECTIVE";
  const num = course.courses?.number ?? "";
  return `${code} ${num}`.trim();
}

export async function computeSemesterDifficulties(semesters) {
  const allCourseIds = [
    ...new Set(
      semesters.flatMap((s) =>
        (s.user_courses || []).map((c) => c.course_id).filter(Boolean),
      ),
    ),
  ];

  const reviewsByCourseId = {};
  if (allCourseIds.length > 0) {
    const { data: reviews, error } = await supabase
      .from("course_reviews")
      .select("course_id, difficulty")
      .in("course_id", allCourseIds);

    if (!error && reviews) {
      for (const r of reviews) {
        if (!reviewsByCourseId[r.course_id]) reviewsByCourseId[r.course_id] = [];
        reviewsByCourseId[r.course_id].push(r.difficulty);
      }
    }
  }

  const result = {};
  for (const sem of semesters) {
    const courses = sem.user_courses || [];
    if (courses.length === 0) {
      result[sem.id] = null;
      continue;
    }

    let totalWeightedDifficulty = 0;
    let totalCredits = 0;
    let missing = false;

    for (const course of courses) {
      const reviews = reviewsByCourseId[course.course_id] || [];
      if (reviews.length === 0) {
        missing = true;
        break;
      }
      const avg = reviews.reduce((a, b) => a + b, 0) / reviews.length;
      const credits = getCourseCredits(course) || 3;
      totalWeightedDifficulty += avg * credits;
      totalCredits += credits;
    }

    if (!missing && totalCredits > 0) {
      const avgDiff = totalWeightedDifficulty / totalCredits;
      const loadFactor = totalCredits / 17;
      const adjusted = avgDiff * loadFactor;
      result[sem.id] = difficultyLabel(adjusted);
    } else {
      result[sem.id] = null;
    }
  }

  return result;
}

// ────────────────────────── HTML / PDF EXPORT ──────────────────────────

function buildSemesterTableHtml(sem, difficultyLabelText) {
  const status = sem.status || "future";
  const headerColor = STATUS_COLORS[status] || "#6b7280";
  const courses = sem.user_courses || [];
  const studentStatus = sem.student_status ? capitalize(sem.student_status) : "";

  const credits = calculateCredits(courses);
  const gpa = calculateSemesterGPA(courses);
  const loadKey = sem.load_mode || "normal";
  const loadLabel = LOAD_LABELS[loadKey] || loadKey;

  const semTitle = [
    escapeHtml(sem.name || "Semester"),
    capitalize(status),
    studentStatus ? studentStatus : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  const rows = courses
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(formatCourseCode(c))}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(c.courses?.name ?? "Elective Slot")}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(c.attribute ?? "")}</td>
          <td style="padding:6px 8px; border:1px solid #ddd; text-align:center;">${escapeHtml(getCourseCredits(c))}</td>
          <td style="padding:6px 8px; border:1px solid #ddd; text-align:center;">${escapeHtml(c.grade ?? "")}</td>
        </tr>`,
    )
    .join("");

  const detailParts = [
    `Total Credits: ${credits}`,
    `Load: ${loadLabel}`,
    `Semester GPA: ${gpa}`,
  ];
  if (difficultyLabelText) {
    detailParts.push(`Difficulty: ${difficultyLabelText}`);
  }

  const detailsRow = `
    <tr style="background:${headerColor}; color:#ffffff; font-weight:600;">
      <td colspan="5" style="padding:8px 10px; border:1px solid #ddd;">
        ${detailParts.map(escapeHtml).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}
      </td>
    </tr>`;

  return `
    <table style="border-collapse:collapse; width:100%; margin:0 0 22px; font-family:Arial,Helvetica,sans-serif; font-size:12px;">
      <thead>
        <tr>
          <th colspan="5" style="background:${headerColor}; color:#ffffff; padding:10px 12px; text-align:left; font-size:14px; border:1px solid #ddd;">
            ${semTitle}
          </th>
        </tr>
        <tr style="background:${headerColor}; color:#ffffff;">
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left; width:16%;">Code</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left;">Course Name</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left; width:22%;">Attribute</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:center; width:9%;">Credits</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:center; width:9%;">Grade</th>
        </tr>
      </thead>
      <tbody>
        ${rows ||
          `<tr><td colspan="5" style="padding:10px; border:1px solid #ddd; color:#888; text-align:center;">No courses</td></tr>`}
        ${detailsRow}
      </tbody>
    </table>`;
}

export function buildExportHTML({
  planTitle,
  profile,
  semesters,
  semesterDifficulties = {},
}) {
  const tables = semesters
    .map((sem) => buildSemesterTableHtml(sem, semesterDifficulties[sem.id]))
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(planTitle)} - Graduation Plan</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #111; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 18px; }
      .profile { margin-bottom: 24px; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
      .profile-row { font-size: 13px; margin: 4px 0; }
      .profile-row strong { display: inline-block; min-width: 130px; }
      @media print {
        body { padding: 16px; }
        .profile { background: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        table { page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        th, td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <h1>Graduation Plan &mdash; ${escapeHtml(planTitle)}</h1>
    <div class="subtitle">Generated from GradSIS</div>
    <div class="profile">
      <div class="profile-row"><strong>Name:</strong> ${escapeHtml(profile.name || "\u2014")}</div>
      <div class="profile-row"><strong>Email:</strong> ${escapeHtml(profile.email || "\u2014")}</div>
      <div class="profile-row"><strong>Major:</strong> ${escapeHtml(profile.major || "\u2014")}</div>
      <div class="profile-row"><strong>GPA:</strong> ${escapeHtml(String(profile.gpa ?? "\u2014"))}</div>
      <div class="profile-row"><strong>Credits Completed:</strong> ${escapeHtml(String(profile.creditsCompleted ?? "\u2014"))} / ${escapeHtml(String(profile.totalCredits ?? "\u2014"))}</div>
    </div>
    ${tables}
  </body>
</html>`;
}

export function exportPlanAsPDF(args) {
  const html = buildExportHTML(args);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups for this site to export your plan as PDF.");
    return;
  }

  const htmlWithAutoPrint = html.replace(
    "</body>",
    `<script>
      window.addEventListener("load", function () {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 250);
      });
    </script></body>`,
  );

  win.document.open();
  win.document.write(htmlWithAutoPrint);
  win.document.close();
}

// ────────────────────────── EXCEL EXPORT (SheetJS) ──────────────────────────

export function exportPlanAsExcel({
  planTitle,
  profile,
  semesters,
  semesterDifficulties = {},
}) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  // ── Profile header rows ──
  rows.push(["Graduation Plan", planTitle || "Graduation Plan"]);
  rows.push(["Generated from GradSIS"]);
  rows.push([]);
  rows.push(["Name", profile.name || "\u2014"]);
  rows.push(["Email", profile.email || "\u2014"]);
  rows.push(["Major", profile.major || "\u2014"]);
  rows.push(["GPA", String(profile.gpa ?? "\u2014")]);
  rows.push([
    "Credits Completed",
    `${profile.creditsCompleted ?? "\u2014"} / ${profile.totalCredits ?? "\u2014"}`,
  ]);
  rows.push([]);

  // ── Semester tables ──
  for (const sem of semesters) {
    const status = sem.status || "future";
    const studentStatus = sem.student_status ? capitalize(sem.student_status) : "";
    const courses = sem.user_courses || [];
    const credits = calculateCredits(courses);
    const gpa = calculateSemesterGPA(courses);
    const loadKey = sem.load_mode || "normal";
    const loadLabel = LOAD_LABELS[loadKey] || loadKey;
    const difficulty = semesterDifficulties[sem.id] || "";

    // Semester title row
    const titleParts = [
      sem.name || "Semester",
      capitalize(status),
      studentStatus || null,
    ]
      .filter(Boolean)
      .join(" \u00B7 ");
    rows.push([titleParts]);

    // Column headers
    rows.push(["Code", "Course Name", "Attribute", "Credits", "Grade"]);

    // Course rows
    if (courses.length === 0) {
      rows.push(["", "No courses", "", "", ""]);
    } else {
      for (const c of courses) {
        rows.push([
          formatCourseCode(c),
          c.courses?.name ?? "Elective Slot",
          c.attribute ?? "",
          getCourseCredits(c),
          c.grade ?? "",
        ]);
      }
    }

    // Summary row
    const summaryParts = [`Total Credits: ${credits}`, `Load: ${loadLabel}`, `GPA: ${gpa}`];
    if (difficulty) summaryParts.push(`Difficulty: ${difficulty}`);
    rows.push([summaryParts.join("  |  ")]);

    // Blank row between semesters
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set reasonable column widths
  ws["!cols"] = [
    { wch: 16 }, // Code
    { wch: 36 }, // Course Name
    { wch: 22 }, // Attribute
    { wch: 10 }, // Credits
    { wch: 10 }, // Grade
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Graduation Plan");

  const safeTitle = (planTitle || "GraduationPlan").replace(/[^a-z0-9-_]+/gi, "_");
  XLSX.writeFile(wb, `${safeTitle}_GraduationPlan.xlsx`);
}
