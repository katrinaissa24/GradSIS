import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./pages/auth";
import OnBoarding from "./pages/onboarding";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Errors from './utils/errors';
import ResetPassword from "./pages/resetPass";
import NewPassword from "./pages/NewPass";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<OnBoarding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/resetPass" element={<ResetPassword />} />
        <Route path="/NewPass" element={<NewPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/errors" element ={<Errors/>}/>
      </Routes>
    </Router>
  );
}
