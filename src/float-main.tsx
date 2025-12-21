import React from "react";
import ReactDOM from "react-dom/client";
import { FloatWindow } from "./components/FloatWindow";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FloatWindow />
  </React.StrictMode>,
);
