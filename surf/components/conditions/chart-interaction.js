import { useRef } from "react";

export function useChartInteraction({
  start,
  end,
  selectedTime,
  width,
  left = 48,
  right = 48,
  onTimeChange,
}) {
  const gesture = useRef(null);
  const choose = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const fraction = Math.max(
      0,
      Math.min(1, (x - left) / (width - left - right)),
    );
    const time =
      Math.round((start + fraction * (end - start)) / 900000) * 900000;
    onTimeChange(Math.max(start, Math.min(end, time)));
  };
  return {
    onPointerDown(e) {
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        scrolling: false,
        horizontal: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (e.pointerType === "mouse") choose(e);
    },
    onPointerMove(e) {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId || g.scrolling) return;
      const dx = Math.abs(e.clientX - g.x),
        dy = Math.abs(e.clientY - g.y);
      if (e.pointerType !== "mouse" && !g.horizontal) {
        if (dy > 8 && dy > dx) {
          g.scrolling = true;
          return;
        }
        if (dx <= 8) return;
        g.horizontal = true;
      }
      choose(e);
    },
    onPointerUp(e) {
      const g = gesture.current;
      if (g && g.id === e.pointerId && !g.scrolling) choose(e);
      gesture.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    },
    onPointerCancel() {
      gesture.current = null;
    },
    onKeyDown(e) {
      const moves = {
        ArrowLeft: -900000,
        ArrowDown: -900000,
        ArrowRight: 900000,
        ArrowUp: 900000,
        PageDown: -3600000,
        PageUp: 3600000,
      };
      if (e.key in moves || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        onTimeChange(
          e.key === "Home"
            ? start
            : e.key === "End"
              ? end
              : Math.max(
                  start,
                  Math.min(end, (selectedTime || start) + moves[e.key]),
                ),
        );
      }
    },
  };
}
