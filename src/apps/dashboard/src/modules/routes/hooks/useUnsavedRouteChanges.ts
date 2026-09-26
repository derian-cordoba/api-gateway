"use client";

import { useEffect } from "react";

/** Protect route drafts when navigating to source settings or leaving the page. */
export function useUnsavedRouteChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;

      if (!link || link.target === "_blank" || link.hasAttribute("download")) {
        return;
      }

      const destination = new URL(link.href, window.location.href);

      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      if (!window.confirm("Discard your unsaved route changes and leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, [dirty]);
}
