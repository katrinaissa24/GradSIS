import CourseCard from "./CourseCard";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { useDrop } from "react-dnd";
import { supabase } from "../services/supabase";
import Prerequisite from "../utils/errors";
import { useState, useEffect } from "react";

export default function SemesterCard({
  semester,
  updateStatus,
  updateLoadMode,
  updateLock,
  updateCourse,
  moveCourse,
  userId,
  refresh,
  deleteCourse,
  onSidebarDrop,
  isMobile = false,
  isAddCourseOpen = false,
  onToggleAddCourse,
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [semesterDifficulty, setSemesterDifficulty] = useState(null);
  const [missingRatings, setMissingRatings] = useState(false);

  const loadMode = semester.load_mode || "normal";
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
      shortLabel: "<12",
      targetCredits: 11,
    },
    normal: {
      label: "Normal",
      shortLabel: "12-17",
      targetCredits: 17,
    },
    overload: {
      label: "Overload",
      shortLabel: "18+",
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
    async function calculateDifficulty() {
      if (!semester.user_courses.length) return;

      const courseIds = semester.user_courses.map(c => c.course_id);

      const { data } = await supabase
        .from("course_reviews")
        .select("course_id, difficulty")
        .in("course_id", courseIds);

      let totalWeightedDifficulty = 0;
      let totalCredits = 0;

      let missing = false;

      semester.user_courses.forEach(course => {
        const reviews = data?.filter(r => r.course_id === course.course_id) || [];

        if (reviews.length === 0) {
          missing = true;
          return;
        }

        const avgDifficulty =
          reviews.reduce((sum, r) => sum + r.difficulty, 0) / reviews.length;

        const credits = course.courses?.credits || 3;

        totalWeightedDifficulty += avgDifficulty * credits;
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

      setMissingRatings(missing || data.length === 0);
    }

    calculateDifficulty();
  }, [semester.user_courses]);

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

  const actionButtons = (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        width: "auto",
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => {
          if (isLocked) return;
          setIsEditingSemesterName(true);
        }}
        disabled={isLocked}
        style={{
          padding: compactPadding,
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: isLocked ? "not-allowed" : "pointer",
          opacity: isLocked ? 0.6 : 1,
          fontSize: isMobile ? 12 : 13,
          minHeight: compactHeight,
        }}
      >
        Rename
      </button>
      <button
        onClick={handleDeleteSemester}
        disabled={deletingSemester || semester.status !== "future"}
        style={{
          padding: compactPadding,
          borderRadius: 8,
          border: "none",
          background:
            semester.status === "future" ? "#dc2626" : "#d1d5db",
          color: semester.status === "future" ? "#fff" : "#6b7280",
          cursor:
            semester.status === "future" ? "pointer" : "not-allowed",
          fontSize: isMobile ? 12 : 13,
          opacity: deletingSemester ? 0.7 : 1,
          minHeight: compactHeight,
        }}
      >
        {deletingSemester
          ? "Deleting..."
          : semester.status === "future"
            ? "Delete"
            : "Cannot Delete"}
      </button>
    </div>
  );

  const loadSelector = (
    <div
      style={{
        width: isMobile ? "100%" : "auto",
        minWidth: isMobile ? "100%" : 250,
      }}
    >
      <div
        style={{
          fontSize: isMobile ? 11 : 12,
          fontWeight: 700,
          color: "#6b7280",
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Course Load
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        <select
          value={loadMode}
          onChange={(e) => {
            if (isLocked) return;
            updateLoadMode?.(semester.id, e.target.value);
          }}
          disabled={isLocked}
          style={{
            width: "100%",
            minHeight: isMobile ? 40 : 42,
            padding: isMobile ? "8px 38px 8px 12px" : "10px 40px 10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
            fontSize: isMobile ? 12 : 13,
            fontWeight: 600,
            cursor: isLocked ? "not-allowed" : "pointer",
            opacity: isLocked ? 0.6 : 1,
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
          }}
        >
          {Object.entries(LOAD_CONFIG).map(([mode, config]) => (
            <option key={mode} value={mode}>
              {config.label} ({config.shortLabel})
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            top: "50%",
            right: 14,
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          ▼
        </span>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#6b7280",
          lineHeight: 1.3,
        }}
      >
        {selectedLoad.label}: {selectedLoad.shortLabel} credits
      </div>
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
    if (semester.status !== "future") return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${semester.name}"?`,
    );
    if (!confirmed) return;

    try {
      setDeletingSemester(true);

      await supabase.from("user_courses").delete().eq("semester_id", semester.id);

      const { error } = await supabase
        .from("user_semesters")
        .delete()
        .eq("id", semester.id);

      if (error) throw error;

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
                gap: 10,
                flex: "1 1 320px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                  {semester.name}
                </h3>
                {isMobile && actionButtons}
              </div>
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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                width: isMobile ? "100%" : "auto",
                alignItems: isMobile ? "stretch" : "flex-end",
                flex: isMobile ? "1 1 100%" : "0 0 auto",
              }}
            >
              {!isMobile && actionButtons}
              {loadSelector}
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
          flexDirection: isMobile ? "row" : "row",
          flexWrap: "wrap",
        }}
      >
        <div>
          Total Credits: <b>{credits}</b> / <b>{targetCredits}</b>
        </div>
        <div>
          Load: <b>{selectedLoad.label}</b>
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
    </div>
  );
}
