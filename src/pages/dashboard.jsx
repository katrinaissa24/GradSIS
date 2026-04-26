import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../services/supabase";
import SemesterCard from "../components/SemesterCard";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { DndProvider, useDragLayer } from "react-dnd";
import { createDragDropManager } from "dnd-core";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import {
  DndProvider as MultiDndProvider,
  MouseTransition,
  TouchTransition,
} from "react-dnd-multi-backend";
import {
  calculateSemesterGPA,
  calculateCumulativeGPAWithRepeats,
  calculateGPACreditHours,
  getCourseCredits,
} from "../constants/gpa";
import { autoAssignBuckets } from "../utils/autoAssignBuckets";
import PrerequisiteSidebar from "../components/PrerequisiteSideBar";
import {
  computeSemesterDifficulties,
  exportPlanAsPDF,
  exportPlanAsExcel,
} from "../utils/exportPlan";
import DashboardLoadingShell from "../components/DashboardLoadingShell";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1100;
const LOAD_CONFIG = {
  underload: { targetCredits: 12 },
  normal: { targetCredits: 17 },
  overload: { targetCredits: 21 },
};
const MAJOR_REQUIRED_COURSES = [
  { code: "CMPS", number: "201", name: "Introduction to Programming" },
  { code: "CMPS", number: "202", name: "Data Structures" },
  { code: "CMPS", number: "214", name: "Analysis of Algorithms" },
  { code: "CMPS", number: "215", name: "Theory of Computation" },
  { code: "CMPS", number: "221", name: "Computer Architecture" },
  { code: "CMPS", number: "240", name: "Operating Systems" },
  { code: "CMPS", number: "241", name: "Systems Programing" },
  { code: "CMPS", number: "271", name: "Software Engineering" },
  { code: "CMPS", number: "211", name: "Discrete Structures" }, // Alternative handled separately
  { code: "MATH", number: "201", name: "Calculus and Analytical Geometry" },
  { code: "MATH", number: "218", name: "Linear Algebra" },
  { code: "STAT", number: "230", name: "Introduction to Probability and Random Variables" }
];
const CMPS_ELECTIVE_CREDITS_REQUIRED =18; // 18 credits of CMPS electives
const NO_OVERLOAD_STATUSES = new Set(["freshman", "sophomore"]);

function isRegularTerm(semester) {
  const name = (semester?.name || "").toLowerCase();
  return !name.includes("summer") && !name.includes("winter");
}

function getAubProbationStatusForPreviousSemester(semesters, previousSemesterIndex) {
  if (previousSemesterIndex < 0) return null;

  const previousSemester = semesters[previousSemesterIndex];
  if (!previousSemester || !isRegularTerm(previousSemester)) {
    return null;
  }

  const completedSemesters = semesters.slice(0, previousSemesterIndex + 1);
  const regularTermsCompleted = completedSemesters.filter(isRegularTerm).length;

  if (regularTermsCompleted < 2) {
    return null;
  }

  const previousSemesterGPA = Number.parseFloat(
    calculateSemesterGPA(previousSemester.user_courses || []),
  );

  if (regularTermsCompleted === 2) {
    const cumulativeGPA = Number.parseFloat(
      calculateCumulativeGPAWithRepeats(
        completedSemesters.flatMap((item) => item.user_courses || []),
        completedSemesters,
      ),
    );

    if (Number.isFinite(cumulativeGPA) && cumulativeGPA < 2.1) {
      return {
        metric: "overall GPA",
        value: cumulativeGPA,
        threshold: 2.1,
      };
    }

    return null;
  }

  const threshold = regularTermsCompleted <= 4 ? 2.2 : 2.3;
  if (Number.isFinite(previousSemesterGPA) && previousSemesterGPA < threshold) {
    return {
      metric: "term GPA",
      value: previousSemesterGPA,
      threshold,
    };
  }

  return null;
}

function getOverloadRestrictionReason(semester, previousSemester, semesterIndex, semesters) {
  if (!semester) return null;

  if (semesterIndex >= 0 && semesterIndex < 2) {
    return "The first two semesters cannot be marked as overload.";
  }

  if (NO_OVERLOAD_STATUSES.has(semester.student_status || "")) {
    return "Freshmen and sophomores cannot overload.";
  }

  if (!previousSemester) return null;

  if (previousSemester.status !== "previous" || !previousSemester.is_locked) {
    return null;
  }

  const probationStatus = getAubProbationStatusForPreviousSemester(
    semesters,
    semesterIndex - 1,
  );

  if (probationStatus) {
    return `The previous locked semester is on probation (${probationStatus.metric} ${probationStatus.value.toFixed(2)} below AUB's ${probationStatus.threshold.toFixed(1)} threshold), so this semester cannot be overload.`;
  }

  return null;
}

const DND_OPTIONS = {
  backends: [
    { id: "html5", backend: HTML5Backend, transition: MouseTransition },
    {
      id: "touch",
      backend: TouchBackend,
      options: {
        enableMouseEvents: false,
        delayTouchStart: 100,
        touchSlop: 5,
      },
      preview: true,
      transition: TouchTransition,
    },
  ],
};

const EMPTY_DASHBOARD_REVIEW_STATS = {};
const dashboardReviewStatsCache = new Map();
const pendingDashboardReviewStats = new Set();
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

