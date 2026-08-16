/**
 * جدول قابل للتمرير أفقياً مع:
 *  - شريط تمرير علوي ثابت (Sticky Top Scrollbar) مزامن مع الجدول.
 *  - السحب بالماوس (Drag-to-Scroll).
 *  - أسهم تمرير بصرية تظهر عند وجود محتوى مخفي يميناً/يساراً.
 *
 * الاستخدام:
 *   <ScrollableTable>
 *     <table className="w-full text-sm">…</table>
 *   </ScrollableTable>
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  maxHeight?: string | number;
  className?: string;
  /** أدنى عرض للمحتوى بالبكسل — يضمن ظهور شريط السحب الأفقي بدل ضغط الأعمدة */
  minWidth?: number;
};

export function ScrollableTable({ children, maxHeight, className = "", minWidth = 880 }: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // قياس عرض المحتوى لإنشاء شريط تمرير علوي مطابق
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      setScrollWidth(el.scrollWidth);
      setOverflowing(el.scrollWidth - el.clientWidth > 4);
      updateArrows(el);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  const updateArrows = (el: HTMLElement) => {
    setCanLeft(el.scrollLeft > 5);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  // مزامنة التمرير بين الشريط العلوي والجدول
  const syncing = useRef(false);
  const onTopScroll = () => {
    if (syncing.current) { syncing.current = false; return; }
    if (topRef.current && wrapRef.current) {
      syncing.current = true;
      wrapRef.current.scrollLeft = topRef.current.scrollLeft;
      updateArrows(wrapRef.current);
    }
  };
  const onWrapScroll = () => {
    if (syncing.current) { syncing.current = false; return; }
    if (topRef.current && wrapRef.current) {
      syncing.current = true;
      topRef.current.scrollLeft = wrapRef.current.scrollLeft;
      updateArrows(wrapRef.current);
    }
  };

  // السحب بالماوس
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let down = false, startX = 0, startLeft = 0, moved = false;
    const onDown = (e: MouseEvent) => {
      // لا نلتقط السحب فوق عناصر تفاعلية (أزرار/روابط)
      const t = e.target as HTMLElement;
      if (t.closest("button,a,input,select,textarea,[role=button]")) return;
      down = true; moved = false;
      startX = e.pageX; startLeft = el.scrollLeft;
      el.classList.add("st-dragging");
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };
    const stop = () => {
      down = false;
      el.classList.remove("st-dragging");
      if (moved) {
        // امنع نقرة عرضية بعد السحب
        const block = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); el.removeEventListener("click", block, true); };
        el.addEventListener("click", block, true);
        setTimeout(() => el.removeEventListener("click", block, true), 50);
      }
    };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    el.addEventListener("mouseleave", stop);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
      el.removeEventListener("mouseleave", stop);
    };
  }, []);

  const scrollBy = (dir: number) => {
    wrapRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  const style = maxHeight ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight } : undefined;

  return (
    <div className={`relative ${className}`} dir="ltr">
      {/* شريط تمرير علوي ثابت ومزامن — يظهر فقط عند وجود محتوى مخفي */}
      <div
        ref={topRef}
        onScroll={onTopScroll}
        className="st-topbar"
        style={{
          overflowX: "scroll",
          overflowY: "hidden",
          height: 16,
          position: "sticky",
          top: 0,
          zIndex: 6,
        }}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>

      {/* الحاوية الفعلية للجدول */}
      <div
        ref={wrapRef}
        onScroll={onWrapScroll}
        className="st-wrap"
        style={{ overflowX: "auto", overflowY: maxHeight ? "auto" : "visible", cursor: "grab", ...style }}
      >
        <div dir="rtl" style={{ minWidth }}>{children}</div>
      </div>

      {/* أسهم تمرير بصرية */}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="تمرير لليمين"
          className="st-arrow st-arrow-right"
        >‹</button>
      )}
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="تمرير لليسار"
          className="st-arrow st-arrow-left"
        >›</button>
      )}

      <style>{`
        .st-topbar, .st-wrap { scrollbar-width: auto; scrollbar-color: var(--primary-mid, #1a7a4a) #eef2f7; }
        .st-topbar::-webkit-scrollbar { height: 10px; }
        .st-topbar::-webkit-scrollbar-thumb,
        .st-wrap::-webkit-scrollbar-thumb { background: var(--primary-mid, #1a7a4a); border-radius: 10px; }
        .st-topbar::-webkit-scrollbar-thumb:hover,
        .st-wrap::-webkit-scrollbar-thumb:hover { background: var(--primary, #0e4d2e); }
        .st-topbar::-webkit-scrollbar-track,
        .st-wrap::-webkit-scrollbar-track { background: #eef2f7; border-radius: 10px; }
        .st-wrap::-webkit-scrollbar { height: 10px; }
        .st-wrap.st-dragging { cursor: grabbing; user-select: none; }
        .st-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; border-radius: 9999px;
          background: var(--primary, #0e4d2e); color: #fff; border: none;
          font-size: 18px; line-height: 1; cursor: pointer; z-index: 5;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,.18); transition: background .2s; opacity: .9;
        }
        .st-arrow:hover { opacity: 1; }
        .st-arrow-right { right: 4px; }
        .st-arrow-left  { left:  4px; }
      `}</style>
    </div>
  );
}
