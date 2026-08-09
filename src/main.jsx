import React from "react";
import ReactDOM from "react-dom/client";
import BudgetBook from "./BudgetBook.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BudgetBook />
  </React.StrictMode>
);

// Offline/installable support — only in production builds so dev HMR stays clean
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
