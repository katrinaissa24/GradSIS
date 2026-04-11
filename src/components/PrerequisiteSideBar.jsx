import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useDrag } from "react-dnd";
import { useNavigate } from "react-router-dom";
import { getEmptyImage } from "react-dnd-html5-backend";
import { supabase } from "../services/supabase";

const REQUIRED_ELECTIVE_BUCKETS = [
  { bucket: "Community Engaged Learning", required: 1 },
  { bucket: "Human Values", required: 1 },
  { bucket: "Cultures and Histories", required: 3 },
  { bucket: "Understanding the World", required: 1 },
  { bucket: "Societies and Individuals", required: 2 },
  { bucket: "Technical Elective", required: 1 },
];

const PASSING_GRADES = new Set([
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "PASS",
]);

const VIRTUAL_LIST_OVERSCAN = 4;
const COURSE_ROW_HEIGHT = 124;
const MOBILE_COURSE_ROW_HEIGHT = 168;

function PrerequisiteSidebar({
  courses = [],
  enrolledCourseIds = new Set(),
  electiveRows = [],
  allUserCourses = [],
  isMobile = false,
  mobileSemesterId = "",
  onMobileSemesterChange,
  semesters = [],
  onQuickAddCourse,
  onQuickAddElective,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("catalog");
  const [reviewStatsByCourseId, setReviewStatsByCourseId] = useState({});
  const [catalogScrollTop, setCatalogScrollTop] = useState(0);
  const [catalogViewportHeight, setCatalogViewportHeight] = useState(0);
  const catalogListRef = useRef(null);

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
        (filter === "available" && !isEnrolled && !isCompleted);
      return matchesSearch && matchesFilter;
    });
  }, [courses, search, filter, enrolledCourseIds, completedCourseIds]);

  const electiveSections = useMemo(() => {
    return REQUIRED_ELECTIVE_BUCKETS.map(({ bucket, required }) => {
      const eligible = courses.filter((c) => {
        const attrs = (c.course_eligible_attributes || []).map(
          (x) => x.attribute,
        );
        return attrs.includes(bucket) && !completedCourseIds.has(c.id);
      });
      const creditsPerCourse = 3;
      const row = electiveRows.find((r) => r.bucket === bucket);
      const earnedCourses = row ? Math.floor(row.earned / creditsPerCourse) : 0;
      const remaining = Math.max(0, required - earnedCourses);
      return { bucket, required, remaining, courses: eligible };
    });
  }, [courses, completedCourseIds, electiveRows]);

  const enrolledCount = courses.filter((c) =>
    enrolledCourseIds.has(c.id),
  ).length;
  const availableCount = courses.filter(
    (c) => !enrolledCourseIds.has(c.id) && !completedCourseIds.has(c.id),
  ).length;
  const courseRowHeight = isMobile ? MOBILE_COURSE_ROW_HEIGHT : COURSE_ROW_HEIGHT;
  const visibleRowCount = Math.max(
    1,
    Math.ceil((catalogViewportHeight || courseRowHeight) / courseRowHeight),
  );
  const virtualStartIndex = Math.max(
    0,
    Math.floor(catalogScrollTop / courseRowHeight) - VIRTUAL_LIST_OVERSCAN,
  );
  const virtualEndIndex = Math.min(
    filtered.length,
    virtualStartIndex + visibleRowCount + VIRTUAL_LIST_OVERSCAN * 2,
  );
  const virtualCourses = filtered.slice(virtualStartIndex, virtualEndIndex);
  const topSpacerHeight = virtualStartIndex * courseRowHeight;
  const bottomSpacerHeight = Math.max(
    0,
    (filtered.length - virtualEndIndex) * courseRowHeight,
  );

  useEffect(() => {
    async function loadReviewStats() {
      if (!courses.length) {
        setReviewStatsByCourseId({});
        return;
      }

      const courseIds = courses.map((course) => course.id).filter(Boolean);
      if (!courseIds.length) {
        setReviewStatsByCourseId({});
        return;
      }

      const { data, error } = await supabase
        .from("course_reviews")
        .select("course_id, difficulty, would_recommend")
        .in("course_id", courseIds);

      if (error) {
        console.error("Failed to load course review stats:", error);
        return;
      }

      const groupedStats = (data || []).reduce((acc, review) => {
        const courseId = review.course_id;
        if (!courseId) return acc;

        if (!acc[courseId]) {
          acc[courseId] = {
            difficultyTotal: 0,
            difficultyCount: 0,
            recommendCount: 0,
            reviewCount: 0,
          };
        }

        acc[courseId].reviewCount += 1;

        if (review.difficulty != null) {
          acc[courseId].difficultyTotal += Number(review.difficulty);
          acc[courseId].difficultyCount += 1;
        }

        if (review.would_recommend === true) {
          acc[courseId].recommendCount += 1;
        }

        return acc;
      }, {});

      const nextStats = Object.fromEntries(
        Object.entries(groupedStats).map(([courseId, stats]) => [
          courseId,
          {
            rating:
              stats.reviewCount > 0
                ? {
                    avg:
                      stats.difficultyCount > 0
                        ? stats.difficultyTotal / stats.difficultyCount
                        : 0,
                    count: stats.reviewCount,
                  }
                : null,
            recommend:
              stats.reviewCount > 0
                ? Math.round((stats.recommendCount / stats.reviewCount) * 100)
                : null,
          },
        ]),
      );

      setReviewStatsByCourseId(nextStats);
    }

    loadReviewStats();
  }, [courses]);

  useEffect(() => {
    setCatalogScrollTop(0);
    if (catalogListRef.current) {
      catalogListRef.current.scrollTop = 0;
    }
  }, [search, filter, activeTab]);

  useEffect(() => {
    const node = catalogListRef.current;
    if (!node) return undefined;

    const updateViewportHeight = () => {
      setCatalogViewportHeight(node.clientHeight);
    };

    updateViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportHeight);
      return () => window.removeEventListener("resize", updateViewportHeight);
    }

    const observer = new ResizeObserver(() => updateViewportHeight());
    observer.observe(node);

    return () => observer.disconnect();
  }, [activeTab, isMobile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #f1f5f9",
          padding: "0 14px",
        }}
      >
        {[
          { key: "catalog", label: "Catalog" },
          { key: "electives", label: "Electives" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1,
              padding: "12px 4px",
              fontSize: 12,
              fontWeight: activeTab === key ? 700 : 400,
              border: "none",
              background: "none",
              borderBottom:
                activeTab === key ? "2px solid #111" : "2px solid transparent",
              color: activeTab === key ? "#111" : "#9ca3af",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isMobile && (
        <div style={{ padding: "12px 14px 0" }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            Add items to
          </label>
          <select
            value={mobileSemesterId}
            onChange={(e) => onMobileSemesterChange?.(e.target.value)}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 16,
              background: "#fff",
            }}
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === "catalog" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flex: 1,
          }}
        >
          <div style={{ padding: "10px 14px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f8f8f8",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "9px 10px",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses..."
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 16,
                  color: "#111",
                  width: "100%",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  x
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "10px 14px 6px",
              flexWrap: "wrap",
            }}
          >
            {[
              { key: "all", label: `All (${courses.length})` },
              { key: "available", label: `Open (${availableCount})` },
              { key: "enrolled", label: `Added (${enrolledCount})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  flex: isMobile ? "1 1 calc(50% - 4px)" : 1,
                  padding: "8px 6px",
                  fontSize: 10,
                  fontWeight: filter === key ? 700 : 400,
                  borderRadius: 6,
                  border:
                    filter === key ? "1.5px solid #111" : "1px solid #e5e7eb",
                  background: filter === key ? "#111" : "#fff",
                  color: filter === key ? "#fff" : "#6b7280",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  minHeight: 40,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            style={{ height: 1, background: "#f1f5f9", margin: "0 14px 8px" }}
          />

          <div
            style={{
              margin: "0 14px 8px",
              padding: "8px 10px",
              background: "#f0fdf4",
              border: "1px solid #d1fae5",
              borderRadius: 7,
              fontSize: 11,
              color: "#059669",
            }}
          >
            {isMobile
              ? "Tap Add to place a course in the selected semester."
              : "Drag any card onto a semester."}
          </div>

          <div
            ref={catalogListRef}
            onScroll={(e) => setCatalogScrollTop(e.currentTarget.scrollTop)}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 14px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 12,
                  marginTop: 32,
                }}
              >
                No courses found
              </div>
            ) : (
              <>
                {topSpacerHeight > 0 && (
                  <div
                    style={{
                      height: topSpacerHeight,
                      flexShrink: 0,
                    }}
                  />
                )}

                {virtualCourses.map((course) => (
                  <DraggableCourseCard
                    key={course.id}
                    course={course}
                    isEnrolled={enrolledCourseIds.has(course.id)}
                    rating={reviewStatsByCourseId[course.id]?.rating ?? null}
                    recommend={reviewStatsByCourseId[course.id]?.recommend ?? null}
                    isMobile={isMobile}
                    onQuickAdd={onQuickAddCourse}
                    disabled={!mobileSemesterId && isMobile}
                  />
                ))}

                {bottomSpacerHeight > 0 && (
                  <div
                    style={{
                      height: bottomSpacerHeight,
                      flexShrink: 0,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "electives" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {electiveSections
            .filter(({ remaining }) => remaining > 0)
            .flatMap(({ bucket, remaining }) =>
              Array.from({ length: remaining }, (_, i) => (
                <ElectiveSlotCard
                  key={`${bucket}-${i}`}
                  bucket={bucket}
                  isMobile={isMobile}
                  onQuickAdd={onQuickAddElective}
                  disabled={!mobileSemesterId && isMobile}
                />
              )),
            )}
        </div>
      )}
    </div>
  );
}

export default memo(
  PrerequisiteSidebar,
  (prevProps, nextProps) =>
    prevProps.courses === nextProps.courses &&
    prevProps.enrolledCourseIds === nextProps.enrolledCourseIds &&
    prevProps.electiveRows === nextProps.electiveRows &&
    prevProps.allUserCourses === nextProps.allUserCourses &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.mobileSemesterId === nextProps.mobileSemesterId &&
    prevProps.semesters === nextProps.semesters,
);

function DraggableCourseCard({
  course,
  isEnrolled,
  rating,
  recommend,
  electiveAttribute,
  isMobile = false,
  onQuickAdd,
  disabled = false,
}) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: "SIDEBAR_COURSE",
    item: (monitor) => {
      const rect = ref.current?.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();

      return {
        type: "SIDEBAR_COURSE",
        course,
        electiveAttribute: electiveAttribute ?? null,
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
    canDrag: !isEnrolled && !isMobile,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const attrs = (course.course_eligible_attributes || [])
    .map((x) => x.attribute)
    .filter(Boolean);

  return (
    <div
      ref={!isEnrolled && !isMobile ? (node) => {
        ref.current = node;
        drag(node);
      } : ref}
      title={
        isEnrolled
          ? "Already added to a semester"
          : isMobile
            ? "Tap Add to place this course"
            : "Drag to a semester"
      }
      style={{
        position: "relative",
        padding: "10px 11px",
        borderRadius: 9,
        border: isEnrolled ? "1px solid #d1fae5" : "1px solid #e5e7eb",
        background: isDragging ? "#e5e7eb" : isEnrolled ? "#f0fdf4" : "#fafafa",
        cursor: isEnrolled || isMobile ? "default" : "grab",
        opacity: isDragging ? 0.4 : 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.15s, background 0.15s",
      }}
    >
      {isEnrolled && (
        <div
          style={{
            position: "absolute",
            top: 7,
            right: 8,
            background: "#10b981",
            color: "#fff",
            fontSize: 9,
            padding: "2px 5px",
            borderRadius: 4,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Added
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 2,
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isEnrolled ? "#059669" : "#111",
            letterSpacing: "0.05em",
          }}
        >
          {course.number ? `${course.code} (${course.number})` : course.code}
        </span>
        {course.credits != null && (
          <span style={{ fontSize: 10, color: "#9ca3af" }}>
            {course.credits} cr
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#374151",
          lineHeight: 1.35,
          marginBottom: attrs.length ? 5 : 0,
        }}
      >
        {course.name}
      </div>

      {rating && rating.count > 0 && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          ⭐ {rating.avg.toFixed(1)} / 5 ({rating.count})
        </div>
      )}

      {recommend !== null && (
        <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
          👍 {recommend}% recommend
        </div>
      )}

      {attrs.length > 0 && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}
        >
          {attrs.map((a) => (
            <span
              key={a}
              style={{
                fontSize: 9,
                padding: "2px 5px",
                borderRadius: 4,
                background: "#f1f5f9",
                color: "#64748b",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
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
      {isMobile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onQuickAdd?.(course.id);
          }}
          disabled={disabled || isEnrolled}
          style={{
            marginTop: 6,
            fontSize: 11,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #111",
            background: disabled || isEnrolled ? "#f3f4f6" : "#111",
            color: disabled || isEnrolled ? "#9ca3af" : "#fff",
            cursor: disabled || isEnrolled ? "not-allowed" : "pointer",
            width: "100%",
            fontWeight: 600,
          }}
        >
          {isEnrolled ? "Added" : "Add"}
        </button>
      )}
    </div>
  );
}

function ElectiveSlotCard({
  bucket,
  isMobile = false,
  onQuickAdd,
  disabled = false,
}) {
  const ref = useRef(null);
  const [{ isDragging }, drag, preview] = useDrag({
    type: "SIDEBAR_COURSE",
    item: (monitor) => {
      const rect = ref.current?.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();

      return {
        type: "SIDEBAR_COURSE",
        course: null,
        electiveAttribute: bucket,
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
    canDrag: !isMobile,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <div
      ref={!isMobile ? (node) => {
        ref.current = node;
        drag(node);
      } : ref}
      style={{
        padding: "10px 11px",
        borderRadius: 9,
        border: "1px dashed #93c5fd",
        background: isDragging ? "#e5e7eb" : "#eff6ff",
        cursor: isMobile ? "default" : "grab",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>
        ELECTIVE SLOT
      </div>
      <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
        {bucket}
      </div>

      {isMobile && (
        <button
          type="button"
          onClick={() => onQuickAdd?.(bucket)}
          disabled={disabled}
          style={{
            width: "100%",
            minHeight: 40,
            marginTop: 10,
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: disabled ? "#dbeafe" : "#2563eb",
            color: "#fff",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: disabled ? 0.65 : 1,
          }}
        >
          Add Elective
        </button>
      )}
    </div>
  );
}
