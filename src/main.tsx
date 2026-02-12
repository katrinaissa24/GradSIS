import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";          // <-- IMPORTANT: use the router App
import "../styles/index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
