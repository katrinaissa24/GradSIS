import CourseCard from "./CourseCard";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { supabase } from "../services/supabase";

export default function SemesterCard({
  semester,
  refresh,
  updateStatus: updateSemesterStatus,
  updateCourse,
}) {
  const gpa = calculateSemesterGPA(semester.user_courses);
  const credits = calculateCredits(semester.user_courses);

  async function updateStatus(newStatus) {
    const previousStatus = semester.status;

    // Optimistic UI for clicked semester
    updateSemesterStatus(semester.id, newStatus);

    try {
      // Fetch all semesters for the user
      const { data: allSemesters, error: fetchError } = await supabase
        .from("user_semesters")
        .select("*")
        .eq("user_id", semester.user_id)
        .order("semester_number", { ascending: true });

      if (fetchError) throw fetchError;

      const clickedIndex = allSemesters.findIndex((s) => s.id === semester.id);

      let updates = allSemesters.map((s, i) => {
        if (newStatus === "present") {
          if (i < clickedIndex) return { ...s, status: "previous" };
          else if (i === clickedIndex) return { ...s, status: "present" };
          else return { ...s, status: "future" };
        } else if (newStatus === "previous") {
          if (i <= clickedIndex) return { ...s, status: "previous" };
          else return { ...s, status: "future" };
        } else if (newStatus === "future") {
          // If all future -> make clicked one present, rest future
          if (allSemesters.every((sem) => sem.status === "future")) {
            if (i < clickedIndex) return { ...s, status: "previous" };
            else if (i === clickedIndex) return { ...s, status: "present" };
            else return { ...s, status: "future" };
          } else {
            // normal future click: keep clicked future, adjust timeline
            if (i < clickedIndex) return { ...s, status: "previous" };
            else if (i === clickedIndex) return { ...s, status: "future" };
            else return { ...s, status: "future" };
          }
        }
      });

      // Ensure exactly one present
      if (!updates.some((s) => s.status === "present")) {
        const nextFuture = updates.find((s) => s.status === "future");
        if (nextFuture)
          updates = updates.map((s) =>
            s.id === nextFuture.id ? { ...s, status: "present" } : s,
          );
      }

      // Update DB
      await Promise.all(
        updates.map((s) =>
          supabase
            .from("user_semesters")
            .update({ status: s.status })
            .eq("id", s.id),
        ),
      );

      // Update local state
      updates.forEach((s) => updateSemesterStatus(s.id, s.status));
    } catch (error) {
      console.error("Error updating status:", error);
      updateSemesterStatus(semester.id, previousStatus);
    }
  }
  async function onDrop(e) {
    const courseId = e.dataTransfer.getData("courseId");
    await supabase
      .from("user_courses")
      .update({ semester_id: semester.id })
      .eq("id", courseId);
    refresh();
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{
        width: "100%",
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        {semester.name}
      </h3>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          padding: "8px 0",
        }}
      >
        {["previous", "present", "future"].map((status) => {
          const colors = {
            previous: { border: "#f97316", bg: "#fff7ed", text: "#f97316" },
            present: { border: "#10b981", bg: "#ecfdf5", text: "#10b981" },
            future: { border: "#2563eb", bg: "#eff6ff", text: "#2563eb" },
          };

          const isActive = semester.status === status;
          const color = colors[status];

          return (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: isActive
                  ? `2px solid ${color.border}`
                  : "1px solid #d1d5db",
                background: isActive ? color.bg : "#fff",
                color: isActive ? color.text : "#6b7280",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s",
              }}
            >
              {status}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {semester.user_courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            refresh={refresh}
            semesterStatus={semester.status}
            updateCourse={updateCourse}
          />
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 14, display: "flex", gap: 12 }}>
        <div>
          Total Credits: <b>{credits}</b>
        </div>
        <div>
          Semester GPA: <b>{gpa}</b>
        </div>
      </div>
    </div>
  );
}
