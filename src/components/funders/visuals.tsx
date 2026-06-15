// Shared funder-page visual language — ported from the canonical FundersPage.jsx design asset.
// Self-contained scoped styles (all classes f2k-* prefixed) translated to the app's font CSS
// vars; the bespoke navy/timber palette is intentional — the funder audience + legal footing is
// distinct from the buyer pages. Used by both the overview (/funders) and the per-project pages.

import type { CostStackItem } from "@/data/funding";

export const INK = "#14181F";
export const PAPER = "#EEF1F4";
export const NAVY = "#1B3A5B";
export const NAVY_DK = "#142C44";
export const TIMBER = "#C77F3A";
export const GREEN = "#2E7D5B";
export const LINE = "#D5DBE0";
export const MUTED = "#5C6773";

export const HURDLE = 0.2; // development-margin hurdle for the verdict

export const fmt0 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
export const fmtM = (n: number) =>
  "$" +
  (n / 1e6).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) +
  "M";
export const pct = (n: number) =>
  (n * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 }) + "%";

// timber→navy ramp so the cost stack reads as one material building up.
const STACK_COLORS = [
  "#C77F3A",
  "#B6783E",
  "#9E6E45",
  "#7E6650",
  "#5A5E5E",
  "#3F5165",
  "#2E4A6A",
  "#234468",
  "#1B3A5B",
];

