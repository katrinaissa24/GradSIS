import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import SemesterCard from "../components/SemesterCard";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import { MultiBackend, MouseTransition, TouchTransition } from "react-dnd-multi-backend";
import CustomDragLayer from "../components/CustomDragLayer";
import {
  calculateCredits,
  calculateCumulativeGPAWithRepeats,
} from "../constants/gpa";
import { autoAssignBuckets } from "../utils/autoAssignBuckets";
import PrerequisiteSidebar from "../components/PrerequisiteSideBar";

const MOBILE_BREAKPOINT = 768;
const LOAD_CONFIG = {
  underload: { targetCredits: 11 },
  normal: { targetCredits: 17 },
  overload: { targetCredits: 21 },
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [prerequisiteCourses, setPrerequisiteCourses] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [addingSemester, setAddingSemester] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [mobileElectivesOpen, setMobileElectivesOpen] = useState(false);
  const [mobileQuickAddSemesterId, setMobileQuickAddSemesterId] = useState("");
  const [isSignOutHovered, setIsSignOutHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth <= MOBILE_BREAKPOINT
      : false,
  );
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
    "Technical Elective": "Technical Elective",   
    CEL: "Community Engaged Learning",
  };

  function calcCredits(semesterList) {
    let total = 0;
    let completed = 0;

    for (const sem of semesterList) {
      for (const uc of sem.user_courses || []) {
        const credits = uc?.courses?.credits ?? 0;
        total += credits;
        if (uc?.grade && PASSING_GRADES.has(uc.grade)) {
          completed += credits;
        }
      }
    }

    return { completed, total };
  }

  function calcElectivesProgress(semesterList) {
    const EXCLUDED = new Set(["F", "W", "FAIL"]);
    const counted = [];

    for (const sem of semesterList) {
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
      const value = earned[bucket] || 0;
      const isComplete = value >= required;

      return {
        bucket,
        earned: value,
        required,
        remaining: Math.max(0, required - value),
        pct: required ? Math.min(100, Math.round((value / required) * 100)) : 0,
        isComplete,
      };
    });
  }

  async function initialize(silent = false, planIdOverride = null) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        navigate("/auth");
        return;
      }

      const user = sessionData.session.user;
      setAuthUser(user);
      const userId = user.id;

      const { data: fetchedPlans, error: plansError } = await supabase
        .from("plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (plansError) throw plansError;

      let safePlans = fetchedPlans || [];

      const hasPlanA = safePlans.some((p) => p.name === "Plan A");
      const hasPlanB = safePlans.some((p) => p.name === "Plan B");

      const plansToCreate = [];

      if (!hasPlanA) plansToCreate.push({ user_id: userId, name: "Plan A" });
      if (!hasPlanB) plansToCreate.push({ user_id: userId, name: "Plan B" });

      if (plansToCreate.length > 0) {
        const { data: createdPlans, error: createError } = await supabase
          .from("plans")
          .insert(plansToCreate)
          .select();

        if (createError) throw createError;

        safePlans = [...safePlans, ...createdPlans];
      }

      setPlans(safePlans);

      let activePlanId = planIdOverride || selectedPlanId;

      if (!activePlanId && safePlans.length > 0) {
        activePlanId = safePlans[0].id;
        setSelectedPlanId(activePlanId);
      }

      if (!activePlanId) {
        setSemesters([]);
        setLoading(false);
        return;
      }

      const { data: userSemesters, error: semestersError } = await supabase
        .from("user_semesters")
        .select("*")
        .eq("user_id", userId)
        .eq("plan_id", activePlanId)
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
              id, name, code, number, credits,
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
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
        id, code, number, name, credits,req_sem,
        course_eligible_attributes ( attribute )
      `,
        )
        .order("code", { ascending: true });

      if (error) throw error;
      setPrerequisiteCourses(data || []);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  }

  useEffect(() => {
    initialize();
    fetchPrerequisiteCourses();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      initialize(true, selectedPlanId);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    if (!semesters.length) {
      setMobileQuickAddSemesterId("");
      return;
    }

    setMobileQuickAddSemesterId((prev) => {
      if (prev && semesters.some((semester) => semester.id === prev)) {
        return prev;
      }
      return semesters[0].id;
    });
  }, [semesters]);

  useEffect(() => {
    if (!isMobile) {
      setMobileCatalogOpen(false);
      setMobileElectivesOpen(false);
    }
  }, [isMobile]);

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

  async function updateSemesterLoadMode(id, newLoadMode) {
    const targetCredits = LOAD_CONFIG[newLoadMode]?.targetCredits ?? 17;

    setSemesters((prev) =>
      prev.map((semester) =>
        semester.id === id
          ? {
              ...semester,
              load_mode: newLoadMode,
              target_credits: targetCredits,
            }
          : semester,
      ),
    );

    const { error } = await supabase
      .from("user_semesters")
      .update({
        load_mode: newLoadMode,
        target_credits: targetCredits,
      })
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      console.error("Failed to update semester load mode:", error);
      await initialize();
    }
  }

    async function updateSemesterLock(id, isLocked) {
    setSemesters((prev) =>
      prev.map((semester) =>
        semester.id === id ? { ...semester, is_locked: isLocked } : semester,
      ),
    );

    const { error } = await supabase
      .from("user_semesters")
      .update({ is_locked: isLocked })
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      console.error("Failed to update semester lock:", error);
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
      updates.status =
        value === "W" || value === "WF" ? "dropped" : "completed";
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

  async function handleSidebarDrop(
    course,
    semesterId,
    electiveAttribute,
    semesterTargetCredits = 15,
  ) {
    if (!semesterId) {
      alert("Please choose a semester first.");
      return;
    }

    if (course) {
      const targetSem = semesters.find((s) => s.id === semesterId);
      const alreadyEnrolledInThisSemester = targetSem?.user_courses?.some(
        (uc) => uc.course_id === course.id && uc.semester_id === semesterId,
      );

      if (alreadyEnrolledInThisSemester) return;

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
              .map((c) => `${c.code} ${c.number} - ${c.name}`)
              .join(", ")}`,
          );
          return;
        }
      }

      const targetSemNumber = targetSem?.semester_number;
      console.log(
        "req_sem:",
        course.req_sem,
        "targetSemNumber:",
        targetSemNumber,
      );
      if (course.req_sem && targetSemNumber !== course.req_sem) {
        alert(`This course must be taken in semester ${course.req_sem}.`);
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
      "Technical Elective": "Technical Elective",
      "English Communication": "Engl. Communication",
      "Arabic Communication": "Arab. Communication",

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
            number: course.number,
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
          id, name, code, number, credits,
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
          plan_id: selectedPlanId,
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

  async function handleMobileQuickAddCourse(courseId) {
    const course = prerequisiteCourses.find((entry) => entry.id === courseId);
    if (!course) return;

    const targetSemester = semesters.find(
      (semester) => semester.id === mobileQuickAddSemesterId,
    );

    await handleSidebarDrop(
      course,
      mobileQuickAddSemesterId,
      null,
      targetSemester?.target_credits ?? 15,
    );
  }

  async function handleMobileQuickAddElective(bucket) {
    const targetSemester = semesters.find(
      (semester) => semester.id === mobileQuickAddSemesterId,
    );

    await handleSidebarDrop(
      null,
      mobileQuickAddSemesterId,
      bucket,
      targetSemester?.target_credits ?? 15,
    );
  }

  const allCourses = semesters.flatMap((s) => s.user_courses || []);
  const totalGPA = calculateCumulativeGPAWithRepeats(allCourses, semesters);
  const totalHours = calculateCredits(allCourses);
  const { completed } = calcCredits(semesters);
  const total = 120;
  const electiveRows = calcElectivesProgress(semesters);
  const electivesRemainingTotal = electiveRows.reduce(
    (sum, row) => sum + row.remaining,
    0,
  );
const DND_OPTIONS = {
  backends: [
    { id: "html5", backend: HTML5Backend, transition: MouseTransition },
    {
      id: "touch",
      backend: TouchBackend,
      options: { enableMouseEvents: false, delayTouchStart: 100, touchSlop: 5 },
      preview: true,
      transition: TouchTransition,
    },
  ],
};
  const drawerOpen = isMobile ? mobileCatalogOpen : sidebarOpen;
  const mobileElectivesPanel =
    isMobile && mobileElectivesOpen ? (
      <div style={{ padding: "0 16px 16px" }}>
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
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Electives</span>
            <span style={{ fontSize: 12, color: "#666" }}>
              {electivesRemainingTotal} left
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {electiveRows.map((row) => (
              <div
                key={row.bucket}
                style={{
                border: row.isComplete ? "1px solid #86efac" : "1px solid #f0f0f0",
                borderRadius: 10,
                padding: 10,
                background: row.isComplete ? "#f0fdf4" : "#fff",
              }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{row.bucket}</span>
                  <span>
                    {row.earned}/{row.required}
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
                    width: `${row.pct}%`,
                    background: row.isComplete ? "#16a34a" : "#111",
                    borderRadius: 999,
                  }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null;

  if (loading) {
    return <div style={{ padding: 20 }}>Initializing...</div>;
  }

  return (
    <DndProvider backend={MultiBackend} options={DND_OPTIONS}>
      <CustomDragLayer isMobile={isMobile} />

      <div style={{ background: "#f4f4f5", minHeight: "100vh", color: "#111" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 300,
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: isMobile ? "12px 16px" : "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileCatalogOpen((prev) => !prev);
                } else {
                  setSidebarOpen((prev) => !prev);
                }
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 5,
                padding: 6,
              }}
              aria-label="Open course catalog"
            >
              <span style={{ width: 22, height: 2, background: "#111" }} />
              <span style={{ width: 22, height: 2, background: "#111" }} />
              <span style={{ width: 22, height: 2, background: "#111" }} />
            </button>
            <span style={{ fontWeight: 600, fontSize: isMobile ? 22 : 25 }}>
              GradSIS
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: isMobile ? "stretch" : "center",
              gap: isMobile ? 10 : 24,
              width: isMobile ? "100%" : "auto",
              justifyContent: isMobile ? "space-between" : "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#444",
                textAlign: isMobile ? "left" : "right",
                flex: isMobile ? 1 : "unset",
                minWidth: 0,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {authUser?.name || authUser?.email}
              </div>
              {!isMobile && (
                <>
                  <div>
                    GPA <b>{totalGPA}</b> - Hours <b>{totalHours}</b>
                  </div>
                  <div>
                    Credits <b>{completed}</b> / {total}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleSignOut}
              onMouseEnter={() => setIsSignOutHovered(true)}
              onMouseLeave={() => setIsSignOutHovered(false)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: isSignOutHovered ? "1px solid #dc2626" : "1px solid #ddd",
                background: isSignOutHovered ? "#dc2626" : "#fafafa",
                color: isSignOutHovered ? "#fff" : "#111",
                cursor: "pointer",
                fontSize: 13,
                minHeight: 40,
                transition: "all 0.2s ease",
              }}
            >
              Sign Out
            </button>
          </div>

          {isMobile && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
                width: "100%",
              }}
            >
              {[
                { label: "GPA", value: totalGPA },
                { label: "Hours", value: totalHours },
                { label: "Credits", value: `${completed}/${total}` },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: isMobile ? "20px 16px 8px" : "24px 24px 8px" }}>
          <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 700 }}>
            Dashboard
          </div>

          <div style={{ fontSize: 12, color: "#6b7280", letterSpacing: 1 }}>
            Plan your past, current and future semesters, track your progress,
            and explore electives.
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontSize: 16,
                background: "#fff",
                minHeight: 44,
              }}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={() => setMobileElectivesOpen((prev) => !prev)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#111",
                    cursor: "pointer",
                    fontSize: 14,
                    minHeight: 44,
                  }}
                >
                  {mobileElectivesOpen ? "Hide Electives" : "Show Electives"}
                </button>
              </>
            )}
          </div>
        </div>

        {mobileElectivesPanel}

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 16 : 24,
            alignItems: "flex-start",
            padding: isMobile ? "0 16px 24px" : "0 24px 24px",
          }}
        >
          {drawerOpen && (
            <SidebarOverlay
              onClose={() => {
                setSidebarOpen(false);
                setMobileCatalogOpen(false);
              }}
            />
          )}

          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100vh",
              width: isMobile ? "100%" : 280,
              maxWidth: "100%",
              background: "#fff",
              boxShadow: "4px 0 20px rgba(0,0,0,0.12)",
              zIndex: 400,
              transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
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
                onClick={() => {
                  setSidebarOpen(false);
                  setMobileCatalogOpen(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                x
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              <PrerequisiteSidebar
                courses={prerequisiteCourses}
                enrolledCourseIds={
                  new Set(allCourses.map((uc) => uc.course_id).filter(Boolean))
                }
                electiveRows={electiveRows}
                allUserCourses={allCourses}
                isMobile={isMobile}
                mobileSemesterId={mobileQuickAddSemesterId}
                onMobileSemesterChange={setMobileQuickAddSemesterId}
                semesters={semesters}
                onQuickAddCourse={handleMobileQuickAddCourse}
                onQuickAddElective={handleMobileQuickAddElective}
              />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              width: "100%",
            }}
          >
            {semesters.map((sem) => (
              <SemesterCard
              key={sem.id}
              semester={sem}
              userId={authUser?.id}
              refresh={initialize}
              updateStatus={updateSemesterStatus}
              updateLoadMode={updateSemesterLoadMode}
              updateLock={updateSemesterLock}
              updateCourse={updateCourseGrade}
              moveCourse={moveCourse}
              deleteCourse={deleteCourse}
              onSidebarDrop={handleSidebarDrop}
              isMobile={isMobile}
            />
            ))}

            <div
              style={{
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                display: "flex",
                gap: 10,
                alignItems: isMobile ? "stretch" : "center",
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
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
                  fontSize: 16,
                  minHeight: 44,
                  width: isMobile ? "100%" : "auto",
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
                  minHeight: 44,
                  width: isMobile ? "100%" : "auto",
                }}
              >
                {addingSemester ? "Adding..." : "Add Semester"}
              </button>
            </div>
          </div>

          {!isMobile && (
            <div
              style={{
                width: 320,
                flexShrink: 0,
                position: "sticky",
                top: 110,
              }}
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
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Electives
                  </span>
                  <span style={{ fontSize: 12, color: "#666" }}>
                    {electivesRemainingTotal} left
                  </span>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {electiveRows.map((row) => (
                    <div
                      key={row.bucket}
                      style={{
                      border: row.isComplete ? "1px solid #86efac" : "1px solid #f0f0f0",
                      borderRadius: 10,
                      padding: 10,
                      background: row.isComplete ? "#f0fdf4" : "#fff",
                    }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{row.bucket}</span>
                        <span>
                          {row.earned}/{row.required}
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
                          width: `${row.pct}%`,
                          background: row.isComplete ? "#16a34a" : "#111",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
