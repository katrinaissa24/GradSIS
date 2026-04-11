import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings as SettingsIcon, ArrowLeft } from "lucide-react";
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

        const plansPromise = supabase
          .from("plans")
          .select(
            `
            id,
            name,
            template_id,
            templates ( name )
          `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        const semestersPromise = supabase
          .from("user_semesters")
          .select("id")
          .eq("user_id", user.id);

        const [
          { data: userRow },
          { data: planRows },
          { data: userSemesters },
        ] = await Promise.all([userPromise, plansPromise, semestersPromise]);

        if (cancelled) return;

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

        // Normalize plans + template name
        const normalizedPlans = (planRows || []).map((p) => {
          const tpl = Array.isArray(p.templates) ? p.templates[0] : p.templates;
          return {
            id: p.id,
            name: p.name,
            templateName: tpl?.name || null,
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
              <Row label="Name" value={profile.name || "—"} />
              <Row label="Email" value={profile.email || "—"} />
              <Row label="Major" value={profile.major || "—"} />
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
                  → <b>{total}</b> credits required
                </div>
              )}
            </Section>

            {/* Plans */}
            <Section title="Plans">
              {plans.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No plans yet.</div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                          {plan.name}
                        </div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>
                          Template:{" "}
                          <b>{plan.templateName || "Not set"}</b>
                        </div>
                      </div>
                    </div>
                  ))}
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
