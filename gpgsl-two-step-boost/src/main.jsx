import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Anketa from "./components/Anketa.tsx";
import browsee from "@browsee/web-sdk";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

browsee.init({ apiKey: "85fdc0534d8b99deb4d546170614f5c754a023663dcdb665" });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/anketa" element={<Anketa />} />
      </Routes>
    </Router>
  </StrictMode>
);
