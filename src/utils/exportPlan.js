import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { supabase } from "../services/supabase";

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
      const credits = course.courses?.credits || 3;
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

function buildSemesterTableHtml(sem, difficultyLabelText) {
  const status = sem.status || "future";
  const headerColor = STATUS_COLORS[status] || "#6b7280";
  const courses = sem.user_courses || [];

  const credits = calculateCredits(courses);
  const gpa = calculateSemesterGPA(courses);
  const loadKey = sem.load_mode || "normal";
  const loadLabel = LOAD_LABELS[loadKey] || loadKey;

  const rows = courses
    .map(
      (c) => `
        <tr>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(formatCourseCode(c))}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(c.courses?.name ?? "Elective Slot")}</td>
          <td style="padding:6px 8px; border:1px solid #ddd;">${escapeHtml(c.attribute ?? "")}</td>
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
      <td colspan="4" style="padding:8px 10px; border:1px solid #ddd;">
        ${detailParts.map(escapeHtml).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}
      </td>
    </tr>`;

  return `
    <table style="border-collapse:collapse; width:100%; margin:0 0 22px; font-family:Arial,Helvetica,sans-serif; font-size:12px;">
      <thead>
        <tr>
          <th colspan="4" style="background:${headerColor}; color:#ffffff; padding:10px 12px; text-align:left; font-size:14px; border:1px solid #ddd;">
            ${escapeHtml(sem.name || "Semester")} &nbsp;&middot;&nbsp; ${escapeHtml(capitalize(status))}
          </th>
        </tr>
        <tr style="background:${headerColor}; color:#ffffff;">
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left; width:18%;">Code</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left;">Course Name</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:left; width:22%;">Attribute</th>
          <th style="padding:8px 10px; border:1px solid #ddd; text-align:center; width:10%;">Grade</th>
        </tr>
      </thead>
      <tbody>
        ${rows ||
          `<tr><td colspan="4" style="padding:10px; border:1px solid #ddd; color:#888; text-align:center;">No courses</td></tr>`}
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
      <div class="profile-row"><strong>Name:</strong> ${escapeHtml(profile.name || "—")}</div>
      <div class="profile-row"><strong>Email:</strong> ${escapeHtml(profile.email || "—")}</div>
      <div class="profile-row"><strong>Major:</strong> ${escapeHtml(profile.major || "—")}</div>
      <div class="profile-row"><strong>GPA:</strong> ${escapeHtml(String(profile.gpa ?? "—"))}</div>
      <div class="profile-row"><strong>Credits Completed:</strong> ${escapeHtml(String(profile.creditsCompleted ?? "—"))} / ${escapeHtml(String(profile.totalCredits ?? "—"))}</div>
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

export function exportPlanAsExcel(args) {
  const html = buildExportHTML(args);
  const xmlPrefix =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  // Strip the doctype and outer html tags from generated content so Excel reads
  // the body cleanly inside the office namespaces.
  const stripped = html
    .replace(/^<!doctype html>/i, "")
    .replace(/^<html>/i, "")
    .replace(/<\/html>$/i, "");
  const blob = new Blob([xmlPrefix + stripped + "</html>"], {
    type: "application/vnd.ms-excel",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = (args.planTitle || "GraduationPlan").replace(/[^a-z0-9-_]+/gi, "_");
  a.download = `${safeTitle}_GraduationPlan.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