function buildDashboardReviewStatsLookup(courseIds, reviews) {
  const groupedStats = (reviews || []).reduce((acc, review) => {
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

  return Object.fromEntries(
    courseIds.map((courseId) => {
      const stats = groupedStats[courseId];

      return [
        courseId,
        {
          avgDifficulty:
            stats?.difficultyCount > 0
              ? stats.difficultyTotal / stats.difficultyCount
              : null,
          recommendPercent:
            stats?.reviewCount > 0
              ? Math.round((stats.recommendCount / stats.reviewCount) * 100)
              : null,
          reviewCount: stats?.reviewCount ?? 0,
        },
      ];
    }),
  );
}

let customDragLayerModulePromise;

function loadCustomDragLayer() {
  if (!customDragLayerModulePromise) {
    customDragLayerModulePromise = import("../components/CustomDragLayer");
  }

  return customDragLayerModulePromise;
}

const LazyCustomDragLayer = lazy(loadCustomDragLayer);

function createDashboardProfiler(label) {
  if (!import.meta.env.DEV || typeof performance === "undefined") {
    return {
      step() {},
      end() {},
    };
  }

  const start = performance.now();
  let last = start;
  const entries = [];

  return {
    step(name) {
      const now = performance.now();
      entries.push({
        step: name,
        duration_ms: Math.round((now - last) * 10) / 10,
        elapsed_ms: Math.round((now - start) * 10) / 10,
      });
      last = now;
    },
    end() {
      if (entries.length === 0) return;
      console.groupCollapsed(
        `[dashboard] ${label} (${Math.round((performance.now() - start) * 10) / 10}ms)`,
      );
      console.table(entries);
      console.groupEnd();
    },
  };
}

function getCourseLookupKey(courseLike) {
  const code = String(courseLike?.code || "").trim().toUpperCase();
  const number = String(courseLike?.number || "").trim().toUpperCase();
  return code && number ? `${code}-${number}` : null;
}

async function fetchEarliestUserPlacementByKey(userId, courseKey) {
  if (!userId || !courseKey) return null;

  const { data: userSemesters, error: userSemestersError } = await supabase
    .from("user_semesters")
    .select("id, semester_number")
    .eq("user_id", userId);

  if (userSemestersError || !userSemesters?.length) return null;

  const semesterNumberById = Object.fromEntries(
    userSemesters.map((semester) => [semester.id, semester.semester_number]),
  );

  const { data: userCourses, error: userCoursesError } = await supabase
    .from("user_courses")
    .select("semester_id, course_id")
    .eq("user_id", userId)
    .in("semester_id", userSemesters.map((semester) => semester.id));

  if (userCoursesError || !userCourses?.length) return null;

  const courseIds = [...new Set(userCourses.map((row) => row.course_id).filter(Boolean))];
  const { data: courseRows, error: courseRowsError } = courseIds.length
    ? await supabase
        .from("courses")
        .select("id, code, number")
        .in("id", courseIds)
    : { data: [], error: null };

  if (courseRowsError) return null;

  const courseKeyById = Object.fromEntries(
    (courseRows || []).map((course) => [course.id, getCourseLookupKey(course)]),
  );

  return userCourses.reduce((minSemester, row) => {
    const semesterNumber = semesterNumberById[row.semester_id];
    if (!semesterNumber || courseKeyById[row.course_id] !== courseKey) {
      return minSemester;
    }

    if (minSemester == null) return semesterNumber;
    return Math.min(minSemester, semesterNumber);
  }, null);
}

async function fetchTemplatePlacementForCourse({
  userId,
  selectedSemesterId,
  course,
}) {
  if (!userId || !selectedSemesterId || !course) {
    return {
      selectedSemester: null,
      earliestTemplateSemester: null,
    };
  }

  const courseKey = getCourseLookupKey(course);

  const { data: selectedSemester, error: selectedSemesterError } = await supabase
    .from("user_semesters")
    .select("id, semester_number, plan_id")
    .eq("id", selectedSemesterId)
    .eq("user_id", userId)
    .single();

  if (selectedSemesterError || !selectedSemester) {
    return {
      selectedSemester: null,
      earliestTemplateSemester: null,
    };
  }

  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .select("id, starting_term_id")
    .eq("id", selectedSemester.plan_id)
    .single();

  let startingTermId = !planError ? planRow?.starting_term_id || null : null;

  if (!startingTermId) {
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("starting_term_id")
      .eq("id", userId)
      .single();

    if (!userError) {
      startingTermId = userRow?.starting_term_id || null;
    }
  }

  if (!startingTermId) {
    const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
    return {
      selectedSemester,
      earliestTemplateSemester: fallbackPlacement,
    };
  }

  const { data: startingTerm, error: startingTermError } = await supabase
    .from("starting_terms")
    .select("template_id")
    .eq("id", startingTermId)
    .single();

  if (startingTermError || !startingTerm?.template_id) {
    const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
    return {
      selectedSemester,
      earliestTemplateSemester: fallbackPlacement,
    };
  }

  const { data: templateSemesters, error: templateSemestersError } = await supabase
    .from("template_semesters")
    .select("id, semester_number")
    .eq("template_id", startingTerm.template_id);

  if (templateSemestersError || !templateSemesters?.length) {
    const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
    return {
      selectedSemester,
      earliestTemplateSemester: fallbackPlacement,
    };
  }

  const semesterNumberByTemplateSemesterId = Object.fromEntries(
    templateSemesters.map((semester) => [semester.id, semester.semester_number]),
  );

  const { data: templateCourses, error: templateCoursesError } = await supabase
    .from("template_courses")
    .select("course_id, template_semester_id")
    .in("template_semester_id", templateSemesters.map((semester) => semester.id));

  if (templateCoursesError || !templateCourses?.length) {
    const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
    return {
      selectedSemester,
      earliestTemplateSemester: fallbackPlacement,
    };
  }

  const templateCourseIds = [...new Set(templateCourses.map((row) => row.course_id).filter(Boolean))];
  const { data: templateCourseRows, error: templateCourseRowsError } = templateCourseIds.length
    ? await supabase
        .from("courses")
        .select("id, code, number")
        .in("id", templateCourseIds)
    : { data: [], error: null };

  if (templateCourseRowsError) {
    const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
    return {
      selectedSemester,
      earliestTemplateSemester: fallbackPlacement,
    };
  }

  const templateCourseKeyById = Object.fromEntries(
    (templateCourseRows || []).map((courseRow) => [courseRow.id, getCourseLookupKey(courseRow)]),
  );

  const earliestTemplateSemester = templateCourses.reduce((minSemester, row) => {
    const semesterNumber = semesterNumberByTemplateSemesterId[row.template_semester_id];
    if (!semesterNumber || templateCourseKeyById[row.course_id] !== courseKey) {
      return minSemester;
    }

    if (minSemester == null) return semesterNumber;
    return Math.min(minSemester, semesterNumber);
  }, null);

  const fallbackPlacement = await fetchEarliestUserPlacementByKey(userId, courseKey);
  const resolvedPlacement = earliestTemplateSemester ?? fallbackPlacement;

  return {
    selectedSemester,
    earliestTemplateSemester: resolvedPlacement,
  };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [prerequisiteCourses, setPrerequisiteCourses] = useState([]);
  const [hasLoadedPrerequisiteCourses, setHasLoadedPrerequisiteCourses] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [addingSemester, setAddingSemester] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planCache, setPlanCache] = useState({});
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [mobileElectivesOpen, setMobileElectivesOpen] = useState(false);
  const [mobileQuickAddSemesterId, setMobileQuickAddSemesterId] = useState("");
  const [mobileMajorReqOpen, setMobileMajorReqOpen] = useState(false);
  const [openAddCourseSemesterId, setOpenAddCourseSemesterId] = useState(null);
  const [isSignOutHovered, setIsSignOutHovered] = useState(false);
  const [toast, setToast] = useState(null);
const showToast = useCallback((message, type = "error") => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 4000);
}, []);
  const [isTabletLayout, setIsTabletLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth <= TABLET_BREAKPOINT
      : false,
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth <= MOBILE_BREAKPOINT
      : false,
  );
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    major: "",
    studentType: "",
  });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reviewStatsByCourseId, setReviewStatsByCourseId] = useState({});
  const skipNextPlanReloadRef = useRef(false);
  const initializeRequestIdRef = useRef(0);
  const navigate = useNavigate();

  const updateSemesterList = useCallback((updater) => {
    setSemesters((prev) => {
      const next = updater(prev);
      return next === prev ? prev : next;
    });
  }, []);

  const updateSemesterById = useCallback((semesterId, updater) => {
    updateSemesterList((prev) => {
      let changed = false;

      const next = prev.map((semester) => {
        if (semester.id !== semesterId) {
          return semester;
        }

        const updatedSemester = updater(semester);
        if (updatedSemester !== semester) {
          changed = true;
        }

        return updatedSemester;
      });

      return changed ? next : prev;
    });
  }, [updateSemesterList]);

  const updateSemesterContainingCourse = useCallback((courseId, updater) => {
    updateSemesterList((prev) => {
      let changed = false;

      const next = prev.map((semester) => {
        const courseIndex = semester.user_courses.findIndex((course) => course.id === courseId);
        if (courseIndex === -1) {
          return semester;
        }

        const updatedSemester = updater(semester, courseIndex);
        if (updatedSemester !== semester) {
          changed = true;
        }

        return updatedSemester;
      });

      return changed ? next : prev;
    });
  }, [updateSemesterList]);

  const overloadRestrictionBySemesterId = useMemo(() => {
    const restrictionMap = {};

    semesters.forEach((semester, index) => {
      restrictionMap[semester.id] = getOverloadRestrictionReason(
        semester,
        index > 0 ? semesters[index - 1] : null,
        index,
        semesters,
      );
    });

    return restrictionMap;
  }, [semesters]);

  const allCourses = useMemo(
    () => semesters.flatMap((semester) => semester.user_courses || []),
    [semesters],
  );

  const passedCourseIds = useMemo(
    () =>
      new Set(
        allCourses
          .filter((course) => course?.grade && PASSING_GRADES.has(course.grade))
          .map((course) => course.course_id)
          .filter(Boolean),
      ),
    [allCourses],
  );

  const enrolledCourseIds = useMemo(
    () => new Set(allCourses.map((course) => course.course_id).filter(Boolean)),
    [allCourses],
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  const handleToggleAddCourse = useCallback((semesterId, shouldOpen) => {
    setOpenAddCourseSemesterId((currentId) => {
      if (!shouldOpen) {
        return currentId === semesterId ? null : currentId;
      }

      return semesterId;
    });
  }, []);

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
        const credits = getCourseCredits(uc);
        total += credits;
        if (uc?.grade && PASSING_GRADES.has(uc.grade)) {
          completed += credits;
        }
      }
    }

    return { completed, total };
  }
