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

      const semesterIds = templateSemesters.map((s) => s.id);
      const { data: templateCourses } = await supabase
        .from("template_courses")
        .select("id, template_semester_id, course_id, courses(id, name, code, credits)")
        .in("template_semester_id", semesterIds);

      const formattedSemesters = templateSemesters.map((sem) => ({
        id: sem.id,
        name: `Semester ${sem.semester_number}`,
        semester_number: sem.semester_number,
        user_courses: (templateCourses.filter((tc) => tc.template_semester_id === sem.id) || []).map(
          (tc) => ({
            id: tc.id,
            grade: null,
            attribute: "Major Course",
            semester_id: sem.id,
            courses: tc.courses || { name: "Unknown", code: "N/A", credits: 0 },
          })
        ),
      }));

      setSemesters(formattedSemesters);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, background: "#f9f9f9", minHeight: "100vh", color: "#111" }}>
      <h1 style={{ marginBottom: 12 }}>Dashboard</h1>
      <p>Welcome {authUser?.email}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {semesters.map((sem) => (
          <SemesterCard key={sem.id} semester={sem} refresh={initialize} />
        ))}
      </div>
    </div>
  );
}