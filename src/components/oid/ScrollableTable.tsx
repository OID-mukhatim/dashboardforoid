/**
 * جدول قابل للتمرير أفقياً.
 *
 * لا يوجد شريط علوي/سفلي لكل جدول — بل شريط أفقي واحد ثابت في أسفل الشاشة
 * (بنفس مواصفات شريط التمرير العمودي الجانبي) يرتبط تلقائياً بالجدول الظاهر حالياً.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
  maxHeight?: string | number;
  className?: string;
  /** أدنى عرض للمحتوى بالبكسل */
  minWidth?: number;
};

/* ---------- سجل عام لكل الحاويات القابلة للتمرير ---------- */
const registry = new Set<HTMLElement>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function register(el: HTMLElement) {
  registry.add(el);
  notify();
  return () => {
    registry.delete(el);
    notify();
  };
}

/** يختار الجدول الظاهر في الشاشة والذي يحتوي فائضاً أفقياً */
function pickActive(): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = -Infinity;
  const vh = window.innerHeight;
  registry.forEach((el) => {
    if (el.scrollWidth - el.clientWidth < 4) return;
    const r = el.getBoundingClientRect();
    const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (visible <= 40) return;
    if (visible > bestScore) {
      bestScore = visible;
      best = el;
    }
  });
  return best;
}

/* ---------- الشريط الأفقي الثابت (نسخة واحدة فقط) ---------- */
let barMounted = false;

function GlobalHScrollbar() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const syncingFromTable = useRef(false);
  const draggingBar = useRef(false);

  useEffect(() => {
    const update = () => {
      const el = pickActive();
      activeRef.current = el;
      setActive(el);
      if (el) {
        const r = el.getBoundingClientRect();
        // نفس عرض منطقة العرض الفعلية للجدول حتى تتطابق مسافة التمرير 1:1
        setBox({ left: Math.max(0, r.left), width: el.clientWidth });
        setWidth(el.scrollWidth);
        if (barRef.current && !draggingBar.current) {
          const bar = barRef.current;
          syncingFromTable.current = true;
          bar.scrollLeft = el.scrollLeft;
          requestAnimationFrame(() => (syncingFromTable.current = false));
        }
      } else {
        setBox(null);
      }
    };
    update();
    listeners.add(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const id = window.setInterval(update, 500);
    return () => {
      listeners.delete(update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const moveTable = () => {
      if (syncingFromTable.current) return;
      const table = activeRef.current;
      if (!table) return;
      const tMax = table.scrollWidth - table.clientWidth;
      table.scrollLeft = Math.min(bar.scrollLeft, tMax);
    };
    const startDragging = () => {
      draggingBar.current = true;
    };
    const stopDragging = () => {
      moveTable();
      draggingBar.current = false;
    };

    // مستمع DOM مباشر لضمان التقاط حركة شريط المتصفح داخل الـ portal.
    bar.addEventListener("scroll", moveTable, { passive: true });
    bar.addEventListener("pointerdown", startDragging);
    window.addEventListener("pointerup", stopDragging);
    return () => {
      bar.removeEventListener("scroll", moveTable);
      bar.removeEventListener("pointerdown", startDragging);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [active]);

  if (!active || !box) return null;

  return createPortal(
    <div
      ref={barRef}
      dir="ltr"
      className="oid-hbar"
      style={{
        position: "fixed",
        bottom: 0,
        left: box.left,
        width: box.width,
        height: 15,
        overflowX: "scroll",
        overflowY: "hidden",
        zIndex: 60,
        background: "hsl(var(--background, 0 0% 100%))",
      }}
    >
      <div style={{ width, height: 1 }} />
    </div>,
    document.body,
  );
}

export function ScrollableTable({ children, maxHeight, className = "", minWidth = 880 }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    if (!barMounted) {
      barMounted = true;
      setOwner(true);
      return () => {
        barMounted = false;
      };
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const un = register(el);
    const ro = new ResizeObserver(() => notify());
    ro.observe(el);
    const onScroll = () => notify();
    el.addEventListener("scroll", onScroll);
    // يبدأ العرض من الطرف الأيمن لأن المحتوى عربي.
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
      notify();
    });
    return () => {
      un();
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [children]);

  const style = maxHeight
    ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }
    : undefined;

  return (
    <div className={`relative ${className}`} dir="ltr">
      <div
        ref={wrapRef}
        className="st-wrap"
        style={{ overflowX: "auto", overflowY: maxHeight ? "auto" : "visible", ...style }}
      >
        <div dir="rtl" style={{ minWidth }}>
          {children}
        </div>
      </div>

      {owner && <GlobalHScrollbar />}

      <style>{`
        /* إخفاء شريط الجدول نفسه — الشريط الوحيد هو الثابت أسفل الشاشة */
        .st-wrap { scrollbar-width: none; -ms-overflow-style: none; }
        .st-wrap::-webkit-scrollbar { height: 0; width: 0; }

        /* الشريط الأفقي الثابت — بنفس مواصفات الشريط العمودي الجانبي */
        .oid-hbar { scrollbar-width: auto; scrollbar-color: #9aa3af transparent; }
        .oid-hbar::-webkit-scrollbar { height: 14px; -webkit-appearance: none; }
        .oid-hbar::-webkit-scrollbar-thumb { background: #9aa3af; border-radius: 999px; border: 3px solid transparent; background-clip: content-box; min-width: 40px; }
        .oid-hbar::-webkit-scrollbar-thumb:hover { background: #6b7280; background-clip: content-box; }
        .oid-hbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
