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

  const itemsPerPage = 8;

  // 1. Fetch Agents for Name Mapping
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
        console.error("Failed to load agents list for name mapping:", e);
      }
    }
    fetchAgents();
  }, []);

  // 2. Fetch leads with parameters (with search debouncing)
  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          search: search,
          priority: priorityFilter,
          status: statusFilter,
          sort_by: sortField,
          sort_order: sortOrder,
          page: String(page),
          limit: String(itemsPerPage),
        });
        const res = await fetch(`http://localhost:8000/api/v1/leads?${queryParams}`);
        if (!res.ok) {
          throw new Error("Failed to fetch leads from API gateway");
        }
        const json = await res.json();
        setLeads(json);
        setError(null);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchLeads();
    }, 250);

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
      const dt = new Date(timeStr);
      return dt.toISOString().replace("T", " ").substring(0, 16);
    } catch {
      return timeStr;
    }
  };

  const hasNextPage = leads.length === itemsPerPage;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">Manage and audit the lifecycle of customer leads.</p>
        </div>
      </div>

      {/* Filters & Search controls */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-72 relative">
          <input
            type="text"
            placeholder="Search leads name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
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
          Error loading leads: {error}
        </div>
      )}

      {/* Leads Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-xs flex items-center justify-center z-10">
              <span className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></span>
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider select-none">
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("first_name")}>Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("priority")}>Priority</th>
                <th className="py-3.5 px-4">Agent</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("status")}>Status</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("created_at")}>Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {leads.map((lead) => (
                <tr key={lead.lead_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    {lead.first_name} {lead.last_name}
                    {lead.is_duplicate && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10">
                        Dup
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-600">{lead.email}</td>
                  <td className="py-4 px-4 text-slate-600">{lead.phone}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      lead.priority === "HIGH" ? "bg-rose-50 text-rose-700" :
                      lead.priority === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-600">
                    {lead.assigned_agent_id ? (agentsMap[lead.assigned_agent_id] || "Assigned") : "Unassigned"}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      lead.status === "CLOSED_WON" ? "bg-emerald-50 text-emerald-700" :
                      lead.status === "ESCALATED" ? "bg-rose-100 text-rose-800 font-bold animate-pulse" :
                      lead.status === "CLOSED_LOST" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-xs">{formatTime(lead.created_at)}</td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      href={`/lead/${lead.lead_id}`}
                      className="inline-flex items-center rounded bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No leads found matching current query and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {(page > 1 || hasNextPage) && (
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Showing Page {page}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border border-slate-200 rounded-md text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={!hasNextPage}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border border-slate-200 rounded-md text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
