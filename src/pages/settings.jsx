import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings as SettingsIcon, ArrowLeft, ChevronDown } from "lucide-react";
import { supabase } from "../services/supabase";
import {
  calculateCumulativeGPAWithRepeats,
  calculateGPACreditHours,
} from "../constants/gpa";

const STUDENT_TYPE_LABELS = {
  freshman: "Freshman",
  transfer: "Transfer",
  regular: "Regular",
};

function totalCreditsFor(studentType) {
  return studentType === "freshman" ? 120 : 90;
}

function calcCompletedCredits(semesters) {
  let completed = 0;
  for (const sem of semesters || []) {
    for (const c of sem.user_courses || []) {
      const credits =
        (c.credits != null ? Number(c.credits) : null) ??
        c.courses?.credits ??
        0;
      if (
        c.grade &&
        c.grade !== "F" &&
        c.grade !== "W" &&
        c.grade !== "WF"
      ) {
        completed += Number(credits) || 0;
      }
    }
  }
  return completed;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    major: "",
    minor: "",
    studentType: "",
  });
  const [gpa, setGpa] = useState("0.00");
  const [hours, setHours] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [plans, setPlans] = useState([]);
  const [majors, setMajors] = useState([]);
  const [startingTerms, setStartingTerms] = useState([]);
  const [savingPlan, setSavingPlan] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          navigate("/auth");
          return;
        }
        const user = sessionData.session.user;
        if (cancelled) return;
        setAuthUser(user);

        const userPromise = supabase
          .from("users")
          .select(
            `
            name,
            email,
            student_type,
            major_id,
            majors ( name )
          `,
          )
          .eq("id", user.id)
          .single();

        // Fetch plans with their major and starting_term associations
        const plansPromise = supabase
          .from("plans")
          .select(
            `
            id,
            name,
            major_id,
            starting_term_id,
            majors ( id, name ),
            starting_terms ( id, name, template_id, major_id )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        const semestersPromise = supabase
          .from("user_semesters")
          .select("id")
          .eq("user_id", user.id);

        const majorsPromise = supabase
          .from("majors")
          .select("*")
          .order("name", { ascending: true });

        const startingTermsPromise = supabase
          .from("starting_terms")
          .select("*")
          .order("name", { ascending: true });

        const [
          { data: userRow },
          { data: planRows },
          { data: userSemesters },
          { data: majorsData },
          { data: termsData },
        ] = await Promise.all([userPromise, plansPromise, semestersPromise, majorsPromise, startingTermsPromise]);

        if (cancelled) return;
        setMajors(majorsData || []);
        setStartingTerms(termsData || []);

        const majorData = Array.isArray(userRow?.majors)
          ? userRow.majors[0]
          : userRow?.majors;

        setProfile({
          name: userRow?.name || user.user_metadata?.name || "",
          email: userRow?.email || user.email || "",
          major: majorData?.name || "",
          minor: "",
          studentType: userRow?.student_type || "",
        });

        // Normalize plans
        const normalizedPlans = (planRows || []).map((p) => {
          const majorObj = Array.isArray(p.majors) ? p.majors[0] : p.majors;
          const termObj = Array.isArray(p.starting_terms) ? p.starting_terms[0] : p.starting_terms;
          return {
            id: p.id,
            name: p.name,
            majorId: p.major_id || null,
            majorName: majorObj?.name || null,
            startingTermId: p.starting_term_id || null,
            startingTermName: termObj?.name || null,
            templateId: termObj?.template_id || null,
          };
        });
        setPlans(normalizedPlans);

        // Pull all courses across user's semesters for GPA + completed credits
        const semIds = (userSemesters || []).map((s) => s.id);
        let allCourses = [];
        let semestersForGpa = [];
        if (semIds.length) {
          const { data: courses } = await supabase
            .from("user_courses")
            .select(
              `
              *,
              courses ( id, name, code, number, credits )
              `,
            )
            .in("semester_id", semIds);
          allCourses = courses || [];

          // group for cumulative GPA function
          const grouped = allCourses.reduce((acc, c) => {
            (acc[c.semester_id] ||= []).push(c);
            return acc;
          }, {});
          semestersForGpa = semIds.map((id) => ({
            id,
            user_courses: grouped[id] || [],
          }));
        }

        if (cancelled) return;
        setGpa(
          calculateCumulativeGPAWithRepeats(allCourses, semestersForGpa) ||
            "0.00",
        );
        setHours(calculateGPACreditHours(allCourses, semestersForGpa) || 0);
        setCompleted(calcCompletedCredits(semestersForGpa));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  // Update the major for a plan (clears starting_term when major changes)
  async function updatePlanMajor(planId, newMajorId) {
    if (!authUser?.id) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.majorId === newMajorId) return;

    setSavingPlan(planId);
    try {
      const { error } = await supabase
        .from("plans")
        .update({ major_id: newMajorId || null, starting_term_id: null })
        .eq("id", planId);
      if (error) throw error;

      const majorObj = majors.find((m) => m.id === newMajorId);
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                majorId: newMajorId || null,
                majorName: majorObj?.name || null,
                startingTermId: null,
                startingTermName: null,
                templateId: null,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("Failed to update plan major:", err);
    } finally {
      setSavingPlan(null);
    }
  }

  // Update the starting term for a plan (also swaps template courses)
  async function updatePlanStartingTerm(planId, newStartingTermId) {
    if (!authUser?.id || !newStartingTermId) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.startingTermId === newStartingTermId) return;

    setSavingPlan(planId);
    try {
      // Get the new starting term's template
      const { data: newTerm, error: termErr } = await supabase
        .from("starting_terms")
        .select("template_id, name, major_id")
        .eq("id", newStartingTermId)
        .single();
      if (termErr || !newTerm) throw new Error("Starting term not found");

      const newTemplateId = newTerm.template_id;
      const oldTemplateId = plan.templateId;

      // Update the plan's starting_term_id
      const { error: planErr } = await supabase
        .from("plans")
        .update({ starting_term_id: newStartingTermId })
        .eq("id", planId);
      if (planErr) throw planErr;

      // Fetch template semesters for the new template
      const { data: newTemplateSemesters, error: tplErr } = await supabase
        .from("template_semesters")
        .select("*")
        .eq("template_id", newTemplateId)
        .order("semester_number", { ascending: true });
      if (tplErr) throw tplErr;

      // Parse the starting term name to generate semester names (e.g. "Fall 2024-2025")
      const [startSemName, academicYear] = newTerm.name.split(" ");
      const [startYear, endYear] = academicYear
        ? academicYear.split("-").map(Number)
        : [new Date().getFullYear(), new Date().getFullYear() + 1];
      const semesterOrder = ["Fall", "Spring", "Summer"];
      const startIndex = semesterOrder.indexOf(startSemName);

      function makeSemName(semesterNumber) {
        const idx = semesterNumber - 1;
        const orderIndex = startIndex + idx;
        const name = semesterOrder[orderIndex % 3];
        const yearOffset = Math.floor(orderIndex / 3);
        return `${name} ${startYear + yearOffset}-${endYear + yearOffset}`;
      }

      // Get existing semesters for this plan
      const { data: existingSemesters } = await supabase
        .from("user_semesters")
        .select("id, semester_number")
        .eq("plan_id", planId);

      let planSemesters = existingSemesters || [];

      if (planSemesters.length === 0 && newTemplateSemesters?.length) {
        // Plan has no semesters yet — create them from the template (same as onboarding)
        const toInsert = newTemplateSemesters.map((ts) => ({
          user_id: authUser.id,
          plan_id: planId,
          semester_number: ts.semester_number,
          name: makeSemName(ts.semester_number),
          status: "future",
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from("user_semesters")
          .insert(toInsert)
          .select();
        if (insertErr) throw insertErr;
        planSemesters = inserted || [];
      } else if (planSemesters.length > 0) {
        // Plan already has semesters — remove old template courses and rename
        const semIds = planSemesters.map((s) => s.id);

        if (oldTemplateId && oldTemplateId !== newTemplateId) {
          const { data: oldTplSems } = await supabase
            .from("template_semesters")
            .select("id")
            .eq("template_id", oldTemplateId);

          if (oldTplSems?.length) {
            const { data: oldTplCourses } = await supabase
              .from("template_courses")
              .select("course_id")
              .in("template_semester_id", oldTplSems.map((s) => s.id));

            if (oldTplCourses?.length) {
              await supabase
                .from("user_courses")
                .delete()
                .in("semester_id", semIds)
                .in("course_id", oldTplCourses.map((c) => c.course_id));
            }
          }
        }

        // Rename existing semesters to match new starting term
        for (const sem of planSemesters) {
          await supabase
            .from("user_semesters")
            .update({ name: makeSemName(sem.semester_number) })
            .eq("id", sem.id);
        }
      }

      // Add new template courses to each semester
      if (newTemplateSemesters?.length && planSemesters.length > 0) {
        for (const ts of newTemplateSemesters) {
          const { data: templateCourses } = await supabase
            .from("template_courses")
            .select("course_id")
            .eq("template_semester_id", ts.id);

          const userSem = planSemesters.find(
            (s) => s.semester_number === ts.semester_number,
          );
          if (!userSem || !templateCourses?.length) continue;

          const newCourses = templateCourses.map((tc, idx) => ({
            user_id: authUser.id,
            semester_id: userSem.id,
            course_id: tc.course_id,
            attribute: "Elective",
            order_index: idx,
          }));

          await supabase.from("user_courses").insert(newCourses);
        }
      }

      // Update local state
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                startingTermId: newStartingTermId,
                startingTermName: newTerm.name,
                templateId: newTemplateId,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("Failed to update plan starting term:", err);
    } finally {
      setSavingPlan(null);
    }
  }

  async function updateStudentType(newType) {
    if (!authUser?.id || newType === profile.studentType) return;
    setSavingStatus(true);
    const previous = profile.studentType;
    setProfile((p) => ({ ...p, studentType: newType }));
    const { error } = await supabase
      .from("users")
      .update({ student_type: newType })
      .eq("id", authUser.id);
    if (error) {
      console.error("Failed to update student type:", error);
      setProfile((p) => ({ ...p, studentType: previous }));
    }
    setSavingStatus(false);
  }

  const total = totalCreditsFor(profile.studentType);

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh", color: "#111" }}>
      {/* Nav bar */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
            title="Back to dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fafafa",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontWeight: 600, fontSize: isMobile ? 22 : 25 }}>
            GradSIS
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 10 : 24,
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#444",
              textAlign: "right",
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {profile.name || profile.email}
            </div>
            {!isMobile && (
              <>
                <div>
                  GPA <b>{gpa}</b> - Hours <b>{hours}</b>
                </div>
                <div>
                  Credits <b>{completed}</b> / {total}
                </div>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              aria-label="Settings"
              title="Settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#eff6ff",
                color: "#2563eb",
                cursor: "default",
              }}
            >
              <SettingsIcon size={18} />
            </button>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
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
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: isMobile ? "20px 16px 40px" : "32px 24px 60px",
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? 24 : 30,
            fontWeight: 700,
            margin: 0,
            marginBottom: 6,
          }}
        >
          Settings
        </h1>
        <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 24 }}>
          Manage your account, onboarding details, and plans.
        </p>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Account information */}
            <Section title="Account Information">
              <Row label="Name" value={profile.name || "\u2014"} />
              <Row label="Email" value={profile.email || "\u2014"} />
              <Row label="Major" value={profile.major || "\u2014"} />
              <Row label="Minor" value={profile.minor || "None"} />
              <Row label="Cumulative GPA" value={gpa} />
              <Row
                label="Credit Hours Completed"
                value={`${completed} / ${total}`}
              />
            </Section>

            {/* Onboarding info */}
            <Section title="Onboarding Information">
              <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 13 }}>
                Your academic standing controls how many total credits are
                required to graduate (
                <b>Freshman = 120</b>, <b>Regular / Transfer = 90</b>).
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {Object.entries(STUDENT_TYPE_LABELS).map(([value, label]) => {
                  const active = profile.studentType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateStudentType(value)}
                      disabled={savingStatus}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: active
                          ? "2px solid #2563eb"
                          : "1px solid #d1d5db",
                        background: active ? "#eff6ff" : "#fff",
                        color: active ? "#2563eb" : "#374151",
                        fontWeight: active ? 600 : 500,
                        cursor: savingStatus ? "progress" : "pointer",
                        minHeight: 42,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {profile.studentType && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
                  Current standing:{" "}
                  <b>
                    {STUDENT_TYPE_LABELS[profile.studentType] ||
                      profile.studentType}
                  </b>{" "}
                  &rarr; <b>{total}</b> credits required
                </div>
              )}
            </Section>

            {/* Plans */}
            <Section title="Plans">
              <div style={{ marginBottom: 10, color: "#6b7280", fontSize: 13 }}>
                Choose a major and starting semester for each plan. Changing the
                template will replace the old template&apos;s major courses with the
                new one&apos;s.
              </div>
              {plans.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No plans yet.</div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {plans.map((plan) => {
                    const isSaving = savingPlan === plan.id;
                    // Filter starting terms to only those matching this plan's selected major
                    const filteredTerms = plan.majorId
                      ? startingTerms.filter((t) => t.major_id === plan.majorId)
                      : [];
                    return (
                      <div
                        key={plan.id}
                        style={{
                          padding: "14px 16px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          background: "#fff",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>
                          {plan.name}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: isMobile ? "column" : "row",
                            gap: 12,
                          }}
                        >
                          {/* Major selector */}
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                              Major
                            </label>
                            <div style={{ position: "relative" }}>
                              <select
                                value={plan.majorId || ""}
                                onChange={(e) => updatePlanMajor(plan.id, e.target.value)}
                                disabled={isSaving}
                                style={{
                                  width: "100%",
                                  padding: "10px 32px 10px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #d1d5db",
                                  background: "#fff",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  cursor: isSaving ? "progress" : "pointer",
                                  opacity: isSaving ? 0.6 : 1,
                                  appearance: "none",
                                  WebkitAppearance: "none",
                                }}
                              >
                                <option value="">Select major</option>
                                {majors.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={14}
                                style={{
                                  position: "absolute",
                                  right: 10,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  pointerEvents: "none",
                                  color: "#6b7280",
                                }}
                              />
                            </div>
                          </div>

                          {/* Starting Semester selector — only shows terms for selected major */}
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                              Starting Semester
                            </label>
                            <div style={{ position: "relative" }}>
                              <select
                                value={plan.startingTermId || ""}
                                onChange={(e) => updatePlanStartingTerm(plan.id, e.target.value)}
                                disabled={isSaving || !plan.majorId}
                                style={{
                                  width: "100%",
                                  padding: "10px 32px 10px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #d1d5db",
                                  background: plan.majorId ? "#fff" : "#f9fafb",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  cursor: isSaving || !plan.majorId ? "not-allowed" : "pointer",
                                  opacity: isSaving ? 0.6 : !plan.majorId ? 0.5 : 1,
                                  appearance: "none",
                                  WebkitAppearance: "none",
                                }}
                              >
                                <option value="">
                                  {plan.majorId
                                    ? filteredTerms.length > 0
                                      ? "Select starting semester"
                                      : "No terms for this major"
                                    : "Select a major first"}
                                </option>
                                {filteredTerms.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={14}
                                style={{
                                  position: "absolute",
                                  right: 10,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  pointerEvents: "none",
                                  color: "#6b7280",
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {isSaving && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#2563eb" }}>
                            Updating plan courses...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: 20,
        border: "1px solid #eee",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          margin: 0,
          marginBottom: 14,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f1f5f9",
        gap: 12,
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 14 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "#111",
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}
