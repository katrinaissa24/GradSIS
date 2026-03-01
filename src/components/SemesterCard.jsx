import CourseCard from "./CourseCard";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import Prerequisite from "../utils/errors";
import { useState } from "react";

export default function SemesterCard({ semester, updateStatus, updateCourse, moveCourse,userId, refresh,deleteCourse}) {
  const gpa = calculateSemesterGPA(semester.user_courses);
  const credits = calculateCredits(semester.user_courses);
const [showAddCourses, setShowAddCourses] = useState(false);
  // Drop zone for courses
  const [{ isOver }, drop] = useDrop({
    accept: "COURSE",
    drop: async (item) => {
      if (item.course.semester_id === semester.id) return; // ignore same semester

      // Update local state in Dashboard
      moveCourse(item.course.id, item.course.semester_id, semester.id);

      // Update backend
      await supabase
        .from("user_courses")
        .update({ semester_id: semester.id })
        .eq("id", item.course.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const colors = {
    previous: "#f97316",
    present: "#10b981",
    future: "#2563eb",
  };

  return (
    <div
      ref={drop}
      style={{
        width: "60%",
        margin: "0 auto",
        background: "#fefefe",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderLeft: `6px solid ${colors[semester.status]}`,
        transition: "background 0.2s",
        backgroundColor: isOver ? "#f1f5f9" : "#fefefe",
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        {semester.name}
      </h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["previous", "present", "future"].map((status) => {
          const isActive = semester.status === status;
          const color = colors[status];
          return (
            <button
              key={status}
              onClick={() => updateStatus(semester.id, status)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: isActive ? `2px solid ${color}` : "1px solid #d1d5db",
                background: isActive ? `${color}20` : "#fff",
                color: isActive ? color : "#6b7280",
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, transition: "all 0.2s ease" }}>
        {semester.user_courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            semesterStatus={semester.status}
            updateCourse={updateCourse}
            deleteCourse={deleteCourse}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 14,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div>Total Credits: <b>{credits}</b></div>
        <div>Semester GPA: <b>{gpa}</b></div>
      </div>{/* ADD COURSE BUTTON */}
<button
  onClick={() => setShowAddCourses(prev => !prev)}
  style={{
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  }}
>
  {showAddCourses ? "Close" : "+ Add Course"}
</button>

{/* SHOW COURSE SELECTOR */}
{showAddCourses && (
  <div style={{ marginTop: 16 }}>
    <Prerequisite
      userId={userId}
      selectedSemesterId={semester.id}
      onCourseRegistered={refresh}
    />
  </div>
)}
    </div>
  );
}async function deleteCourse(courseId) {
  await supabase
    .from("user_courses")
    .delete()
    .eq("id", courseId);

  initialize(); // refresh data
}