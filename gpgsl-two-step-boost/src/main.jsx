import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import browsee from "@browsee/web-sdk";

browsee.init({ apiKey: "85fdc0534d8b99deb4d546170614f5c754a023663dcdb665" });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
