import React, { useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import "./resetPass.css";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessage({ text: "Please enter your email.", isError: true });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/NewPass`,
    });

    if (error) {
      setMessage({ text: error.message, isError: true });
    } else {
      setMessage({
        text: "Check your email for the password reset link.",
        isError: false,
      });
    }

    setLoading(false);
  };

  return (
    <div className="reset-password-page">
      <h2>Reset Password</h2>
      
      {message.text && (
        <div className={`message ${message.isError ? "error" : "success"}`}>
          {message.text}
        </div>
      )}
      
      <div className="inputs">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        
        <div className="submit-container">
          <div className="submit" onClick={handleResetPassword}>
            {loading ? "Please wait..." : "Send Reset Link"}
          </div>
          
          <div className="submit gray" onClick={() => navigate("/auth")}>
            Back
          </div>
        </div>
      </div>
    </div>
  );
}