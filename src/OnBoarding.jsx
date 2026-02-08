import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./services/supabase";


// Custom Dropdown Component
function CustomDropdown({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={styles.dropdownContainer}>
      <div
        style={styles.dropdownHeader}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={value ? styles.selectedText : styles.placeholderText}>
          {value ? options.find(opt => opt.value === value)?.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease"
          }}
        >
          <path fill="#047857" d="M6 9L1 4h10z" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div style={styles.dropdownOverlay} onClick={() => setIsOpen(false)} />
          <div style={styles.dropdownList}>
            {options.map((option) => (
              <div
                key={option.value}
                style={{
                  ...styles.dropdownItem,
                  ...(value === option.value && styles.dropdownItemSelected)
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
  const [profile, setProfile] = useState({
    academicStanding: "",
    major: "",
    startingTerm: "",
    startingYear: "",
    catalogYear: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [majors, setMajors] = useState([]);
  const [startingTerms, setStartingTerms] = useState([]);



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


  useEffect(() => {
    const signInTestUser = async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "jaa118@mail.aub.edu",
        password: "jaatest06",
      });

      console.log("SIGNED IN:", data, error);
    };

    signInTestUser();
  }, []);


  function computeCatalogYear(term, year) {
    if (!term || !year) return "";
    return term === "fall" ? year : year - 1;
  }

  const isComplete =
    profile.academicStanding &&
    profile.major &&
    profile.startingTerm &&
    profile.startingYear;

  async function saveProfile() {
    if (!isComplete) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("Not authenticated");

      const payload = {
        major_id: profile.major,            
        starting_term_id: profile.startingTerm,
      };

      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("id", user.id);

      if (error) throw error;

      alert("Saved ✅ (users table updated)");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }





  const academicStandingOptions = [
    { value: "freshman", label: "Freshman" },
    { value: "transfer", label: "Transfer" },
    { value: "regular", label: "Regular" }
  ];

  const majorOptions = majors.map((m) => ({
  value: m.id,
  label: m.name
}));

  const termOptions = [
    { value: "fall", label: "Fall" },
    { value: "spring", label: "Spring" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <h1 style={styles.title}>CS Graduation Planner</h1>
        <p style={styles.subtitle}>American University of Beirut</p>
        <div style={styles.divider}></div>

        {/* Form */}
        <div style={styles.form}>
          {/* Academic Standing */}
          <label style={styles.label}>Academic Standing *</label>
          <CustomDropdown
            value={profile.academicStanding}
            onChange={(value) =>
              setProfile(p => ({ ...p, academicStanding: value }))
            }
            options={academicStandingOptions}
            placeholder="Select your standing"
          />

          {/* Major */}
          <label style={styles.label}>Major *</label>
          <CustomDropdown
            value={profile.major}
            onChange={(value) =>
              setProfile(p => ({ ...p, major: value }))
            }
            options={majorOptions}
            placeholder="Select your major"
          />

          {/* Starting Term & Year */}
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Starting Term *</label>
              <CustomDropdown
                value={profile.startingTerm}
                onChange={(value) => {
                  setProfile(p => ({
                    ...p,
                    startingTerm: value,
                    catalogYear: computeCatalogYear(value, p.startingYear)
                  }));
                }}
                options={termOptions}
                placeholder="Select term"
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={styles.label}>Starting Year *</label>
              <input
                type="number"
                placeholder="e.g., 2026"
                value={profile.startingYear}
                onChange={e => {
                  const year = Number(e.target.value);
                  setProfile(p => ({
                    ...p,
                    startingYear: year,
                    catalogYear: computeCatalogYear(p.startingTerm, year)
                  }));
                }}
                style={styles.input}
              />
            </div>
          </div>

          {/* Catalog Year */}
          {profile.catalogYear && (
            <p style={styles.catalogText}>
              Catalog Year: <strong>{profile.catalogYear}</strong>
            </p>
          )}

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}

          {/* Save Button */}
          <button
            onClick={saveProfile}
            disabled={!isComplete || loading}
            style={{
              ...styles.button,
              ...((!isComplete || loading) && styles.buttonDisabled)
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
    margin: 0
  },
  card: {
    width: "100%",
    maxWidth: 450,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 30,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
  },
  title: { color: "#047857", fontSize: 26, fontWeight: "700", margin: 0, textAlign: "center" },
  subtitle: { color: "#065f46", fontSize: 14, textAlign: "center", marginTop: 5, marginBottom: 15 },
  divider: { width: 50, height: 3, backgroundColor: "#10b981", margin: "10px auto 20px", borderRadius: 2 },
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
    color: "#1f2937"
  },
  row: { display: "flex", gap: 15 },
  catalogText: { fontSize: 14, fontWeight: 600, color: "#047857", marginTop: 10 },
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
    transition: "all 0.2s ease"
  },
  buttonDisabled: { backgroundColor: "#9ca3af", cursor: "not-allowed" },

  // Custom Dropdown Styles
  dropdownContainer: {
    position: "relative",
    width: "100%"
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
    userSelect: "none"
  },
  selectedText: {
    color: "#1f2937"
  },
  placeholderText: {
    color: "#9ca3af"
  },
  dropdownOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999
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
    overflowY: "auto"
  },
  dropdownItem: {
    padding: "12px 16px",
    cursor: "pointer",
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "white",
    transition: "all 0.15s ease",
    userSelect: "none"
  },
  dropdownItemSelected: {
    backgroundColor: "#047857",
    color: "white",
    fontWeight: 600
  }
};