import { supabase } from "../services/supabase";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";

export default function CourseCard({ course, refresh }) {

  function onDragStart(e) {
    e.dataTransfer.setData("courseId", course.id);
  }

  async function updateField(field, value) {
    await supabase
      .from('user_courses')
      .update({ [field]: value })
      .eq('id', course.id);

    refresh();
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: "#1c1c1c",
        padding: 10,
        borderRadius: 8,
        fontSize: 13
      }}
    >
      <div style={{ fontWeight: 600 }}>
        {course.courses.name} ({course.courses.code})
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Credits: {course.courses.credits}
      </div>

      {/* Attribute */}
      <select
        value={course.attribute}
        onChange={(e) => updateField("attribute", e.target.value)}
      >
        {attributeOptions.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      {/* Grade */}
      <select
        value={course.grade || ""}
        onChange={(e) => updateField("grade", e.target.value)}
      >
        <option value="">Grade</option>
        {gradeOptions.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  );
}