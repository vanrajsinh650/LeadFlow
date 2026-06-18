"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface AgentLoad {
  agent_name: string;
  weight: number;
  current_load: number;
  max_load: number;
}

interface LeadActivity {
  id: string;
  lead_name: string;
  action: string;
  agent: string;
  time: string;
  status: "success" | "warning" | "danger" | "neutral";
}

interface StatsData {
  total_leads: number;
  active_agents: number;
  total_agents: number;
  sla_violations: number;
  conversion_rate: number;
  agent_loads: AgentLoad[];
  recent_logs: LeadActivity[];
}

export default function DashboardPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("http://localhost:8000/api/v1/dashboard/stats");
        if (!res.ok) {
          throw new Error("Failed to fetch dashboard statistics");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading dashboard statistics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-lg max-w-2xl mx-auto mt-8 shadow-sm">
        <h3 className="font-bold text-base flex items-center gap-2">
          <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Backend Gateway Offline
        </h3>
        <p className="text-sm text-rose-700 mt-2">
          {error || "Unable to reach http://localhost:8000/api/v1/dashboard/stats."}
        </p>
        <p className="text-xs text-rose-500 mt-3 pt-3 border-t border-rose-100">
          Make sure your FastAPI server is running (`uvicorn backend.app.main:app --port 8000`) and the database is seeded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-2">Real-time sales lead distribution, routing load, and SLA enforcement tracking.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Leads</span>
          <span className="text-3xl font-bold text-slate-900 mt-2">{data.total_leads}</span>
          <span className="text-xs text-slate-400 mt-2">Across 30-day window</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Agents</span>
          <span className="text-3xl font-bold text-slate-900 mt-2">{data.active_agents} / {data.total_agents}</span>
          <span className="text-xs text-emerald-600 font-medium mt-2">● {data.active_agents} currently in shift</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA Violations</span>
          <span className={`text-3xl font-bold mt-2 ${data.sla_violations > 0 ? "text-rose-600 animate-pulse" : "text-slate-900"}`}>
            {data.sla_violations}
          </span>
          <span className="text-xs text-rose-500 font-medium mt-2">Reassignment triggered</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion Rate</span>
          <span className="text-3xl font-bold text-slate-900 mt-2">{data.conversion_rate}%</span>
          <span className="text-xs text-emerald-600 font-medium mt-2">↑ Active Closed-Won ratio</span>
        </div>
      </div>

      {/* Distribution Load & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Load Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Agent Distribution Load</h2>
            <div className="space-y-4">
              {data.agent_loads.map((agent, index) => {
                const loadPercent = Math.min(
                  100,
                  agent.max_load > 0 ? (agent.current_load / agent.max_load) * 100 : 0
                );
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>{agent.agent_name} (Weight: {agent.weight})</span>
                      <span>{agent.current_load} / {agent.max_load} leads</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          loadPercent >= 90
                            ? "bg-rose-500"
                            : loadPercent >= 75
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {data.agent_loads.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No active agents in shift</p>
              )}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link href="/agents" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Manage Agents & Weights →
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Ingestion & Routing Logs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider select-none">
                  <th className="pb-3">Lead Name</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Assigned Owner</th>
                  <th className="pb-3">Time</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data.recent_logs.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-semibold text-slate-900">{act.lead_name}</td>
                    <td className="py-4 text-slate-600 max-w-[200px] truncate" title={act.action}>
                      {act.action}
                    </td>
                    <td className="py-4 text-slate-600">{act.agent}</td>
                    <td className="py-4 text-slate-400 text-xs">{act.time}</td>
                    <td className="py-4 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        act.status === "success" ? "bg-emerald-50 text-emerald-700" :
                        act.status === "warning" ? "bg-amber-50 text-amber-700" :
                        act.status === "danger" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"
                      }`}>
                        {act.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recent_logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No routing activity logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link href="/leads" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              View All Active Leads →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
