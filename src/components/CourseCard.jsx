import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";

export default function CourseCard({
  course,
  semesterStatus,
  updateCourse,
  dragPreview = false // true when rendered in CustomDragLayer
}) {
  const canEditGrade = semesterStatus === "previous";
  const ref = useRef(null);

  // Drag
  const [{ isDragging }, drag] = useDrag({
    type: "COURSE",
    item: (monitor) => {
      const rect = ref.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      return {
        id: course.id,
        course,
        width: rect.width,
        height: rect.height,
        grabOffsetX: clientOffset.x - rect.left, // distance from mouse to card left
        grabOffsetY: clientOffset.y - rect.top,  // distance from mouse to card top
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop placeholder (for potential reordering)
  const [, drop] = useDrop({ accept: "COURSE" });
  drag(drop(ref));

  // Update grade/attribute (optimistic UI)
  async function updateField(field, value) {
    updateCourse(course.id, field, value);
    supabase.from("user_courses").update({ [field]: value }).eq("id", course.id);
  }

  // Hide the original card completely when dragging, unless this is the drag preview
  if (isDragging && !dragPreview) return <div style={{ height: ref.current?.offsetHeight || 0 }} />;

  return (
    <div
      ref={ref}
      style={{
        padding: 12,
        borderRadius: 10,                     // rounded corners
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", // shadow
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "grab",
        transition: "transform 0.2s ease, opacity 0.2s ease",
        opacity: dragPreview ? 1 : isDragging ? 0 : 1, // hide original, show preview
      }}
    >
      {/* Drag Handle */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 4px)",
          gap: 3,
          cursor: "grab",
          opacity: 0.6,
        }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
              background: "#6b7280",
              borderRadius: "50%",
            }}
          />
        ))}
      </div>

      {/* Course Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>
          {course.courses.name} ({course.courses.code})
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Credits: {course.courses.credits}
        </div>
      </div>

      {/* Attribute & Grade */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={course.attribute}
          onChange={(e) => updateField("attribute", e.target.value)}
          style={{ padding: 4, borderRadius: 6 }}
        >
          {attributeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
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
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}