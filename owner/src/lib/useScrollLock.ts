import { useEffect } from "react";

let locks = 0;
let prevHtml = "";
let prevBody = "";

function acquire() {
  if (locks === 0) {
    prevHtml = document.documentElement.style.overflow;
    prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  locks += 1;
}

function release() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.documentElement.style.overflow = prevHtml;
    document.body.style.overflow = prevBody;
  }
}

export function useScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    acquire();
    return release;
  }, [open]);
}
