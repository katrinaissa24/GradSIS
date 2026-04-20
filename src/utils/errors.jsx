import { supabase } from "../services/supabase";
import React, { useState, useEffect, useCallback } from "react";
import "./errors.css";

const PASSED_GRADES = [
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
];

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

export default function Prerequisite({
  userId,
  selectedSemesterId,
  onCourseRegistered,
  targetCredits = 17,
  currentCredits = 0,
  loadMode = "normal",
}) {
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creditWarning, setCreditWarning] = useState("");
  const [registering, setRegistering] = useState(false);
  const [codePrefix, setCodePrefix] = useState("");
  const [courseNumber, setCourseNumber] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [rating, setRating] = useState(null);
  const [recommend, setRecommend] = useState(null);
  const [recommendCount, setRecommendCount] = useState(0);
  const [existingReview, setExistingReview] = useState(null);

  const LOAD_RULES = {
  underload: { min: 0, max: 12, label: "Underload" },
  normal: { min: 13, max: 17, label: "Normal" },
  overload: { min: 18, max: 21, label: "Overload" },
};

  const activeLoadRule = LOAD_RULES[loadMode] || LOAD_RULES.normal;
  const MIN_CREDITS = activeLoadRule.min;
  const MAX_CREDITS = activeLoadRule.max;

  const fetchUserCourses = useCallback(async () => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("user_courses")
      .select("course_id, grade, status")
      .eq("user_id", userId);

    if (error) {
      console.error("fetchUserCourses:", error);
      return [];
    }

    return data || [];
  }, [userId]);

  function checkCreditWarning(total) {
    if (loadMode !== "underload" && total < MIN_CREDITS) {
      setCreditWarning(
        `${activeLoadRule.label} requires at least ${MIN_CREDITS} credits. You currently have ${total}.`,
      );
    } else if (total > MAX_CREDITS) {
      setCreditWarning(
        `${activeLoadRule.label} allows up to ${MAX_CREDITS} credits. You currently have ${total}.`,
      );
    } else if (loadMode === "underload" && total > 12) {
      setCreditWarning(
        `Underload is for 12 credits or fewer. You currently have ${total}.`,
      );
    } else {
      setCreditWarning("");
    }
  }

  function getDifficultyLabel(d) {
  if (d < 1.5) return "Very Easy";
  if (d < 2.5) return "Easy";
  if (d < 3.5) return "Medium";
  if (d < 4.5) return "Hard";
  return "Very Hard";
}

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUserCourses();
      checkCreditWarning(currentCredits);
      setLoading(false);
    };

    init();
  }, [fetchUserCourses, selectedSemesterId, currentCredits, loadMode, targetCredits]);

  useEffect(() => {
    checkCreditWarning(currentCredits);
  }, [currentCredits, targetCredits, loadMode, MIN_CREDITS, MAX_CREDITS]);

  async function handleFetchCourse() {
    if (!codePrefix || !courseNumber) {
      setMessage({
        text: "Enter both course code and number.",
        type: "warning",
      });
      return;
    }

    const normalizedCode = codePrefix.trim().toUpperCase();
    const normalizedNumber = courseNumber.trim();

    const { data, error } = await supabase
    .from("courses")
    .select("*, course_eligible_attributes ( attribute )")
    .eq("code", normalizedCode)
    .eq("number", normalizedNumber)
    .limit(1)
    .single();

    if (error || !data) {
      setMessage({ text: "Course not found.", type: "error" });
      setSelectedCourse(null);
      setRating(null);
      setRecommend(null);
      setRecommendCount(0);
      setExistingReview(null);
      return;
    }

    const { data: sameSemesterEnrollment, error: sameSemesterError } =
      await supabase
        .from("user_courses")
        .select("id")
        .eq("user_id", userId)
        .eq("semester_id", selectedSemesterId)
        .eq("course_id", data.id)
        .neq("status", "dropped")
        .maybeSingle();

    if (sameSemesterError) {
      setMessage({ text: "Error checking enrollment.", type: "error" });
      setSelectedCourse(null);
      setRating(null);
      setRecommend(null);
      setRecommendCount(0);
      setExistingReview(null);
      return;
    }

    if (sameSemesterEnrollment) {
      setMessage({
        text: "You already added this course in this semester.",
        type: "warning",
      });
      setSelectedCourse(null);
      setRating(null);
      setRecommend(null);
      setRecommendCount(0);
      setExistingReview(null);
      return;
    }

    setSelectedCourse(data);
    setMessage(null);

    const { data: reviews, error: reviewsError } = await supabase
      .from("course_reviews")
      .select("user_id, comment, difficulty, would_recommend")
      .eq("course_id", data.id);

    if (reviewsError || !reviews) {
      setRating(null);
      setRecommend(null);
      setRecommendCount(0);
      setExistingReview(null);
      return;
    }

    setExistingReview((reviews || []).find((review) => review.user_id === userId) || null);

    if (reviews.length > 0) {
      const difficultyReviews = reviews.filter((r) => r.difficulty != null);
      const recommendationReviews = reviews.filter(
        (r) => r.would_recommend === true || r.would_recommend === false,
      );

      if (difficultyReviews.length > 0) {
        const avg =
          difficultyReviews.reduce((sum, r) => sum + Number(r.difficulty), 0) /
          difficultyReviews.length;

        setRating({
          avg,
          count: difficultyReviews.length,
        });
      } else {
        setRating(null);
      }

      if (recommendationReviews.length > 0) {
        const recommendCount = recommendationReviews.filter(
          (r) => r.would_recommend === true,
        ).length;

        const percent = Math.round((recommendCount / recommendationReviews.length) * 100);
        setRecommend(percent);
        setRecommendCount(recommendationReviews.length);
      } else {
        setRecommend(null);
        setRecommendCount(0);
      }
    } else {
      setRating(null);
      setRecommend(null);
      setRecommendCount(0);
      setExistingReview(null);
    }
  }

  async function handleSelect() {
    if (!userId) {
      setMessage({
        text: "Please log in to register for courses.",
        type: "error",
      });
      return;
    }

    if (!selectedSemesterId) {
      setMessage({
        text: "Please select a semester before adding a course.",
        type: "warning",
      });
      return;
    }

    if (!selectedCourse) return;

    setRegistering(true);

    try {
      const courseCredits = selectedCourse.credits || 0;
      const newTotal = currentCredits + courseCredits;

      if (newTotal > MAX_CREDITS) {
        setMessage({
          text: `Cannot add: this would bring your total to ${newTotal} credits (max is ${MAX_CREDITS}).`,
          type: "error",
        });
        return;
      }

      const { data: selectedSemesterForPrereqs, error: selectedSemesterForPrereqsError } =
        await supabase
          .from("user_semesters")
          .select("id, semester_number")
          .eq("id", selectedSemesterId)
          .eq("user_id", userId)
          .single();

      if (selectedSemesterForPrereqsError || !selectedSemesterForPrereqs) {
        setMessage({
          text: "Could not verify the selected semester.",
          type: "error",
        });
        return;
      }

      const { data: prereqs, error: prereqError } = await supabase
  .from("prerequisites")
  .select("prereq_course_id, group_id")
  .eq("course_id", selectedCourse.id);
      if (prereqError) {
        setMessage({
          text: "Error checking prerequisites. Please try again.",
          type: "error",
        });
        return;
      }

      if (prereqs?.length > 0) {
        const { data: freshUserCourses, error: freshUserCoursesError } =
          await supabase
            .from("user_courses")
            .select("course_id, grade, status, semester_id")
            .eq("user_id", userId);

        if (freshUserCoursesError) {
          setMessage({
            text: "Error checking completed courses.",
            type: "error",
          });
          return;
        }

        const FAILED_GRADES = new Set(["F", "W", "WF", "FAIL"]);
        const { data: userSemesters, error: userSemestersError } = await supabase
          .from("user_semesters")
          .select("id, semester_number")
          .eq("user_id", userId);

        if (userSemestersError) {
          setMessage({
            text: "Error checking prerequisite semesters.",
            type: "error",
          });
          return;
        }

const semesterNumberById = Object.fromEntries(
  (userSemesters || []).map((semester) => [semester.id, semester.semester_number]),
);

const prerequisiteMet = new Set(
  (freshUserCourses || [])
    .filter((courseRow) => {
      const grade = courseRow.grade ? String(courseRow.grade).trim().toUpperCase() : null;
      const semesterNumber = Number(semesterNumberById[courseRow.semester_id] ?? 0);
      if (!(semesterNumber > 0 && semesterNumber < Number(selectedSemesterForPrereqs.semester_number ?? 0))) {
        return false;
      }
      return !grade || !FAILED_GRADES.has(grade);
    })
    .map((courseRow) => courseRow.course_id)
);

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

const missing = missingGroups.length > 0 ? missingGroups : [];

        if (missing.length > 0) {
          const { data: missingCourses, error: nameError } = await supabase
            .from("courses")
            .select("id, code, number, name")
            .in(
              "id",
              missing,
            );

          if (nameError) {
            setMessage({
              text: "Error fetching prerequisite details.",
              type: "error",
            });
            return;
          }

          setMessage({
            text: `Missing prerequisites: ${(missingCourses || [])
              .map((c) => `${c.code} ${c.number} – ${c.name}`)
              .join(", ")}`,
            type: "warning",
          });
          return;
        }
      }

      const {
        selectedSemester,
        earliestTemplateSemester,
      } = await fetchTemplatePlacementForCourse({
        userId,
        selectedSemesterId,
        course: selectedCourse,
      });

      if (!selectedSemester) {
        setMessage({
          text: "Could not verify the selected semester.",
          type: "error",
        });
        return;
      }

      if (
        earliestTemplateSemester &&
        selectedSemester.semester_number < earliestTemplateSemester
      ) {
        setMessage({
          text: `This course is assigned to semester ${earliestTemplateSemester} or later in the selected template.`,
          type: "warning",
        });
        return;
      }

      const insertError = await assignCourseToSemester(
        selectedCourse,
        selectedSemesterId,
      );

      if (insertError) {
        setMessage({
          text: "Failed to register course. Please try again.",
          type: "error",
        });
        console.error(insertError);
        return;
      }

      await fetchUserCourses();

      setMessage({
        text: `${selectedCourse.code} ${selectedCourse.number} added successfully!`,
        type: "success",
      });
    setSelectedCourse(null);
    setCodePrefix("");
    setCourseNumber("");
    setRating(null);
    setRecommend(null);
    setRecommendCount(0);
    setExistingReview(null);

      if (onCourseRegistered) onCourseRegistered();
    } finally {
      setRegistering(false);
    }
  }

