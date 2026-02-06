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
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .single();
        if (profile) {
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
        // Call Supabase directly
        await signUp(email, password);
        setMessage({
          text: "Check your email to confirm your account!",
          isError: false,
        });
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
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("user_id", user.id)
            .single();

          if (profile) {
            // profile exists -> go to dashboard
            setMessage({ text: "Logged in successfully!", isError: false });
            navigate("/dashboard");
          } else {
            // no profile -> first time login, go to onboarding
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
        <>
            <div className="left-side-container">
                <div className="gradsis-logo">
                    GRADSIS
                </div>
                <button 
                    className="homepage-button" 
                    onClick={handleHomeClick}
                    disabled={loading}
                >
                    <i className="fas fa-home"></i> Home
                </button>
            </div>
            <div className='container'>
                <div className='header'>
                    <div className='tab-container'>
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

                    <div className='text'>{action}</div>
                    <div className='underline'></div>
                </div>

                {message.text && (
                    <div className={message.isError ? 'message error' : 'message success'}>
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
                            placeholder='Enter your email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="input">
                        <img src={password_icon} alt="Password icon" />
                        <input
                            type="password"
                            placeholder='Enter your password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {action === "Sign Up" ? null : (
                        <div className="forgot-password">
                            Forgot Password? <span>Click here!</span>
                        </div>
                    )}

                    <div className='submit-container'>
                        <div
                            className="submit"
                            onClick={handleSubmit}
                        >
                            {loading ? 'Please wait...' : 'Submit'}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default AuthPage;