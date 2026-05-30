"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  agency: string | null;
  notify_new_client: boolean;
  notify_status_change: boolean;
}

export default function AgentProfilePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agency, setAgency] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notifyNewClient, setNotifyNewClient] = useState(true);
  const [notifyStatusChange, setNotifyStatusChange] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/me");
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
        setName(data.agent.name || "");
        setPhone(data.agent.phone || "");
        setAgency(data.agent.agency || "");
        setNotifyNewClient(data.agent.notify_new_client ?? true);
        setNotifyStatusChange(data.agent.notify_status_change ?? true);
      } else if (res.status === 401) {
        router.push("/agent/login");
      }
    } catch {
      setMsg({ type: "error", text: "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          agency: agency.trim() || null,
          notify_new_client: notifyNewClient,
          notify_status_change: notifyStatusChange,
        }),
      });
      
      if (res.ok) {
        setMsg({ type: "success", text: "Profile updated successfully" });
        load();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to update profile" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setMsg({ type: "error", text: "Please enter both passwords" });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    
    setSaving(true);
    setMsg(null);
    
    try {
      const res = await fetch("/api/agent/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (res.ok) {
        setMsg({ type: "success", text: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Failed to change password" });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  const inputClass = "w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-slate-900";

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-slate-900">Your Profile</h1>
          <p className="text-sm text-slate-500">Manage your account details</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {msg && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${
            msg.type === "success" 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {msg.text}
          </div>
        )}

        <div className="space-y-8">
          {/* Profile Details */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Details</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={agent?.email || ""} disabled className={`${inputClass} bg-stone-100 text-stone-500`} />
                <p className="text-xs text-stone-400 mt-1">Email cannot be changed</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className={inputClass} 
                  placeholder="Ant Manton" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  className={inputClass} 
                  placeholder="0429 995 121" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Agency</label>
                <input 
                  value={agency} 
                  onChange={(e) => setAgency(e.target.value)} 
                  className={inputClass} 
                  placeholder="LJ Hooker" 
                />
              </div>
              
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </section>

          {/* Notification Preferences */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h2>
            <p className="text-sm text-slate-500 mb-4">Choose what emails you receive about your clients.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyNewClient}
                  onChange={(e) => setNotifyNewClient(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-[#00B5AD] focus:ring-[#00B5AD]"
                />
                <span className="text-sm text-slate-700">New client registrations</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyStatusChange}
                  onChange={(e) => setNotifyStatusChange(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-[#00B5AD] focus:ring-[#00B5AD]"
                />
                <span className="text-sm text-slate-700">Client status changes</span>
              </label>
            </div>
            <button 
              onClick={() => {
                setSaving(true);
                saveProfile(new Event('submit') as any);
              }}
              disabled={saving}
              className="mt-4 w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Preferences"}
            </button>
          </section>

          {/* Change Password */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Change Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  className={inputClass} 
                  placeholder="Enter current password" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className={inputClass} 
                  placeholder="Enter new password (min 6 characters)" 
                />
              </div>
              
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 min-h-[44px] rounded text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Changing…" : "Change Password"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
