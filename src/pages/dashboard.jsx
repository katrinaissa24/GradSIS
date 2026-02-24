import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import SemesterCard from "../components/SemesterCard";
import { useNavigate } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CustomDragLayer from "../components/CustomDragLayer";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const navigate = useNavigate();

  const PASSING_GRADES = new Set([
    "A+", "A", "A-","B+","B","B-","C+","C","C-","D+","D","D-"
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
      "Elective": "Technical Elective",
      "CEL": "Community Engaged Learning",
    };

  function calcCredits(semesters) {
    let total = 0, completed = 0;
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
    const earned = {};
    for (const k of Object.keys(ELECTIVE_REQUIREMENTS)) earned[k] = 0;

    for (const sem of semesters) {
      for (const uc of sem.user_courses || []) {
        const grade = uc?.grade;
        const credits = uc?.courses?.credits ?? 0;

        if (!grade || !PASSING_GRADES.has(grade)) continue;

        const bucket = ATTRIBUTE_TO_BUCKET[uc?.attribute];
        if (!bucket) continue;

        earned[bucket] += credits;
      }
    }

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

  async function initialize() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/auth");
        return;
      }

      setAuthUser(sessionData.session.user);

      const userId = sessionData.session.user.id;

      const { data: userSemesters } = await supabase
        .from("user_semesters")
        .select("*")
        .eq("user_id", userId)
        .order("semester_number", { ascending: true });

      const semesterIds = userSemesters.map((s) => s.id);

      const { data: userCourses } = await supabase
        .from("user_courses")
        .select("*, courses(id,name,code,credits)")
        .in("semester_id", semesterIds);

      const formattedSemesters = userSemesters.map((sem) => ({
        ...sem,
        user_courses: userCourses.filter((c) => c.semester_id === sem.id),
      }));

      setSemesters(formattedSemesters);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => { initialize(); }, []);

  function updateSemesterStatus(id, newStatus) {
    setSemesters(prev =>
      prev.map(s => s.id === id ? { ...s, status: newStatus } : s)
    );
  }

  function updateCourseGrade(courseId, field, value) {
    setSemesters(prev =>
      prev.map(sem => ({
        ...sem,
        user_courses: sem.user_courses.map(c =>
          c.id === courseId ? { ...c, [field]: value } : c
        ),
      }))
    );
  }

  function moveCourse(courseId, fromSemesterId, toSemesterId) {
  setSemesters(prev => {
    let movedCourse = null;

    const updated = prev.map(sem => {
      if (sem.id === fromSemesterId) {
        const remaining = sem.user_courses.filter(c => {
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

    return updated.map(sem => {
      if (sem.id === toSemesterId && movedCourse) {
        return {
          ...sem,
          user_courses: [...sem.user_courses, { ...movedCourse, semester_id: toSemesterId }]
        };
      }
      return sem;
    });
  });
}

  const { completed } = calcCredits(semesters);
  const total = 120;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const safePercent = Math.min(100, Math.max(0, percent));
  const remaining = Math.max(0, total - completed);

  const electiveRows = calcElectivesProgress(semesters);
  const electivesRemainingTotal = electiveRows.reduce((s, r) => s + r.remaining, 0);

if (loading) {
  return <div style={{ padding: 20 }}>Initializing...</div>;
}
  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer />
      <div style={{ background: "#f4f4f5", minHeight: "100vh", color: "#111" }}>

        {/* NAV BAR */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          backgroundColor: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: 24,
          borderRadius: "0 0 12px 12px",
        }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Dashboard</h1>

          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 16,
              border: "1px solid #eee",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              margin: "0 24px 16px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Electives Tracker</h3>
              <div style={{ fontSize: 13, color: "#666" }}>
                {electivesRemainingTotal} credits remaining
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {electiveRows.map((r) => (
                <div key={r.bucket} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{r.bucket}</span>
                    <span>{r.pct}%</span>
                  </div>

                  <div style={{ height: 8, background: "#eee", borderRadius: 999, marginTop: 8 }}>
                    <div style={{ height: 8, width: `${r.pct}%`, background: "#111", borderRadius: 999 }} />
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "#444" }}>
                    <b>{r.earned}</b> / {r.required} credits
                    <span style={{ color: "#666" }}> · {r.remaining} left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", fontSize: 14, textAlign: "right" }}>
            <div style={{ fontWeight: 600 }}>Welcome {authUser?.name || authUser?.email}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#555" }}>
              Total Credits Completed: {completed} / {total}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {semesters.map(sem => (
            
            <SemesterCard
  key={sem.id}
  semester={sem}
  updateStatus={updateSemesterStatus}
  updateCourse={updateCourseGrade}
  moveCourse={moveCourse}
/>
          ))}
        </div>
      </div>
    </DndProvider>
  );
}