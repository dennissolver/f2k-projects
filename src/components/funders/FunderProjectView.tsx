import {
  FunderStyles,
  StackColumn,
  CapitalStack,
  fmtM,
  fmt0,
  MUTED,
  TIMBER,
  GREEN,
  INK,
  NAVY,
} from "./visuals";
import FunderRegistration from "./FunderRegistration";
import { seniorAmount, type ProjectFundingModel } from "@/data/funding";

/**
 * Per-project funder page body — the overview design scoped to one project, with that project's
 * real numbers and the registration form + project-tuned Sterling. Server component (the form +
 * voice are inside the FunderRegistration client wrapper).
 */
export default function FunderProjectView({
  project,
}: {
  project: ProjectFundingModel;
}) {
  const coverPctOfTrigger = Math.min(
    100,
    Math.round((project.demand_current_x / project.demand_trigger_x) * 100),
  );

  return (
    <div className="f2k-root">
      <FunderStyles />

      {/* header */}
      <section className="f2k-hero">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">Fund this project · for registered Australian banks</div>
          <h1 className="f2k-h1" style={{ fontSize: "clamp(34px,6vw,60px)" }}>
            {project.name}
          </h1>
          <p className="f2k-lead">
            {project.location} · {project.unit_count} modular dwellings. Register a senior
            or junior position in {project.name}&apos;s funding package.{" "}
            <b style={{ color: INK }}>
              Figures are indicative until demand reaches {project.demand_trigger_x}× cover.
            </b>{" "}
            This is a registration of interest only — not an offer, and not financial product
            advice.
          </p>
        </div>
      </section>

      {/* cost stack vs revenue */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The stack</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 24 }}>
            Cost stack vs revenue
          </h2>
          <div className="f2k-calc">
            <div>
              <StackColumn
                revenue={project.grv}
                categories={project.cost_stack.map((c) => ({
                  label: c.label,
                  value: c.value,
                }))}
                total={project.tdc}
              />
            </div>
            <div className="f2k-readout">
              <div className="f2k-rrow">
                <span className="k">GRV (gross realisable value)</span>
                <span className="v">{fmt0(project.grv)}</span>
              </div>
              <div className="f2k-rrow">
                <span className="k">Total development cost (ex-finance)</span>
                <span className="v">{fmt0(project.tdc)}</span>
              </div>
              <div className="f2k-rrow">
                <span className="k">Indicative margin*</span>
                <span className="v" style={{ color: GREEN }}>
                  {project.margin_pct}%
                </span>
              </div>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
                *GST-correct, on net realisation. Indicative until {project.demand_trigger_x}×
                cover.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* capital stack — senior / junior with real $ */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">The capital stack</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 8 }}>
            Funding package · {fmtM(project.package_amount)}
          </h2>
          <p className="f2k-lead" style={{ marginBottom: 24 }}>
            The committed development facility for {project.name}. One senior bank commits 50%
            ({fmtM(seniorAmount(project.package_amount))}) and receives first right of refusal
            on the retail mortgage book; one or more junior banks share the remaining 50% in
            10–50% tranches. Every party is a registered Australian bank.
          </p>
          <CapitalStack packageAmount={project.package_amount} />
        </div>
      </section>

      {/* demand status */}
      <section className="f2k-sec">
        <div className="f2k-wrap">
          <div className="f2k-eyebrow">Demand</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 16 }}>
            Subscription vs the {project.demand_trigger_x}× trigger
          </h2>
          <div className="f2k-caveat">
            <div style={{ fontSize: 20, lineHeight: 1, color: TIMBER }}>▲</div>
            <div className="t">
              <b>Indicative until {project.demand_trigger_x}× cover.</b> Construction finance
              is called only once pre-qualified subscriptions reach{" "}
              {project.demand_trigger_x}× the lots released (300% cover). Current demand ≈{" "}
              {project.demand_current_x}× cover
              {project.demand_note ? ` (${project.demand_note})` : ""}.
            </div>
          </div>
          <div
            style={{
              height: 14,
              background: "#fff",
              border: "1px solid #D5DBE0",
              borderRadius: 999,
              overflow: "hidden",
              maxWidth: 480,
            }}
          >
            <div
              style={{
                width: `${coverPctOfTrigger}%`,
                height: "100%",
                background: NAVY,
              }}
            />
          </div>
          <p className="f2k-cardnote">
            {project.demand_current_x}× of the {project.demand_trigger_x}× trigger (
            {coverPctOfTrigger}% of the way there).
          </p>
        </div>
      </section>

      {/* registration form + project-tuned Sterling */}
      <section className="f2k-sec">
        <div className="f2k-wrap" style={{ maxWidth: 820 }}>
          <div className="f2k-eyebrow">Register your interest</div>
          <h2 className="f2k-h2" style={{ marginTop: 10, marginBottom: 20 }}>
            Senior or junior — indicate your position
          </h2>
          <FunderRegistration
            project={project}
            sourcePage={`/${project.slug}/funders`}
          />
        </div>
      </section>

      {/* footer disclaimer */}
      <section style={{ padding: "32px 0 64px" }}>
        <div className="f2k-wrap">
          <p style={{ fontSize: 12.5, color: MUTED, maxWidth: "70ch" }}>
            Directed to registered Australian banks (APRA-authorised ADIs) only. Registration
            of interest only — not an offer or invitation, and not financial product advice.
            All figures are indicative and subject to confirmation once demand reaches{" "}
            {project.demand_trigger_x}× cover and to formal documentation and due diligence.
            Construction works are invoiced through Global Buildtech Australia under separate
            agreement.
          </p>
        </div>
      </section>
    </div>
  );
}
