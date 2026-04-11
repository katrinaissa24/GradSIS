import CourseCard from "./CourseCard";
import ConfirmModal from "./ConfirmModal";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import Prerequisite from "../utils/errors";
import { memo, useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";

const STUDENT_STATUS_OPTIONS = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
];

const NO_OVERLOAD_STATUSES = new Set(["freshman", "sophomore"]);

function SemesterCard({
  semester,
  updateStatus,
  updateLoadMode,
  updateLock,
  updateStudentStatus,
  updateCourse,
  moveCourse,
  userId,
  refresh,
  deleteCourse,
  onSidebarDrop,
  isMobile = false,
  isAddCourseOpen = false,
  onToggleAddCourse,
  reviewStatsByCourseId = {},
}) {
  const gpa = calculateSemesterGPA(semester.user_courses);
  const credits = calculateCredits(semester.user_courses);
  const compactHeight = isMobile ? 38 : 44;
  const compactPadding = isMobile ? "8px 10px" : "10px 12px";
  const [isEditingSemesterName, setIsEditingSemesterName] = useState(false);
  const [editedSemesterName, setEditedSemesterName] = useState(
    semester.name || "",
  );
  const [savingSemesterName, setSavingSemesterName] = useState(false);
  const [deletingSemester, setDeletingSemester] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [semesterDifficulty, setSemesterDifficulty] = useState(null);
  const [missingRatings, setMissingRatings] = useState(false);

  const studentStatus = semester.student_status || "";
  const overloadDisabled = NO_OVERLOAD_STATUSES.has(studentStatus);
  const loadModeRaw = semester.load_mode || "normal";
  const loadMode = overloadDisabled && loadModeRaw === "overload" ? "normal" : loadModeRaw;
  const isLocked = !!semester.is_locked;
  const canShowLockButton = semester.status === "previous";

  useEffect(() => {
    if (isLocked && isAddCourseOpen) {
      onToggleAddCourse?.(semester.id, false);
    }
  }, [isLocked, isAddCourseOpen, onToggleAddCourse, semester.id]);

  const LOAD_CONFIG = {
    underload: {
      label: "Underload",
      shortLabel: "≤12",
      targetCredits: 12,
    },
    normal: {
      label: "Normal",
      shortLabel: "13-17",
      targetCredits: 17,
    },
    overload: {
      label: "Overload",
      shortLabel: "≥18",
      targetCredits: 21,
    },
  };

  const selectedLoad = LOAD_CONFIG[loadMode] ?? LOAD_CONFIG.normal;
  const targetCredits = selectedLoad.targetCredits;
  const colors = {
    previous: "#f97316",
    present: "#10b981",
    future: "#2563eb",
  };

  useEffect(() => {
    function calculateDifficulty() {
      if (!semester.user_courses.length) return;

      let totalWeightedDifficulty = 0;
      let totalCredits = 0;
      let missing = false;

      semester.user_courses.forEach((course) => {
        if (!course.course_id) {
          missing = true;
          return;
        }

        const stats = reviewStatsByCourseId[course.course_id];

        if (!stats || stats.avgDifficulty == null) {
          missing = true;
          return;
        }

        const credits =
          (course.credits != null ? Number(course.credits) : null) ||
          course.courses?.credits ||
          3;

        totalWeightedDifficulty += stats.avgDifficulty * credits;
        totalCredits += credits;
      });

      if (!missing && totalCredits > 0) {
        const avgDifficulty = totalWeightedDifficulty / totalCredits;

        const loadFactor = totalCredits / 17;

        const adjustedDifficulty = avgDifficulty * loadFactor;

        setSemesterDifficulty(adjustedDifficulty);
      } else {
        setSemesterDifficulty(null);
      }

      setMissingRatings(missing);
    }

    calculateDifficulty();
  }, [semester.user_courses, reviewStatsByCourseId]);

  const statusButtons = (
    <div
      style={{
        display: isMobile ? "grid" : "flex",
        gap: 8,
        flexWrap: "wrap",
        gridTemplateColumns: isMobile ? "repeat(3, minmax(0, 1fr))" : undefined,
        width: isMobile ? "100%" : "auto",
      }}
    >
      {["previous", "present", "future"].map((status) => {
        const isActive = semester.status === status;
        const color = colors[status];
        return (
          <button
            key={status}
            onClick={() => {
            if (isLocked) return;
            updateStatus(semester.id, status);
            }}
            disabled={isLocked}
            style={{
              padding: compactPadding,
              borderRadius: 6,
              border: isActive ? `2px solid ${color}` : "1px solid #d1d5db",
              background: isActive ? `${color}20` : "#fff",
              color: isActive ? color : "#6b7280",
              fontSize: isMobile ? 12 : 13,
              fontWeight: isActive ? 600 : 400,
              cursor: isLocked ? "not-allowed" : "pointer",
              opacity: isLocked ? 0.6 : 1,
              textTransform: "capitalize",
              transition: "all 0.2s",
              minHeight: compactHeight,
            }}
          >
            {status}
          </button>
        );
      })}
    </div>
  );

  const studentStatusSelect = (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <select
        value={studentStatus}
        onChange={(e) => {
          if (isLocked) return;
          updateStudentStatus?.(semester.id, e.target.value);
        }}
        disabled={isLocked}
        aria-label="Class standing"
        title="Class standing for this semester"
        style={{
          height: compactHeight,
          padding: isMobile ? "0 30px 0 10px" : "0 32px 0 12px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          background: "#fff",
          color: studentStatus ? "#111" : "#6b7280",
          fontSize: isMobile ? 12 : 13,
          fontWeight: 600,
          cursor: isLocked ? "not-allowed" : "pointer",
          opacity: isLocked ? 0.6 : 1,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      >
        <option value="">Class</option>
        {STUDENT_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        style={{
          position: "absolute",
          right: 10,
          pointerEvents: "none",
          color: "#6b7280",
          fontSize: 10,
        }}
      >
        ▼
      </span>
    </div>
  );

  const actionButtons = (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        width: "auto",
        flexShrink: 0,
      }}
    >
      {studentStatusSelect}
      <button
        type="button"
        onClick={() => {
          if (isLocked) return;
          setIsEditingSemesterName(true);
        }}
        disabled={isLocked}
        aria-label="Rename semester"
        title={isLocked ? "Unlock this semester to rename it" : "Rename semester"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: compactHeight,
          minWidth: compactHeight,
          height: compactHeight,
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: isLocked ? "not-allowed" : "pointer",
          opacity: isLocked ? 0.6 : 1,
          color: "#374151",
        }}
      >
        <Pencil size={isMobile ? 15 : 16} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDeleteOpen(true)}
        disabled={deletingSemester}
        aria-label="Delete semester"
        title="Delete semester"
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
          cursor: deletingSemester ? "progress" : "pointer",
          opacity: deletingSemester ? 0.7 : 1,
        }}
      >
        <Trash2 size={isMobile ? 15 : 16} />
      </button>
    </div>
  );

  const [{ isOver }, drop] = useDrop({
    accept: ["COURSE", "SIDEBAR_COURSE"],
    canDrop: () => !isLocked,
    drop: async (item, monitor) => {
      if (isLocked) return;
      const itemType = monitor.getItemType();
      if (itemType === "SIDEBAR_COURSE") {
        onSidebarDrop &&
          onSidebarDrop(
            item.course,
            semester.id,
            item.electiveAttribute,
            Number(targetCredits) || 15,
          );
        setRefreshKey((key) => key + 1);
        return;
      }

      if (item.course.semester_id === semester.id) return;

      moveCourse(item.course.id, item.course.semester_id, semester.id);

      await supabase
        .from("user_courses")
        .update({ semester_id: semester.id })
        .eq("id", item.course.id);
      setRefreshKey((key) => key + 1);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  async function handleRenameSemester() {
    const trimmedName = editedSemesterName.trim();
    if (!trimmedName) return;

    try {
      setSavingSemesterName(true);

      const { error } = await supabase
        .from("user_semesters")
        .update({ name: trimmedName })
        .eq("id", semester.id);

      if (error) throw error;

      setIsEditingSemesterName(false);
      await refresh();
    } catch (err) {
      console.error("Error renaming semester:", err);
    } finally {
      setSavingSemesterName(false);
    }
  }

  async function handleDeleteSemester() {
    try {
      setDeletingSemester(true);

      await supabase.from("user_courses").delete().eq("semester_id", semester.id);

      const { error } = await supabase
        .from("user_semesters")
        .delete()
        .eq("id", semester.id);

      if (error) throw error;

      setConfirmDeleteOpen(false);
      await refresh();
    } catch (err) {
      console.error("Error deleting semester:", err);
    } finally {
      setDeletingSemester(false);
    }
  }

  return (
    <div
      ref={drop}
      style={{
        width: "100%",
        margin: "0 auto",
        background: "#fefefe",
        borderRadius: 12,
        padding: isMobile ? 12 : 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 10 : 12,
        borderLeft: `6px solid ${colors[semester.status]}`,
        transition: "background 0.2s",
        backgroundColor: isOver ? "#f1f5f9" : "#fefefe",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: isMobile ? 8 : 12,
          flexWrap: "wrap",
          flexDirection: "row",
          width: "100%",
        }}
      >
        {isEditingSemesterName ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              flex: 1,
              width: "100%",
            }}
          >
            <input
              type="text"
              value={editedSemesterName}
              onChange={(e) => setEditedSemesterName(e.target.value)}
              style={{
                padding: compactPadding,
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: isMobile ? 15 : 16,
                flex: 1,
                minWidth: isMobile ? "100%" : 220,
                minHeight: compactHeight,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSemester();
                if (e.key === "Escape") {
                  setEditedSemesterName(semester.name || "");
                  setIsEditingSemesterName(false);
                }
              }}
            />
            <button
              onClick={handleRenameSemester}
              disabled={savingSemesterName}
              style={{
                padding: compactPadding,
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                opacity: savingSemesterName ? 0.7 : 1,
                minHeight: compactHeight,
                fontSize: isMobile ? 12 : 13,
              }}
            >
              {savingSemesterName ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditedSemesterName(semester.name || "");
                setIsEditingSemesterName(false);
              }}
              style={{
                padding: compactPadding,
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                minHeight: compactHeight,
                fontSize: isMobile ? 12 : 13,
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: "100%",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                }}
              >
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                    minWidth: 0,
                    flex: "1 1 auto",
                  }}
                >
                  {semester.name}
                </h3>
                <div style={{ flexShrink: 0 }}>{actionButtons}</div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    flex: "1 1 320px",
                    minWidth: 0,
                  }}
                >
                  {statusButtons}

                  {canShowLockButton && (
                    <button
                      type="button"
                      onClick={() => updateLock?.(semester.id, !isLocked)}
                      style={{
                        padding: isMobile ? "6px 10px" : "7px 12px",
                        borderRadius: 8,
                        border: `1px solid ${isLocked ? "#2563eb" : "#111"}`,
                        background: isLocked ? "#2563eb" : "#fff",
                        color: isLocked ? "#fff" : "#111",
                        cursor: "pointer",
                        fontSize: isMobile ? 12 : 13,
                        minHeight: isMobile ? 34 : 36,
                        width: "fit-content",
                      }}
                    >
                      {isLocked ? "Unlock" : "Lock"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          transition: "all 0.2s ease",
        }}
      >
        {semester.user_courses.map((course) => (
          <CourseCard
          key={course.id}
          course={course}
          semesterStatus={semester.status}
          isLocked={isLocked}
          updateCourse={updateCourse}
          deleteCourse={deleteCourse}
          isMobile={isMobile}
        />
        ))}
      </div>

      <div
        style={{
          marginTop: isMobile ? 8 : 12,
          fontSize: isMobile ? 13 : 14,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "center",
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
        }}
      >
        <div>
          Total Credits: <b>{credits}</b> / <b>{targetCredits}</b>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
          }}
        >
          <span style={{ fontWeight: 500 }}>Load:</span>
          <div style={{ position: "relative" }}>
            <select
              value={loadMode}
              onChange={(e) => {
                if (isLocked) return;
                if (overloadDisabled && e.target.value === "overload") return;
                updateLoadMode?.(semester.id, e.target.value);
              }}
              disabled={isLocked}
              aria-label="Course load"
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                padding: "6px 28px 6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111",
                fontSize: isMobile ? 13 : 14,
                fontWeight: 700,
                cursor: isLocked ? "not-allowed" : "pointer",
                opacity: isLocked ? 0.6 : 1,
                minHeight: 34,
              }}
            >
              {Object.entries(LOAD_CONFIG).map(([mode, config]) => {
                const disabled = mode === "overload" && overloadDisabled;
                return (
                  <option
                    key={mode}
                    value={mode}
                    disabled={disabled}
                    title={
                      disabled
                        ? "Freshmen and sophomores cannot overload"
                        : undefined
                    }
                    style={disabled ? { color: "#9ca3af" } : undefined}
                  >
                    {config.label} ({config.shortLabel})
                    {disabled ? " — not allowed" : ""}
                  </option>
                );
              })}
            </select>
            <span
              style={{
                position: "absolute",
                top: "50%",
                right: 10,
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "#6b7280",
                fontSize: 10,
              }}
            >
              ▼
            </span>
          </div>
          {overloadDisabled && (
            <span
              title="Freshmen and sophomores cannot overload"
              aria-label="Freshmen and sophomores cannot overload"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#e5e7eb",
                color: "#6b7280",
                fontSize: 11,
                fontWeight: 700,
                cursor: "help",
              }}
            >
              ?
            </span>
          )}
        </div>
        <div>
          Semester GPA: <b>{gpa}</b>
        </div>
        {semesterDifficulty ? (
          <div>
            Difficulty: <b>
              {semesterDifficulty < 1.5
                ? "🟢 Very Light"
                : semesterDifficulty < 2.5
                ? "🟡 Light"
                : semesterDifficulty < 3.5
                ? "🟠 Moderate"
                : semesterDifficulty < 4.5
                ? "🔴 Hard"
                : "🔥 Very Hard"}
            </b>
          </div>
        ) : null}

      {missingRatings && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          ⚠ Some courses in this semester are not rated yet.
        </div>
      )}

      </div>

      {!isLocked && (
  <button
    type="button"
    onClick={() => {
      onToggleAddCourse?.(semester.id, !isAddCourseOpen);
    }}
    style={{
      marginTop: 8,
      padding: compactPadding,
      borderRadius: 8,
      border: "1px solid #000",
      background: "#fff",
      color: "#000",
      cursor: "pointer",
      fontSize: isMobile ? 12 : 13,
      minHeight: compactHeight,
      width: "auto",
      alignSelf: "flex-start",
    }}
  >
    {isAddCourseOpen ? "Close" : "+ Add Course"}
  </button>
)}

      {isAddCourseOpen && (
        <div style={{ marginTop: 16 }}>
          <Prerequisite
            key={refreshKey}
            userId={userId}
            selectedSemesterId={semester.id}
            onCourseRegistered={refresh}
            courseCount={semester.user_courses.length}
            targetCredits={Number(targetCredits)}
            currentCredits={credits}
            loadMode={loadMode}
          />
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete this semester?"
        message={`This will permanently delete "${semester.name}" and all the courses inside it. This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteSemester}
        busy={deletingSemester}
      />
    </div>
  );
}

export default memo(
  SemesterCard,
  (prevProps, nextProps) =>
    prevProps.semester === nextProps.semester &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.isAddCourseOpen === nextProps.isAddCourseOpen &&
    prevProps.reviewStatsByCourseId === nextProps.reviewStatsByCourseId &&
    prevProps.userId === nextProps.userId,
);
