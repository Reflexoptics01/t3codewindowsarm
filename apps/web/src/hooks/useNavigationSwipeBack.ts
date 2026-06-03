import { useCanGoBack } from "@tanstack/react-router";
import { useEffect } from "react";

const SWIPE_THRESHOLD_PX = 60;
const HORIZONTAL_DOMINANCE = 1.35;

export function useNavigationSwipeBack() {
  const canGoBack = useCanGoBack();

  useEffect(() => {
    let accumX = 0;
    let accumY = 0;
    let tracking = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const resetTracking = () => {
      tracking = false;
      accumX = 0;
      accumY = 0;
    };

    const scheduleReset = () => {
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
      resetTimer = setTimeout(resetTracking, 120);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest("[data-disable-swipe-back='true']")) {
        return;
      }

      const deltaX = event.deltaX;
      const deltaY = event.deltaY;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      if (!tracking) {
        if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE) {
          return;
        }
        tracking = true;
        accumX = 0;
        accumY = 0;
      }

      accumX += deltaX;
      accumY += deltaY;
      scheduleReset();

      if (Math.abs(accumY) > Math.abs(accumX) * HORIZONTAL_DOMINANCE) {
        resetTracking();
        return;
      }

      if (accumX >= SWIPE_THRESHOLD_PX && canGoBack) {
        resetTracking();
        event.preventDefault();
        window.history.back();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
    };
  }, [canGoBack]);
}