/** The scoped style block. Render ONCE per page (e.g. at the top of the funder root). */
export function FunderStyles() {
  return (
    <style>{`
      .f2k-root{ --ink:${INK}; --navy:${NAVY}; --timber:${TIMBER}; --green:${GREEN};
        background:${PAPER}; color:${INK}; font-family:var(--font-inter),system-ui,sans-serif;
        line-height:1.5; -webkit-font-smoothing:antialiased;
        background-image:linear-gradient(${LINE} 1px,transparent 1px),linear-gradient(90deg,${LINE} 1px,transparent 1px);
        background-size:48px 48px; background-position:-1px -1px; }
      .f2k-root *{ box-sizing:border-box; }
      .f2k-wrap{ max-width:1080px; margin:0 auto; padding:0 24px; }
      .f2k-mono{ font-family:var(--font-ibm-mono),monospace; font-variant-numeric:tabular-nums; }
      .f2k-eyebrow{ font-family:var(--font-ibm-mono),monospace; font-size:11px; letter-spacing:.22em;
        text-transform:uppercase; color:${TIMBER}; font-weight:600; }
      .f2k-h1{ font-family:var(--font-archivo),sans-serif; font-weight:800; letter-spacing:-.02em;
        font-size:clamp(40px,7vw,76px); line-height:.98; margin:14px 0 0; color:${INK}; }
      .f2k-h2{ font-family:var(--font-archivo),sans-serif; font-weight:700; letter-spacing:-.01em;
        font-size:clamp(24px,3.4vw,34px); margin:0; color:${INK}; }
      .f2k-lead{ font-size:clamp(16px,2vw,19px); color:${MUTED}; max-width:54ch; margin:20px 0 0; }

      .f2k-sec{ padding:72px 0; border-bottom:1px solid ${LINE}; }
      .f2k-hero{ padding:72px 0 64px; }

      .f2k-steps{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:36px; }
      .f2k-step{ background:#fff; border:1px solid ${LINE}; border-radius:4px; padding:24px; position:relative; overflow:hidden; }
      .f2k-step::before{ content:attr(data-n); position:absolute; right:14px; top:6px;
        font-family:var(--font-archivo),sans-serif; font-weight:800; font-size:60px; color:${PAPER}; line-height:1; }
      .f2k-step h3{ font-family:var(--font-archivo),sans-serif; font-size:18px; margin:0 0 8px; letter-spacing:-.01em; position:relative; }
      .f2k-step p{ margin:0; font-size:14.5px; color:${MUTED}; position:relative; }
      .f2k-steparrow{ height:2px; background:${TIMBER}; width:34px; margin:14px 0 0; position:relative; }

      .f2k-chain{ display:grid; grid-template-columns:repeat(7,1fr); gap:0; border:1px solid ${LINE};
        border-radius:4px; overflow:hidden; background:#fff; }
      .f2k-node{ padding:18px 14px; border-right:1px solid ${LINE}; position:relative; }
      .f2k-node:last-child{ border-right:0; }
      .f2k-node:first-child{ background:#FBF4E6; }
      .f2k-noden{ font-family:var(--font-ibm-mono),monospace; font-size:11px; font-weight:600; color:${TIMBER}; }
      .f2k-node h4{ font-family:var(--font-archivo),sans-serif; font-size:14px; margin:8px 0 6px; letter-spacing:-.01em; line-height:1.15; }
      .f2k-node p{ font-size:11.5px; color:${MUTED}; margin:0; line-height:1.35; }
      .f2k-chainband{ font-family:var(--font-ibm-mono),monospace; font-size:11.5px; letter-spacing:.04em;
        color:#dfe8f1; background:${NAVY}; border-radius:4px; padding:12px 16px; margin-top:12px; text-align:center; }
      .f2k-formula{ font-family:var(--font-ibm-mono),monospace; font-size:clamp(13px,2vw,16px);
        background:${NAVY}; color:#dfe8f1; border-radius:4px; padding:18px 20px; margin-top:8px;
        display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; }
      .f2k-formula b{ color:#fff; } .f2k-formula .op{ color:${TIMBER}; } .f2k-formula .res{ color:#8fe0b6; }

      .f2k-calc{ display:grid; grid-template-columns:1.05fr 1fr; gap:36px; margin-top:30px; align-items:start; }
      .f2k-controls label{ display:block; font-size:12.5px; color:${MUTED}; font-weight:600; margin:0 0 6px;
        font-family:var(--font-ibm-mono),monospace; letter-spacing:.04em; text-transform:uppercase; }
      .f2k-ctl{ margin-bottom:22px; }
      .f2k-ctl .val{ font-family:var(--font-ibm-mono),monospace; font-weight:600; font-size:20px; color:${INK}; }
      .f2k-root input[type=range]{ -webkit-appearance:none; appearance:none; width:100%; height:3px; background:${LINE}; border-radius:2px; margin-top:12px; }
      .f2k-root input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px;height:18px;border-radius:50%;
        background:${NAVY}; cursor:pointer; border:3px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.25); }
      .f2k-root input[type=range]::-moz-range-thumb{ width:18px;height:18px;border-radius:50%; background:${NAVY}; cursor:pointer; border:3px solid #fff; }

      .f2k-readout{ background:#fff; border:1px solid ${LINE}; border-radius:4px; padding:22px; }
      .f2k-rrow{ display:flex; justify-content:space-between; align-items:baseline; padding:9px 0; border-bottom:1px dashed ${LINE}; }
      .f2k-rrow:last-child{ border-bottom:0; }
      .f2k-rrow .k{ font-size:13.5px; color:${MUTED}; }
      .f2k-rrow .v{ font-family:var(--font-ibm-mono),monospace; font-weight:600; font-size:16px; }
      .f2k-bigmargin{ font-family:var(--font-archivo),sans-serif; font-weight:800; font-size:46px; letter-spacing:-.02em; line-height:1; }

      .f2k-verdict{ display:inline-flex; align-items:center; gap:7px; font-family:var(--font-ibm-mono),monospace;
        font-weight:600; font-size:13px; padding:6px 12px; border-radius:999px; }
      .f2k-dot{ width:8px;height:8px;border-radius:50%; }

      /* cost stack visual */
      .f2k-stackcol{ position:relative; border-left:2px solid ${INK}; border-bottom:2px solid ${INK}; }
      .f2k-blocks{ position:absolute; left:0; right:0; bottom:0; display:flex; flex-direction:column-reverse; }
      .f2k-block{ width:100%; border-top:1px solid rgba(255,255,255,.35); display:flex; align-items:center;
        padding:0 12px; overflow:hidden; }
      .f2k-blocklabel{ color:#fff; font-size:11.5px; font-weight:600; display:flex; gap:8px; align-items:baseline;
        white-space:nowrap; text-shadow:0 1px 1px rgba(0,0,0,.18); }
      .f2k-blocklabel em{ font-family:var(--font-ibm-mono),monospace; font-style:normal; opacity:.85; font-size:11px; }
      .f2k-margin{ width:100%; background:repeating-linear-gradient(45deg,#D8EEE2,#D8EEE2 7px,#cfe9da 7px,#cfe9da 14px);
        border-top:2px solid ${GREEN}; display:flex; align-items:center; padding:0 12px; }
      .f2k-marginlabel{ color:#0f4a32; font-size:12px; font-weight:700; display:flex; gap:8px; align-items:baseline; }
      .f2k-marginlabel em{ font-family:var(--font-ibm-mono),monospace; font-style:normal; }
      .f2k-revline{ position:absolute; left:-2px; right:0; border-top:1px dashed ${MUTED}; }
      .f2k-revline span{ position:absolute; right:0; top:-20px; font-family:var(--font-ibm-mono),monospace;
        font-size:11px; color:${MUTED}; background:${PAPER}; padding:0 6px; }
      .f2k-axis{ margin-top:8px; font-family:var(--font-ibm-mono),monospace; font-size:10.5px; letter-spacing:.06em;
        text-transform:uppercase; color:${MUTED}; }
      .f2k-grow{ transform-origin:bottom; animation:f2kgrow .5s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes f2kgrow{ from{ transform:scaleY(0); opacity:.3 } to{ transform:scaleY(1); opacity:1 } }

      /* capital stack (senior / junior) */
      .f2k-capital{ display:flex; height:60px; border:1px solid ${LINE}; border-radius:4px; overflow:hidden; }
      .f2k-capseg{ display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;
        font-family:var(--font-ibm-mono),monospace; font-size:11px; border-right:1px solid rgba(255,255,255,.25); padding:0 4px; text-align:center; }
      .f2k-capseg:last-child{ border-right:0; }
      .f2k-capseg b{ font-size:12px; font-weight:700; }
      .f2k-caplegend{ display:flex; gap:18px; margin-top:10px; flex-wrap:wrap; font-size:12px; color:${MUTED}; font-family:var(--font-ibm-mono),monospace; }
      .f2k-caplegend i{ width:11px;height:11px;border-radius:2px;display:inline-block;margin-right:6px;vertical-align:-1px; }

      /* projects */
      .f2k-caveat{ display:flex; gap:14px; align-items:flex-start; background:#FBF4E6; border:1px solid #E7D6B0;
        border-left:4px solid ${TIMBER}; border-radius:4px; padding:16px 18px; margin-bottom:28px; }
      .f2k-caveat .t{ font-size:14px; color:#5b4a2a; }
      .f2k-caveat b{ color:#3f3417; }
      .f2k-projects{ display:grid; grid-template-columns:1fr 1fr; gap:22px; }
      .f2k-card{ background:#fff; border:1px solid ${LINE}; border-radius:4px; padding:24px; display:flex; flex-direction:column; }
      .f2k-cardhead{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; gap:12px; }
      .f2k-cardhead h3{ font-family:var(--font-archivo),sans-serif; font-size:22px; margin:0; letter-spacing:-.01em; }
      .f2k-cardhead .sub{ font-size:13px; color:${MUTED}; margin-top:2px; }
      .f2k-badge{ font-family:var(--font-ibm-mono),monospace; font-size:10.5px; font-weight:600; letter-spacing:.06em;
        text-transform:uppercase; padding:5px 9px; border-radius:3px; white-space:nowrap; }
      .f2k-badge.ind{ background:#F4E8CC; color:#7a5a16; }
      .f2k-badge.live{ background:#D8EEE2; color:#0f4a32; }
      .f2k-mini{ display:flex; gap:16px; margin-top:18px; }
      .f2k-mini .m{ flex:1; } .f2k-mini .k{ font-size:11px; color:${MUTED}; font-family:var(--font-ibm-mono),monospace; text-transform:uppercase; letter-spacing:.05em; }
      .f2k-mini .v{ font-family:var(--font-ibm-mono),monospace; font-weight:600; font-size:17px; margin-top:3px; }
      .f2k-pending{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
        height:300px; border:1px dashed ${LINE}; border-radius:4px; color:${MUTED}; gap:10px; }
      .f2k-pending .big{ font-family:var(--font-archivo),sans-serif; font-weight:700; font-size:20px; color:${INK}; }
      .f2k-cardcta{ display:inline-flex; align-items:center; gap:8px; margin-top:18px; background:${NAVY}; color:#fff;
        font-family:var(--font-archivo),sans-serif; font-weight:600; font-size:14px; padding:11px 18px; border-radius:4px;
        text-decoration:none; align-self:flex-start; }
      .f2k-cardcta:hover{ background:${NAVY_DK}; }
      .f2k-cardnote{ font-size:12px; color:${MUTED}; margin-top:14px; }

      .f2k-cta{ display:inline-flex; align-items:center; gap:10px; background:${NAVY}; color:#fff;
        font-weight:600; font-size:15px; padding:14px 22px; border-radius:4px; text-decoration:none; margin-top:8px;
        font-family:var(--font-archivo),sans-serif; }
      .f2k-cta:hover{ background:${NAVY_DK}; }

      @media (max-width:860px){
        .f2k-steps{ grid-template-columns:1fr; } .f2k-calc{ grid-template-columns:1fr; }
        .f2k-projects{ grid-template-columns:1fr; }
        .f2k-chain{ grid-template-columns:1fr 1fr; }
        .f2k-node{ border-bottom:1px solid ${LINE}; }
      }
      @media (prefers-reduced-motion:reduce){ .f2k-grow{ animation:none } }
    `}</style>
  );
}

