"use client";

import React, { useState } from "react";

interface AgentRecord {
  id: string;
  full_name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "AGENT";
  is_active: boolean;
  weight: number;
  timezone: string;
  shift_start: string;
  shift_end: string;
  max_concurrent_leads: number;
  current_load: number;
}

const initialAgents: AgentRecord[] = [
  { id: "1", full_name: "Jane Smith", email: "jane@leadflow.com", role: "AGENT", is_active: true, weight: 8, timezone: "America/New_York", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 12, current_load: 4 },
  { id: "2", full_name: "Bob Jones", email: "bob@leadflow.com", role: "AGENT", is_active: true, weight: 5, timezone: "UTC", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 10, current_load: 3 },
  { id: "3", full_name: "Alice Miller", email: "alice@leadflow.com", role: "AGENT", is_active: true, weight: 3, timezone: "Europe/London", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 10, current_load: 1 },
  { id: "4", full_name: "Charlie Davis", email: "charlie@leadflow.com", role: "AGENT", is_active: true, weight: 2, timezone: "Asia/Kolkata", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 8, current_load: 0 },
  { id: "5", full_name: "Eve Garcia", email: "eve@leadflow.com", role: "AGENT", is_active: false, weight: 6, timezone: "America/New_York", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 10, current_load: 0 },
  { id: "6", full_name: "Frank Wilson", email: "frank@leadflow.com", role: "AGENT", is_active: false, weight: 4, timezone: "UTC", shift_start: "09:00", shift_end: "17:00", max_concurrent_leads: 10, current_load: 0 },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>(initialAgents);
  const [loadingAgentId, setLoadingAgentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const toggleAgentActive = async (id: string, currentStatus: boolean) => {
    setLoadingAgentId(id);
    
    // Simulate async network request
    await new Promise((resolve) => setTimeout(resolve, 800));

    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id ? { ...agent, is_active: !currentStatus } : agent
      )
    );

    setLoadingAgentId(null);
    showToast(`Agent availability successfully updated.`);
  };

  const updateAgentWeight = async (id: string, weight: number) => {
    setLoadingAgentId(id);
    
    await new Promise((resolve) => setTimeout(resolve, 800));

    setAgents((prev) =>
      prev.map((agent) => (agent.id === id ? { ...agent, weight } : agent))
    );

    setLoadingAgentId(null);
    showToast(`Agent weight threshold adjusted.`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agents</h1>
        <p className="text-slate-500 mt-1">Manage active agent shift hours, capacity load ceilings, and distribution weights.</p>
      </div>

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Agents Table List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Name</th>
                <th className="py-3.5 px-6">Shift Hours</th>
                <th className="py-3.5 px-6">Timezone</th>
                <th className="py-3.5 px-6">Load Limit</th>
                <th className="py-3.5 px-6">Current Load</th>
                <th className="py-3.5 px-6">Weight</th>
                <th className="py-3.5 px-6 text-right">Routing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-900">{agent.full_name}</div>
                    <div className="text-slate-400 text-xs">{agent.email}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {agent.shift_start} - {agent.shift_end}
                  </td>
                  <td className="py-4 px-6 text-slate-600">{agent.timezone}</td>
                  <td className="py-4 px-6 text-slate-600">
                    {agent.max_concurrent_leads} max
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${(agent.current_load / agent.max_concurrent_leads) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {agent.current_load}/{agent.max_concurrent_leads}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <select
                      value={agent.weight}
                      disabled={loadingAgentId === agent.id}
                      onChange={(e) => updateAgentWeight(agent.id, intval(e.target.value))}
                      className="px-2 py-1 border border-slate-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                    >
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      disabled={loadingAgentId === agent.id}
                      onClick={() => toggleAgentActive(agent.id, agent.is_active)}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50 ${
                        agent.is_active
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-inset ring-emerald-600/10"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200"
                      }`}
                    >
                      {loadingAgentId === agent.id ? (
                        <span className="h-3 w-3 border-2 border-slate-400 border-t-transparent animate-spin rounded-full"></span>
                      ) : agent.is_active ? (
                        "Active"
                      ) : (
                        "Inactive"
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Simple helper to parse integers safely
function intval(val: string): number {
  return parseInt(val, 10) || 1;
}
