"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string;
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
  audit_logs: AuditLog[];
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

  // Fetch lead detail from backend API
  async function fetchLead() {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/leads/${leadId}`);
      if (!res.ok) {
        throw new Error("Failed to load lead details from backend");
      }
      const json = await res.json();
      setLead(json);
      setStatusInput(json.status);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: statusInput,
          notes: notesInput || "Manual status change via interface."
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save status update to backend server");
      }

      // Re-fetch lead details to reload timelines and fields
      await fetchLead();
      setNotesInput("");
      setToastMsg("Lead status updated successfully.");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "SLA Clock Inactive";
    try {
      const dt = new Date(timeStr);
      return dt.toISOString().replace("T", " ").substring(0, 16);
    } catch {
      return timeStr;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading lead record details...</p>
      </div>
    );
  }

  if (errorMsg && !lead) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-lg max-w-2xl mx-auto mt-8 shadow-sm">
        <h3 className="font-bold text-base flex items-center gap-2">
          <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Record Not Found
        </h3>
        <p className="text-sm text-rose-700 mt-2">{errorMsg}</p>
        <div className="mt-4">
          <Link href="/leads" className="text-sm font-semibold text-rose-600 underline">
            ← Return to Leads list
          </Link>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Navigation & Header */}
      <div>
        <Link href="/leads" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors mb-4">
          ← Back to Leads List
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {lead.first_name} {lead.last_name}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Lead ID: {lead.lead_id}</p>
          </div>
          <div className="flex gap-3">
            {lead.is_duplicate && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Duplicate Lead
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              lead.status === "CLOSED_WON" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" :
              lead.status === "ESCALATED" ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 font-bold" :
              "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
            }`}>
              {lead.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Info Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact info & parameters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400 font-medium block">Email Address</span>
                <span className="text-slate-900 font-semibold">{lead.email}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Phone Number</span>
                <span className="text-slate-900 font-semibold">{lead.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Lead Source</span>
                <span className="text-slate-900 font-semibold uppercase">{lead.source}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Priority Tier</span>
                <span className="text-slate-900 font-semibold">{lead.priority}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Routing & SLA Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400 font-medium block">Assigned Sales Agent</span>
                <span className="text-slate-900 font-semibold">{lead.assigned_agent_name || "Unassigned"}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">SLA Expiry Time</span>
                <span className="text-slate-900 font-semibold">{formatTime(lead.sla_expires_at)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Reassignment Counter</span>
                <span className="text-slate-900 font-semibold">{lead.reassignment_count} / 3</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">SLA Violated Status</span>
                <span className={`font-semibold ${lead.sla_violated ? "text-rose-600 font-bold" : "text-slate-900"}`}>
                  {lead.sla_violated ? "YES" : "NO"}
                </span>
              </div>
            </div>
            {lead.is_duplicate && lead.original_lead_id && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                This lead was classified as a duplicate of an existing record. View original:{" "}
                <Link href={`/lead/${lead.original_lead_id}`} className="underline font-semibold">
                  {lead.original_lead_id}
                </Link>
              </div>
            )}
          </div>

          {/* Audit Timeline Logs */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Audit History Log</h2>
            <div className="relative border-l border-slate-200 pl-4 space-y-6">
              {lead.audit_logs.map((log) => (
                <div key={log.id} className="relative">
                  <div className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                    log.action.includes("ESCALATE") ? "bg-rose-600" :
                    log.action.includes("REASSIGN") ? "bg-amber-500" : "bg-blue-600"
                  }`}></div>
                  <div className="text-xs text-slate-400">{formatTime(log.created_at)}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{log.action}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {log.notes} {log.old_status && `(${log.old_status} → ${log.new_status})`}
                  </div>
                </div>
              ))}
              {lead.audit_logs.length === 0 && (
                <p className="text-xs text-slate-400">No logs found for this lead record.</p>
              )}
            </div>
          </div>
        </div>

        {/* Status update sidebar form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Update Status</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Lead Status</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ASSIGNED">Assigned (Active)</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLOSED_WON">Closed Won</option>
                  <option value="CLOSED_LOST">Closed Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Activity Notes</label>
                <textarea
                  placeholder="Details of call/email/demo interaction..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-none"
                ></textarea>
              </div>

              {errorMsg && <p className="text-xs font-semibold text-rose-600">{errorMsg}</p>}

              <button
                type="submit"
                disabled={updating}
                className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {updating ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></span>
                ) : (
                  "Save Status Update"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
