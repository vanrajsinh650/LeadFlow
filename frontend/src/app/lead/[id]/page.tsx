"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string;
  old_agent_id: string | null;
  new_agent_id: string | null;
  notes: string | null;
  created_at: string;
}

interface LeadDetail {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  sla_expires_at: string | null;
  sla_violated: boolean;
  is_duplicate: boolean;
  original_lead_id: string | null;
  reassignment_count: number;
  created_at: string;
  updated_at: string;
  audit_logs: AuditLog[];
}

interface AgentOption {
  agent_id: string;
  full_name: string;
  is_active: boolean;
  current_load: number;
  max_concurrent_leads: number;
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const leadId = unwrappedParams.id;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [statusInput, setStatusInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Reassignment state
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [reassignAgentId, setReassignAgentId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // SLA countdown
  const [slaCountdown, setSlaCountdown] = useState<string | null>(null);

  async function fetchLead() {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to load lead details from backend");
      const json = await res.json();
      setLead(json);
      setStatusInput(json.status);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    try {
      const res = await fetch("http://localhost:8000/api/v1/agents");
      if (res.ok) {
        const json = await res.json();
        setAgents(json);
      }
    } catch (e) {
      console.error("Failed to fetch agents:", e);
    }
  }

  useEffect(() => {
    fetchLead();
    fetchAgents();
  }, [leadId]);

  // SLA countdown timer
  useEffect(() => {
    if (!lead?.sla_expires_at) {
      setSlaCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const expiry = new Date(lead.sla_expires_at!);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setSlaCountdown("EXPIRED");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setSlaCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setSlaCountdown(`${minutes}m ${seconds}s`);
      } else {
        setSlaCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lead?.sla_expires_at]);

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusInput) {
      setErrorMsg("Status option is required.");
      return;
    }
    setErrorMsg(null);
    setUpdating(true);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusInput,
          notes: notesInput || "Manual status change via interface."
        })
      });

      if (!res.ok) throw new Error("Failed to save status update to backend server");

      await fetchLead();
      setNotesInput("");
      showToast("Lead status updated successfully.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignAgentId) {
      setReassignError("Select a target agent.");
      return;
    }
    setReassignError(null);
    setReassigning(true);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/leads/${leadId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_agent_id: reassignAgentId,
          reason: reassignReason || "Manual reassignment by manager."
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.detail === "SLA_REASSIGNMENT_LIMIT_EXCEEDED") {
          throw new Error("Reassignment limit (3) exceeded. Lead has been escalated.");
        } else if (data.detail === "ROUTING_CONCURRENT_LIMIT") {
          throw new Error("Target agent has reached their concurrent lead capacity.");
        }
        throw new Error(data.detail || "Failed to reassign lead");
      }

      await fetchLead();
      setReassignAgentId("");
      setReassignReason("");
      showToast("Lead reassigned successfully.");
    } catch (err: any) {
      setReassignError(err.message || "Reassignment failed");
    } finally {
      setReassigning(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "—";
    try {
      return new Date(timeStr).toLocaleString();
    } catch {
      return timeStr;
    }
  };

  const priorityColor = (p: string) => {
    if (p === "HIGH") return "bg-rose-50 text-rose-700 ring-rose-600/20";
    if (p === "MEDIUM") return "bg-amber-50 text-amber-700 ring-amber-600/20";
    return "bg-blue-50 text-blue-700 ring-blue-600/20";
  };

  const statusColor = (s: string) => {
    if (s === "CLOSED_WON") return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    if (s === "ESCALATED") return "bg-rose-50 text-rose-700 ring-rose-600/20";
    if (s === "CLOSED_LOST") return "bg-slate-100 text-slate-600 ring-slate-300";
    if (s === "UNASSIGNED") return "bg-slate-50 text-slate-600 ring-slate-200";
    return "bg-blue-50 text-blue-700 ring-blue-600/20";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading lead record...</p>
      </div>
    );
  }

  if (errorMsg && !lead) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-xl max-w-2xl mx-auto mt-8 shadow-sm">
        <h3 className="font-bold text-base flex items-center gap-2">
          <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Record Not Found
        </h3>
        <p className="text-sm text-rose-700 mt-2">{errorMsg}</p>
        <Link href="/leads" className="inline-block mt-4 text-sm font-semibold text-rose-600 underline">
          ← Return to Leads list
        </Link>
      </div>
    );
  }

  if (!lead) return null;

  const eligibleAgents = agents.filter(
    (a) => a.is_active && a.agent_id !== lead.assigned_agent_id && a.current_load < a.max_concurrent_leads
  );

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700 z-50">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div>
        <Link href="/leads" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors mb-4">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Leads
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {lead.first_name} {lead.last_name}
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">ID: {lead.lead_id}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${priorityColor(lead.priority)}`}>
              {lead.priority} Priority
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusColor(lead.status)}`}>
              {lead.status}
            </span>
            {lead.is_duplicate && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Duplicate
              </span>
            )}
            {lead.sla_violated && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                SLA Violated
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SLA Countdown Banner */}
      {slaCountdown && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${
          slaCountdown === "EXPIRED"
            ? "bg-rose-50 border border-rose-200"
            : "bg-blue-50 border border-blue-200"
        }`}>
          <div className="flex items-center gap-3">
            <svg className={`h-5 w-5 ${slaCountdown === "EXPIRED" ? "text-rose-600" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm font-semibold ${slaCountdown === "EXPIRED" ? "text-rose-700" : "text-blue-700"}`}>
              SLA Deadline
            </span>
          </div>
          <span className={`text-lg font-bold font-mono ${slaCountdown === "EXPIRED" ? "text-rose-600 animate-pulse" : "text-blue-700"}`}>
            {slaCountdown}
          </span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <InfoField label="Email Address" value={lead.email} />
              <InfoField label="Phone Number" value={lead.phone} />
              <InfoField label="Lead Source" value={lead.source.toUpperCase()} />
              <InfoField label="Created" value={formatTime(lead.created_at)} />
            </div>
          </div>

          {/* Routing & SLA */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Routing & SLA Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <InfoField label="Assigned Agent" value={lead.assigned_agent_name || "Unassigned"} />
              <InfoField label="SLA Expiry" value={lead.sla_expires_at ? formatTime(lead.sla_expires_at) : "Clock Inactive"} />
              <div>
                <span className="text-slate-400 font-medium block text-xs mb-1">Reassignment Count</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={`h-2.5 w-6 rounded-full ${i < lead.reassignment_count ? "bg-amber-500" : "bg-slate-100"}`} />
                    ))}
                  </div>
                  <span className="text-slate-900 font-semibold">{lead.reassignment_count} / 3</span>
                </div>
              </div>
              <InfoField
                label="SLA Violated"
                value={lead.sla_violated ? "YES" : "NO"}
                valueClass={lead.sla_violated ? "text-rose-600 font-bold" : ""}
              />
            </div>
            {lead.is_duplicate && lead.original_lead_id && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mt-4">
                This lead was classified as a duplicate. Original record:{" "}
                <Link href={`/lead/${lead.original_lead_id}`} className="underline font-semibold">
                  {lead.original_lead_id}
                </Link>
              </div>
            )}
          </div>

          {/* Audit Timeline */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">Audit History Timeline</h2>
            <div className="relative border-l-2 border-slate-100 pl-6 space-y-6">
              {lead.audit_logs.map((log) => {
                const isEscalation = log.action.includes("ESCALATE");
                const isReassign = log.action.includes("REASSIGN");
                const dotColor = isEscalation ? "bg-rose-500" : isReassign ? "bg-amber-500" : "bg-blue-500";

                return (
                  <div key={log.id} className="relative">
                    <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${dotColor}`}></div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isEscalation ? "bg-rose-100 text-rose-700" :
                        isReassign ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatTime(log.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{log.notes}</p>
                    {log.old_status && (
                      <p className="text-xs text-slate-400 mt-1">
                        {log.old_status} → {log.new_status}
                      </p>
                    )}
                  </div>
                );
              })}
              {lead.audit_logs.length === 0 && (
                <p className="text-xs text-slate-400">No audit events recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Update */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-20">
            <h2 className="text-base font-bold text-slate-900 mb-4">Update Status</h2>
            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Lead Status</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="ASSIGNED">Assigned</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLOSED_WON">Closed Won</option>
                  <option value="CLOSED_LOST">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Notes</label>
                <textarea
                  placeholder="Details of interaction..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                ></textarea>
              </div>
              {errorMsg && <p className="text-xs font-semibold text-rose-600">{errorMsg}</p>}
              <button
                type="submit"
                disabled={updating}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {updating ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></span>
                ) : (
                  "Save Status"
                )}
              </button>
            </form>
          </div>

          {/* Manual Reassignment */}
          {lead.status !== "ESCALATED" && lead.status !== "CLOSED_WON" && lead.status !== "CLOSED_LOST" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1">Reassign Lead</h2>
              <p className="text-xs text-slate-400 mb-4">Transfer this lead to a different sales agent.</p>
              <form onSubmit={handleReassign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Target Agent</label>
                  <select
                    value={reassignAgentId}
                    onChange={(e) => setReassignAgentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select an agent...</option>
                    {eligibleAgents.map((a) => (
                      <option key={a.agent_id} value={a.agent_id}>
                        {a.full_name} ({a.current_load}/{a.max_concurrent_leads} leads)
                      </option>
                    ))}
                  </select>
                  {eligibleAgents.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">No eligible agents with available capacity.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Reason</label>
                  <input
                    type="text"
                    placeholder="Reason for reassignment..."
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                {reassignError && <p className="text-xs font-semibold text-rose-600">{reassignError}</p>}
                <button
                  type="submit"
                  disabled={reassigning || !reassignAgentId}
                  className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {reassigning ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></span>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Reassign Lead
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  {lead.reassignment_count}/3 reassignments used. {3 - lead.reassignment_count} remaining before escalation.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <span className="text-slate-400 font-medium block text-xs mb-1">{label}</span>
      <span className={`text-slate-900 font-semibold text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}
