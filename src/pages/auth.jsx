import "./auth.css";
import React, { useState, useEffect } from "react";
import { Mail, Lock, User } from "lucide-react";
import { signIn } from "../services/auth";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { hasCompletedOnboarding } from "../utils/OnBoarding.utils";

const AuthPage = () => {
  const [action, setAction] = useState("Sign Up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
const [selectedMajorId, setSelectedMajorId] = useState(null);
const [selectedTermId, setSelectedTermId] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("major_id, starting_term_id")
          .eq("id", user.id)
          .single();

        if (hasCompletedOnboarding(userData)) {
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async () => {
    setMessage({ text: "", isError: false });
    setLoading(true);

    try {
      if (action === "Sign Up") {
        try {
          setMessage({ text: "", isError: false });

          // 1️⃣ Sign up in Auth
          const { data: authData, error: signUpError } =
            await supabase.auth.signUp({
              email,
              password,
              options: {
    data: {
      name,
      template_id: selectedTemplateId,   
      major_id: selectedMajorId,        
      starting_term_id: selectedTermId,  
    }
  }

            });

          if (signUpError) throw signUpError;

          

          // 3️⃣ Show success message
          setMessage({
            text: "Sign up successful! Check your email to confirm your account.",
            isError: false,
          });

        } catch (err) {
          console.error("Signup error:", err);
          setMessage({
            text: err.message || "Database error saving new user",
            isError: true,
          });
        }
      } else {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        // Supabase has now created the auth session token (JWT)
        // data.session.access_token exists here
        setMessage({ text: "Logged in successfully!", isError: false });
        // redirect after logging in for the 1st time
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: userData } = await supabase
            .from("users")
            .select("major_id, starting_term_id")
            .eq("id", user.id)
            .single();

          if (hasCompletedOnboarding(userData)) {
            setMessage({ text: "Logged in successfully!", isError: false });
            navigate("/dashboard");
          } else {
            navigate("/onboarding");
          }
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setMessage({
        text: err.message || "Something went wrong",
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };
  const handleHomeClick = () => {
    navigate("/");
  };
  return (
    <div className="auth-page">
      <div className="left-side-container">
        <div className="gradsis-logo">GRADSIS</div>
        <button
          className="homepage-button"
          onClick={handleHomeClick}
          disabled={loading}
        >
          <i className="fas fa-home"></i> Home
        </button>
      </div>
      <div className="container">
        <div className="header">
          <div className="tab-container">
            <div
              className={action === "Sign Up" ? "submit" : "submit gray"}
              onClick={() => {
                setAction("Sign Up");
                setMessage({ text: "", isError: false });
              }}
            >
              Sign Up
            </div>
            <div
              className={action === "Login" ? "submit" : "submit gray"}
              onClick={() => {
                setAction("Login");
                setMessage({ text: "", isError: false });
              }}
            >
              Login
            </div>
          </div>

          <div className="text">{action}</div>
          <div className="underline"></div>
        </div>

        {message.text && (
          <div
            className={message.isError ? "message error" : "message success"}
          >
            {message.text}
          </div>
        )}

        <div className="inputs">
          {action === "Login" ? null : (
            <div className="input">
              <span className="input-icon" aria-hidden="true">
                <User size={18} strokeWidth={2.2} />
              </span>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="input">
            <span className="input-icon" aria-hidden="true">
              <Mail size={18} strokeWidth={2.2} />
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input">
            <span className="input-icon" aria-hidden="true">
              <Lock size={18} strokeWidth={2.2} />
            </span>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {action === "Sign Up" ? null : (
  <div className="forgot-password">
    Forgot Password?{" "}
    <span onClick={() => navigate("/resetPass")}>
      Click here!
    </span>
  </div>
)}
          <div className="submit-container">
            <div className="submit" onClick={handleSubmit}>
              {loading ? "Please wait..." : "Submit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
