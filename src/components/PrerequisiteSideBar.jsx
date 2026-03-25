import { useState, useMemo, useEffect } from "react";
import { useDrag } from "react-dnd";
import { useNavigate } from "react-router-dom";
import { getEmptyImage } from "react-dnd-html5-backend";

const REQUIRED_ELECTIVE_BUCKETS = [
  { bucket: "Community Engaged Learning", required: 1 },
  { bucket: "Human Values", required: 1 },
  { bucket: "Cultures and Histories", required: 3 },
  { bucket: "Understanding the World", required: 1 },
  { bucket: "Societies and Individuals", required: 2 },
  { bucket: "Technical Elective", required: 1 },

];

const PASSING_GRADES = new Set([
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "PASS",
]);

export default function PrerequisiteSidebar({ courses = [], enrolledCourseIds = new Set(), electiveRows = [], allUserCourses = [] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("catalog");
  
const completedCourseIds = useMemo(() => {
    const ids = new Set();
    for (const uc of allUserCourses) {
      if (uc.grade && PASSING_GRADES.has(uc.grade)) ids.add(uc.course_id);
    }
    return ids;
  }, [allUserCourses]);

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
  c.code?.toLowerCase().includes(search.toLowerCase()) ||
  c.name?.toLowerCase().includes(search.toLowerCase()) ||
  c.number?.toString().toLowerCase().includes(search.toLowerCase()) ||
  `${c.code} ${c.number}`.toLowerCase().includes(search.toLowerCase()) ||
  `${c.code}${c.number}`.toLowerCase().includes(search.toLowerCase());
      const isEnrolled = enrolledCourseIds.has(c.id);
      const isCompleted = completedCourseIds.has(c.id);
      const matchesFilter =
        filter === "all" ||
        (filter === "enrolled" && isEnrolled) ||
        (filter === "available" && !isEnrolled&& !isCompleted);
      return matchesSearch && matchesFilter;
    });
  }, [courses, search, filter, enrolledCourseIds, completedCourseIds]);
  

  const electiveSections = useMemo(() => {
    return REQUIRED_ELECTIVE_BUCKETS.map(({ bucket, required }) => {
      const eligible = courses.filter((c) => {
        const attrs = (c.course_eligible_attributes || []).map((x) => x.attribute);
        return attrs.includes(bucket) && !completedCourseIds.has(c.id);
      });
      const creditsPerCourse = 3;
      const row = electiveRows.find((r) => r.bucket === bucket);
      const earnedCourses = row ? Math.floor(row.earned / creditsPerCourse) : 0;
      const earned = earnedCourses;
      const remaining = Math.max(0, required - earnedCourses);
      return { bucket, required, earned, remaining, courses: eligible };
    });
  }, [courses, completedCourseIds, electiveRows]);

  const enrolledCount = courses.filter((c) => enrolledCourseIds.has(c.id)).length;
const availableCount = courses.filter((c) => !enrolledCourseIds.has(c.id) && !completedCourseIds.has(c.id)).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", padding: "0 14px" }}>
        {[
          { key: "catalog", label: "Catalog" },
          { key: "electives", label: "Electives" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex: 1, padding: "10px 4px", fontSize: 12,
            fontWeight: activeTab === key ? 700 : 400,
            border: "none", background: "none",
            borderBottom: activeTab === key ? "2px solid #111" : "2px solid transparent",
            color: activeTab === key ? "#111" : "#9ca3af",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === "catalog" && (
        <div>
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
      )}
      {activeTab === "electives" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {electiveSections
            .filter(({ remaining }) => remaining > 0)
            .flatMap(({ bucket, remaining }) =>
              Array.from({ length: remaining }, (_, i) => (
                <ElectiveSlotCard key={`${bucket}-${i}`} bucket={bucket} />
              ))
            )
          }
        </div>
      )}

    </div>
  );
}

function DraggableCourseCard({ course, isEnrolled, electiveAttribute }) {
  const navigate = useNavigate();
  const [{ isDragging }, drag, preview] = useDrag({
    type: "SIDEBAR_COURSE",
    item: () => ({
      type: "SIDEBAR_COURSE",
      course,
      electiveAttribute: electiveAttribute ?? null,
      grabOffsetX: 20,
      grabOffsetY: 10
    }),
    canDrag: !isEnrolled,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

useEffect(() => {
  preview(getEmptyImage(), { captureDraggingState: true });
}, [preview]);

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
          {course.number ? `${course.code} (${course.number})` : course.code}
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
       <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/course/${course.id}`);
        }}
        style={{
          marginTop: 6,
          fontSize: 10,
          padding: "3px 8px",
          borderRadius: 5,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
          color: "#374151",
          width: "100%",
        }}
      >
        View Details & Reviews
      </button>

    </div>
  );
}
function ElectiveSlotCard({ bucket }) {
  const [{ isDragging }, drag,preview] = useDrag({
    type: "SIDEBAR_COURSE",
    item: () => ({
      type: "SIDEBAR_COURSE",
      course: null,
      electiveAttribute: bucket,
      grabOffsetX: 20,
      grabOffsetY: 10,
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });
useEffect(() => {
  preview(getEmptyImage(), { captureDraggingState: true });
}, [preview]);
  return (
    <div
      ref={drag}
      style={{
        padding: "9px 11px",
        borderRadius: 9,
        border: "1px dashed #93c5fd",
        background: isDragging ? "#e5e7eb" : "#eff6ff",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>
        ELECTIVE SLOT
      </div>
      <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
        {bucket}
      </div>
    </div>
  );
}