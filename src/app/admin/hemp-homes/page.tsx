import { createSupabaseService } from "@/lib/supabase-service";
import { NotifyRecipientsCard } from "@caistech/property-launch-kit/components";

async function getCounts() {
  const supabase = createSupabaseService();
  const [posts, media, journey, prospects] = await Promise.all([
    (supabase.from("hemp_homes_posts") as any)
      .select("id, published_at", { count: "exact" })
      .then((r: any) => ({
        total: r.count ?? 0,
        published: (r.data ?? []).filter((p: any) => p.published_at).length,
      }))
      .catch(() => ({ total: 0, published: 0 })),
    (supabase.from("hemp_homes_media") as any)
      .select("id, kind", { count: "exact" })
      .then((r: any) => ({
        total: r.count ?? 0,
        images: (r.data ?? []).filter((m: any) => m.kind === "image").length,
        videos: (r.data ?? []).filter((m: any) => m.kind === "video").length,
      }))
      .catch(() => ({ total: 0, images: 0, videos: 0 })),
    (supabase.from("hemp_homes_journey_entries") as any)
      .select("id, state", { count: "exact" })
      .then((r: any) => ({
        total: r.count ?? 0,
        in_progress: (r.data ?? []).filter((j: any) => j.state === "in_progress").length,
      }))
      .catch(() => ({ total: 0, in_progress: 0 })),
    (supabase.from("hemp_homes_community_prospects") as any)
      .select("id, wave, indicative_lot_potential", { count: "exact" })
      .then((r: any) => ({
        total: r.count ?? 0,
        wave1: (r.data ?? []).filter((p: any) => p.wave === 1).length,
        wave2: (r.data ?? []).filter((p: any) => p.wave === 2).length,
        wave3: (r.data ?? []).filter((p: any) => p.wave === 3).length,
        lots: (r.data ?? []).reduce((s: number, p: any) => s + (p.indicative_lot_potential ?? 0), 0),
      }))
      .catch(() => ({ total: 0, wave1: 0, wave2: 0, wave3: 0, lots: 0 })),
  ]);
  return { posts, media, journey, prospects };
}

export default async function HempHomesAdminIndex() {
  const { posts, media, journey, prospects } = await getCounts();

  const cards = [
    {
      title: "Posts",
      number: posts.total,
      subline: `${posts.published} published`,
      href: "/admin/hemp-homes/posts",
      cta: "Manage posts →",
    },
    {
      title: "Media Library",
      number: media.total,
      subline: `${media.images} images · ${media.videos} videos`,
      href: "/admin/hemp-homes/media",
      cta: "Open library →",
    },
    {
      title: "Journey Timeline",
      number: journey.total,
      subline: `${journey.in_progress} in progress`,
      href: "/admin/hemp-homes/journey",
      cta: "Edit timeline →",
    },
    {
      title: "Community Prospects",
      number: prospects.total,
      subline: `${prospects.wave1}/${prospects.wave2}/${prospects.wave3} W1/W2/W3 · ${prospects.lots} lots`,
      href: "/admin/hemp-homes/prospects",
      cta: "Open pipeline →",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Hemp Homes</h2>
        <p className="text-sm text-slate-500 max-w-2xl">
          Community-builder admin for the Joey60 Hemp Edition. Publish progress posts
          for the email cadence (2/week max), curate the media library that backs the
          gallery and emails, and keep the public journey timeline current as the
          design → test → build → certify program moves forward.
        </p>
      </div>

      <NotifyRecipientsCard
        apiEndpoint="/api/admin/hemp-homes/notify-recipients"
        description="Who gets emailed on new Hemp Homes waitlist registrations."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            className="bg-white border border-slate-200 rounded-lg p-5 hover:border-[#22c55e] transition-colors no-underline block"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              {c.title}
            </p>
            <p className="text-4xl font-black text-slate-900 mt-2 mb-1">
              {c.number}
            </p>
            <p className="text-xs text-slate-500">{c.subline}</p>
            <p className="text-xs text-[#22c55e] font-semibold mt-3">{c.cta}</p>
          </a>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">Phase 1 — what works now</p>
        <ul className="list-disc ml-5 space-y-0.5 text-amber-800">
          <li>Create posts with hero image picker; edit, publish/unpublish, delete.</li>
          <li>Upload media (image + video, up to 500MB) directly from this admin.</li>
          <li>Google Drive sync — connect your folder, pull files in bulk on demand.</li>
          <li>Read the journey timeline (DB-backed, was hard-coded).</li>
        </ul>
        <p className="font-semibold mt-3 mb-1">Coming next</p>
        <ul className="list-disc ml-5 space-y-0.5 text-amber-800">
          <li>Journey inline edit + drag-to-reorder.</li>
          <li>LLM email generation from post overview + selected images.</li>
          <li>Send-to-subscribers with 2/week frequency cap (Phase 2 — nudge-core).</li>
          <li>Joey voice agent on the public page (Phase 3).</li>
        </ul>
      </div>
    </div>
  );
}