type StackCategory = { label: string; value: number };

/** Cost stack building up from the bottom, with margin headroom to the revenue line. */
export function StackColumn({
  revenue,
  categories,
  total,
  height = 320,
  animate = true,
}: {
  revenue: number;
  categories: StackCategory[];
  total: number;
  height?: number;
  animate?: boolean;
}) {
  const surplus = Math.max(revenue - total, 0);
  const over = total > revenue;
  const denom = Math.max(revenue, total);
  const px = (v: number) => (v / denom) * height;

  return (
    <div>
      <div className="f2k-stackcol" style={{ height }}>
        <div className="f2k-revline" style={{ bottom: px(revenue) }}>
          <span>Revenue · {fmtM(revenue)}</span>
        </div>
        <div className="f2k-blocks">
          {categories.map((c, i) => {
            const h = px(c.value);
            return (
              <div
                key={c.label}
                className={"f2k-block" + (animate ? " f2k-grow" : "")}
                style={{
                  height: h,
                  background: STACK_COLORS[i % STACK_COLORS.length],
                  animationDelay: `${i * 70}ms`,
                }}
                title={`${c.label} · ${fmt0(c.value)}`}
              >
                {h > 18 && (
                  <span className="f2k-blocklabel">
                    {c.label}
                    <em>{fmtM(c.value)}</em>
                  </span>
                )}
              </div>
            );
          })}
          {!over && (
            <div
              className={"f2k-margin" + (animate ? " f2k-grow" : "")}
              style={{ height: px(surplus), animationDelay: `${categories.length * 70}ms` }}
            >
              {px(surplus) > 22 && (
                <span className="f2k-marginlabel">
                  Margin
                  <em>{fmtM(surplus)}</em>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="f2k-axis">Cost stack → margin headroom</div>
    </div>
  );
}

export function Verdict({ margin }: { margin: number }) {
  let label: string, color: string, bg: string;
  if (margin >= HURDLE) {
    label = "Fundable";
    color = "#0f4a32";
    bg = "#D8EEE2";
  } else if (margin >= 0.15) {
    label = "Marginal";
    color = "#7a5a16";
    bg = "#F4E8CC";
  } else {
    label = "Below hurdle";
    color = "#7a2420";
    bg = "#F3D9D6";
  }
  return (
    <span className="f2k-verdict" style={{ color, background: bg }}>
      <span className="f2k-dot" style={{ background: color }} /> {label}
    </span>
  );
}

/**
 * The capital stack — one senior 50% block + the junior 50% band split into 10% slices.
 * When packageAmount is given, shows the $ on each segment.
 */
export function CapitalStack({ packageAmount }: { packageAmount?: number }) {
  const juniorShades = ["#C77F3A", "#B6783E", "#9E6E45", "#7E6650", "#5A5E5E"];
  const amt = (p: number) =>
    packageAmount ? fmtM((p / 100) * packageAmount) : "";

  return (
    <div>
      <div className="f2k-capital">
        <div
          className="f2k-capseg"
          style={{ flex: 50, background: NAVY }}
          title="Senior — 50%"
        >
          <b>Senior · 50%</b>
          {packageAmount && <span>{amt(50)}</span>}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="f2k-capseg"
            style={{ flex: 10, background: juniorShades[i] }}
            title={`Junior tranche — 10%`}
          >
            <b>10%</b>
            {packageAmount && <span>{amt(10)}</span>}
          </div>
        ))}
      </div>
      <div className="f2k-caplegend">
        <span>
          <i style={{ background: NAVY }} />
          Senior — 50% + retail FRoR{packageAmount ? ` · ${amt(50)}` : ""}
        </span>
        <span>
          <i style={{ background: TIMBER }} />
          Junior — remaining 50%, in 10–50% tranches{packageAmount ? ` · 10% ≈ ${amt(10)}` : ""}
        </span>
      </div>
    </div>
  );
}
