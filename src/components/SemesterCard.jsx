import CourseCard from "./CourseCard";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { supabase } from "../services/supabase";

export default function SemesterCard({ semester, refresh }) {
  const gpa = calculateSemesterGPA(semester.user_courses);
  const credits = calculateCredits(semester.user_courses);

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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {semester.user_courses.map((course) => (
          <CourseCard key={course.id} course={course} refresh={refresh} />
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 14, display: "flex", gap: 12 }}>
        <div>Total Credits: <b>{credits}</b></div>
        <div>Semester GPA: <b>{gpa}</b></div>
      </div>
    </div>
  );
}