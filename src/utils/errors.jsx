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
    overload: { min: 18, max: Math.max(targetCredits, 24), label: "Overload" },
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

      const { data: prereqs, error: prereqError } = await supabase
        .from("prerequisites")
        .select("prereq_course_id")
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
            .select("course_id, grade, status")
            .eq("user_id", userId);

        if (freshUserCoursesError) {
          setMessage({
            text: "Error checking completed courses.",
            type: "error",
          });
          return;
        }

        const freshPassedCourseIds = (freshUserCourses || [])
          .filter((c) => PASSED_GRADES.includes(c.grade)||
    c.status === "enrolled" ||
    c.status === "completed")
          .map((c) => c.course_id);

        const missing = prereqs.filter(
          (p) => !freshPassedCourseIds.includes(p.prereq_course_id),
        );

        if (missing.length > 0) {
          const { data: missingCourses, error: nameError } = await supabase
            .from("courses")
            .select("id, code, number, name")
            .in(
              "id",
              missing.map((m) => m.prereq_course_id),
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

      const { data: selectedSemester, error: selectedSemesterError } =
        await supabase
          .from("user_semesters")
          .select("id, semester_number")
          .eq("id", selectedSemesterId)
          .eq("user_id", userId)
          .single();

      if (selectedSemesterError || !selectedSemester) {
        setMessage({
          text: "Could not verify the selected semester.",
          type: "error",
        });
        return;
      }

      if (
        selectedCourse.req_sem &&
        selectedSemester.semester_number < selectedCourse.req_sem
      ) {
        setMessage({
          text: `This course is intended for semester ${selectedCourse.req_sem} or later.`,
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

  console.log("insert error:", error);
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
