"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol === "https:"
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("PWA Service Worker registrado con éxito:", registration.scope);
          })
          .catch((error) => {
            console.warn("Fallo en el registro del PWA Service Worker:", error);
          });
      });
    }
  }, []);

  return null;
}
