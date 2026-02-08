import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Welcome</h1>

      <button onClick={() => navigate("/auth")}>
        Login / Signup
      </button>
    </div>
  );
}
