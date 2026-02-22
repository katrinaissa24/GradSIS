import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import SemesterCard from "../components/SemesterCard";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, []);

  const PASSING_GRADES = new Set(["A+", "A", "A-","B+", "B", "B-","C+", "C", "C-","D+", "D", "D-"]);

  function calcCredits(semesters) {
    let total = 0;
    let completed = 0;

    for (const sem of semesters) {
      for (const uc of sem.user_courses || []) {
        const credits = uc?.courses?.credits ?? 0;
        total += credits;

        const g = uc?.grade;
        if (g && PASSING_GRADES.has(g)) completed += credits;
      }
    }

    return { completed, total };
  }

  async function initialize() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/auth");
        return;
      }
      const userId = sessionData.session.user.id;
      setAuthUser(sessionData.session.user);

      const { data: userRow } = await supabase
        .from("users")
        .select("major_id, starting_term_id")
        .eq("id", userId)
        .single();

      const { data: startingTerm } = await supabase
        .from("starting_terms")
        .select("template_id, major_id")
        .eq("id", userRow.starting_term_id)
        .single();

      const templateId = startingTerm.template_id;

      const { data: templateSemesters } = await supabase
        .from("template_semesters")
        .select("*")
        .eq("template_id", templateId)
        .order("semester_number", { ascending: true });

      const { data: existingUserSemesters } = await supabase
        .from("user_semesters")
        .select("*")
        .eq("user_id", userId);

      let userSemesters = existingUserSemesters;
      if (!existingUserSemesters || existingUserSemesters.length === 0) {
        const newUserSemesters = templateSemesters.map((sem) => ({
          user_id: userId,
          semester_number: sem.semester_number,
          name: `Semester ${sem.semester_number}`,
          status: "future",
        }));

        const { data: created, error: insertError } = await supabase
          .from("user_semesters")
          .insert(newUserSemesters)
          .select();

        if (insertError) {
          console.error("Insert error:", insertError);
          userSemesters = [];
        } else {
          userSemesters = created;
        }
      }

      console.log("userSemesters:", userSemesters);

      // Create user_courses if they don't exist
      const userSemesterIds = userSemesters.map((s) => s.id);
      const { data: existingUserCourses } = await supabase
        .from("user_courses")
        .select("*")
        .in("semester_id", userSemesterIds);

      if (!existingUserCourses || existingUserCourses.length === 0) {
        const semesterIds = templateSemesters.map((s) => s.id);
        const { data: templateCourses } = await supabase
          .from("template_courses")
          .select("id, template_semester_id, course_id")
          .in("template_semester_id", semesterIds);

        const newUserCourses = [];
        templateCourses.forEach((tc) => {
          const templateSem = templateSemesters.find(
            (ts) => ts.id === tc.template_semester_id,
          );
          const userSem = userSemesters.find(
            (us) => us.semester_number === templateSem?.semester_number,
          );
          if (userSem) {
            newUserCourses.push({
              user_id: userId,
              semester_id: userSem.id,
              course_id: tc.course_id,
              grade: null,
              attribute: "Major Course",
            });
          }
        });

        await supabase.from("user_courses").insert(newUserCourses);
      }

      // Fetch actual user_courses with course details
      const { data: userCourses } = await supabase
        .from("user_courses")
        .select("*, courses(id, name, code, credits)")
        .in("semester_id", userSemesterIds);

      console.log("userCourses:", userCourses);

      const formattedSemesters = templateSemesters.map((sem) => {
        const userSem = userSemesters?.find(
          (us) => us.semester_number === sem.semester_number,
        );

        return {
          id: userSem?.id || sem.id,
          template_semester_id: sem.id,
          name: `Semester ${sem.semester_number}`,
          semester_number: sem.semester_number,
          status: userSem?.status || "future",
          user_id: userId,
          user_courses:
            userCourses?.filter((uc) => uc.semester_id === userSem?.id) || [],
        };
      });

      console.log("formattedSemesters:", formattedSemesters);

      setSemesters(formattedSemesters);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  function updateSemesterStatus(semesterId, newStatus) {
    setSemesters((prevSemesters) =>
      prevSemesters.map((sem) =>
        sem.id === semesterId ? { ...sem, status: newStatus } : sem,
      ),
    );
  }
  function updateCourseGrade(courseId, field, value) {
    setSemesters((prevSemesters) =>
      prevSemesters.map((sem) => ({
        ...sem,
        user_courses: sem.user_courses.map((course) =>
          course.id === courseId ? { ...course, [field]: value } : course,
        ),
      })),
    );
  }

  const { completed } = calcCredits(semesters);
  const total = 120;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const safePercent = Math.min(100, Math.max(0, percent));
  const remaining = Math.max(0, total - completed);

  return (
    <div
      style={{
        padding: 20,
        background: "#f9f9f9",
        minHeight: "100vh",
        color: "#111",
      }}
    >
        <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: "10px 14px",
            minWidth: 260,
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            border: "1px solid #eee",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Credits</span>
            <span>{safePercent}%</span>
          </div>

          <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
            {remaining} credits remaining
          </div>

          <div style={{ height: 10, width: "100%", background: "#eee", borderRadius: 999 }}>
            <div
              style={{
                height: 10,
                width: `${safePercent}%`,
                background: "#111",
                borderRadius: 999,
                transition: "width 200ms",
              }}
            />
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
            <b>{completed}</b> / {total} credits completed
          </div>
        </div>
      </div>
      <p>Welcome {authUser?.email}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {semesters.map((sem) => (
          <SemesterCard
            key={sem.id}
            semester={sem}
            refresh={initialize}
            updateStatus={updateSemesterStatus}
            updateCourse={updateCourseGrade}
          />
        ))}
      </div>
    </div>
  );
}
