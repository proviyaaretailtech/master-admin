import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { bootstrapI18n, scheduleIdlePrefetch } from "./i18n/bootstrap";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Load the saved language (catalogue + font) BEFORE the first render. The inline splash in
// index.html stays on screen meanwhile. bootstrapI18n never rejects: on failure the app starts
// in English instead of showing a blank page.
void bootstrapI18n().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  scheduleIdlePrefetch();
});
