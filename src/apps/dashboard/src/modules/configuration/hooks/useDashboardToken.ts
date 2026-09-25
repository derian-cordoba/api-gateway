"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { configurationService } from "../services/configuration";

const subscribeToTokenStorage = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};

const getServerToken = () => "";

export function useDashboardToken(onSaved: () => void) {
  const storedToken = useSyncExternalStore(
    subscribeToTokenStorage,
    configurationService.getDashboardToken,
    getServerToken,
  );
  const [editedToken, setEditedToken] = useState<string | null>(null);
  const token = editedToken ?? storedToken;
  const [saved, setSaved] = useState(false);
  const [visibleUntil, setVisibleUntil] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  useEffect(() => {
    if (visibleUntil === null) return;
    const timeout = window.setTimeout(
      () => setVisibleUntil(null),
      Math.max(0, visibleUntil - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [visibleUntil]);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const showToken = () => setVisibleUntil(Date.now() + 30_000);
  const hideToken = () => setVisibleUntil(null);

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const save = () => {
    configurationService.setDashboardToken(token);
    setSaved(true);
    onSaved();
  };

  return {
    token,
    setToken: setEditedToken,
    saved,
    save,
    isVisible: visibleUntil !== null,
    copyStatus,
    showToken,
    hideToken,
    copyToken,
  };
}