async function assignCourseToSemester(course, semesterId) {
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

  const eligibleAttrs = course.course_eligible_attributes || [];
  const firstEligible = eligibleAttrs[0]?.attribute;
  const attribute =
    firstEligible && ELIGIBLE_TO_ATTRIBUTE[firstEligible]
      ? ELIGIBLE_TO_ATTRIBUTE[firstEligible]
      : "Major Course";
  const { error } = await supabase.from("user_courses").insert({
    user_id: userId,
    course_id: course.id,
    semester_id: semesterId,
    status: "enrolled",
    grade: null,
    attribute,
  });

  return error;
} 

 if (loading) return <div className="prereq-loading">Loading…</div>;

  const creditStatus =
    currentCredits < MIN_CREDITS
      ? "below"
      : currentCredits > MAX_CREDITS
        ? "exceed"
        : "good";

  return (
    <div className="prereq-wrapper">
      <div className="prereq-header">
        <h2 className="prereq-title">Add Courses</h2>
        <div
          className={`prereq-credit-badge prereq-credit-badge--${creditStatus}`}
        >
          {currentCredits} / {MAX_CREDITS} credits
        </div>
      </div>

      {creditWarning && (
        <div className="prereq-notice prereq-notice--warning" role="alert">
          <span className="prereq-notice-icon">⚠</span>
          {creditWarning}
        </div>
      )}

      <div className="prereq-course-search">
        <input
          type="text"
          placeholder="Course code (e.g., CMPS)"
          value={codePrefix}
          onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleFetchCourse()}
        />
        <input
          type="text"
          placeholder="Course number (e.g., 201)"
          value={courseNumber}
          onChange={(e) => setCourseNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetchCourse()}
        />
        <button onClick={handleFetchCourse}>Search</button>
      </div>

      {selectedCourse && (
        <div className="prereq-course-row">
          <div>
            <span className="course-code">
              {selectedCourse.code} {selectedCourse.number}
            </span>
            <span className="course-name">{selectedCourse.name}</span>
            {rating && (
              <span className="course-rating">
                Difficulty: {rating.avg.toFixed(1)} / 5 — {getDifficultyLabel(rating.avg)}
              </span>
            )}
            {recommend !== null && (
              <span className="course-recommend">
                👍 {recommend}% recommend ({recommendCount} vote{recommendCount !== 1 ? "s" : ""})
              </span>
            )}
            {existingReview && (
              <div className="course-recommend" style={{ color: "#374151" }}>
                <strong>Your previous review:</strong>
                {existingReview.difficulty != null && (
                  <span>
                    {" "}
                    Difficulty {existingReview.difficulty}/5
                  </span>
                )}
                {existingReview.would_recommend === true && <span> • Recommended</span>}
                {existingReview.would_recommend === false && <span> • Not recommended</span>}
                {existingReview.comment && <span> • {existingReview.comment}</span>}
              </div>
            )}
            <span className="course-credits">
              + {selectedCourse.credits} credits
            </span>
          </div>
          <button onClick={handleSelect} disabled={registering}>
            {registering ? "Adding…" : "+ Add"}
          </button>
        </div>
      )}

      {message && (
        <div
          className={`prereq-message prereq-message--${message.type}`}
          role="alert"
          aria-live="polite"
        >
          {message.type === "success" && "✓ "}
          {message.type === "warning" && "⚠ "}
          {message.type === "error" && "✕ "}
          {message.text}
        </div>
      )}
    </div>
  );
}
