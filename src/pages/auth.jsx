import "./auth.css";
import React, { useState, useEffect } from "react";
import email_icon from "../assets/email.png";
import password_icon from "../assets/password.png";
import user_icon from "../assets/person.png";
import { signUp, signIn } from "../services/auth";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";

const AuthPage = () => {
  const [action, setAction] = useState("Sign Up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getSession();
      if (user) {
        // Check if user has completed onboarding by checking major_id and starting_term_id
        const { data: userData } = await supabase
          .from("users")
          .select("major_id, starting_term_id")
          .eq("id", user.id)
          .single();

        if (userData && userData.major_id && userData.starting_term_id) {
          // User has completed onboarding
          navigate("/dashboard");
        } else {
          // User hasn't completed onboarding
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
            });

          if (signUpError) throw signUpError;

          const { data: userData, error: insertError } = await supabase
            .from("users")
            .insert([
              {
                id: authData.user.id, // MUST come from Auth
                email: authData.user.email, // NOT NULL
                name: name || null, // optional
                major_id: null, // optional, can stay null at signup
                starting_term_id: null, // optional
                current_gpa: null, // optional
                credits_completed: 0, // default value
                student_type: null, // optional
              },
            ])
            .select(); // optional, returns the inserted row

          if (insertError) throw insertError;

          // 3️⃣ Show success message
          setMessage({
            text: "Sign up successful! Check your email to confirm your account.",
            isError: false,
          });

          console.log("User signed up and saved in users table:", userData);
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

          if (userData && userData.major_id && userData.starting_term_id) {
            // User has completed onboarding -> go to dashboard
            setMessage({ text: "Logged in successfully!", isError: false });
            navigate("/dashboard");
          } else {
            // User hasn't completed onboarding -> go to onboarding
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
              <img src={user_icon} alt="User icon" />
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
            <img src={email_icon} alt="Email icon" />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input">
            <img src={password_icon} alt="Password icon" />
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
