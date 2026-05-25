"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HEMP_HOMES_STAGES,
  HEMP_HOMES_STATES,
  type HempHomesPost,
  type HempHomesStage,
  type HempHomesState,
} from "@/lib/hemp-homes/types";
import { MediaPicker } from "@/components/admin/HempHomesMediaPicker";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function StageBadge({ stage }: { stage: HempHomesStage }) {
  const label = HEMP_HOMES_STAGES.find((s) => s.value === stage)?.label ?? stage;
  return <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{label}</span>;
}
function StateBadge({ state }: { state: HempHomesState }) {
  if (state === "completed") return <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-semibold">Completed</span>;
  if (state === "in_progress") return <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">In progress</span>;
  return <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold">Scheduled</span>;
}

interface EditDraft {
  id: string;
  title: string;
  overview: string;
  stage: HempHomesStage;
  state: HempHomesState;
  hero_media_id: string | null;
}

interface Props {
  /** e.g. /api/admin/estates/branscombe */
  apiBase: string;
  estateName: string;
  /** e.g. /admin/estates/branscombe/media — for the picker's empty-state link */
  mediaAdminHref: string;
}

export default function EstatePostsAdmin({ apiBase, estateName, mediaAdminHref }: Props) {
  const [posts, setPosts] = useState<HempHomesPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [estateContext, setEstateContext] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [postPrompt, setPostPrompt] = useState("");

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [stage, setStage] = useState<HempHomesStage>("building");
  const [state, setState] = useState<HempHomesState>("in_progress");
  const [createHeroId, setCreateHeroId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/posts`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load posts" });
        return;
      }
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setMessage({ type: "error", text: "Network error loading posts" });
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/settings`);
      if (!res.ok) return;
      const data = await res.json();
      setEstateContext(data.ai_context ?? "");
    } catch {
      // Non-fatal.
    }
  }, [apiBase]);

  useEffect(() => {
    fetchPosts();
    fetchContext();
  }, [fetchPosts, fetchContext]);

  async function saveContext() {
    setSavingContext(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_context: estateContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Could not save context" });
        return;
      }
      setMessage({ type: "success", text: "Saved — the AI will use this for every draft." });
    } catch {
      setMessage({ type: "error", text: "Network error saving context" });
    } finally {
      setSavingContext(false);
    }
  }

  function startEdit(p: HempHomesPost) {
    setEditing({
      id: p.id, title: p.title, overview: p.overview, stage: p.stage, state: p.state, hero_media_id: p.hero_media_id,
    });
  }

  async function generateDraft() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/posts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_prompt: postPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "AI draft failed" });
        return;
      }
      setMessage({
        type: data.warning ? "error" : "success",
        text: data.warning
          ? data.warning
          : `AI draft created${data.selected_media ? ` with ${data.selected_media} photo(s)` : ""} — review and edit below, then publish when ready.`,
      });
      await fetchPosts();
      if (data.post) startEdit(data.post);
    } catch {
      setMessage({ type: "error", text: "Network error generating draft" });
    } finally {
      setGenerating(false);
    }
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, overview, stage, state, hero_media_id: createHeroId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to create" });
        return;
      }
      setMessage({ type: "success", text: `Post "${data.post.title}" created (draft).` });
      setTitle(""); setOverview(""); setStage("building"); setState("in_progress"); setCreateHeroId(null);
      fetchPosts();
    } catch {
      setMessage({ type: "error", text: "Network error creating post" });
    } finally {
      setCreating(false);
    }
  }

  async function patchPost(id: string, body: Record<string, unknown>, busyMsg: string) {
    setBusyPostId(id);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? `${busyMsg} failed` });
        return false;
      }
      setMessage({ type: "success", text: `${busyMsg} succeeded.` });
      fetchPosts();
      return true;
    } catch {
      setMessage({ type: "error", text: "Network error" });
      return false;
    } finally {
      setBusyPostId(null);
    }
  }

  async function togglePublish(p: HempHomesPost) {
    const isPublished = !!p.published_at;
    if (isPublished && !confirm(`Unpublish "${p.title}"? It will disappear from the public blog.`)) return;
    await patchPost(p.id, { published_at: !isPublished }, isPublished ? "Unpublish" : "Publish");
  }

  async function deletePost(p: HempHomesPost) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusyPostId(p.id);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/posts/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error ?? "Delete failed" });
        return;
      }
      setMessage({ type: "success", text: `Deleted "${p.title}".` });
      fetchPosts();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setBusyPostId(null);
    }
  }

  async function sendEmail(p: HempHomesPost, mode: "test" | "live") {
    if (
      mode === "live" &&
      !confirm(
        `Email "${p.title}" to all ${estateName} subscribers? This sends to real people. Already-sent and unsubscribed addresses are skipped, max 2 emails/week each.`,
      )
    ) {
      return;
    }
    setBusyPostId(p.id);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/posts/${p.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Send failed" });
        return;
      }
      if (mode === "test") {
        setMessage({ type: "success", text: `Test email sent to ${data.to}. Check your inbox before sending to subscribers.` });
      } else {
        setMessage({
          type: "success",
          text: `Sent to ${data.sent} of ${data.total_subscribers} subscriber(s). Skipped: ${data.skipped_already} already sent, ${data.skipped_optout} unsubscribed, ${data.skipped_cap} over weekly cap.${data.remaining ? ` ${data.remaining} remaining — run again.` : ""}${data.failed ? ` Failed: ${data.failed}.` : ""}`,
        });
      }
      fetchPosts();
    } catch {
      setMessage({ type: "error", text: "Network error sending email" });
    } finally {
      setBusyPostId(null);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const ok = await patchPost(
      editing.id,
      { title: editing.title, overview: editing.overview, stage: editing.stage, state: editing.state, hero_media_id: editing.hero_media_id },
      "Save edit",
    );
    if (ok) setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">{estateName} — Blog Posts</h2>
        <p className="text-sm text-slate-500 max-w-2xl">
          Editorial posts for the {estateName} build journal. Draft with AI or by hand, attach photos
          from the media library, edit, and publish when ready. Drafts are not public until you publish.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Persisted AI context (the "system" prompt) */}
      <div className="bg-white border rounded-lg p-5 space-y-2">
        <h3 className="font-semibold text-slate-900">About {estateName}</h3>
        <p className="text-sm text-slate-600 max-w-2xl">
          Tell the AI about {estateName} so it can write better posts — what it is, who it&apos;s for,
          the tone, and anything it should always mention or never claim. Saved once and used for every draft.
        </p>
        <textarea
          value={estateContext}
          onChange={(e) => setEstateContext(e.target.value)}
          rows={4}
          placeholder={`e.g. ${estateName} is … Our buyers care about … Always mention … Never claim …`}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={saveContext}
          disabled={savingContext}
          className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
        >
          {savingContext ? "Saving…" : "Save AI context"}
        </button>
      </div>

      {/* AI draft */}
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-slate-900">Draft a post with AI</h3>
          <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
            The assistant writes an upbeat, educational update about {estateName} and picks relevant
            photos from your curated library. It lands as a <strong>draft</strong> — you edit and
            approve before anything publishes or sends.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            What do you want to say about this post? (optional)
          </label>
          <textarea
            value={postPrompt}
            onChange={(e) => setPostPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. This update is about the first display home being framed — focus on the timber and the view."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={generateDraft}
          disabled={generating}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
        >
          {generating ? "Drafting…" : "✨ Draft a post with AI"}
        </button>
      </div>

      {/* Create form */}
      <form onSubmit={createPost} className="bg-white border rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">New post</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Title</label>
          <input type="text" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm" placeholder="e.g. First display home framed up" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Overview (markdown — source for the public post)
          </label>
          <textarea required minLength={10} value={overview} onChange={(e) => setOverview(e.target.value)} rows={6}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono" placeholder="Tell the story. Attach a hero image below." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value as HempHomesStage)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
              {HEMP_HOMES_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">State</label>
            <select value={state} onChange={(e) => setState(e.target.value as HempHomesState)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
              {HEMP_HOMES_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Hero image</label>
          <MediaPicker value={createHeroId} onChange={setCreateHeroId} apiBase={apiBase} uploadHref={mediaAdminHref} placeholder="Pick a hero image from the media library" />
        </div>
        <button type="submit" disabled={creating} className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50">
          {creating ? "Creating…" : "Create draft post"}
        </button>
      </form>

      {/* List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-900">All posts ({posts.length})</div>
        {loading ? (
          <div className="p-6 text-slate-500">Loading posts…</div>
        ) : posts.length === 0 ? (
          <div className="p-6 text-slate-500">No posts yet. Draft one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-left">State</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const published = !!p.published_at;
                  const busy = busyPostId === p.id;
                  return (
                    <tr key={p.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{p.title}</span>
                        <span className="block text-xs text-slate-500 font-mono">{p.slug}</span>
                      </td>
                      <td className="px-3 py-2"><StageBadge stage={p.stage} /></td>
                      <td className="px-3 py-2"><StateBadge state={p.state} /></td>
                      <td className="px-3 py-2 text-xs">
                        {published ? <span className="text-emerald-700 font-semibold">Published</span> : <span className="text-slate-400">Draft</span>}
                        {published && <span className="block text-slate-500">{fmtDate(p.published_at)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <button type="button" disabled={busy} onClick={() => startEdit(p)} className="text-xs text-slate-700 hover:text-slate-900 font-semibold disabled:opacity-50">Edit</button>
                        <button type="button" disabled={busy} onClick={() => togglePublish(p)} className={`text-xs font-semibold disabled:opacity-50 ${published ? "text-amber-700 hover:text-amber-900" : "text-emerald-700 hover:text-emerald-900"}`}>
                          {busy ? "…" : published ? "Unpublish" : "Publish"}
                        </button>
                        {published && (
                          <>
                            <button type="button" disabled={busy} onClick={() => sendEmail(p, "test")} className="text-xs text-slate-600 hover:text-slate-900 font-semibold disabled:opacity-50">Test email</button>
                            <button type="button" disabled={busy} onClick={() => sendEmail(p, "live")} className="text-xs text-blue-700 hover:text-blue-900 font-semibold disabled:opacity-50">Email subscribers</button>
                          </>
                        )}
                        <button type="button" disabled={busy} onClick={() => deletePost(p)} className="text-xs text-red-600 hover:text-red-800 font-semibold disabled:opacity-50">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Edit post</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-900 text-sm">Close</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Title</label>
                <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Overview</label>
                <textarea value={editing.overview} onChange={(e) => setEditing({ ...editing, overview: e.target.value })} rows={8} className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Stage</label>
                  <select value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value as HempHomesStage })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                    {HEMP_HOMES_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">State</label>
                  <select value={editing.state} onChange={(e) => setEditing({ ...editing, state: e.target.value as HempHomesState })} className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                    {HEMP_HOMES_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Hero image</label>
                <MediaPicker value={editing.hero_media_id} onChange={(id) => setEditing({ ...editing, hero_media_id: id })} apiBase={apiBase} uploadHref={mediaAdminHref} placeholder="Pick a hero image from the media library" />
              </div>
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
              <button type="button" disabled={busyPostId === editing.id} onClick={saveEdit} className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50">
                {busyPostId === editing.id ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
