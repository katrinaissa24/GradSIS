import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const Auth = lazy(() => import("./pages/auth"));
const OnBoarding = lazy(() => import("./pages/onboarding"));
const Home = lazy(() => import("./pages/home"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Errors = lazy(() => import("./utils/errors"));
const ResetPassword = lazy(() => import("./pages/resetPass"));
const NewPassword = lazy(() => import("./pages/NewPass"));
const CourseRating = lazy(() => import("./pages/CourseRating"));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<OnBoarding />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/resetPass" element={<ResetPassword />} />
          <Route path="/NewPass" element={<NewPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/errors" element={<Errors />} />
          <Route path="/course/:courseId" element={<CourseRating />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
