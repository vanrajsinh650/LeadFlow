"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface LeadRecord {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "UNASSIGNED" | "ASSIGNED" | "CONTACTED" | "IN_PROGRESS" | "CLOSED_WON" | "CLOSED_LOST" | "ESCALATED";
  assigned_agent_id: string | null;
  created_at: string;
  is_duplicate: boolean;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<keyof LeadRecord>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Lead Modal state
  const [showModal, setShowModal] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    source: "web_form",
    priority: "MEDIUM",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Fetch Agents for Name Mapping
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/agents");
        if (res.ok) {
          const agents = await res.json();
          const mapping: Record<string, string> = {};
          agents.forEach((ag: any) => {
            mapping[ag.agent_id] = ag.full_name;
          });
          setAgentsMap(mapping);
        }
      } catch (e) {
        console.error("Failed to load agents:", e);
      }
    }
    fetchAgents();
  }, []);

  // Fetch leads
  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          search,
          priority: priorityFilter,
          status: statusFilter,
          sort_by: sortField,
          sort_order: sortOrder,
          page: String(page),
          limit: String(itemsPerPage),
        });
        const res = await fetch(`http://localhost:8000/api/v1/leads?${queryParams}`);
        if (!res.ok) throw new Error("Failed to fetch leads");
        const json = await res.json();
        setLeads(json);
        setError(null);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchLeads, 250);
    return () => clearTimeout(timer);
  }, [search, priorityFilter, statusFilter, sortField, sortOrder, page]);

  const handleSort = (field: keyof LeadRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return timeStr;
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch("http://localhost:8000/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create lead");
      }

      const created = await res.json();
      setShowModal(false);
      setNewLead({ first_name: "", last_name: "", email: "", phone: "", source: "web_form", priority: "MEDIUM" });
      setToastMsg(`Lead "${created.first_name} ${created.last_name}" created → ${created.status}`);
      setTimeout(() => setToastMsg(null), 4000);

      // Re-fetch leads
      setPage(1);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const SortIcon = ({ field }: { field: keyof LeadRecord }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  const hasNextPage = leads.length === itemsPerPage;

  const priorityBadge = (p: string) => {
    if (p === "HIGH") return "bg-rose-50 text-rose-700 ring-rose-600/10";
    if (p === "MEDIUM") return "bg-amber-50 text-amber-700 ring-amber-600/10";
    return "bg-blue-50 text-blue-700 ring-blue-600/10";
  };

  const statusBadge = (s: string) => {
    if (s === "CLOSED_WON") return "bg-emerald-50 text-emerald-700";
    if (s === "ESCALATED") return "bg-rose-100 text-rose-800 font-bold";
    if (s === "CLOSED_LOST") return "bg-slate-100 text-slate-600";
    if (s === "UNASSIGNED") return "bg-slate-50 text-slate-500";
    return "bg-blue-50 text-blue-700";
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700 z-50">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">Manage and audit the lifecycle of customer leads.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Lead
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">🔴 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🔵 Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CONTACTED">Contacted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED_WON">Closed Won</option>
            <option value="CLOSED_LOST">Closed Lost</option>
            <option value="ESCALATED">Escalated</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
              <span className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></span>
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider select-none">
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("first_name")}>
                  Name <SortIcon field="first_name" />
                </th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("priority")}>
                  Priority <SortIcon field="priority" />
                </th>
                <th className="py-3.5 px-4">Agent</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("created_at")}>
                  Created <SortIcon field="created_at" />
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {leads.map((lead) => (
                <tr key={lead.lead_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {lead.first_name} {lead.last_name}
                      </span>
                      {lead.is_duplicate && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/10">
                          DUP
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">{lead.email}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${priorityBadge(lead.priority)}`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">
                    {lead.assigned_agent_id ? (agentsMap[lead.assigned_agent_id] || "Assigned") : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(lead.status)}`}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-xs">{formatTime(lead.created_at)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/lead/${lead.lead_id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 opacity-60 group-hover:opacity-100 transition-all"
                    >
                      Details
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <svg className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-slate-400 text-sm">No leads found matching your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(page > 1 || hasNextPage) && (
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs text-slate-500">Page {page}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                ← Previous
              </button>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Ingest New Lead</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">First Name</label>
                  <input
                    required
                    type="text"
                    value={newLead.first_name}
                    onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Last Name</label>
                  <input
                    required
                    type="text"
                    value={newLead.last_name}
                    onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone</label>
                <input
                  required
                  type="text"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="5551234567"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source</label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="web_form">Web Form</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="meta_campaign">Meta Campaign</option>
                    <option value="referral">Referral</option>
                    <option value="api_ingest">API Ingest</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Priority</label>
                  <select
                    value={newLead.priority}
                    onChange={(e) => setNewLead({ ...newLead, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="HIGH">🔴 High</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="LOW">🔵 Low</option>
                  </select>
                </div>
              </div>
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-lg">
                  {submitError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></span>
                  ) : (
                    "Create & Route Lead"
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                The lead will be automatically deduplicated and routed via Weighted Round Robin.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
