import { supabase } from "../services/supabase";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";

export default function CourseCard({ course, refresh }) {
  function onDragStart(e) {
    e.dataTransfer.setData("courseId", course.id);
  }

  async function updateField(field, value) {
    await supabase
      .from("user_courses")
      .update({ [field]: value })
      .eq("id", course.id);
    refresh();
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: "#f1f1f1",
        padding: 12,
        borderRadius: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: 14,
        cursor: "grab",
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
          style={{ padding: 4, borderRadius: 6 }}
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