function calcMajorRequirementsProgress(semesterList, allUserCourses, prerequisiteCourses = []) {
const EXCLUDED = new Set(["GRADE", "F", "W", "WF", "FAIL"]);
  function normalizeString(val) {
    return val ? String(val).trim().toUpperCase() : null;
  }

  // Helper function to get course code and number from a user_course
  function getCourseCodeAndNumber(uc) {
    // Method 1: Check courses nested object
    let code = uc.courses?.code;
    let number = uc.courses?.number;
    
    // Method 2: Check direct properties
    if (!code && uc.code) code = uc.code;
    if (!number && uc.number) number = uc.number;
    
    // Method 3: Look up from prerequisiteCourses using course_id
    if ((!code || !number) && uc.course_id) {
      const fullCourse = prerequisiteCourses.find(c => c.id === uc.course_id);
      if (fullCourse) {
        code = fullCourse.code;
        number = fullCourse.number;
      }
    }
    
    return { 
      code: normalizeString(code),
      number: normalizeString(number)
    };
  }

  // Check required courses - handle alternatives (like CMPS 211 OR MATH 211)
  const requiredRows = MAJOR_REQUIRED_COURSES.map((req) => {
    let match = null;
    const reqCode = normalizeString(req.code);
    const reqNumber = normalizeString(req.number);
    
    // Find if any user_course matches this requirement
// Prioritize passing grades over failed grades
for (const uc of allUserCourses) {
  const { code, number } = getCourseCodeAndNumber(uc);
  
  if (!code || !number) continue;
  
  const grade = normalizeString(uc.grade);
  const isMatch = (reqCode === "CMPS" && reqNumber === "211") 
    ? ((code === "CMPS" && number === "211") || (code === "MATH" && number === "211"))
    : (code === reqCode && number === reqNumber);
  
  if (isMatch) {
    // If this is a passing grade, use it immediately
    if (PASSING_GRADES.has(grade)) {
      match = uc;
      break;
    }
    // Otherwise, keep first match but continue searching for better one
    if (!match) {
      match = uc;
    }
  }
}

    if (!match) {
      return { ...req, status: "missing", grade: null };
    }

    const grade = normalizeString(match.grade);
    if (!grade) {
      return { ...req, status: "planned", grade: null };
    }
    if (EXCLUDED.has(grade)) {
      return { ...req, status: "failed", grade };
    }
    if (PASSING_GRADES.has(grade)) {
      return { ...req, status: "passed", grade };
    }
    return { ...req, status: "planned", grade: null };
  });

  // Check CMPS elective credits: any CMPS course not in the required list
  const requiredKeys = new Set(
    MAJOR_REQUIRED_COURSES.map((r) => `${normalizeString(r.code)}-${normalizeString(r.number)}`)
  );
  // Add alternative discrete math keys
  requiredKeys.add("CMPS-211");
  requiredKeys.add("MATH-211");

  let electiveCreditsEarned = 0;
for (const uc of allUserCourses) {
  const grade = normalizeString(uc.grade);
  if (EXCLUDED.has(grade)) continue;

  // Count CMPS Elective placeholder slots directly
  const attr = normalizeString(uc.attribute);
  if (attr === "CMPS ELECTIVE") {
    electiveCreditsEarned += getCourseCredits(uc);
    continue;
  }

  // Count real CMPS courses not in the required list
  const { code, number } = getCourseCodeAndNumber(uc);
  if (!code || !number) continue;
  if (code !== "CMPS") continue;
  if (requiredKeys.has(`${code}-${number}`)) continue;
  electiveCreditsEarned += getCourseCredits(uc);
}

  return {
    requiredRows,
    electiveCreditsEarned,
    electiveCreditsRequired: CMPS_ELECTIVE_CREDITS_REQUIRED,
  };
}
  function calcElectivesProgress(semesterList) {
    const EXCLUDED = new Set(["F", "W", "WF", "FAIL"]);
    const counted = [];

    for (const sem of semesterList) {
      for (const uc of sem.user_courses || []) {
        const grade = String(uc?.grade || "").trim().toUpperCase();
        if (grade && EXCLUDED.has(grade)) continue;

        let credits = getCourseCredits(uc);
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
      const isExact = value === required;
      const isOver = value > required;
      const isUnder = value < required;

      return {
        bucket,
        earned: value,
        required,
        remaining: Math.max(0, required - value),
        pct: required ? Math.min(100, Math.round((value / required) * 100)) : 0,
        isExact,
        isOver,
        isUnder,
        isComplete: isExact,
      };
    });
  }

  async function initialize(silent = false, planIdOverride = null) {
    const requestId = ++initializeRequestIdRef.current;
    const profiler = createDashboardProfiler(
      silent ? "initialize:plan-switch" : "initialize:first-load",
    );
    const isStale = () => requestId !== initializeRequestIdRef.current;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      profiler.step("session");

      if (isStale()) {
        profiler.step("stale-after-session");
        profiler.end();
        return;
      }

      if (!sessionData?.session) {
        navigate("/auth");
        profiler.end();
        return;
      }

      const user = sessionData.session.user;
      setAuthUser(user);
      const userId = user.id;

      try {
        const userProfilePromise = supabase
          .from("users")
          .select(`
            name,
            email,
            major_id,
            student_type,
            majors (
              name
            )
          `)
          .eq("id", userId)
          .single();

        const plansPromise = supabase
          .from("plans")
          .select("*")
          .eq("user_id", userId)
          .order("name", { ascending: true });
        const [
          { data: userRow, error: userRowError },
          { data: fetchedPlans, error: plansError },
        ] = await Promise.all([userProfilePromise, plansPromise]);
        profiler.step("profile+plans");

        if (isStale()) {
          profiler.step("stale-after-profile+plans");
          profiler.end();
          return;
        }

        if (userRowError) throw userRowError;
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
        profiler.step("ensure-plans");

        if (isStale()) {
          profiler.step("stale-after-ensure-plans");
          profiler.end();
          return;
        }

        setPlans(safePlans);

        let activePlanId = planIdOverride || selectedPlanId;

        if (!activePlanId && safePlans.length > 0) {
          activePlanId = safePlans[0].id;
          skipNextPlanReloadRef.current = true;
          setSelectedPlanId(activePlanId);
        }

        if (!activePlanId) {
          setUserProfile({
            name: userRow?.name || user.user_metadata?.name || "",
            email: userRow?.email || user.email || "",
            major: "",
            studentType: userRow?.student_type || "",
          });
          setSemesters([]);
          setLoading(false);
          profiler.step("empty-plan");
          profiler.end();
          return;
        }

        if (silent && planCache[activePlanId]) {
          setSemesters(planCache[activePlanId]);
          setLoading(false);
          profiler.step("cache-hit");
          profiler.end();
          return;
}

        const { data: userSemesters, error: semestersError } = await supabase
          .from("user_semesters")
          .select("*")
          .eq("user_id", userId)
          .eq("plan_id", activePlanId)
          .order("semester_number", { ascending: true });
        profiler.step("semesters");

        if (isStale()) {
          profiler.step("stale-after-semesters");
          profiler.end();
          return;
        }

        const majorData = Array.isArray(userRow?.majors)
          ? userRow.majors[0]
          : userRow?.majors;

        setUserProfile({
          name: userRow?.name || user.user_metadata?.name || "",
          email: userRow?.email || user.email || "",
          major: majorData?.name || "",
          studentType: userRow?.student_type || "",
        });

        if (semestersError) throw semestersError;

        const safeSemesters = userSemesters || [];
        const semesterIds = safeSemesters.map((s) => s.id);
        let userCourses = [];

        if (semesterIds.length > 0) {
          const { data: fetchedCourses, error: coursesError } = await supabase
            .from("user_courses")
            .select(`
              *,
              courses (
                id, name, code, number, credits,
                course_eligible_attributes ( attribute )
              )
            `)
            .in("semester_id", semesterIds);

          if (coursesError) throw coursesError;
          userCourses = fetchedCourses || [];
        }
        profiler.step("user-courses");

        if (isStale()) {
          profiler.step("stale-after-user-courses");
          profiler.end();
          return;
        }

        const userCoursesBySemesterId = userCourses.reduce((acc, course) => {
          if (!acc[course.semester_id]) {
            acc[course.semester_id] = [];
          }
          acc[course.semester_id].push({
            ...course,
            courses: course.courses ?? {
              id: null,
              name: course.attribute,
              code: "ELECTIVE",
              credits: 3,
              course_eligible_attributes: [],
            },
          });
          return acc;
        }, {});

        const formattedSemesters = safeSemesters.map((sem) => ({
          ...sem,
          user_courses: userCoursesBySemesterId[sem.id] || [],
        }));

        setSemesters(formattedSemesters);
        setPlanCache((prev) => ({
          ...prev,
          [activePlanId]: formattedSemesters,
        }));
        setLoading(false);
        profiler.step("state-commit");
        profiler.end();
      } catch (profileErr) {
        console.error("Failed to load dashboard data:", profileErr);
        if (!isStale()) {
          setUserProfile({
            name: user.user_metadata?.name || "",
            email: user.email || "",
            major: "",
            studentType: "",
          });
        }
        throw profileErr;
      }
    } catch (err) {
      console.error(err);
      if (!isStale()) {
        setLoading(false);
      }
      profiler.end();
    }
  }

  async function fetchPrerequisiteCourses() {
    const profiler = createDashboardProfiler("catalog-fetch");

    try {
      const pageSize = 500;
      const fetchedCourses = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("courses")
          .select(`
            id, code, number, name, credits, attribute,
            course_eligible_attributes ( attribute )
          `)
          .order("code", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data?.length) break;

        fetchedCourses.push(...data);

        if (data.length < pageSize) {
          break;
        }

        from += pageSize;
      }
      profiler.step("courses");

      setPrerequisiteCourses(fetchedCourses);
      profiler.step("state-commit");
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      profiler.end();
    }
  }

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      if (skipNextPlanReloadRef.current) {
        skipNextPlanReloadRef.current = false;
        return;
      }
      initialize(true, selectedPlanId);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    async function loadReviewStats() {
      const profiler = createDashboardProfiler("review-stats");
      const courseIds = [
        ...new Set(
          semesters.flatMap((semester) =>
            (semester.user_courses || [])
              .map((course) => course.course_id)
              .filter(Boolean),
          ),
        ),
      ];

      if (!courseIds.length) {
        setReviewStatsByCourseId(EMPTY_DASHBOARD_REVIEW_STATS);
        profiler.step("empty");
        profiler.end();
        return;
      }

      const cachedStats = Object.fromEntries(
        courseIds
          .filter((courseId) => dashboardReviewStatsCache.has(courseId))
          .map((courseId) => [courseId, dashboardReviewStatsCache.get(courseId)]),
      );

      setReviewStatsByCourseId(cachedStats);

      const missingCourseIds = courseIds.filter(
        (courseId) =>
          !dashboardReviewStatsCache.has(courseId) &&
          !pendingDashboardReviewStats.has(courseId),
      );

      if (!missingCourseIds.length) {
        profiler.step("cache-hit");
        profiler.end();
        return;
      }

      missingCourseIds.forEach((courseId) => pendingDashboardReviewStats.add(courseId));

      const { data, error } = await supabase
        .from("course_reviews")
        .select("course_id, difficulty, would_recommend")
        .in("course_id", missingCourseIds);
      profiler.step("query");

      if (error) {
        missingCourseIds.forEach((courseId) => pendingDashboardReviewStats.delete(courseId));
        console.error("Failed to load dashboard review stats:", error);
        profiler.end();
        return;
      }

      const fetchedStats = buildDashboardReviewStatsLookup(missingCourseIds, data || []);

      missingCourseIds.forEach((courseId) => {
        pendingDashboardReviewStats.delete(courseId);
        dashboardReviewStatsCache.set(courseId, fetchedStats[courseId]);
      });

      if (cancelled) {
        profiler.step("cancelled");
        profiler.end();
        return;
      }

      setReviewStatsByCourseId((prev) => ({
        ...prev,
        ...fetchedStats,
      }));
      profiler.step("state-commit");
      profiler.end();
    }

    const scheduleLoad = () => {
      if (cancelled) return;
      loadReviewStats();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(scheduleLoad, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(scheduleLoad, 180);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loading, semesters]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
      setIsTabletLayout(window.innerWidth <= TABLET_BREAKPOINT);
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

  useEffect(() => {
    const invalidOverloadSemesters = semesters.filter(
      (semester) =>
        semester.load_mode === "overload" &&
        overloadRestrictionBySemesterId[semester.id],
    );

    if (!invalidOverloadSemesters.length || !authUser?.id) {
      return;
    }

    updateSemesterList((prev) =>
      prev.map((semester) =>
        invalidOverloadSemesters.some((item) => item.id === semester.id)
          ? {
              ...semester,
              load_mode: "normal",
              target_credits: LOAD_CONFIG.normal.targetCredits,
            }
          : semester,
      ),
    );

    invalidOverloadSemesters.forEach(async (semester) => {
      const { error } = await supabase
        .from("user_semesters")
        .update({
          load_mode: "normal",
          target_credits: LOAD_CONFIG.normal.targetCredits,
        })
        .eq("id", semester.id)
        .eq("user_id", authUser.id);

      if (error) {
        console.error("Failed to normalize restricted overload semester:", error);
      }
    });
  }, [authUser?.id, overloadRestrictionBySemesterId, semesters, updateSemesterList]);

  useEffect(() => {
    const isCatalogOpen = isMobile ? mobileCatalogOpen : sidebarOpen;
    if (!isCatalogOpen || hasLoadedPrerequisiteCourses) return;

    fetchPrerequisiteCourses();
    setHasLoadedPrerequisiteCourses(true);
  }, [hasLoadedPrerequisiteCourses, isMobile, mobileCatalogOpen, sidebarOpen]);

  const updateSemesterStatus = useCallback(async (id, newStatus) => {
    if (!authUser?.id) return;

    updateSemesterById(id, (semester) => {
      if (semester.status === newStatus) return semester;
      return { ...semester, status: newStatus };
    });

    setPlanCache((prev) => {
      if (!selectedPlanId || !prev[selectedPlanId]) return prev;

      return {
        ...prev,
        [selectedPlanId]: prev[selectedPlanId].map((semester) =>
          semester.id === id ? { ...semester, status: newStatus } : semester
        ),
      };
    });

    const { error } = await supabase
      .from("user_semesters")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      console.error("Failed to update semester status:", error);
      await initialize();
    }
  }, [authUser?.id, updateSemesterById]);

  const updateSemesterLoadMode = useCallback(async (id, newLoadMode) => {
    if (!authUser?.id) return;

    if (
      newLoadMode === "overload" &&
      overloadRestrictionBySemesterId[id]
    ) {
      return;
    }

    const targetCredits = LOAD_CONFIG[newLoadMode]?.targetCredits ?? 17;

    updateSemesterById(id, (semester) => {
      if (
        semester.load_mode === newLoadMode &&
        semester.target_credits === targetCredits
      ) {
        return semester;
      }

      return {
        ...semester,
        load_mode: newLoadMode,
        target_credits: targetCredits,
      };
    });

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
  }, [authUser?.id, initialize, overloadRestrictionBySemesterId, updateSemesterById]);

  const updateSemesterName = useCallback((id, name) => {
    updateSemesterById(id, (sem) => ({ ...sem, name }));
  }, [updateSemesterById]);

  async function updateSemesterStudentStatus(id, newStudentStatus) {
    if (!authUser?.id) return;

    const normalized = newStudentStatus || null;

    setSemesters((prev) =>
      prev.map((semester) => {
        if (semester.id !== id) return semester;
        const next = { ...semester, student_status: normalized };
        if (
          (normalized === "freshman" || normalized === "sophomore") &&
          semester.load_mode === "overload"
        ) {
          next.load_mode = "normal";
          next.target_credits = LOAD_CONFIG.normal.targetCredits;
        }
        return next;
      }),
    );

    const updates = { student_status: normalized };
    if (
      (normalized === "freshman" || normalized === "sophomore") &&
      semesters.find((s) => s.id === id)?.load_mode === "overload"
    ) {
      updates.load_mode = "normal";
      updates.target_credits = LOAD_CONFIG.normal.targetCredits;
    }

    const { error } = await supabase
      .from("user_semesters")
      .update(updates)
      .eq("id", id)
      .eq("user_id", authUser.id);

    if (error) {
      console.error("Failed to update student status:", error);
    }
  }

  const updateSemesterLock = useCallback(async (id, isLocked) => {
    if (!authUser?.id) return;

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
  }, [authUser?.id]);

  const updateCourseGrade = useCallback(async (courseId, field, value) => {
    const normalizedValue = field === "credits" ? Number(value) || 0 : value;

    setSemesters((prev) =>
      prev.map((sem) => ({
        ...sem,
        user_courses: sem.user_courses.map((c) =>
          c.id === courseId ? { ...c, [field]: normalizedValue } : c,
        ),
      })),
    );

    const updates = { [field]: normalizedValue };

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
  }, []);

  const moveCourse = useCallback(async (courseId, fromSemesterId, toSemesterId) => {
    if (fromSemesterId === toSemesterId) return false;

    const targetSemester = semesters.find((semester) => semester.id === toSemesterId);
    const sourceSemester = semesters.find((semester) => semester.id === fromSemesterId);
    const movingCourse =
      sourceSemester?.user_courses?.find((course) => course.id === courseId) || null;

    if (!targetSemester || !movingCourse) {
      return false;
    }

    if (movingCourse.course_id) {
      const { data: prereqs, error: prereqError } = await supabase
  .from("prerequisites")
  .select("prereq_course_id, group_id")
  .eq("course_id", movingCourse.course_id);

      if (prereqError) {
        console.error("Failed to check prerequisites before move:", prereqError);
        showToast("Error checking prerequisites.");
        return false;
      }

      const targetSemesterNumber = Number(targetSemester.semester_number ?? 0);
      const missingPrereqIds = (prereqs || [])
        .map((prereq) => prereq.prereq_course_id)
        .filter(Boolean)
        .filter((prereqCourseId) => {
          if (passedCourseIds.has(prereqCourseId)) {
            return false;
          }

          return !semesters.some((semester) => {
            const semesterNumber = Number(semester.semester_number ?? 0);

            if (semesterNumber >= targetSemesterNumber) {
              return false;
            }

            return (semester.user_courses || []).some(
              (course) => course.id !== courseId && course.course_id === prereqCourseId,
            );
          });
        });

      if (missingPrereqIds.length > 0) {
        const { data: missingCourses } = await supabase
          .from("courses")
          .select("id, code, number, name")
          .in("id", missingPrereqIds);

        showToast(`Cannot move course. Missing prerequisites: ${(missingCourses || []).map((course) => `${course.code} ${course.number} - ${course.name}`).join(", ")}`);

        return false;
      }
    }
    // Check if moving would exceed the target credits of the destination semester
    const movingCourseCredits = getCourseCredits(movingCourse);
    const currentTargetCredits = targetSemester.target_credits ?? 15;
    const currentSemesterCredits = (targetSemester.user_courses || []).reduce(
      (sum, uc) => sum + getCourseCredits(uc),
      0,
    );

    if (currentSemesterCredits + movingCourseCredits > currentTargetCredits) {
      showToast(`Cannot move: would exceed the target of ${currentTargetCredits} credits for this semester.`, "error");
      return false;
    }

    updateSemesterList((prev) => {
      let movedCourse = null;
      let changed = false;

      const updated = prev.map((sem) => {
        if (sem.id === fromSemesterId) {
          const remaining = sem.user_courses.filter((c) => {
            if (c.id === courseId) {
              movedCourse = c;
              return false;
            }
            return true;
          });

          if (remaining.length !== sem.user_courses.length) {
            changed = true;
            return { ...sem, user_courses: remaining };
          }
        }
        return sem;
      });

      if (!changed || !movedCourse) {
        return prev;
      }

      return updated.map((sem) => {
        if (sem.id === toSemesterId) {
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

    const { error } = await supabase
      .from("user_courses")
      .update({ semester_id: toSemesterId })
      .eq("id", courseId);

    if (error) {
      console.error("Failed to move course:", error);
      await initialize(true, selectedPlanId);
      return false;
    }

    return true;
  }, [initialize, passedCourseIds, selectedPlanId, semesters, updateSemesterList]);

  const deleteCourse = useCallback(async (courseId) => {
    updateSemesterContainingCourse(courseId, (semester) => {
      const nextCourses = semester.user_courses.filter((course) => course.id !== courseId);
      if (nextCourses.length === semester.user_courses.length) {
        return semester;
      }

      return { ...semester, user_courses: nextCourses };
    });

    await supabase.from("user_courses").delete().eq("id", courseId);
  }, [updateSemesterContainingCourse]);

  const handleSidebarDrop = useCallback(async (
    course,
    semesterId,
    electiveAttribute,
    semesterTargetCredits = 15,
  ) => {
    console.log("handleSidebarDrop called", { course, semesterId, electiveAttribute });
    if (!semesterId) {
      alert("Please choose a semester first.");
      return;
    }

    if (!authUser?.id) {
      alert("User session not ready. Please refresh and try again.");
      return;
    }

    const targetSemester = semesters.find((s) => s.id === semesterId);
    const currentPlanId = targetSemester?.plan_id || selectedPlanId;
    const targetSemCourses = targetSemester?.user_courses || [];

    if (course) {
      const alreadyInTargetSemester = targetSemCourses.some(
        (userCourse) => userCourse.course_id === course.id,
      );

      if (alreadyInTargetSemester) {
        showToast("This course is already added in this semester.");
        return;
      }

      const { data: prereqs, error: prereqError } = await supabase
  .from("prerequisites")
  .select("prereq_course_id, group_id")
  .eq("course_id", course.id);

      if (prereqError) {
        alert("Error checking prerequisites.");
        return;
      }

      if (prereqs?.length > 0) {
  const targetSemesterNumber = Number(targetSemester?.semester_number ?? 0);
  const { data: currentPlanSemesters, error: currentPlanSemestersError } =
    await supabase
      .from("user_semesters")
      .select("id, semester_number")
      .eq("user_id", authUser.id)
      .eq("plan_id", currentPlanId);
  if (currentPlanSemestersError) {
    alert("Error checking plan semesters.");
    return;
  }

  const semesterNumberById = Object.fromEntries(
    (currentPlanSemesters || []).map((semester) => [semester.id, semester.semester_number]),
  );

  const currentPlanSemesterIds = (currentPlanSemesters || [])
    .map((s) => s.id)
    .filter(Boolean);

  const { data: freshUserCourses, error: freshUserCoursesError } =
    currentPlanSemesterIds.length > 0
      ? await supabase
          .from("user_courses")
          .select("course_id, grade, semester_id")
          .eq("user_id", authUser.id)
          .in("semester_id", currentPlanSemesterIds)
      : { data: [], error: null };

  if (freshUserCoursesError) {
    alert("Error checking completed courses.");
    return;
  }

const prerequisiteMet = new Set();
const FAILED_GRADES = new Set(["F", "W", "WF", "FAIL"]);

for (const userCourse of freshUserCourses || []) {
  const grade = userCourse.grade ? String(userCourse.grade).trim().toUpperCase() : null;
  const semesterNumber = Number(semesterNumberById[userCourse.semester_id] ?? 0);

  if (semesterNumber > 0 && semesterNumber < targetSemesterNumber && (!grade || !FAILED_GRADES.has(grade))) {
    prerequisiteMet.add(userCourse.course_id);
  }
}

// Group prerequisites by group_id
const groupedPrereqs = {};
for (const prereq of prereqs) {
  const groupId = prereq.group_id || "default";
  if (!groupedPrereqs[groupId]) {
    groupedPrereqs[groupId] = [];
  }
  groupedPrereqs[groupId].push(prereq.prereq_course_id);
}

// Check if at least one course from each group is satisfied
const missingGroups = [];
for (const [groupId, courseIds] of Object.entries(groupedPrereqs)) {
  const hasAtLeastOne = courseIds.some((courseId) => prerequisiteMet.has(courseId));
  if (!hasAtLeastOne) {
    missingGroups.push(...courseIds);
  }
}
        if (missingGroups.length > 0) {
  const { data: missingCourses } = await supabase
    .from("courses")
    .select("id, code, number, name")
    .in(
      "id",
      [...new Set(missingGroups)],
    );

          showToast(`Missing prerequisites: ${(missingCourses || []).map((c) => `${c.code} ${c.number} - ${c.name}`).join(", ")}`);
          return;
        }
      }

      const {
        selectedSemester,
        earliestTemplateSemester,
      } = await fetchTemplatePlacementForCourse({
        userId: authUser.id,
        selectedSemesterId: semesterId,
        course,
      });

      if (
        selectedSemester &&
        earliestTemplateSemester &&
        selectedSemester.semester_number < earliestTemplateSemester
      ) {
        showToast(`This course is assigned to semester ${earliestTemplateSemester} or later in the selected template.`);
        return;
      }

      const currentCredits = targetSemCourses.reduce(
        (sum, uc) => sum + getCourseCredits(uc),
        0,
      );

      if (currentCredits + (course.credits ?? 0) > semesterTargetCredits) {
        showToast(`Cannot add: would exceed the target of ${semesterTargetCredits} credits for this semester.`);
        return;
      }
    }

    if (!course) {
      const currentCredits = targetSemCourses.reduce(
        (sum, uc) => sum + getCourseCredits(uc),
        0,
      );

      if (currentCredits + 3 > semesterTargetCredits) {
        showToast(`Cannot add: would exceed the target of ${semesterTargetCredits} credits for this semester.`);
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
      "CMPS Elective": "CMPS Elective",

    };

    const ELIGIBLE_TO_ATTRIBUTE = {
  "Engl. Communication": "Engl. Communication",
  "Arab. Communication": "Arab. Communication",
  "Human Values": "Human Values",
  "Cultures & Histories": "Cultures & Histories",
  "Societies & Individuals": "Societies & Individuals",
  "Understanding the World": "Understanding the World",
  "Technical Elective": "Technical Elective",
  "CEL": "CEL",
};

const courseFirstEligible = course?.course_eligible_attributes?.[0]?.attribute || course?.attribute;
const attributeToUse =
  BUCKET_TO_ATTRIBUTE[electiveAttribute] ||
  (courseFirstEligible && ELIGIBLE_TO_ATTRIBUTE[courseFirstEligible]
    ? ELIGIBLE_TO_ATTRIBUTE[courseFirstEligible]
    : null) ||
  (course && !electiveAttribute ? "Major Course" : electiveAttribute) ||
  "Elective";

    const tempId = `temp-${Date.now()}`;
    const optimisticEntry = {
      id: tempId,
      course_id: course?.id ?? null,
      semester_id: semesterId,
      attribute: attributeToUse,
      grade: null,
      credits: course?.credits ?? 3,
      courses: course
        ? {
            id: course.id,
            name: course.name,
            code: course.code,
            number: course.number,
            credits: course.credits,
            attribute: course.attribute ?? null,
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

    updateSemesterById(semesterId, (semester) => ({
      ...semester,
      user_courses: [...semester.user_courses, optimisticEntry],
    }));

    const { data, error } = await supabase
      .from("user_courses")
      .insert({
        user_id: authUser.id,
        course_id: course?.id ?? null,
        semester_id: semesterId,
        grade: null,
        attribute: attributeToUse,
      })
      .select(`
        *,
        courses (
          id, name, code, number, credits, attribute,
          course_eligible_attributes ( attribute )
        )
      `)
      .single();

    if (error) {
      console.error("Failed to add course:", error);
      updateSemesterById(semesterId, (semester) => {
        const nextCourses = semester.user_courses.filter((uc) => uc.id !== tempId);
        if (nextCourses.length === semester.user_courses.length) {
          return semester;
        }

        return {
          ...semester,
          user_courses: nextCourses,
        };
      });
      return;
    }

    updateSemesterById(semesterId, (semester) => {
      const courseIndex = semester.user_courses.findIndex((uc) => uc.id === tempId);
      if (courseIndex === -1) {
        return semester;
      }

      const nextCourses = [...semester.user_courses];
      nextCourses[courseIndex] = {
        ...data,
        courses: data.courses ?? {
          id: null,
          name: attributeToUse,
          code: "ELECTIVE",
          credits: 3,
          course_eligible_attributes: [],
        },
      };

      return {
        ...semester,
        user_courses: nextCourses,
      };
    });
}, [authUser?.id, selectedPlanId, semesters, updateSemesterById]);
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

      const newSemester = { ...data, user_courses: [] };

      setSemesters((prev) => {
        const updated = [...prev, newSemester];

        setPlanCache((cachePrev) => ({
          ...cachePrev,
          [selectedPlanId]: updated,
        }));

        return updated;
      });

      setNewSemesterName("");
    } catch (err) {
      console.error("Error adding semester:", err);
      alert(err.message || "Failed to add semester.");
    } finally {
      setAddingSemester(false);
    }
  }
 const majorProgress = useMemo(
  () => calcMajorRequirementsProgress(semesters, allCourses, prerequisiteCourses),
  [semesters, allCourses, prerequisiteCourses]  
);

    async function handleExport(format) {
    setExportMenuOpen(false);

    const incompleteMajorRows = majorProgress.requiredRows.filter((r) => r.status === "missing" || r.status === "failed");
    const electivesMissing = majorProgress.electiveCreditsEarned < majorProgress.electiveCreditsRequired;
    const incompleteElectiveRows = electiveRows.filter((row) => !row.isExact);

    const details = [];

    // Add missing/failed major requirements
    if (incompleteMajorRows.length > 0) {
      details.push(
        "Missing major courses:",
        incompleteMajorRows.map((r) => `• ${r.code} ${r.number} - ${r.name}`).join("\n")
      );
    }

    // Add missing CMPS electives
    if (electivesMissing) {
      details.push(
        `CMPS electives: ${majorProgress.electiveCreditsEarned}/${majorProgress.electiveCreditsRequired} credits`
      );
    }

    // Add incomplete electives
    if (incompleteElectiveRows.length > 0) {
      details.push(
        "Incomplete elective requirements:",
        incompleteElectiveRows.map((row) => `• ${row.bucket}: ${row.earned}/${row.required}`).join("\n")
      );
    }

    // Show alert if any issues
    if (details.length > 0) {
      alert(
        `Cannot export your graduation plan.\n\n` +
        `Please fix the following before exporting:\n\n${details.join("\n")}`
      );
      return;
    }

    if (!semesters.length) {
      alert("There are no semesters to export yet.");
      return;
    }

    try {
      setExporting(true);
      const semesterDifficulties = await computeSemesterDifficulties(semesters);
      const activePlan = plans.find((p) => p.id === selectedPlanId);
      const profile = {
        name: userProfile.name || authUser?.email || "",
        email: userProfile.email || authUser?.email || "",
        major: userProfile.major || "",
        gpa: totalGPA,
        creditsCompleted: completed,
        totalCredits: total,
      };

      const args = {
        planTitle: activePlan?.name || "Graduation Plan",
        profile,
        semesters,
        semesterDifficulties,
      };

      if (format === "pdf") {
        exportPlanAsPDF(args);
      } else {
        exportPlanAsExcel(args);
      }
    } catch (err) {
      console.error("Failed to export plan:", err);
      alert("Failed to export plan. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const handleMobileQuickAddCourse = useCallback(async (courseId) => {
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
  }, [handleSidebarDrop, mobileQuickAddSemesterId, prerequisiteCourses, semesters]);
const handleMobileQuickAddCmpsElective = useCallback(async () => {
  const targetSemester = semesters.find(
    (semester) => semester.id === mobileQuickAddSemesterId,
  );
  await handleSidebarDrop(
    null,
    mobileQuickAddSemesterId,
    "CMPS Elective",
    targetSemester?.target_credits ?? 15,
  );
}, [handleSidebarDrop, mobileQuickAddSemesterId, semesters]);

  const handleMobileQuickAddElective = useCallback(async (bucket) => {
    const targetSemester = semesters.find(
      (semester) => semester.id === mobileQuickAddSemesterId,
    );

    await handleSidebarDrop(
      null,
      mobileQuickAddSemesterId,
      bucket,
      targetSemester?.target_credits ?? 15,
    );
  }, [handleSidebarDrop, mobileQuickAddSemesterId, semesters]);


  const totalGPA = calculateCumulativeGPAWithRepeats(allCourses, semesters);
  const totalHours = calculateGPACreditHours(allCourses, semesters);
  const { completed } = calcCredits(semesters);
  // Total credits required varies by student type:
  // freshman → 120 (full degree), regular/transfer → 90 (entered with credit).
  const total = userProfile.studentType === "freshman" ? 120 : 90;
  const electiveRows = useMemo(() => calcElectivesProgress(semesters), [semesters]);
  const electivesRemainingTotal = useMemo(
    () => electiveRows.reduce((sum, row) => sum + row.remaining, 0),
    [electiveRows],
  );
 
const majorRequirementsMet = useMemo(
  () =>
    majorProgress.requiredRows.every((r) => r.status === "passed") &&
    majorProgress.electiveCreditsEarned >= majorProgress.electiveCreditsRequired,
  [majorProgress]
);

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
            {electiveRows.map((row) => {
              const ok = row.isExact;
              return (
                <div
                  key={row.bucket}
                  style={{
                    border: ok ? "1px solid #86efac" : "1px solid #fecaca",
                    borderRadius: 10,
                    padding: 10,
                    background: ok ? "#f0fdf4" : "#fef2f2",
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
                    <span style={{ color: ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
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
                        background: ok ? "#16a34a" : "#dc2626",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ) : null;

  if (loading) {
    return <DashboardLoadingShell isMobile={isMobile} isTabletLayout={isTabletLayout} />;
  }

  return (
    <DashboardDndProvider isMobile={isMobile}>
      <DragLayerHost isMobile={isMobile} />

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
          {toast && (
  <div style={{
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    background: toast.type === "error" ? "#dc2626" : "#16a34a",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    maxWidth: "90vw",
    textAlign: "center",
    pointerEvents: "none",
  }}>
    {toast.message}
  </div>
)}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => navigate("/settings")}
                aria-label="Settings"
                title="Settings"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  color: "#111",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <SettingsIcon size={18} />
              </button>
              <button
                onClick={handleSignOut}
                onMouseEnter={() => setIsSignOutHovered(true)}
                onMouseLeave={() => setIsSignOutHovered(false)}
                aria-label="Sign out"
                title="Sign out"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border: isSignOutHovered ? "1px solid #dc2626" : "1px solid #ddd",
                  background: isSignOutHovered ? "#dc2626" : "#fafafa",
                  color: isSignOutHovered ? "#fff" : "#111",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
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

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                disabled={exporting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  minHeight: 44,
                  cursor: exporting ? "wait" : "pointer",
                  opacity: exporting ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {exporting ? "Exporting..." : "Export"}
                <span style={{ fontSize: 10 }}>▼</span>
              </button>

              {exportMenuOpen && (
                <>
                  <div
                    onClick={() => setExportMenuOpen(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 199,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 200,
                      minWidth: 170,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleExport("pdf")}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 14,
                        color: "#111",
                      }}
                    >
                      Export as PDF
                    </button>
                    <div style={{ height: 1, background: "#f1f5f9" }} />
                    <button
                      type="button"
                      onClick={() => handleExport("excel")}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 14,
                        color: "#111",
                      }}
                    >
                      Export as Excel
                    </button>
                  </div>
                </>
              )}
            </div>

            {isMobile && (
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
            )}
            {isMobile && (
  <button
    type="button"
    onClick={() => setMobileMajorReqOpen((prev) => !prev)}
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
    {mobileMajorReqOpen ? "Hide Major Req." : "Major Req."}
  </button>
)}
          </div>
        </div>

        {mobileElectivesPanel}
{isMobile && mobileMajorReqOpen && (
  <div style={{ padding: "0 16px 16px" }}>
    <MajorRequirementsPanel majorProgress={majorProgress} />
  </div>
)}

        <div
          style={{
            display: "flex",
            flexDirection: isMobile || isTabletLayout ? "column" : "row",
            gap: isMobile ? 16 : isTabletLayout ? 20 : 24,
            alignItems: "flex-start",
            padding:
              isMobile
                ? "0 16px 24px"
                : isTabletLayout
                  ? "0 20px 24px"
                  : "0 24px 24px",
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
              overflow: "visible",
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

<div style={{ flex: 1, overflowY: "auto", overflowX: "visible" }}>
              <PrerequisiteSidebar
                courses={prerequisiteCourses}
                enrolledCourseIds={enrolledCourseIds}
                electiveRows={electiveRows}
                allUserCourses={allCourses}
                isMobile={isMobile}
                mobileSemesterId={mobileQuickAddSemesterId}
                onMobileSemesterChange={setMobileQuickAddSemesterId}
                semesters={semesters}
                onQuickAddCourse={handleMobileQuickAddCourse}
                onQuickAddElective={handleMobileQuickAddElective}
                cmpsElectiveCreditsEarned={majorProgress.electiveCreditsEarned}
                onQuickAddCmpsElective={handleMobileQuickAddCmpsElective}
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
              updateSemesterName={updateSemesterName}
              updateStatus={updateSemesterStatus}
              updateLoadMode={updateSemesterLoadMode}
              updateLock={updateSemesterLock}
              updateStudentStatus={updateSemesterStudentStatus}
              updateCourse={updateCourseGrade}
              moveCourse={moveCourse}
              deleteCourse={deleteCourse}
              onSidebarDrop={handleSidebarDrop}
              isMobile={isMobile}
              isAddCourseOpen={openAddCourseSemesterId === sem.id}
              onToggleAddCourse={handleToggleAddCourse}
              reviewStatsByCourseId={reviewStatsByCourseId}
              overloadDisabledReason={overloadRestrictionBySemesterId[sem.id]}
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
                width: isTabletLayout ? "100%" : 320,
                flexShrink: 0,
                position: isTabletLayout ? "static" : "sticky",
                top: isTabletLayout ? "auto" : 110,
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
  
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {electiveRows.map((row) => {
                    const ok = row.isExact;
                    return (
                      <div
                        key={row.bucket}
                        style={{
                          border: ok ? "1px solid #86efac" : "1px solid #fecaca",
                          borderRadius: 10,
                          padding: 10,
                          background: ok ? "#f0fdf4" : "#fef2f2",
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
                          <span style={{ color: ok ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
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
                              background: ok ? "#16a34a" : "#dc2626",
                              borderRadius: 999,
                            }}
                          />
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
        <div style={{ marginTop: 16 }}>
      <MajorRequirementsPanel majorProgress={majorProgress} />
    </div>
  </div>
          )}
        </div>
      </div>
    </DashboardDndProvider>
  );
}

let _desktopDndManager = null;
function getDesktopDndManager() {
  if (!_desktopDndManager) {
    _desktopDndManager = createDragDropManager(HTML5Backend);
  }
  return _desktopDndManager;
}

function DashboardDndProvider({ children, isMobile }) {
  if (isMobile) {
    return <MultiDndProvider options={DND_OPTIONS}>{children}</MultiDndProvider>;
  }

  return <DndProvider manager={getDesktopDndManager()}>{children}</DndProvider>;
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
function MajorRequirementsPanel({ majorProgress }) {
  const { requiredRows, electiveCreditsEarned, electiveCreditsRequired } = majorProgress;
  const electivePct = Math.min(100, Math.round((electiveCreditsEarned / electiveCreditsRequired) * 100));
  const electiveMet = electiveCreditsEarned >= electiveCreditsRequired;

  const statusLabel = {
    passed: (uc) => uc.grade,
    planned: () => "In plan",
    missing: () => "Not added",
    failed: (uc) => `Failed (${uc.grade})`,
  };

  const statusStyle = {
    passed:  { border: "1px solid #86efac", background: "#f0fdf4", badge: { background: "#dcfce7", color: "#15803d" } },
    planned: { border: "1px solid #fde68a", background: "#fffbeb", badge: { background: "#fef3c7", color: "#92400e" } },
    missing: { border: "1px solid #e5e7eb", background: "#f9fafb", badge: { background: "#f3f4f6", color: "#6b7280" } },
    failed:  { border: "1px solid #fecaca", background: "#fef2f2", badge: { background: "#fee2e2", color: "#b91c1c" } },
  };

  const completedCount = requiredRows.filter((r) => r.status === "passed" || r.status === "planned").length;

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 14, border: "1px solid #eee", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Major Requirements</span>
        <span style={{ fontSize: 12, color: "#666" }}>
          {completedCount} / {requiredRows.length} done
        </span>
      </div>

      {/* Required courses */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
        Required Courses
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {requiredRows.map((row) => {
          const s = statusStyle[row.status];
          return (
            <div key={`${row.code}-${row.number}`} style={{ border: s.border, borderRadius: 8, padding: "7px 10px", background: s.background, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#111" }}>
                  {row.code} {row.number}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{row.name}</div>
              </div>
              <span style={{ ...s.badge, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                {statusLabel[row.status](row)}
              </span>
            </div>
          );
        })}
      </div>

      {/* CMPS Electives */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", margin: "10px 0 6px" }}>
        CMPS Electives
      </div>
      <div style={{
        border: electiveMet ? "1px solid #86efac" : "1px solid #fde68a",
        borderRadius: 8,
        padding: 10,
        background: electiveMet ? "#f0fdf4" : "#fffbeb",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>CMPS electives</span>
          <span style={{ color: electiveMet ? "#15803d" : "#92400e", fontWeight: 600 }}>
            {electiveCreditsEarned} / {electiveCreditsRequired} cr.
          </span>
        </div>
        <div style={{ height: 6, background: "#eee", borderRadius: 999, marginTop: 6 }}>
          <div style={{ height: 6, width: `${electivePct}%`, background: electiveMet ? "#16a34a" : "#f59e0b", borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}
function DragLayerHost({ isMobile }) {
  const isDragging = useDragLayer((monitor) => monitor.isDragging());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const preload = () => {
      if (cancelled) return;
      loadCustomDragLayer().catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(preload, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(preload, 500);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!isDragging) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyCustomDragLayer isMobile={isMobile} />
    </Suspense>
  );
}
