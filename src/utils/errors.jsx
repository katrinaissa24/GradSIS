import { supabase } from '../services/supabase';
import React, { useState, useEffect, useCallback } from "react";
import "./errors.css";

export default function Prerequisite({ userId, selectedSemesterId, onCourseRegistered }) {
  const [courses, setCourses] = useState([]);
  const [userCourseIds, setUserCourseIds] = useState([]);
  const [message, setMessage] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [semesterCredits, setSemesterCredits] = useState(0);
  const [creditWarning, setCreditWarning] = useState('');
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [registering, setRegistering] = useState(false);

  const MIN_CREDITS = 12;
  const MAX_CREDITS = 17;

  const fetchCourses = useCallback(async () => {
    const { data, error } = await supabase.from("courses").select("*");
    if (error) { console.error("fetchCourses:", error); return; }
    const uniqueCourses = data.filter(
      (course, index, self) => index === self.findIndex(c => c.code === course.code)
    );
    setCourses(uniqueCourses);
  }, []);

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
    if (enrollments.length === 0) { setSemesterCredits(0); setCreditWarning(''); return; }

    const { data: enrolledCourses, error: coursesError } = await supabase
      .from('courses').select('credits').in('id', enrollments.map(e => e.course_id));
    if (coursesError) { console.error(coursesError); return; }

    const total = enrolledCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    setSemesterCredits(total);
    checkCreditWarning(total);
  }, [userId]);


  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([fetchCourses(), fetchUserCourses()]).finally(() => setLoading(false));
  }, [userId, fetchCourses, fetchUserCourses]);

  useEffect(() => {
    if (userId && selectedSemesterId) fetchSemesterCredits(selectedSemesterId);
  }, [selectedSemesterId, userId, fetchSemesterCredits]);

  useEffect(() => {
    if (!courses.length) return;
    let available = courses.filter(c => !userCourseIds.includes(c.id));
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      available = available.filter(
        c => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term)
      );
    }
    setFilteredCourses(available);
  }, [courses, userCourseIds, searchTerm]);


  function checkCreditWarning(total) {
    if (total < MIN_CREDITS) {
      setCreditWarning(`You are enrolled in only ${total} credits. Minimum required is ${MIN_CREDITS}.`);
    } else if (total > MAX_CREDITS) {
      setCreditWarning(`You are enrolled in ${total} credits, which exceeds the maximum of ${MAX_CREDITS}.`);
    } else {
      setCreditWarning('');
    }
  }


  async function handleSelect(courseId) {
    if (!userId) {
      setMessage({ text: "Please log in to register for courses.", type: "error" }); return;
    }
    if (!selectedSemesterId) {
      setMessage({ text: "Please select a semester before adding a course.", type: "warning" }); return;
    }

    const selectedCourse = courses.find(c => c.id === courseId);
    if (!selectedCourse) {
      setMessage({ text: "Course not found.", type: "error" }); return;
    }
    if (userCourseIds.includes(courseId)) {
      setMessage({ text: "You are already enrolled in this course.", type: "warning" }); return;
    }

    const courseCredits = selectedCourse.credits || 0;
    const newTotal = semesterCredits + courseCredits;
    if (newTotal > MAX_CREDITS) {
      setMessage({
        text: `Cannot add: this would bring your total to ${newTotal} credits (max is ${MAX_CREDITS}).`,
        type: "error",
      }); return;
    }

    setMessage(null);
    setRegistering(true);

    try {
      const { data: prereqs, error: prereqError } = await supabase
        .from("prerequisites").select("prereq_course_id").eq("course_id", courseId);

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
        user_id: userId, course_id: courseId, semester_id: selectedSemesterId,
        status: "enrolled", grade: null, attribute: "Major Course",
      });

      if (insertError) {
        setMessage({ text: "Failed to register course. Please try again.", type: "error" });
        console.error(insertError); return;
      }

      const nextTotal = semesterCredits + courseCredits;
      setUserCourseIds(prev => [...prev, courseId]);
      setSemesterCredits(nextTotal);
      checkCreditWarning(nextTotal);
      setMessage({ text: `${selectedCourse.code} added successfully!`, type: "success" });
      if (onCourseRegistered) onCourseRegistered();
    } finally {
      setRegistering(false);
    }
  }


  if (loading) return <div className="prereq-loading">Loading courses…</div>;

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

      {/* Credit warning */}
      {creditWarning && (
        <div className="prereq-notice prereq-notice--warning" role="alert">
          <span className="prereq-notice-icon">⚠</span>
          {creditWarning}
        </div>
      )}

      {/* Search */}
      <div className="prereq-search-row">
        <input
          type="text"
          className="prereq-search"
          placeholder="Search by name or code…"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setMessage(null); }}
          aria-label="Search courses"
        />
        <span className="prereq-count">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Course list*/}
      <div className="prereq-course-list">
        {filteredCourses.length === 0 ? (
          <div className="prereq-empty">
            {searchTerm ? 'No courses match your search.' : 'No available courses found.'}
          </div>
        ) : (
          filteredCourses.map(course => (
            <div key={course.id} className="prereq-course-row">
              <div className="prereq-course-info">
                <span className="prereq-course-name">
                  {course.name}
                  <span className="prereq-course-code"> ({course.code})</span>
                </span>
                <span className="prereq-course-credits">Credits: {course.credits}</span>
              </div>
              <button
                className="prereq-add-btn"
                onClick={() => handleSelect(course.id)}
                disabled={registering}
                aria-label={`Add ${course.code} – ${course.name}`}
              >
                {registering ? '…' : '+ Add'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Feedback message */}
      {message && (
        <div
          className={`prereq-message prereq-message--${message.type}`}
          role="alert"
          aria-live="polite"
        >
          {message.type === 'success' && '✓ '}
          {message.type === 'warning' && '⚠ '}
          {message.type === 'error'   && '✕ '}
          {message.text}
        </div>
      )}
    </div>
  );
}
