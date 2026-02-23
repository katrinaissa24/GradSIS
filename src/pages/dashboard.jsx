import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import SemesterCard from "../components/SemesterCard";
import { useNavigate } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const navigate = useNavigate();

  const PASSING_GRADES = new Set([
    "A+", "A", "A-","B+","B","B-","C+","C","C-","D+","D","D-"
  ]);

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

  const { completed } = calcCredits(semesters);
  const total = 120;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const safePercent = Math.min(100, Math.max(0, percent));
  const remaining = Math.max(0, total - completed);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <DndProvider backend={HTML5Backend}>
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
              refresh={initialize}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}