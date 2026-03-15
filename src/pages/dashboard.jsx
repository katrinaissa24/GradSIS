import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import SemesterCard from "../components/SemesterCard";
import { useNavigate } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CustomDragLayer from "../components/CustomDragLayer";
import {
  calculateSemesterGPA,
  calculateCredits,
  calculateCumulativeGPAWithRepeats,
} from "../constants/gpa";
import { autoAssignBuckets } from "../utils/autoAssignBuckets";
import PrerequisiteSidebar from "../components/PrerequisiteSideBar";
import { useDragLayer } from "react-dnd";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [prerequisiteCourses, setPrerequisiteCourses] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [addingSemester, setAddingSemester] = useState(false);
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

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

  const ELECTIVE_REQUIREMENTS = {
    "English Communication": 6,
    "Arabic Communication": 3,
    "Human Values": 3,
    "Cultures and Histories": 9,
    "Societies and Individuals": 6,
    "Understanding the World": 3,
    "Technical Elective": 3,
    "Community Engaged Learning": 3,
  };

  const ATTRIBUTE_TO_BUCKET = {
    "Engl. Communication": "English Communication",
    "Arab. Communication": "Arabic Communication",
    "Human Values": "Human Values",
    "Cultures & Histories": "Cultures and Histories",
    "Societies & Individuals": "Societies and Individuals",
    "Understanding the World": "Understanding the World",
    Elective: "Technical Elective",
    CEL: "Community Engaged Learning",
  };

  function calcCredits(semesters) {
    let total = 0,
      completed = 0;
    for (const sem of semesters) {
      for (const uc of sem.user_courses || []) {
        const credits = uc?.courses?.credits ?? 0;
        total += credits;
        if (uc?.grade && PASSING_GRADES.has(uc.grade)) completed += credits;
      }
    }
    return { completed, total };
  }

  function calcElectivesProgress(semesters) {
    const EXCLUDED = new Set(["F", "W", "FAIL"]);
    const counted = [];
    for (const sem of semesters) {
      for (const uc of sem.user_courses || []) {
        if (uc?.grade && EXCLUDED.has(uc.grade)) continue;

        let credits = uc?.courses?.credits ?? 0;
        if (!credits) {
          if (uc.course_id === null && uc.attribute) {
            const bucket = ATTRIBUTE_TO_BUCKET[uc.attribute];
            credits = bucket ? 3 : 0;
          }
          if (!credits) continue;
        }

        const eligibleAttrs = (uc?.courses?.course_eligible_attributes || [])
          .map((x) => x.attribute)
          .filter(Boolean);

        const attrsToUse = eligibleAttrs.length
          ? eligibleAttrs
          : [uc?.attribute].filter(Boolean);

        const eligibleBuckets = [
          ...new Set(
            attrsToUse.map((a) => ATTRIBUTE_TO_BUCKET[a]).filter(Boolean),
          ),
        ];

        if (!eligibleBuckets.length) continue;

        counted.push({ id: uc.id, credits, eligibleBuckets });
      }
    }

    const { earned } = autoAssignBuckets(counted, ELECTIVE_REQUIREMENTS);

    return Object.entries(ELECTIVE_REQUIREMENTS).map(([bucket, required]) => {
      const e = earned[bucket] || 0;
      return {
        bucket,
        earned: e,
        required,
        remaining: Math.max(0, required - e),
        pct: required ? Math.min(100, Math.round((e / required) * 100)) : 0,
      };
    });
  }

  async function initialize(silent = false) {
    if (!silent) setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/auth");
        return;
      }

      setAuthUser(sessionData.session.user);
      const userId = sessionData.session.user.id;

      const { data: userSemesters, error: semestersError } = await supabase
        .from("user_semesters")
        .select("*")
        .eq("user_id", userId)
        .order("semester_number", { ascending: true });

      if (semestersError) throw semestersError;

      const safeSemesters = userSemesters || [];
      const semesterIds = safeSemesters.map((s) => s.id);

      let userCourses = [];

      if (semesterIds.length > 0) {
        const { data: fetchedCourses, error: coursesError } = await supabase
          .from("user_courses")
          .select(
            `
            *,
            courses (
              id, name, code, credits,
              course_eligible_attributes ( attribute )
            )
          `,
          )
          .in("semester_id", semesterIds);

        if (coursesError) throw coursesError;
        userCourses = fetchedCourses || [];
      }

      const formattedSemesters = safeSemesters.map((sem) => ({
        ...sem,
        user_courses: userCourses
          .filter((c) => c.semester_id === sem.id)
          .map((uc) => ({
            ...uc,
            courses: uc.courses ?? {
              id: null,
              name: uc.attribute,
              code: "ELECTIVE",
              credits: 3,
              course_eligible_attributes: [],
            },
          })),
      }));

      setSemesters(formattedSemesters);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function fetchPrerequisiteCourses() {
    try {
      const { data: prereqRows, error } = await supabase.from("prerequisites")
        .select(`
          course_id,
          courses!prerequisites_course_id_fkey (
            id, code, name, credits,
            course_eligible_attributes ( attribute )
          )
        `);
      if (error) throw error;

      const seen = new Set();
      const data = (prereqRows || [])
        .map((row) => row.courses)
        .filter((course) => {
          if (!course || seen.has(course.id)) return false;
          seen.add(course.id);
          return true;
        });

      setPrerequisiteCourses(data);
    } catch (err) {
      console.error("Error fetching prerequisite courses:", err);
    }
  }

  useEffect(() => {
    initialize();
    fetchPrerequisiteCourses();
  }, []);

  async function updateSemesterStatus(id, newStatus) {
    setSemesters((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
    );

    const { error } = await supabase
      .from("user_semesters")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      console.error("Failed to update semester status:", error);
      await initialize();
    }
  }

  async function updateCourseGrade(courseId, field, value) {
    setSemesters((prev) =>
      prev.map((sem) => ({
        ...sem,
        user_courses: sem.user_courses.map((c) =>
          c.id === courseId ? { ...c, [field]: value } : c,
        ),
      })),
    );

    const updates = { [field]: value };

    if (field === "grade") {
      if (value === "W" || value === "WF") {
        updates.status = "dropped";
      } else {
        updates.status = "completed";
      }
    }

    const { error } = await supabase
      .from("user_courses")
      .update(updates)
      .eq("id", courseId);

    if (error) {
      console.error("Failed to update course:", error);
    }
  }

  function moveCourse(courseId, fromSemesterId, toSemesterId) {
    setSemesters((prev) => {
      let movedCourse = null;

      const updated = prev.map((sem) => {
        if (sem.id === fromSemesterId) {
          const remaining = sem.user_courses.filter((c) => {
            if (c.id === courseId) {
              movedCourse = c;
              return false;
            }
            return true;
          });
          return { ...sem, user_courses: remaining };
        }
        return sem;
      });

      return updated.map((sem) => {
        if (sem.id === toSemesterId && movedCourse) {
          return {
            ...sem,
            user_courses: [
              ...sem.user_courses,
              { ...movedCourse, semester_id: toSemesterId },
            ],
          };
        }
        return sem;
      });
    });
  }

  async function deleteCourse(courseId) {
    setSemesters((prev) =>
      prev.map((sem) => ({
        ...sem,
        user_courses: sem.user_courses.filter((c) => c.id !== courseId),
      })),
    );

    await supabase.from("user_courses").delete().eq("id", courseId);
  }

  // semesterTargetCredits comes from SemesterCard's own targetCredits state,
  // passed up through the drop handler — no stale LOAD_LIMITS lookup needed.
  async function handleSidebarDrop(
    course,
    semesterId,
    electiveAttribute,
    semesterTargetCredits = 15,
  ) {
    console.log("DROP:", course, semesterId, electiveAttribute);

    if (course) {
      const targetSem = semesters.find((s) => s.id === semesterId);
      const alreadyEnrolled = targetSem?.user_courses?.some(
        (uc) => uc.course_id === course.id,
      );
      if (alreadyEnrolled) return;

      const { data: prereqs, error: prereqError } = await supabase
        .from("prerequisites")
        .select("prereq_course_id")
        .eq("course_id", course.id);

      if (prereqError) {
        alert("Error checking prerequisites.");
        return;
      }

      if (prereqs?.length > 0) {
        const { data: enrolledData } = await supabase
          .from("user_courses")
          .select("course_id")
          .eq("user_id", authUser.id);
        const enrolledCourseIds = (enrolledData || [])
          .map((uc) => uc.course_id)
          .filter(Boolean);

        const missing = prereqs.filter(
          (p) => !enrolledCourseIds.includes(p.prereq_course_id),
        );

        if (missing.length > 0) {
          const { data: missingCourses } = await supabase
            .from("courses")
            .select("id, code, number, name")
            .in(
              "id",
              missing.map((m) => m.prereq_course_id),
            );

          alert(
            `Missing prerequisites: ${(missingCourses || [])
              .map((c) => `${c.code} ${c.number} – ${c.name}`)
              .join(", ")}`,
          );
          return;
        }
      }

      const { data: semData } = await supabase
        .from("user_semesters")
        .select("semester_number")
        .eq("id", semesterId)
        .single();

      if (course.req_sem && semData?.semester_number < course.req_sem) {
        alert(
          `This course is intended for semester ${course.req_sem} or later.`,
        );
        return;
      }

      const targetSemCourses =
        semesters.find((s) => s.id === semesterId)?.user_courses || [];
      const currentCredits = targetSemCourses.reduce(
        (sum, uc) => sum + (uc?.courses?.credits ?? 0),
        0,
      );

      if (currentCredits + (course.credits ?? 0) > semesterTargetCredits) {
        alert(
          `Cannot add: would exceed your target of ${semesterTargetCredits} credits for this semester.`,
        );
        return;
      }
    }

    if (!course) {
      const targetSemCourses =
        semesters.find((s) => s.id === semesterId)?.user_courses || [];
      const currentCredits = targetSemCourses.reduce(
        (sum, uc) => sum + (uc?.courses?.credits ?? 0),
        0,
      );

      if (currentCredits + 3 > semesterTargetCredits) {
        alert(
          `Cannot add: would exceed your target of ${semesterTargetCredits} credits for this semester.`,
        );
        return;
      }
    }

    const BUCKET_TO_ATTRIBUTE = {
      "Community Engaged Learning": "CEL",
      "Cultures and Histories": "Cultures & Histories",
      "Societies and Individuals": "Societies & Individuals",
      "Human Values": "Human Values",
      "Understanding the World": "Understanding the World",
      "Technical Elective": "Elective",
    };

    const attributeToUse =
      BUCKET_TO_ATTRIBUTE[electiveAttribute] ||
      (course && !electiveAttribute ? "Major Course" : electiveAttribute) ||
      "Elective";

    const tempId = `temp-${Date.now()}`;
    const optimisticEntry = {
      id: tempId,
      course_id: course?.id ?? null,
      semester_id: semesterId,
      attribute: attributeToUse,
      grade: null,
      courses: course
        ? {
            id: course.id,
            name: course.name,
            code: course.code,
            credits: course.credits,
            course_eligible_attributes: course.course_eligible_attributes || [],
          }
        : {
            id: null,
            name: attributeToUse,
            code: "ELECTIVE",
            credits: 3,
            course_eligible_attributes: [],
          },
    };

    setSemesters((prev) =>
      prev.map((sem) =>
        sem.id === semesterId
          ? { ...sem, user_courses: [...sem.user_courses, optimisticEntry] }
          : sem,
      ),
    );

    const { data, error } = await supabase
      .from("user_courses")
      .insert({
        user_id: authUser.id,
        course_id: course?.id ?? null,
        semester_id: semesterId,
        grade: null,
        attribute: attributeToUse,
      })
      .select(
        `
        *,
        courses (
          id, name, code, credits,
          course_eligible_attributes ( attribute )
        )
      `,
      )
      .single();

    if (error) {
      console.error("Failed to add course:", error);
      setSemesters((prev) =>
        prev.map((sem) =>
          sem.id === semesterId
            ? {
                ...sem,
                user_courses: sem.user_courses.filter((uc) => uc.id !== tempId),
              }
            : sem,
        ),
      );
      return;
    }

    setSemesters((prev) =>
      prev.map((sem) =>
        sem.id === semesterId
          ? {
              ...sem,
              user_courses: sem.user_courses.map((uc) =>
                uc.id === tempId
                  ? {
                      ...data,
                      courses: data.courses ?? {
                        id: null,
                        name: attributeToUse,
                        code: "ELECTIVE",
                        credits: 3,
                        course_eligible_attributes: [],
                      },
                    }
                  : uc,
              ),
            }
          : sem,
      ),
    );
  }

  async function handleAddSemester() {
    const trimmedName = newSemesterName.trim();
    if (!trimmedName) {
      alert("Please enter a semester name.");
      return;
    }

    if (!authUser?.id) {
      alert("User session not ready. Please refresh and try again.");
      return;
    }

    try {
      setAddingSemester(true);

      const nextSemesterNumber =
        semesters.length > 0
          ? Math.max(...semesters.map((s) => s.semester_number || 0)) + 1
          : 1;

      const { data, error } = await supabase
        .from("user_semesters")
        .insert({
          user_id: authUser.id,
          name: trimmedName,
          semester_number: nextSemesterNumber,
          status: "future",
          load_mode: "normal",
          target_credits: 15,
        })
        .select()
        .single();

      if (error) {
        console.error("Add semester error:", error);
        throw error;
      }

      setSemesters((prev) => [...prev, { ...data, user_courses: [] }]);
      setNewSemesterName("");
    } catch (err) {
      console.error("Error adding semester:", err);
      alert(err.message || "Failed to add semester.");
    } finally {
      setAddingSemester(false);
    }
  }

  const allCourses = semesters.flatMap((s) => s.user_courses || []);

  const totalGPA = calculateCumulativeGPAWithRepeats(allCourses, semesters);
  const totalHours = calculateCredits(allCourses);

  const { completed } = calcCredits(semesters);
  const total = 120;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const safePercent = Math.min(100, Math.max(0, percent));
  const remaining = Math.max(0, total - completed);

  const electiveRows = calcElectivesProgress(semesters);
  const electivesRemainingTotal = electiveRows.reduce(
    (s, r) => s + r.remaining,
    0,
  );

  if (loading) {
    return <div style={{ padding: 20 }}>Initializing...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer />

      <div style={{ background: "#f4f4f5", minHeight: "100vh", color: "#111" }}>
        {/* ── Top nav ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 300,
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <span style={{ width: 22, height: 2, background: "#111" }} />
              <span style={{ width: 22, height: 2, background: "#111" }} />
              <span style={{ width: 22, height: 2, background: "#111" }} />
            </button>
            <span style={{ fontWeight: 600, fontSize: 25 }}>GradSIS</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ fontSize: 13, color: "#444", textAlign: "right" }}>
              <div style={{ fontWeight: 600 }}>
                {authUser?.name || authUser?.email}
              </div>
              <div>
                GPA <b>{totalGPA}</b> • Hours <b>{totalHours}</b>
              </div>
              <div>
                Credits <b>{completed}</b> / {total}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fafafa",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Page header ── */}
        <div style={{ padding: "24px 24px 8px 24px" }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "#6b7280", letterSpacing: 1 }}>
            Plan your past, current and future semesters, track your progress,
            and explore electives.
          </div>
          <br />
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "flex-start",
            padding: "0 24px 24px 24px",
          }}
        >
          {sidebarOpen && (
            <SidebarOverlay onClose={() => setSidebarOpen(false)} />
          )}

          {/* ── Slide-out catalog sidebar ── */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100vh",
              width: 280,
              background: "#fff",
              boxShadow: "4px 0 20px rgba(0,0,0,0.12)",
              zIndex: 400,
              transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 14px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Course Catalog
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <PrerequisiteSidebar
                courses={prerequisiteCourses}
                enrolledCourseIds={
                  new Set(allCourses.map((uc) => uc.course_id))
                }
                electiveRows={electiveRows}
                allUserCourses={allCourses}
              />
            </div>
          </div>

          {/* ── Semester list ── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {semesters.map((sem) => (
              <SemesterCard
                key={sem.id + "-" + sem.user_courses.length}
                semester={sem}
                userId={authUser?.id}
                refresh={initialize}
                updateStatus={updateSemesterStatus}
                updateCourse={updateCourseGrade}
                moveCourse={moveCourse}
                deleteCourse={deleteCourse}
                onSidebarDrop={handleSidebarDrop}
              />
            ))}

            {/* ── Add semester ── */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={newSemesterName}
                onChange={(e) => setNewSemesterName(e.target.value)}
                placeholder="Enter new semester name"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  fontSize: 14,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSemester();
                }}
              />
              <button
                onClick={handleAddSemester}
                disabled={addingSemester}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {addingSemester ? "Adding..." : "Add Semester"}
              </button>
            </div>
          </div>

          {/* ── Electives panel ── */}
          <div
            style={{ width: 320, flexShrink: 0, position: "sticky", top: 110 }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 14,
                padding: 14,
                border: "1px solid #eee",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>Electives</span>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {electivesRemainingTotal} left
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {electiveRows.map((r) => (
                  <div
                    key={r.bucket}
                    style={{
                      border: "1px solid #f0f0f0",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{r.bucket}</span>
                      <span>
                        {r.earned}/{r.required}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#eee",
                        borderRadius: 999,
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          width: `${r.pct}%`,
                          background: "#111",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}

function SidebarOverlay({ onClose }) {
  const isDragging = useDragLayer((monitor) => monitor.isDragging());
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        zIndex: 100,
        pointerEvents: isDragging ? "none" : "auto",
      }}
    />
  );
}
