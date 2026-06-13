"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type LazyVisibleProps = {
  children: ReactNode;
  /** Placeholder min-height (px) reserved before mount, to avoid layout shift. */
  minHeight?: number;
  /** How far ahead of the viewport to start mounting (IntersectionObserver rootMargin). */
  rootMargin?: string;
  className?: string;
};

/**
 * Renders its children only once the wrapper scrolls near the viewport, then
 * keeps them mounted (no unmount on scroll-away).
 *
 * Used to keep heavy below-the-fold subtrees — e.g. the Seafields interactive
 * subdivision map — out of the initial hydration pass, so low-memory mobile
 * devices don't spike on first page load. The placeholder reserves height so
 * deferring the mount doesn't shift the page. Server and first client render
 * both produce the placeholder (state starts `false` on both), so there is no
 * hydration mismatch.
 */
export default function LazyVisible({
  children,
  minHeight = 400,
  rootMargin = "800px",
  className,
}: LazyVisibleProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    // Old browsers without IntersectionObserver: render immediately rather
    // than leave the content permanently hidden.
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {show ? children : <div style={{ minHeight }} aria-hidden />}
    </div>
  );
}
