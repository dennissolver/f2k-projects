"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface RegistrationActionsProps {
  registrationId: string;
  project: "seafields" | "branscombe" | "hemp";
  ownership: "agent" | "house" | "unassigned" | null;
  agentId: string | null;
}

export function RegistrationActions({
  registrationId,
  project,
  ownership,
  agentId,
}: RegistrationActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleClaim = async () => {
    setLoading(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, name, email")
        .eq("active", true)
        .order("name");

      if (agentsData && agentsData.length > 0) {
        setAgents(agentsData);
        setShowAgentSelect(true);
      }
    } catch (err) {
      console.error("Error loading agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmClaim = async () => {
    if (!selectedAgent) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/registrations/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          project,
          agent_id: selectedAgent,
          action: "claim",
        }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error claiming registration:", err);
    } finally {
      setLoading(false);
      setShowAgentSelect(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm("Release this registration back to house/unassigned?")) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/registrations/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          project,
          action: "release",
        }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error releasing registration:", err);
    } finally {
      setLoading(false);
    }
  };

  const isHouse = ownership === "house" || ownership === "unassigned";

  if (showAgentSelect) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="">Select agent...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <button
          onClick={confirmClaim}
          disabled={!selectedAgent || loading}
          className="text-xs bg-navy text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          Claim
        </button>
        <button
          onClick={() => setShowAgentSelect(false)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (ownership === "agent" && agentId) {
    return (
      <button
        onClick={handleRelease}
        disabled={loading}
        className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-50"
        title="Release back to house"
      >
        {loading ? "..." : "Release"}
      </button>
    );
  }

  if (isHouse || ownership === null) {
    if (project === "hemp") {
      return <span className="text-xs text-gray-400">—</span>;
    }
    return (
      <button
        onClick={handleClaim}
        disabled={loading}
        className="text-xs text-[#00B5AD] hover:text-[#009990] disabled:opacity-50"
        title="Claim this registration"
      >
        {loading ? "..." : "Claim"}
      </button>
    );
  }

  return null;
}
