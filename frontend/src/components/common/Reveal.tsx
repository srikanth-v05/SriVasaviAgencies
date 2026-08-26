import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Wraps content and eases it into view once it scrolls into the viewport.
 * Uses IntersectionObserver, reveals once, and honours prefers-reduced-motion
 * through the CSS in index.css.
 */
export function Reveal({
  children,
  as: Tag = "div",
  stagger = false,
  className = "",
  threshold = 0.15,
}: {
  children: ReactNode;
  as?: ElementType;
  stagger?: boolean;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, threshold]);

  const base = stagger ? "reveal-stagger" : "reveal";
  return (
    <Tag ref={ref} className={`${base} ${visible ? "is-visible" : ""} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
