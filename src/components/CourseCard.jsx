import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";

export default function CourseCard({ course, semesterStatus, updateCourse, refresh }) {
  const canEditGrade = semesterStatus === "previous";
  const ref = useRef(null);

  // Drag
  const [{ isDragging }, drag] = useDrag({
    type: "COURSE",
    item: { id: course.id, course },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop placeholder (needed if we implement reordering later)
  const [, drop] = useDrop({
    accept: "COURSE",
    hover: (dragged) => {
      if (dragged.id === course.id) return;
    },
  });

  drag(drop(ref));

  async function updateField(field, value) {
    updateCourse(course.id, field, value);
    await supabase
      .from("user_courses")
      .update({ [field]: value })
      .eq("id", course.id);
    refresh();
  }

  return (
    <div
      ref={ref}
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: isDragging ? 0.5 : 1,
        cursor: "grab",
        transition: "transform 0.2s ease",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>
          {course.courses.name} ({course.courses.code})
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Credits: {course.courses.credits}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={course.attribute}
          onChange={(e) => updateField("attribute", e.target.value)}
          style={{ padding: 4, borderRadius: 6 }}
        >
          {attributeOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select
          value={course.grade || ""}
          onChange={(e) => updateField("grade", e.target.value)}
          disabled={!canEditGrade}
          style={{
            padding: 4,
            borderRadius: 6,
            opacity: canEditGrade ? 1 : 0.5,
            cursor: canEditGrade ? "pointer" : "not-allowed",
          }}
        >
          <option value="">Grade</option>
          {gradeOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
    </div>
  );
}