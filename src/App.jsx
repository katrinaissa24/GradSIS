import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import Onboarding from "./onBoarding";
import Auth from "./pages/auth";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Errors from "./utils/errors";
import ResetPassword from "./pages/resetPass";
import NewPassword from "./pages/NewPass";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auth"
            element={
              <GuestRoute>
                <Auth />
              </GuestRoute>
            }
          />
          <Route
            path="/resetPass"
            element={
              <GuestRoute>
                <ResetPassword />
              </GuestRoute>
            }
          />
          <Route
            path="/newPass"
            element={<NewPassword />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/errors" element={<Errors />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
