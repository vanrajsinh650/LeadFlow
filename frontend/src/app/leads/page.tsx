"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

interface LeadRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "UNASSIGNED" | "ASSIGNED" | "CONTACTED" | "IN_PROGRESS" | "CLOSED_WON" | "CLOSED_LOST" | "ESCALATED";
  assigned_agent: string;
  created_at: string;
  is_duplicate: boolean;
}

const mockLeads: LeadRecord[] = [
  { id: "4a7b3c20-80d4-4c4f-bf14-a9572efde0c2", first_name: "James", last_name: "Johnson", email: "james@example.com", phone: "555-0101", source: "web_form", priority: "HIGH", status: "ASSIGNED", assigned_agent: "Jane Smith", created_at: "2026-06-18 19:49", is_duplicate: false },
  { id: "9d8e7f60-1234-5678-abcd-1234567890ab", first_name: "Mary", last_name: "Brown", email: "mary@example.com", phone: "555-0102", source: "google_ads", priority: "MEDIUM", status: "ESCALATED", assigned_agent: "Unassigned", created_at: "2026-06-17 14:30", is_duplicate: true },
  { id: "e1f2g3h4-5678-90ab-cdef-1234567890cd", first_name: "John", last_name: "Taylor", email: "john@example.com", phone: "555-0103", source: "referral", priority: "LOW", status: "CONTACTED", assigned_agent: "Jane Smith", created_at: "2026-06-16 11:22", is_duplicate: false },
  { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", first_name: "Robert", last_name: "Moore", email: "robert@example.com", phone: "555-0104", source: "meta_campaign", priority: "HIGH", status: "IN_PROGRESS", assigned_agent: "Bob Jones", created_at: "2026-06-15 09:15", is_duplicate: false },
  { id: "z9y8x7w6-v5u4-t3s2-r1q0-p9o8n7m6l5k4", first_name: "Patricia", last_name: "Thomas", email: "patricia@example.com", phone: "555-0105", source: "api_ingest", priority: "MEDIUM", status: "CLOSED_WON", assigned_agent: "Bob Jones", created_at: "2026-06-14 16:45", is_duplicate: false },
  { id: "b2c3d4e5-f6a7-8901-bcde-f1234567890a", first_name: "William", last_name: "Miller", email: "william@example.com", phone: "555-0106", source: "web_form", priority: "LOW", status: "CLOSED_LOST", assigned_agent: "Alice Miller", created_at: "2026-06-13 10:05", is_duplicate: false },
];

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<keyof LeadRecord>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const handleSort = (field: keyof LeadRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filter and Sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let result = [...mockLeads];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.first_name.toLowerCase().includes(q) ||
          lead.last_name.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          lead.phone.includes(q)
      );
    }

    // Priority filter
    if (priorityFilter !== "ALL") {
      result = result.filter((lead) => lead.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((lead) => lead.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [search, priorityFilter, statusFilter, sortField, sortOrder]);

  // Pagination
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredAndSortedLeads.slice(start, start + itemsPerPage);
  }, [filteredAndSortedLeads, page]);

  const totalPages = Math.ceil(filteredAndSortedLeads.length / itemsPerPage);

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

      {/* Leads Data Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider select-none">
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("first_name")}>Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("priority")}>Priority</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("assigned_agent")}>Agent</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("status")}>Status</th>
                <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("created_at")}>Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
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
                  <td className="py-4 px-4 text-slate-600">{lead.assigned_agent}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      lead.status === "CLOSED_WON" ? "bg-emerald-50 text-emerald-700" :
                      lead.status === "ESCALATED" ? "bg-rose-100 text-rose-800 font-bold" :
                      lead.status === "CLOSED_LOST" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-xs">{lead.created_at}</td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      href={`/lead/${lead.id}`}
                      className="inline-flex items-center rounded bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {paginatedLeads.length === 0 && (
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
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Showing Page {page} of {totalPages}
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
                disabled={page === totalPages}
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
