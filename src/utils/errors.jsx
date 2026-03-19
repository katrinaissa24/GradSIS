import { supabase } from "../services/supabase";
import React, { useState, useEffect, useCallback } from "react";
import "./errors.css";

export default function Prerequisite({
  userId,
  selectedSemesterId,
  onCourseRegistered,
  targetCredits = 17,
  currentCredits = 0,
}) {
  const [passedCourseIds, setPassedCourseIds] = useState([]);
  const [blockedCourseIds, setBlockedCourseIds] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creditWarning, setCreditWarning] = useState("");
  const [registering, setRegistering] = useState(false);
  const [codePrefix, setCodePrefix] = useState("");
  const [courseNumber, setCourseNumber] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);

  const MIN_CREDITS = 12;
  const MAX_CREDITS = targetCredits;

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

  const fetchUserCourses = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("user_courses")
      .select("course_id, grade, status")
      .eq("user_id", userId)
      

    if (error) {
      console.error("fetchUserCourses:", error);
      return;
    }

    const passedIds = (data || [])
      .filter((c) => PASSED_GRADES.includes(c.grade))
      .map((c) => c.course_id);

    const blockedIds = (data || [])
      .filter((c) => {
        const isCurrentlyEnrolled = !c.grade || c.grade === "";
        const isPassed = PASSED_GRADES.includes(c.grade);
        return isCurrentlyEnrolled || isPassed;
      })
      .map((c) => c.course_id);

    setPassedCourseIds([...new Set(passedIds)]);
    setBlockedCourseIds([...new Set(blockedIds)]);
  }, [userId]);

  
  useEffect(() => {
    const init = async () => {
      await fetchUserCourses();
      checkCreditWarning(currentCredits);
      setLoading(false);
    };

    init();
  }, [fetchUserCourses, selectedSemesterId]);

  // Re-run credit warning whenever targetCredits changes
  useEffect(() => {
    checkCreditWarning(currentCredits
    );
  }, [targetCredits, currentCredits]);

  function checkCreditWarning(total) {
    if (total < MIN_CREDITS) {
      setCreditWarning(
        `You are enrolled in only ${total} credits. Minimum required is ${MIN_CREDITS}.`,
      );
    } else if (total > MAX_CREDITS) {
      setCreditWarning(
        `You are enrolled in ${total} credits, which exceeds the maximum of ${MAX_CREDITS}.`,
      );
    } else {
      setCreditWarning("");
    }
  }

  async function handleFetchCourse() {
    if (!codePrefix || !courseNumber) {
      setMessage({
        text: "Enter both course code and number.",
        type: "warning",
      });
      return;
    }

    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .ilike("code", codePrefix.trim())
      .eq("number", courseNumber.trim())
      .limit(1)
      .single();

    if (error || !data) {
      setMessage({ text: "Course not found.", type: "error" });
      setSelectedCourse(null);
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
  return;
}

    if (sameSemesterEnrollment) {
  setMessage({
    text: "You already added this course in this semester.",
    type: "warning",
  });
  setSelectedCourse(null);
  return;
}

    setSelectedCourse(data);
    setMessage(null);
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

    const courseCredits = selectedCourse.credits || 0;
    const newTotal = currentCredits + courseCredits;

    if (newTotal > MAX_CREDITS) {
      setMessage({
        text: `Cannot add: this would bring your total to ${newTotal} credits (max is ${MAX_CREDITS}).`,
        type: "error",
      });
      return;
    }

    setRegistering(true);

    try {
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
        const missing = prereqs.filter(
          (p) => !passedCourseIds.includes(p.prereq_course_id),
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

      if (onCourseRegistered) onCourseRegistered();
    } finally {
      setRegistering(false);
    }
  }

  async function assignCourseToSemester(course, semesterId) {
    const { error } = await supabase.from("user_courses").insert({
      user_id: userId,
      course_id: course.id,
      semester_id: semesterId,
      status: "enrolled",
      grade: null,
      attribute: "Major Course",
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
