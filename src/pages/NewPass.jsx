
import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import "./NewPass.css";

export default function NewPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });
  const [loading, setLoading] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Verify that Supabase created a recovery session for this link.
  useEffect(() => {
    let isMounted = true;

    const checkRecoverySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error || !data?.session) {
        setMessage({
          text: "Invalid or expired reset link. Please request a new one.",
          isError: true,
        });

        // Redirect to reset password page after 3 seconds
        setTimeout(() => {
          navigate("/resetPass");
        }, 3000);
      }
    };

    checkRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const validatePassword = (pass) => {
    const errors = [];
    if (pass.length < 6) errors.push("at least 6 characters");
    if (!/[A-Z]/.test(pass)) errors.push("one uppercase letter");
    if (!/[a-z]/.test(pass)) errors.push("one lowercase letter");
    if (!/[0-9]/.test(pass)) errors.push("one number");
    return errors;
  };

  const handleUpdatePassword = async () => {
    // Validate passwords
    if (password.length < 6) {
      setMessage({ text: "Password must be at least 6 characters", isError: true });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match", isError: true });
      return;
    }

    // Strong password validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setMessage({ 
        text: `Password must contain: ${passwordErrors.join(", ")}`, 
        isError: true 
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setPasswordUpdated(true);
      setMessage({ 
        text: "Password updated successfully!", 
        isError: false 
      });

      // Sign out after password change
      await supabase.auth.signOut();

    } catch (error) {
      setMessage({ 
        text: error.message || "Failed to update password. Please try again.", 
        isError: true 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading && password && confirmPassword) {
      handleUpdatePassword();
    }
  };

  if (passwordUpdated) {
    return (
      <div className="reset-password-page">
        <div className="reset-container">
          <div className="success-screen">
            <div className="success-icon">✓</div>
            <h3>Password Updated!</h3>
            <p>
              Your password has been successfully changed.
              You can now log in with your new password.
            </p>
            <button 
              className="submit-btn" 
              onClick={() => navigate("/auth")}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-container">
        <div className="reset-header">
          <h1>GRADSIS</h1>
          <h2>Create New Password</h2>
        </div>

        {message.text && (
          <div className={`message ${message.isError ? "error" : "success"}`}>
            {message.text}
          </div>
        )}

        <p className="instruction-text">
          Please enter your new password below.
        </p>

        <div className="input-group">
          <label htmlFor="password">New Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoFocus
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <small className="password-hint">
            Password must be at least 6 characters with uppercase, lowercase, and number.
          </small>
        </div>

        <div className="input-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-input-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <div className="button-group">
          <button 
            className="submit-btn" 
            onClick={handleUpdatePassword}
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
          
          <button 
            className="back-btn" 
            onClick={() => navigate("/auth")}
            disabled={loading}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
