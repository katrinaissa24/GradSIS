import React, { useState, useEffect } from "react";
import { supabase } from "./services/supabase";
import { useNavigate } from "react-router-dom";

// Custom Dropdown Component
function CustomDropdown({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={styles.dropdownContainer}>
      <div style={styles.dropdownHeader} onClick={() => setIsOpen(!isOpen)}>
        <span style={value ? styles.selectedText : styles.placeholderText}>
          {value
            ? options.find((opt) => opt.value === value)?.label
            : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path fill="#047857" d="M6 9L1 4h10z" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div
            style={styles.dropdownOverlay}
            onClick={() => setIsOpen(false)}
          />
          <div style={styles.dropdownList}>
            {options.map((option) => (
              <div
                key={option.value}
                style={{
                  ...styles.dropdownItem,
                  ...(value === option.value && styles.dropdownItemSelected),
                }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (value !== option.value) {
                    e.currentTarget.style.backgroundColor = "#ecfdf5";
                    e.currentTarget.style.color = "#047857";
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== option.value) {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.color = "#1f2937";
                  }
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OnBoarding() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    academicStanding: "",
    major: "",
    startingTerm: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [majors, setMajors] = useState([]);
  const [startingTerms, setStartingTerms] = useState([]);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Check if user has already completed onboarding
  useEffect(() => {
    const checkExistingProfile = async () => {
      try {
        // Check session first
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr || !session) {
          console.error("No active session:", sessionErr);
          navigate("/auth");
          return;
        }

        const user = session.user;

        // Check if user already has major_id and starting_term_id filled
        const { data: userData, error: fetchError } = await supabase
          .from("users")
          .select("major_id, starting_term_id")
          .eq("id", user.id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("Error checking profile:", fetchError);
        }

        // If both fields are filled, redirect to dashboard
        if (userData && userData.major_id && userData.starting_term_id) {
          navigate("/dashboard");
          return;
        }
      } catch (err) {
        console.error("Error checking profile:", err);
        navigate("/auth");
      } finally {
        setCheckingProfile(false);
      }
    };

    checkExistingProfile();
  }, [navigate]);

  useEffect(() => {
    const loadMajors = async () => {
      const { data, error } = await supabase
        .from("majors")
        .select("*")
        .order("name", { ascending: true });

      console.log("majors:", data, error);

      if (!error) setMajors(data ?? []);
    };

    loadMajors();
  }, []);

  useEffect(() => {
    const loadStartingTerms = async () => {
      const { data, error } = await supabase
        .from("starting_terms")
        .select("*")
        .order("name", { ascending: true });

      console.log("starting_terms:", data, error);

      if (!error) setStartingTerms(data ?? []);
    };

    loadStartingTerms();
  }, []);

  const isComplete =
    profile.academicStanding && profile.major && profile.startingTerm;


async function saveProfile() {
  if (!isComplete) return;
  setLoading(true);
  setError(null);

  try {
    // 1️⃣ Get current session and user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session. Please log in again.");
    const user = session.user;

    // 2️⃣ Upsert user profile with major and starting term
    await supabase.from("users").upsert({
      id: user.id,
      major_id: profile.major,
      starting_term_id: profile.startingTerm,
    });

    // 3️⃣ Fetch starting term and template
    const { data: startingTerm } = await supabase
      .from("starting_terms")
      .select("template_id, name")
      .eq("id", profile.startingTerm)
      .single();
    if (!startingTerm) throw new Error("Starting term not found");

    const templateId = startingTerm.template_id;
const [startSemesterName, academicYear] = startingTerm.name.split(" ");
let [startYear, endYear] = academicYear.split("-").map(Number);

    // 4️⃣ Fetch template semesters
    const { data: templateSemesters } = await supabase
      .from("template_semesters")
      .select("*")
      .eq("template_id", templateId);
    if (!templateSemesters?.length) throw new Error("No template semesters found");

    // 5️⃣ Generate user_semesters with dynamic names
const semesterOrder = ["Fall", "Spring", "Summer"];
const startIndex = semesterOrder.indexOf(startSemesterName);

const userSemesters = templateSemesters.map((ts, idx) => {
  const orderIndex = startIndex + idx;
  const semName = semesterOrder[orderIndex % 3];

  // Academic year increases AFTER Summer
  const yearOffset = Math.floor(orderIndex / 3);
  const currentStartYear = startYear + yearOffset;
  const currentEndYear = endYear + yearOffset;

  return {
    user_id: user.id,
    semester_number: ts.semester_number,
    name: `${semName} ${currentStartYear}-${currentEndYear}`,
  };
});

    // 6️⃣ Insert user_semesters
    const { data: insertedSemesters } = await supabase
      .from("user_semesters")
      .insert(userSemesters)
      .select();

    // 7️⃣ Copy template_courses into user_courses
    for (const ts of templateSemesters) {
      const { data: templateCourses } = await supabase
        .from("template_courses")
        .select("course_id")
        .eq("template_semester_id", ts.id);

      const userSemester = insertedSemesters.find(
        (us) => us.semester_number === ts.semester_number
      );
      if (!userSemester) continue;

      const userCourses = templateCourses.map((tc, idx) => ({
        user_id: user.id,
        semester_id: userSemester.id,
        course_id: tc.course_id,
        attribute: "Elective", // adjust if needed
        order_index: idx,
      }));

      await supabase.from("user_courses").insert(userCourses);
    }

    // ✅ Finished
    navigate("/dashboard");
  } catch (err) {
    console.error("Save profile error:", err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  const academicStandingOptions = [
    { value: "freshman", label: "Freshman" },
    { value: "transfer", label: "Transfer" },
    { value: "regular", label: "Regular" },
  ];

  const majorOptions = majors.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const startingTermOptions = startingTerms.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  // Show loading while checking profile
  if (checkingProfile) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: "center", color: "#047857" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <h1 style={styles.title}>GradSIS</h1>
        <p style={styles.subtitle}>American University of Beirut</p>
        <div style={styles.divider}></div>

        {/* Form */}
        <div style={styles.form}>
          {/* Academic Standing */}
          <label style={styles.label}>Academic Standing *</label>
          <CustomDropdown
            value={profile.academicStanding}
            onChange={(value) =>
              setProfile((p) => ({ ...p, academicStanding: value }))
            }
            options={academicStandingOptions}
            placeholder="Select your standing"
          />

          {/* Major */}
          <label style={styles.label}>Major *</label>
          <CustomDropdown
            value={profile.major}
            onChange={(value) => setProfile((p) => ({ ...p, major: value }))}
            options={majorOptions}
            placeholder="Select your major"
          />

          {/* Starting Term (with year included) */}
          <label style={styles.label}>Starting Term *</label>
          <CustomDropdown
            value={profile.startingTerm}
            onChange={(value) =>
              setProfile((p) => ({ ...p, startingTerm: value }))
            }
            options={startingTermOptions}
            placeholder="Select starting term"
          />

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}

          {/* Save Button */}
          <button
            onClick={saveProfile}
            disabled={!isComplete || loading}
            style={{
              ...styles.button,
              ...((!isComplete || loading) && styles.buttonDisabled),
            }}
          >
            {loading ? "Saving..." : "Continue to Planner"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
    fontFamily: "Arial, sans-serif",
    padding: 0,
    margin: 0,
  },
  card: {
    width: "100%",
    maxWidth: 450,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 30,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
  },
  title: {
    color: "#047857",
    fontSize: 26,
    fontWeight: "700",
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    color: "#065f46",
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 15,
  },
  divider: {
    width: 50,
    height: 3,
    backgroundColor: "#10b981",
    margin: "10px auto 20px",
    borderRadius: 2,
  },
  form: { display: "flex", flexDirection: "column", gap: 15 },
  label: { fontSize: 14, fontWeight: 600, color: "#374151" },
  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s ease",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "white",
    color: "#1f2937",
  },
  error: { color: "#dc2626", fontSize: 13, marginTop: 5 },
  button: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#047857",
    color: "white",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 15,
    transition: "all 0.2s ease",
  },
  buttonDisabled: { backgroundColor: "#9ca3af", cursor: "not-allowed" },

  // Custom Dropdown Styles
  dropdownContainer: {
    position: "relative",
    width: "100%",
  },
  dropdownHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    backgroundColor: "white",
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s ease",
    userSelect: "none",
  },
  selectedText: {
    color: "#1f2937",
  },
  placeholderText: {
    color: "#9ca3af",
  },
  dropdownOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownList: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    backgroundColor: "white",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    zIndex: 1000,
    maxHeight: "200px",
    overflowY: "auto",
  },
  dropdownItem: {
    padding: "12px 16px",
    cursor: "pointer",
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "white",
    transition: "all 0.15s ease",
    userSelect: "none",
  },
  dropdownItemSelected: {
    backgroundColor: "#047857",
    color: "white",
    fontWeight: 600,
  },
};
