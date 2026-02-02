import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Onboarding from "./onBoarding";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </Router>
  );
}

export default App;
