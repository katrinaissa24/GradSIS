import React, { useState, useMemo } from "react";
import { useDrag } from "react-dnd";

export default function PrerequisiteSidebar({ courses = [], enrolledCourseIds = new Set() }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.code?.toLowerCase().includes(search.toLowerCase()) ||
        c.name?.toLowerCase().includes(search.toLowerCase());
      const isEnrolled = enrolledCourseIds.has(c.id);
      const matchesFilter =
        filter === "all" ||
        (filter === "enrolled" && isEnrolled) ||
        (filter === "available" && !isEnrolled);
      return matchesSearch && matchesFilter;
    });
  }, [courses, search, filter, enrolledCourseIds]);

  const enrolledCount = courses.filter((c) => enrolledCourseIds.has(c.id)).length;
  const availableCount = courses.length - enrolledCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Search */}
      <div style={{ padding: "10px 14px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#f8f8f8", border: "1px solid #e5e7eb",
          borderRadius: 8, padding: "7px 10px",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            style={{
              border: "none", background: "transparent", outline: "none",
              fontSize: 12, color: "#111", width: "100%",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 14px 6px" }}>
        {[
          { key: "all", label: `All (${courses.length})` },
          { key: "available", label: `Open (${availableCount})` },
          { key: "enrolled", label: `Added (${enrolledCount})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            flex: 1, padding: "5px 4px", fontSize: 10,
            fontWeight: filter === key ? 700 : 400,
            borderRadius: 6,
            border: filter === key ? "1.5px solid #111" : "1px solid #e5e7eb",
            background: filter === key ? "#111" : "#fff",
            color: filter === key ? "#fff" : "#6b7280",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em",
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: "#f1f5f9", margin: "0 14px 8px" }} />

      {/* Drag hint */}
      <div style={{
        margin: "0 14px 8px", padding: "6px 10px",
        background: "#f0fdf4", border: "1px solid #d1fae5",
        borderRadius: 7, fontSize: 10, color: "#059669",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>↕</span>
        Drag any card onto a semester
      </div>

      {/* Course list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 32 }}>
            No courses found
          </div>
        ) : (
          filtered.map((course) => (
            <DraggableCourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.has(course.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCourseCard({ course, isEnrolled }) {
  const [{ isDragging }, drag] = useDrag({
    type: "SIDEBAR_COURSE",
    item: { type: "SIDEBAR_COURSE", course },
    canDrag: !isEnrolled,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const attrs = (course.course_eligible_attributes || []).map((x) => x.attribute).filter(Boolean);

  return (
    <div
      ref={!isEnrolled ? drag : undefined}
      title={isEnrolled ? "Already added to a semester" : "Drag to a semester"}
      style={{
        position: "relative",
        padding: "9px 11px",
        borderRadius: 9,
        border: isEnrolled ? "1px solid #d1fae5" : "1px solid #e5e7eb",
        background: isDragging ? "#e5e7eb" : isEnrolled ? "#f0fdf4" : "#fafafa",
        cursor: isEnrolled ? "default" : "grab",
        opacity: isDragging ? 0.4 : 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isEnrolled && !isDragging) e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
      }}
    >
      {/* Enrolled badge */}
      {isEnrolled && (
        <div style={{
          position: "absolute", top: 7, right: 8,
          background: "#10b981", color: "#fff",
          fontSize: 9, padding: "2px 5px", borderRadius: 4,
          fontWeight: 700, textTransform: "uppercase",
        }}>
          ✓ Added
        </div>
      )}

      {/* Code + credits */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isEnrolled ? "#059669" : "#111", letterSpacing: "0.05em" }}>
          {course.code}
        </span>
        {course.credits != null && (
          <span style={{ fontSize: 10, color: "#9ca3af" }}>{course.credits} cr</span>
        )}
      </div>

      {/* Name */}
      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.35, marginBottom: attrs.length ? 5 : 0 }}>
        {course.name}
      </div>

      {/* Attribute tags */}
      {attrs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
          {attrs.map((a) => (
            <span key={a} style={{
              fontSize: 9, padding: "2px 5px", borderRadius: 4,
              background: "#f1f5f9", color: "#64748b",
              textTransform: "uppercase", fontWeight: 600,
            }}>
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}