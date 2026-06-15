"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FunderStyles,
  StackColumn,
  Verdict,
  CapitalStack,
  fmt0,
  fmtM,
  pct,
  HURDLE,
  GREEN,
  MUTED,
  NAVY,
  TIMBER,
  INK,
} from "./visuals";
import FunderVoiceAgent, { type VoiceMessage } from "./FunderVoiceAgent";
import {
  FUNDING_PROJECTS,
  branscombeFunding,
  isConfirmedFunding,
} from "@/data/funding";

const DELIVERY_CHAIN: [string, string][] = [
  ["Demand & sales platform", "Portal, agents, pre-qualified registrations"],
  ["Development approvals", "DAs, permits, consultant coordination"],
  ["Module supply", "Source & contract the modular product"],
  ["Site works", "Civils, services, foundations"],
  ["Shipping & logistics", "Sea freight (DDP) + port-to-site transport"],
  ["Installation & complexing", "Crane placement, joining, lock-up"],
  ["Finishing & handover", "Landscaping, fencing, fit-off, settlement"],
];

const COST_BASE = branscombeFunding.cost_stack.reduce((s, c) => s + c.value, 0);

export default function FundersOverview() {
  // Interactive feasibility test (generic gross development margin).
  const [units, setUnits] = useState(37);
  const [price, setPrice] = useState(685000);
  const [costUnit, setCostUnit] = useState(Math.round(COST_BASE / 37));

  const model = useMemo(() => {
    const revenue = units * price;
    const totalCost = units * costUnit;
    const surplus = revenue - totalCost;
    const margin = revenue > 0 ? surplus / revenue : 0;
    const cats = branscombeFunding.cost_stack.map((c) => ({
      label: c.label,
      value: (c.value / COST_BASE) * totalCost,
    }));
    return { revenue, totalCost, surplus, margin, cats };
  }, [units, price, costUnit]);

  // Generic Sterling (overview Q&A — no project numbers).
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);

  const bransRevenue = branscombeFunding.grv;
  const bransCats = branscombeFunding.cost_stack.map((c) => ({
    label: c.label,
    value: c.value,
  }));

  return (
    <div className="f2k-root">
      <FunderStyles />

      {/* hero */}
      <section className="f2k-hero">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The funding model</div>
          <h1 className="f2k-h1">
            Demand is
            <br />
            the trigger.
          </h1>
          <p className="f2k-lead">
            F2K takes a development from raw site to delivered homes — sourcing the
            modular product, running the development approvals, coordinating site works,
            shipping and installation, and originating pre-qualified buyer demand through
            our sales platform. Oversubscribed demand is what unlocks the finance.{" "}
            <b style={{ color: INK }}>
              This page covers that funding piece — one link in the chain below.
            </b>{" "}
            Directed to registered Australian banks (ADIs).
          </p>
        </div>
      </section>

      {/* scope — F2K end to end */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">What F2K delivers</div>
          <h2 className="f2k-h2" style={{ marginTop: 10 }}>
            One integrator, raw site to handed-over homes
          </h2>
          <p className="f2k-lead" style={{ marginBottom: 30 }}>
            F2K coordinates the whole delivery chain — not just the sales platform. Every
            cost block in the model below is something we source, arrange or manage.
          </p>
          <div className="f2k-chain">
            {DELIVERY_CHAIN.map(([t, dsc], i) => (
              <div className="f2k-node" key={t}>
                <span className="f2k-noden">{String(i + 1).padStart(2, "0")}</span>
                <h4>{t}</h4>
                <p>{dsc}</p>
              </div>
            ))}
          </div>
          <div className="f2k-chainband">
            Coordinated end-to-end by F2K · construction works invoiced through Global
            Buildtech Australia
          </div>
        </div>
      </section>

      {/* the back-to-back model */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The funding component · for registered Australian banks</div>
          <h2 className="f2k-h2" style={{ marginTop: 10 }}>
            Prove demand · fund the build · first-rights retail
          </h2>
          <div className="f2k-steps">
            <div className="f2k-step" data-n="01">
              <h3>Prove the demand</h3>
              <div className="f2k-steparrow" />
              <p style={{ marginTop: 14 }}>
                The platform goes live and agents market it. We drive pre-qualified
                registrations to{" "}
                <b style={{ color: INK }}>3× the lots released</b> — 300% cover. That
                oversubscription is the trigger.
              </p>
            </div>
            <div className="f2k-step" data-n="02">
              <h3>Fund the build</h3>
              <div className="f2k-steparrow" />
              <p style={{ marginTop: 14 }}>
                On that signal the development facility funds construction. Buyer
                progress-payments flow back as the build rises, so the facility peaks low
                and clears mid-build.
              </p>
            </div>
            <div className="f2k-step" data-n="03">
              <h3>First-rights retail</h3>
              <div className="f2k-steparrow" />
              <p style={{ marginTop: 14 }}>
                In return, the senior bank&apos;s retail arm takes first right of refusal on
                every end-buyer mortgage the platform originates — this project and the
                pipeline behind it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* capital stack — senior & junior */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The capital stack</div>
          <h2 className="f2k-h2" style={{ marginTop: 10 }}>
            Senior &amp; junior — one syndicate of registered Australian banks
          </h2>
          <p className="f2k-lead" style={{ marginBottom: 26 }}>
            Each project has a Funding Package — the committed development facility. One{" "}
            <b style={{ color: INK }}>senior</b> bank commits 50% and receives first right
            of refusal on the retail mortgage book; one or more{" "}
            <b style={{ color: INK }}>junior</b> banks share the remaining 50%, each tranche
            10–50%. Every party is a registered Australian bank.
          </p>
          <CapitalStack />
          <p style={{ marginTop: 24 }}>
            <Link className="f2k-cta" href={`/${branscombeFunding.slug}/funders`}>
              Register interest in a live project →
            </Link>
          </p>
          <p className="f2k-cardnote">
            Ranking and return between senior and junior are a term-sheet item — subject to
            formal terms. Registration happens on each project&apos;s funder page.
          </p>
        </div>
      </section>

      {/* the test */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The test</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 16 }}>
            Is it a fundable project?
          </h2>
          <div className="f2k-formula">
            <span>
              (<b>x</b> units <span className="op">×</span> <b>y</b> avg price)
            </span>
            <span className="op">−</span>
            <span>
              Σ cost <b>(a+b+c+d…)</b>
            </span>
            <span className="op">=</span>
            <span className="res">margin (CD%)</span>
            <span style={{ color: MUTED }}>
              — fundable when margin clears the hurdle ({pct(HURDLE)}).
            </span>
          </div>

          <div className="f2k-calc">
            <div>
              <div className="f2k-controls">
                <div className="f2k-ctl">
                  <label>x · number of units</label>
                  <span className="val">{units}</span>
                  <input
                    type="range"
                    min={6}
                    max={120}
                    value={units}
                    onChange={(e) => setUnits(+e.target.value)}
                  />
                </div>
                <div className="f2k-ctl">
                  <label>y · average selling price</label>
                  <span className="val">{fmt0(price)}</span>
                  <input
                    type="range"
                    min={350000}
                    max={1200000}
                    step={5000}
                    value={price}
                    onChange={(e) => setPrice(+e.target.value)}
                  />
                </div>
                <div className="f2k-ctl">
                  <label>cost per unit (a+b+c+d… ÷ x)</label>
                  <span className="val">{fmt0(costUnit)}</span>
                  <input
                    type="range"
                    min={250000}
                    max={900000}
                    step={1000}
                    value={costUnit}
                    onChange={(e) => setCostUnit(+e.target.value)}
                  />
                </div>
              </div>

              <div className="f2k-readout">
                <div className="f2k-rrow">
                  <span className="k">Revenue · x × y</span>
                  <span className="v">{fmt0(model.revenue)}</span>
                </div>
                <div className="f2k-rrow">
                  <span className="k">Total cost · Σ(a…)</span>
                  <span className="v">{fmt0(model.totalCost)}</span>
                </div>
                <div className="f2k-rrow">
                  <span className="k">Surplus</span>
                  <span
                    className="v"
                    style={{ color: model.surplus >= 0 ? GREEN : "#c0413a" }}
                  >
                    {fmt0(model.surplus)}
                  </span>
                </div>
                <div
                  className="f2k-rrow"
                  style={{ alignItems: "center", paddingTop: 14 }}
                >
                  <span
                    className="f2k-bigmargin"
                    style={{
                      color:
                        model.margin >= HURDLE
                          ? GREEN
                          : model.margin >= 0.15
                            ? "#a87a1e"
                            : "#c0413a",
                    }}
                  >
                    {pct(model.margin)}
                  </span>
                  <Verdict margin={model.margin} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
                Generic gross development margin (pre-GST, pre-finance). Confirmed
                feasibility is assessed on a GST-correct basis, net of finance — see live
                projects below.
              </p>
            </div>

            <div>
              <StackColumn
                revenue={model.revenue}
                categories={model.cats}
                total={model.totalCost}
              />
            </div>
          </div>
        </div>
      </section>

      {/* live projects */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">Live projects</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 20 }}>
            Real stacks, confirmed by the market
          </h2>

          <div className="f2k-caveat">
            <div style={{ fontSize: 20, lineHeight: 1, color: TIMBER }}>▲</div>
            <div className="t">
              <b>Project figures are indicative estimates.</b> They are confirmed only once
              the project page is live, agents are actively marketing, and pre-qualified
              subscriptions reach <b>3× the lots released (300% cover)</b> — not before.
              Until then, treat the stacks below as the modelled basis, not a committed
              feasibility.
            </div>
          </div>

          <div className="f2k-projects">
            {FUNDING_PROJECTS.map((p) => {
              if (isConfirmedFunding(p)) {
                return (
                  <div className="f2k-card" key={p.slug}>
                    <div className="f2k-cardhead">
                      <div>
                        <h3>{p.name}</h3>
                        <div className="sub">
                          {p.location} · {p.unit_count} modular dwellings
                        </div>
                      </div>
                      <span className="f2k-badge ind">Indicative · pre-subscription</span>
                    </div>
                    <StackColumn
                      revenue={p.grv}
                      categories={p.cost_stack.map((c) => ({
                        label: c.label,
                        value: c.value,
                      }))}
                      total={p.tdc}
                      height={300}
                    />
                    <div className="f2k-mini">
                      <div className="m">
                        <div className="k">GRV</div>
                        <div className="v">{fmtM(p.grv)}</div>
                      </div>
                      <div className="m">
                        <div className="k">Package</div>
                        <div className="v">{fmtM(p.package_amount)}</div>
                      </div>
                      <div className="m">
                        <div className="k">Margin*</div>
                        <div className="v" style={{ color: GREEN }}>
                          {p.margin_pct}%
                        </div>
                      </div>
                    </div>
                    <p className="f2k-cardnote">
                      *GST-correct, on net realisation. Demand to date ≈{p.demand_current_x}×
                      cover; trigger is {p.demand_trigger_x}×.
                    </p>
                    <Link className="f2k-cardcta" href={`/${p.slug}/funders`}>
                      Fund this project →
                    </Link>
                  </div>
                );
              }
              return (
                <div className="f2k-card" key={p.slug}>
                  <div className="f2k-cardhead">
                    <div>
                      <h3>{p.name}</h3>
                      <div className="sub">{p.location}</div>
                    </div>
                    <span className="f2k-badge live">Pending model</span>
                  </div>
                  <div className="f2k-pending">
                    <div style={{ fontSize: 26 }}>◷</div>
                    <div className="big">Stack pending confirmation</div>
                    <div style={{ fontSize: 13, maxWidth: "30ch" }}>
                      Cost and revenue stacks publish here once the finance model is
                      finalised and subscriptions build toward 3× cover.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* optional generic Q&A with Sterling */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">Questions about the model</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 20 }}>
            Talk it through with Sterling
          </h2>
          <FunderVoiceAgent
            transcript={transcript}
            onTranscriptChange={setTranscript}
          />
          <p className="f2k-cardnote">
            Sterling answers questions about the funding model generally. For a specific
            project&apos;s numbers — and to register — open that project&apos;s funder page.
          </p>
        </div>
      </section>

      {/* footer disclaimer (funder-specific) */}
      <section style={{ padding: "48px 0 64px" }}>
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">Talk to us</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 14 }}>
            A repeatable, de-risked pipeline
          </h2>
          <a className="f2k-cta" href="mailto:dennis@factory2key.com.au">
            Request a project pack →
          </a>
          <p style={{ marginTop: 24, fontSize: 12.5, color: MUTED, maxWidth: "70ch" }}>
            Directed to registered Australian banks (APRA-authorised ADIs) only. Registration
            of interest only — not an offer or invitation, and not financial product advice.
            All figures are indicative and subject to confirmation once demand reaches 3×
            cover and to formal documentation and due diligence. Factory2Key Pty Ltd
            originates demand and integrates the full delivery — module supply, development
            approvals, site works, logistics, installation and completion. Construction works
            are invoiced through Global Buildtech Australia under separate agreement.
          </p>
        </div>
      </section>
    </div>
  );
}
