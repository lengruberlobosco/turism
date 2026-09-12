import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { router } from "./App";
import "./index.css";
import { startAutoSync } from "./sync/engine";

const updateSW = registerSW({
  onNeedRefresh() {
    // nunca atualiza o SW no meio da viagem sem perguntar (docs/04 §2.4)
    if (confirm("Nova versão do Turism disponível. Atualizar agora?")) void updateSW(true);
  },
  onOfflineReady() {
    console.info("Turism pronto para uso offline.");
  },
});

startAutoSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
