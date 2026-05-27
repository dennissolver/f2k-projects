"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PasswordField } from "./PasswordField";

type AdminRole = "super_admin" | "fund_manager" | "compliance" | "read_only";

interface Initial {
  email: string;
  role: AdminRole;
  first_name: string;
  last_name: string;
  phone: string;
  company: string;
  job_title: string;
  email_marketing_opt_in: boolean;
}

export function SettingsForm({ initial }: { initial: Initial }) {
  return (
    <div className="space-y-6">
      <ProfileSection initial={initial} />
      <PasswordSection />
      <NotificationsSection initial={initial.email_marketing_opt_in} />
      <AccountSection />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded-lg p-6 shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-f2k-blue outline-none disabled:opacity-50 disabled:bg-gray-50"
      />
    </div>
  );
}

function StatusLine({
  error,
  info,
}: {
  error: string | null;
  info: string | null;
}) {
  if (!error && !info) return null;
  return (
    <p
      className={`text-sm mt-2 ${
        error ? "text-red-600" : "text-emerald-700"
      }`}
    >
      {error ?? info}
    </p>
  );
}

function ProfileSection({ initial }: { initial: Initial }) {
  const [firstName, setFirstName] = useState(initial.first_name);
  const [lastName, setLastName] = useState(initial.last_name);
  const [phone, setPhone] = useState(initial.phone);
  const [company, setCompany] = useState(initial.company);
  const [jobTitle, setJobTitle] = useState(initial.job_title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          job_title: jobTitle.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save profile");
        return;
      }
      setInfo("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Profile"
      description="Your name, contact details, and the company you work for. Email is the allowlist key for admin access — contact a super-admin to change it."
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            id="first_name"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
          />
          <Field
            id="last_name"
            label="Last name"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
          />
        </div>
        <Field
          id="email_readonly"
          label="Email"
          value={initial.email}
          onChange={() => undefined}
          type="email"
          disabled
        />
        <Field
          id="phone"
          label="Phone"
          value={phone}
          onChange={setPhone}
          type="tel"
          autoComplete="tel"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            id="company"
            label="Company"
            value={company}
            onChange={setCompany}
            autoComplete="organization"
          />
          <Field
            id="job_title"
            label="Job title"
            value={jobTitle}
            onChange={setJobTitle}
            autoComplete="organization-title"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Role: {initial.role.replace("_", " ")}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
        <StatusLine error={error} info={info} />
      </form>
    </SectionCard>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setPassword("");
      setConfirm("");
      setInfo("Password changed. You can keep using this session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Password"
      description="Choose a new password (at least 8 characters). You stay signed in on this device after the change."
    >
      <form onSubmit={handleChange} className="space-y-4">
        <PasswordField
          id="new_password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <PasswordField
          id="confirm_password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change password"}
          </button>
        </div>
        <StatusLine error={error} info={info} />
      </form>
    </SectionCard>
  );
}

function NotificationsSection({ initial }: { initial: boolean }) {
  const [optIn, setOptIn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setError(null);
    setInfo(null);
    setSaving(true);
    const prev = optIn;
    setOptIn(next);
    try {
      const res = await fetch("/api/admin/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_marketing_opt_in: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOptIn(prev);
        setError(json.error ?? "Could not save preference");
        return;
      }
      setInfo("Preference saved");
    } catch (err) {
      setOptIn(prev);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Email preferences"
      description="Transactional emails (registration confirmations, password resets, audit notices) always send. The toggle below controls non-transactional product updates only."
    >
      <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={optIn}
          disabled={saving}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <span>
          <span className="block font-medium text-slate-900">
            Product updates &amp; announcements
          </span>
          <span className="block text-slate-600">
            Periodic emails about new Factory2Key features, stage launches, and
            project milestones.
          </span>
        </span>
      </label>
      <StatusLine error={error} info={info} />
    </SectionCard>
  );
}

function AccountSection() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOutEverywhere() {
    setSigningOut(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/admin/login";
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SectionCard
      title="Account"
      description="Revoke all of your active sessions across every device. You'll need to sign in again afterwards."
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Removing yourself from the admin allowlist is a super-admin action —
          contact Dennis if you need access removed.
        </p>
        <button
          type="button"
          onClick={handleSignOutEverywhere}
          disabled={signingOut}
          className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out everywhere"}
        </button>
      </div>
    </SectionCard>
  );
}
