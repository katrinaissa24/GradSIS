import { getEmptyImage } from "react-dnd-html5-backend";
import { memo, useCallback, useRef, useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { Trash2 } from "lucide-react";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";
import { getCourseCredits } from "../constants/gpa";
import ConfirmModal from "./ConfirmModal";

export default function CourseCard({
  course,
  semesterStatus,
  isLocked = false,
  updateCourse,
  dragPreview = false,
  deleteCourse,
  isMobile = false,
}) {
  const canEditGrade = semesterStatus === "previous" && !isLocked;
  const canDragCourse = !isLocked;
  const cardRef = useRef(null);
  const compactHeight = isMobile ? 40 : 44;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const courseCredits = getCourseCredits(course);
  const [creditsDraft, setCreditsDraft] = useState(String(courseCredits || 3));

  useEffect(() => {
    setCreditsDraft(String(courseCredits || 3));
  }, [courseCredits]);

  const [{ isDragging }, drag, preview] = useDrag({
    type: "COURSE",
    canDrag: canDragCourse && !dragPreview,
    item: (monitor) => {
      const rect = cardRef.current?.getBoundingClientRect();
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

  // Callback ref pattern matches PrerequisiteSidebar's working drag setup —
  // attaches the connectors reliably whenever the DOM node mounts/changes.
  const attachDragRef = (node) => {
    ref.current = node;
    if (!dragPreview && node) {
      drag(drop(node));
    }
  };

  async function updateField(field, value) {
    updateCourse(course.id, field, value);
    const { error } = await supabase
      .from("user_courses")
      .update({ [field]: value })
      .eq("id", course.id);
    if (error) console.error(`Failed to update ${field}:`, error);
  }

  function commitCredits() {
    let parsed = parseFloat(creditsDraft);

    if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;
    if (parsed > 12) parsed = 12;

    if (parsed === courseCredits) {
      setCreditsDraft(String(courseCredits));
      return;
    }

    setCreditsDraft(String(parsed));
    updateField("credits", parsed);
  }

  const showAsHidden = isDragging && !dragPreview && !isMobile;

  return (
    <>
      <div
        ref={dragPreview ? null : attachDragRef}
        style={{
          padding: isMobile ? 10 : 12,
          borderRadius: 10,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          display: "flex",
          alignItems: "center",
          flexDirection: "row",
          gap: 10,
          cursor: isLocked ? "default" : isMobile ? "default" : "grab",
          transition: "opacity 0.15s ease",
          opacity: dragPreview ? 1 : showAsHidden ? 0 : isDragging && isMobile ? 0.3 : 1,
          visibility: showAsHidden ? "hidden" : "visible",
          touchAction: isMobile ? "pan-y" : "none",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        {/* Drag handle */}
        {!isLocked && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 4px)",
              gap: 3,
              cursor: "grab",
              opacity: 0.4,
              padding: "4px 2px",
              flexShrink: 0,
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{ width: 4, height: 4, background: "#9ca3af", borderRadius: "50%" }}
              />
            ))}
          </div>
        )}

        {/* Course name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.35, fontSize: isMobile ? 13 : 14 }}>
            {course.courses?.name ?? "Elective Slot"}{" "}
            <span style={{ fontWeight: 400, color: "#6b7280", fontSize: isMobile ? 12 : 13 }}>
              ({course.courses?.code ?? "ELECTIVE"} {course.courses?.number ?? ""})
            </span>
          </div>
        </div>

        {/* Right-side controls */}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexShrink: 0,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          {/* Attribute */}
          {isLocked ? (
            <span style={{ fontSize: 13, color: "#6b7280" }}>{course.attribute}</span>
          ) : (
            <select
              value={course.attribute}
              onChange={(e) => updateField("attribute", e.target.value)}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                fontSize: 13,
                border: "1px solid #d1d5db",
                background: "#fff",
                minHeight: compactHeight,
              }}
            >
              {attributeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {/* Credits */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
              Credits
            </span>

            {isLocked ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 20, textAlign: "center" }}>
                {courseCredits}
              </span>
            ) : (
              <input
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={creditsDraft}
                onChange={(e) => setCreditsDraft(e.target.value)}
                onBlur={commitCredits}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Credits"
                style={{
                  width: 52,
                  padding: "6px 4px",
                  borderRadius: 6,
                  fontSize: 14,
                  textAlign: "center",
                  border: "1px solid #d1d5db",
                  minHeight: compactHeight,
                }}
              />
            )}
          </div>

          {/* Grade */}
          {isLocked ? (
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: course.grade ? "#111" : "#9ca3af",
                minWidth: 48,
                textAlign: "center",
              }}
            >
              {course.grade || "—"}
            </span>
          ) : (
            <select
              value={course.grade || ""}
              onChange={(e) => updateField("grade", e.target.value)}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={!canEditGrade}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                opacity: canEditGrade ? 1 : 0.5,
                cursor: canEditGrade ? "pointer" : "not-allowed",
                minHeight: compactHeight,
                fontSize: 14,
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Grade</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          {/* Delete */}
          {!isLocked && (
            <button
              type="button"
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
              aria-label="Delete course"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: compactHeight,
                minWidth: compactHeight,
                height: compactHeight,
                borderRadius: 8,
                border: "none",
                background: "#dc2626",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete this course?"
        message={`This will remove "${course.courses?.name ?? "this course"}" from the semester. This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); deleteCourse(course.id); }}
      />
    </>
  );
}
