import CourseCard from "./CourseCard";
import { calculateSemesterGPA, calculateCredits } from "../constants/gpa";
import { useDrop, useDragLayer } from "react-dnd";
import { supabase } from "../services/supabase";
import Prerequisite from "../utils/errors";
import { useState } from "react";

export default function SemesterCard({
  semester,
  updateStatus,
  updateCourse,
  moveCourse,
  userId,
  refresh,
  deleteCourse,
  onSidebarDrop,
}) {
  const gpa = calculateSemesterGPA(semester.user_courses);
  const credits = calculateCredits(semester.user_courses);
  const [showAddCourses, setShowAddCourses] = useState(false);
  const [isEditingSemesterName, setIsEditingSemesterName] = useState(false);
  const [editedSemesterName, setEditedSemesterName] = useState(
    semester.name || "",
  );
  const [savingSemesterName, setSavingSemesterName] = useState(false);
  const [deletingSemester, setDeletingSemester] = useState(false);
  const [loadMode, setLoadMode] = useState(semester.load_mode || "normal");
  const [savingLoadPrefs, setSavingLoadPrefs] = useState(false);

  const LOAD_LIMITS = { underload: 11, normal: 17, overload: 21 };
  const targetCredits = LOAD_LIMITS[loadMode] ?? 17;

  const { isDraggingAny } = useDragLayer((monitor) => ({
    isDraggingAny: monitor.isDragging(),
  }));

  const [{ isOver }, drop] = useDrop({
    accept: ["COURSE", "SIDEBAR_COURSE"],
    drop: async (item, monitor) => {
      const itemType = monitor.getItemType();
      if (itemType === "SIDEBAR_COURSE") {
        onSidebarDrop &&
          onSidebarDrop(
            item.course,
            semester.id,
            item.electiveAttribute,
            Number(targetCredits) || 15,
          );
        return;
      }
      if (item.course.semester_id === semester.id) return;

      moveCourse(item.course.id, item.course.semester_id, semester.id);

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

  async function saveSemesterLoadPreferences() {
    try {
      setSavingLoadPrefs(true);

      const { error } = await supabase
        .from("user_semesters")
        .update({
          load_mode: loadMode,
          target_credits: targetCredits,
        })
        .eq("id", semester.id);

      if (error) throw error;

      await refresh(true);
    } catch (err) {
      console.error("Error saving semester load preferences:", err);
    } finally {
      setSavingLoadPrefs(false);
    }
  }

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

      await supabase
        .from("user_courses")
        .delete()
        .eq("semester_id", semester.id);

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
        width: "80%",
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
      {/* ── Header: name + rename/delete ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
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
            }}
          >
            <input
              type="text"
              value={editedSemesterName}
              onChange={(e) => setEditedSemesterName(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
                flex: 1,
                minWidth: 220,
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
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                opacity: savingSemesterName ? 0.7 : 1,
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
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {semester.name}
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setIsEditingSemesterName(true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Rename
              </button>
              <button
                onClick={handleDeleteSemester}
                disabled={deletingSemester || semester.status !== "future"}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    semester.status === "future" ? "#dc2626" : "#d1d5db",
                  color: semester.status === "future" ? "#fff" : "#6b7280",
                  cursor:
                    semester.status === "future" ? "pointer" : "not-allowed",
                  fontSize: 13,
                  opacity: deletingSemester ? 0.7 : 1,
                }}
              >
                {deletingSemester
                  ? "Deleting..."
                  : semester.status === "future"
                    ? "Delete"
                    : "Cannot Delete"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Status buttons ── */}
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

      {/* ── Load preference ── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
          padding: "10px 12px",
          border: "1px solid #eee",
          borderRadius: 10,
          background: "#fafafa",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Load</span>

        <select
          value={loadMode}
          onChange={(e) => {
            setLoadMode(e.target.value);
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="underload">Underload (≤ 11 cr)</option>
          <option value="normal">Normal (12 – 17 cr)</option>
          <option value="overload">Overload (≥ 18 cr)</option>
        </select>

        <button
          onClick={saveSemesterLoadPreferences}
          disabled={savingLoadPrefs}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            opacity: savingLoadPrefs ? 0.7 : 1,
          }}
        >
          {savingLoadPrefs ? "Saving..." : "Save"}
        </button>
      </div>

      {/* ── Course list ── */}
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
            updateCourse={updateCourse}
            deleteCourse={deleteCourse}
          />
        ))}
      </div>

      {/* ── Footer stats ── */}
      <div
        style={{
          marginTop: 12,
          fontSize: 14,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div>
          Total Credits: <b>{credits}</b> / <b>{targetCredits}</b>
        </div>
        <div>
          Semester GPA: <b>{gpa}</b>
        </div>
      </div>

      {/* ── Add course toggle ── */}
      <button
        type="button"
        onClick={() => setShowAddCourses((prev) => !prev)}
        style={{
          marginTop: 10,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #000",
          background: "#fff",
          color: "#000",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {showAddCourses ? "Close" : "+ Add Course"}
      </button>

      {showAddCourses && (
        <div key={semester.user_courses.length} style={{ marginTop: 16 }}>
          <Prerequisite
            key={semester.user_courses.length}
            userId={userId}
            selectedSemesterId={semester.id}
            onCourseRegistered={refresh}
            courseCount={semester.user_courses.length}
            targetCredits={Number(targetCredits)}
          />
        </div>
      )}
    </div>
  );
}
