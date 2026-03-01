import { supabase } from '../services/supabase';
import React, { useState, useEffect, useCallback } from "react";
import "./errors.css";

export default function Prerequisite({ userId, selectedSemesterId, onCourseRegistered }) {
  const [userCourseIds, setUserCourseIds] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [semesterCredits, setSemesterCredits] = useState(0);
  const [creditWarning, setCreditWarning] = useState('');
  const [registering, setRegistering] = useState(false);
  const [codePrefix, setCodePrefix] = useState('');
  const [courseNumber, setCourseNumber] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);

  const MIN_CREDITS = 12;
  const MAX_CREDITS = 17;

  const fetchUserCourses = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("user_courses").select("course_id")
      .eq("user_id", userId).neq("status", "dropped");
    if (error) { console.error("fetchUserCourses:", error); return; }
    setUserCourseIds([...new Set(data.map(c => c.course_id))]);
  }, [userId]);

  const fetchSemesterCredits = useCallback(async (semesterId) => {
    if (!userId || !semesterId) return;
    const { data: enrollments, error: enrollError } = await supabase
      .from('user_courses').select('course_id')
      .eq('user_id', userId).eq('semester_id', semesterId).neq('status', 'dropped');
    if (enrollError) { console.error(enrollError); return; }
    if (enrollments.length === 0) { setSemesterCredits(0); checkCreditWarning(0); return; }

    const { data: enrolledCourses, error: coursesError } = await supabase
      .from('courses').select('credits').in('id', enrollments.map(e => e.course_id));
    if (coursesError) { console.error(coursesError); return; }

    const total = enrolledCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    setSemesterCredits(total);
    checkCreditWarning(total);
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      await fetchUserCourses();
      if (selectedSemesterId) await fetchSemesterCredits(selectedSemesterId);
      setLoading(false);
    };
    init();
  }, [fetchUserCourses, fetchSemesterCredits, selectedSemesterId]);

  function checkCreditWarning(total) {
    if (total < MIN_CREDITS) {
      setCreditWarning(`You are enrolled in only ${total} credits. Minimum required is ${MIN_CREDITS}.`);
    } else if (total > MAX_CREDITS) {
      setCreditWarning(`You are enrolled in ${total} credits, which exceeds the maximum of ${MAX_CREDITS}.`);
    } else {
      setCreditWarning('');
    }
  }

  async function handleFetchCourse() {
    if (!codePrefix || !courseNumber) {
      setMessage({ text: "Enter both course code and number.", type: "warning" });
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
    if (userCourseIds.includes(data.id)) {
      setMessage({ text: "You are already enrolled in this course.", type: "warning" });
      setSelectedCourse(null);
      return;
    }
    setSelectedCourse(data);
    setMessage(null);
  }

  async function handleSelect() {
    if (!userId) {
      setMessage({ text: "Please log in to register for courses.", type: "error" }); return;
    }
    if (!selectedSemesterId) {
      setMessage({ text: "Please select a semester before adding a course.", type: "warning" }); return;
    }
    if (!selectedCourse) return;

    const courseCredits = selectedCourse.credits || 0;
    const newTotal = semesterCredits + courseCredits;
    if (newTotal > MAX_CREDITS) {
      setMessage({
        text: `Cannot add: this would bring your total to ${newTotal} credits (max is ${MAX_CREDITS}).`,
        type: "error",
      }); return;
    }

    setRegistering(true);
    try {
      const { data: prereqs, error: prereqError } = await supabase
        .from("prerequisites").select("prereq_course_id").eq("course_id", selectedCourse.id);
      if (prereqError) {
        setMessage({ text: "Error checking prerequisites. Please try again.", type: "error" }); return;
      }

      if (prereqs?.length > 0) {
        const missing = prereqs.filter(p => !userCourseIds.includes(p.prereq_course_id));
        if (missing.length > 0) {
          const { data: missingCourses, error: nameError } = await supabase
            .from("courses").select("name, code").in("id", missing.map(m => m.prereq_course_id));
          if (nameError) {
            setMessage({ text: "Error fetching prerequisite details.", type: "error" }); return;
          }
          setMessage({
            text: `Missing prerequisites: ${missingCourses.map(c => `${c.code} – ${c.name}`).join(", ")}`,
            type: "warning",
          }); return;
        }
      }

      const { error: insertError } = await supabase.from("user_courses").insert({
        user_id: userId, course_id: selectedCourse.id, semester_id: selectedSemesterId,
        status: "enrolled", grade: null, attribute: "Major Course",
      });

      if (insertError) {
        setMessage({ text: "Failed to register course. Please try again.", type: "error" });
        console.error(insertError); return;
      }

      setUserCourseIds(prev => [...prev, selectedCourse.id]);
      setSemesterCredits(newTotal);
      checkCreditWarning(newTotal);
      setMessage({ text: `${selectedCourse.code} ${selectedCourse.number} added successfully!`, type: "success" });
      setSelectedCourse(null);
      setCodePrefix('');
      setCourseNumber('');
      if (onCourseRegistered) onCourseRegistered();
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return <div className="prereq-loading">Loading…</div>;

  const creditStatus =
    semesterCredits < MIN_CREDITS ? 'below' :
    semesterCredits > MAX_CREDITS ? 'exceed' : 'good';

  return (
    <div className="prereq-wrapper">
      <div className="prereq-header">
        <h2 className="prereq-title">Add Courses</h2>
        <div className={`prereq-credit-badge prereq-credit-badge--${creditStatus}`}>
          {semesterCredits} / {MAX_CREDITS} credits
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
          placeholder="Course code (e.g., cvsp)"
          value={codePrefix}
          onChange={e => setCodePrefix(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleFetchCourse()}
        />
        <input
          type="text"
          placeholder="Course number (e.g., 101)"
          value={courseNumber}
          onChange={e => setCourseNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetchCourse()}
        />
        <button onClick={handleFetchCourse}>Search</button>
      </div>

      {selectedCourse && (
        <div className="prereq-course-row">
          <div>
            <span className="course-code">{selectedCourse.code} {selectedCourse.number}</span>
            <span className="course-name">{selectedCourse.name}</span>
            <span className="course-credits">{selectedCourse.credits} credits</span>
          </div>
          <button onClick={handleSelect} disabled={registering}>
            {registering ? 'Adding…' : '+ Add'}
          </button>
        </div>
      )}

      {message && (
        <div className={`prereq-message prereq-message--${message.type}`} role="alert" aria-live="polite">
          {message.type === 'success' && '✓ '}
          {message.type === 'warning' && '⚠ '}
          {message.type === 'error' && '✕ '}
          {message.text}
        </div>
      )}
    </div>
  );
}