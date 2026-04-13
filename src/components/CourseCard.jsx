import { getEmptyImage } from "react-dnd-html5-backend";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDrag } from "react-dnd";
import { Trash2 } from "lucide-react";
import { gradeOptions } from "../constants/grades";
import { attributeOptions } from "../constants/attributes";
import { getCourseCredits } from "../constants/gpa";
import { supabase } from "../services/supabase";
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
  const courseCredits = getCourseCredits(course);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attributeWarning, setAttributeWarning] = useState(null);
  const [creditsDraft, setCreditsDraft] = useState(String(courseCredits || 3));

  useEffect(() => {
    setCreditsDraft(String(courseCredits || 3));
  }, [courseCredits]);

  const [{ isDragging }, drag, preview] = useDrag({
    type: "COURSE",
    canDrag: () => canDragCourse && !dragPreview,
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

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.debug("[CourseCard drag]", {
      courseId: course.id,
      isDragging,
      isMobile,
      canDragCourse,
      dragPreview,
    });
  }, [canDragCourse, course.id, dragPreview, isDragging, isMobile]);

  const attachDragRef = useCallback(
    (node) => {
      cardRef.current = node;
      if (!dragPreview && node) {
        drag(node);
      }
    },
    [drag, dragPreview],
  );

  async function updateField(field, value) {
    if (field === "attribute") {
      if (!course.course_id) {
        setAttributeWarning({
          blocked: true,
          message:
            "Elective slot attributes cannot be changed. Delete this slot and add a new one with the correct attribute.",
        });
        return;
      }

      const eligibleAttrs = (course.courses?.course_eligible_attributes || [])
        .map((x) => x.attribute)
        .filter(Boolean);

      if (
        eligibleAttrs.length > 0 &&
        !eligibleAttrs.includes(value) &&
        value !== "Major Course"
      ) {
        setAttributeWarning({
          newValue: value,
          eligible: eligibleAttrs.join(", "),
        });
        return;
      }
    }

    setAttributeWarning(null);
    updateCourse(course.id, field, value);

    const { error } = await supabase
      .from("user_courses")
      .update({ [field]: value })
      .eq("id", course.id);

    if (error) {
      console.error(`Failed to update ${field}:`, error);
    }
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

  const cardBaseStyle = {
    padding: isMobile ? 10 : 12,
    borderRadius: 10,
    background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    display: "flex",
    gap: 10,
    transition: "opacity 0.15s ease",
    opacity: dragPreview ? 1 : isDragging ? 0.2 : 1,
    touchAction: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
    cursor: isLocked ? "default" : isMobile ? "default" : "grab",
  };

  const handleDots = !isLocked ? (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 4px)",
        gap: 3,
        cursor: "grab",
        opacity: 0.4,
        padding: "4px 2px",
        flexShrink: 0,
        marginTop: 2,
      }}
      aria-hidden="true"
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            background: "#9ca3af",
            borderRadius: "50%",
          }}
        />
      ))}
    </div>
  ) : null;

  const nameBlock = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, lineHeight: 1.35, fontSize: isMobile ? 13 : 14 }}>
        {course.courses?.name ?? "Elective Slot"}{" "}
        <span style={{ fontWeight: 400, color: "#6b7280", fontSize: isMobile ? 12 : 13 }}>
          ({course.courses?.code ?? "ELECTIVE"} {course.courses?.number ?? ""})
        </span>
      </div>
    </div>
  );

  const attributeControl = isLocked ? (
    <span
      style={{
        fontSize: 13,
        color: "#6b7280",
        gridColumn: isMobile ? "1 / -1" : "auto",
      }}
    >
      {course.attribute}
    </span>
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
        width: isMobile ? "100%" : 220,
        gridColumn: isMobile ? "1 / -1" : "auto",
      }}
    >
      {attributeOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  const creditsControl = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        justifyContent: isMobile ? "flex-start" : "center",
      }}
    >
      <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
        Credits
      </span>
      {isLocked ? (
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#374151",
            minWidth: 20,
            textAlign: "center",
          }}
        >
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
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
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
  );

  const gradeControl = isLocked ? (
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
        minWidth: isMobile ? 0 : 92,
      }}
    >
      <option value="">Grade</option>
      {gradeOptions.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );

  const deleteControl = !isLocked ? (
    <button
      type="button"
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setConfirmOpen(true);
      }}
      aria-label="Delete course"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: isMobile ? "100%" : compactHeight,
        minWidth: compactHeight,
        height: compactHeight,
        borderRadius: 8,
        border: "none",
        background: "#dc2626",
        color: "#fff",
        cursor: "pointer",
        flexShrink: 0,
        gridColumn: isMobile ? "1 / -1" : "auto",
      }}
    >
      <Trash2 size={15} />
    </button>
  ) : null;

  return (
    <>
      <div
        ref={dragPreview ? null : attachDragRef}
        onMouseDown={() => {
          if (!import.meta.env.DEV || dragPreview) return;
          console.debug("[CourseCard mouseDown]", {
            courseId: course.id,
            target: "card-root",
          });
        }}
        onTouchStart={() => {
          if (!import.meta.env.DEV || dragPreview) return;
          console.debug("[CourseCard touchStart]", {
            courseId: course.id,
            target: "card-root",
          });
        }}
        style={{
          ...cardBaseStyle,
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          border: isDragging ? "1px dashed #93c5fd" : "1px solid transparent",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            width: "100%",
            minWidth: 0,
            flex: isMobile ? "1 1 auto" : 1,
          }}
        >
          {handleDots}
          {nameBlock}
        </div>

        <div
          style={{
            display: isMobile ? "grid" : "flex",
            gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
            gap: 6,
            alignItems: "center",
            alignSelf: isMobile ? "stretch" : "center",
            marginLeft: isMobile ? 0 : "auto",
            width: isMobile ? "100%" : "auto",
            flexShrink: 0,
            flexWrap: "nowrap",
          }}
        >
          {attributeControl}
          {creditsControl}
          {gradeControl}
          {deleteControl}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete this course?"
        message={`This will remove "${course.courses?.name ?? "this course"}" from the semester. This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          deleteCourse(course.id);
        }}
      />

      {attributeWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
              {attributeWarning.blocked ? "🚫 Not Allowed" : "⚠ Attribute Mismatch"}
            </div>

            <p
              style={{
                fontSize: 14,
                color: "#374151",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              {attributeWarning.blocked ? (
                attributeWarning.message
              ) : (
                <>
                  This course is designated as <b>{attributeWarning.eligible}</b> in the
                  system. Changing it to <b>{attributeWarning.newValue}</b> may affect your
                  elective progress tracking.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setAttributeWarning(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {attributeWarning.blocked ? "OK" : "Cancel"}
              </button>

              {!attributeWarning.blocked && (
                <button
                  onClick={async () => {
                    const value = attributeWarning.newValue;
                    setAttributeWarning(null);
                    updateCourse(course.id, "attribute", value);

                    const { error } = await supabase
                      .from("user_courses")
                      .update({ attribute: value })
                      .eq("id", course.id);

                    if (error) {
                      console.error("Failed to update attribute:", error);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#dc2626",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Change Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
