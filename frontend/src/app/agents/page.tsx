"use client";

import React, { useState, useEffect } from "react";

interface AgentRecord {
  agent_id: string;
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAgentId, setLoadingAgentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  async function fetchAgents() {
    try {
      const res = await fetch("http://localhost:8000/api/v1/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      const json = await res.json();
      setAgents(json);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  const toggleAgentActive = async (id: string, currentStatus: boolean) => {
    setLoadingAgentId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/agents/${id}/routing-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (!res.ok) throw new Error("Failed to toggle agent status");
      await fetchAgents();
      showToast(`Agent ${!currentStatus ? "activated" : "deactivated"} successfully.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update");
    } finally {
      setLoadingAgentId(null);
    }
  };

  const updateAgentWeight = async (id: string, weight: number) => {
    setLoadingAgentId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/agents/${id}/routing-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight })
      });
      if (!res.ok) throw new Error("Failed to update weight");
      await fetchAgents();
      showToast(`Routing weight updated to ${weight}.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update weight");
    } finally {
      setLoadingAgentId(null);
    }
  };

  const formatShiftTime = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr.substring(0, 5);
  };

  const activeCount = agents.filter(a => a.is_active).length;
  const totalLoad = agents.reduce((sum, a) => sum + a.current_load, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700 z-50">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agents</h1>
          <p className="text-slate-500 mt-1">Manage shift hours, capacity limits, and routing distribution weights.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm text-center">
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Active</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm text-center">
            <p className="text-2xl font-bold text-slate-900">{totalLoad}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Load</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {agents.map((agent) => {
          const loadPercent = agent.max_concurrent_leads > 0
            ? Math.min(100, (agent.current_load / agent.max_concurrent_leads) * 100)
            : 0;
          const isOverloaded = agent.current_load >= agent.max_concurrent_leads;
          const isLoading = loadingAgentId === agent.agent_id;

          return (
            <div
              key={agent.agent_id}
              className={`bg-white rounded-xl border shadow-sm p-5 transition-all duration-200 ${
                agent.is_active
                  ? "border-slate-200 hover:shadow-md"
                  : "border-slate-100 opacity-65"
              }`}
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    agent.is_active ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-slate-300"
                  }`}>
                    {agent.full_name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{agent.full_name}</h3>
                    <p className="text-xs text-slate-400">{agent.email}</p>
                  </div>
                </div>
                <button
                  disabled={isLoading}
                  onClick={() => toggleAgentActive(agent.agent_id, agent.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    agent.is_active ? "bg-blue-600" : "bg-slate-200"
                  } ${isLoading ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      agent.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Load Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Current Load</span>
                  <span className={`font-mono font-semibold ${isOverloaded ? "text-rose-600" : "text-slate-700"}`}>
                    {agent.current_load}/{agent.max_concurrent_leads}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverloaded ? "bg-rose-500" : loadPercent >= 75 ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Shift</span>
                  <span className="text-slate-700 font-semibold">
                    {formatShiftTime(agent.shift_start)} – {formatShiftTime(agent.shift_end)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Timezone</span>
                  <span className="text-slate-700 font-semibold text-[11px]">{agent.timezone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Weight</span>
                  <select
                    value={agent.weight}
                    disabled={isLoading}
                    onChange={(e) => updateAgentWeight(agent.agent_id, parseInt(e.target.value, 10) || 0)}
                    className="px-2 py-1 border border-slate-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 bg-white"
                  >
                    {[...Array(11)].map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Status</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    agent.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${agent.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {agent.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No agents configured.</p>
        </div>
      )}
    </div>
  );
}
