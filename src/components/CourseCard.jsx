import { getEmptyImage } from "react-dnd-html5-backend";
import { memo, useRef, useEffect } from "react";
import { useDrag, useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";

function CourseCard({
  course,
  semesterStatus,
  isLocked = false,
  updateCourse,
  dragPreview = false,
  deleteCourse,
  isMobile = false,
}) {
  const canEditGrade = semesterStatus === "previous" && !isLocked;
  const canEditAttribute = !isLocked;
  const canDeleteCourse = !isLocked;
  const canDragCourse = !isLocked;
  const ref = useRef(null);
  const compactHeight = isMobile ? 40 : 44;

  const [{ isDragging }, drag, preview] = useDrag({
    type: "COURSE",
    canDrag: canDragCourse,
    item: (monitor) => {
      const rect = ref.current?.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      return {
        id: course.id,
        course,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        grabOffsetX: clientOffset?.x
          ? clientOffset.x - (rect?.left ?? 0)
          : (rect?.width ?? 0) / 2,
        grabOffsetY: clientOffset?.y
          ? clientOffset.y - (rect?.top ?? 0)
          : (rect?.height ?? 0) / 2,
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const [, drop] = useDrop({ accept: "COURSE" });
  drag(drop(ref));

  async function updateField(field, value) {
    updateCourse(course.id, field, value);

    const { error } = await supabase
      .from("user_courses")
      .update({ [field]: value })
      .eq("id", course.id);

    if (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  }

  if (isDragging && !dragPreview && !isMobile) {
    return <div style={{ height: ref.current?.offsetHeight || 0 }} />;
  }

  return (
    <div
      ref={ref}
      style={{
        padding: isMobile ? 10 : 12,
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        gap: 10,
        cursor: isLocked ? "default" : "grab",
        transition: "transform 0.2s ease, opacity 0.2s ease",
        opacity: dragPreview ? 1 : isDragging && !isMobile ? 0 : isDragging && isMobile ? 0.3 : 1,
        touchAction: isMobile ? "pan-y" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: isMobile ? "100%" : "auto",
          flex: 1,
          minWidth: 0,
        }}
      >
        {!isLocked && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 4px)",
              gap: 3,
              cursor: "grab",
              opacity: 0.6,
              padding: 4,
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
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.35 }}>
            {course.courses?.name ?? "Elective Slot"} ({course.courses?.code ?? "ELECTIVE"}{" "}
            {course.courses?.number ?? ""})
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Credits: {course.courses?.credits ?? 0}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: isMobile ? "stretch" : "center",
          width: isMobile ? "100%" : "auto",
          flexDirection: isMobile ? "row" : "row",
          flexWrap: "wrap",
          marginLeft: isMobile ? 0 : "auto",
          justifyContent: isMobile ? "flex-start" : "flex-end",
          flex: isMobile ? "1 1 100%" : "0 0 auto",
        }}
      >
        {isLocked ? (
  <div
    style={{
      padding: isMobile ? "6px 8px" : "8px 10px",
      borderRadius: 6,
      minHeight: compactHeight,
      width: isMobile ? "calc(50% - 4px)" : "auto",
      fontSize: isMobile ? 14 : 16,
      flex: isMobile ? "1 1 calc(50% - 4px)" : "0 1 auto",
      display: "flex",
      alignItems: "center",
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      color: "#374151",
    }}
  >
    {course.attribute}
  </div>
) : (
  <select
    value={course.attribute}
    onChange={(e) => updateField("attribute", e.target.value)}
    onTouchStart={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    style={{
      padding: isMobile ? "6px 8px" : "8px 10px",
      borderRadius: 6,
      minHeight: compactHeight,
      width: isMobile ? "calc(50% - 4px)" : "auto",
      fontSize: isMobile ? 14 : 16,
      flex: isMobile ? "1 1 calc(50% - 4px)" : "0 1 auto",
    }}
  >
    {attributeOptions.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
)}

        {isLocked ? (
  <div
    style={{
      padding: isMobile ? "6px 8px" : "8px 10px",
      borderRadius: 6,
      minHeight: compactHeight,
      width: isMobile ? "calc(50% - 4px)" : 90,
      fontSize: isMobile ? 14 : 16,
      fontWeight: 700,
      flex: isMobile ? "1 1 calc(50% - 4px)" : "0 0 90px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      color: "#111",
    }}
  >
    {course.grade || "No Grade"}
  </div>
) : (
  <select
    value={course.grade || ""}
    onChange={(e) => updateField("grade", e.target.value)}
    onTouchStart={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    disabled={!canEditGrade}
    style={{
      padding: isMobile ? "6px 8px" : "8px 10px",
      borderRadius: 6,
      opacity: canEditGrade ? 1 : 0.5,
      cursor: canEditGrade ? "pointer" : "not-allowed",
      minHeight: compactHeight,
      width: isMobile ? "calc(50% - 4px)" : "auto",
      fontSize: isMobile ? 14 : 16,
      flex: isMobile ? "1 1 calc(50% - 4px)" : "0 1 auto",
    }}
  >
    <option value="">Grade</option>
    {gradeOptions.map((g) => (
      <option key={g} value={g}>
        {g}
      </option>
    ))}
  </select>
)}

        {!isLocked && (
  <button
    onTouchStart={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      if (window.confirm("Delete this course?")) {
        deleteCourse(course.id);
      }
    }}
    style={{
      padding: isMobile ? "8px 12px" : "10px 12px",
      borderRadius: 6,
      border: "1px solid #ef4444",
      background: "#fff",
      color: "#ef4444",
      cursor: "pointer",
      fontSize: 12,
      minHeight: compactHeight,
      width: isMobile ? "100%" : "auto",
      flex: isMobile ? "1 0 100%" : "0 1 auto",
    }}
  >
    Delete
  </button>
)}
      </div>
    </div>
  );
}

export default memo(
  CourseCard,
  (prevProps, nextProps) =>
    prevProps.course === nextProps.course &&
    prevProps.semesterStatus === nextProps.semesterStatus &&
    prevProps.isLocked === nextProps.isLocked &&
    prevProps.dragPreview === nextProps.dragPreview &&
    prevProps.isMobile === nextProps.isMobile,
);
