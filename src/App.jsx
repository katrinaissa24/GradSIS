import LandingPage from "./pages/LandingPage";

export default function App() {
  return <LandingPage />;
}
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Onboarding from "./onBoarding";
import Auth from "./pages/auth";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
