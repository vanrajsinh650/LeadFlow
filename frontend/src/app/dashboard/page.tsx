"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard statistics");
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchStats(false), 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
        <p className="text-slate-500 font-semibold text-sm">Loading dashboard statistics...</p>
      </div>
    );
  }

  if (error && !data) {
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
          Make sure your FastAPI server is running and the database is seeded.
        </p>
        <button
          onClick={() => fetchStats(true)}
          className="mt-4 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-md hover:bg-rose-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      label: "Total Leads",
      value: data.total_leads,
      sub: "All pipeline leads",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: "blue",
    },
    {
      label: "Active Agents",
      value: `${data.active_agents} / ${data.total_agents}`,
      sub: `● ${data.active_agents} currently in shift`,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: "emerald",
      subColor: "text-emerald-600",
    },
    {
      label: "SLA Violations",
      value: data.sla_violations,
      sub: "Reassignment triggered",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: data.sla_violations > 0 ? "rose" : "slate",
      valueClass: data.sla_violations > 0 ? "text-rose-600" : "",
      subColor: "text-rose-500",
    },
    {
      label: "Conversion Rate",
      value: `${data.conversion_rate}%`,
      sub: "↑ Closed-Won ratio",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: "emerald",
      subColor: "text-emerald-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-2">Real-time sales lead distribution, routing load, and SLA enforcement tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
              <span className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600 group-hover:scale-110 transition-transform`}>
                {card.icon}
              </span>
            </div>
            <span className={`text-3xl font-bold mt-1 ${card.valueClass || "text-slate-900"}`}>
              {card.value}
            </span>
            <span className={`text-xs font-medium mt-2 ${card.subColor || "text-slate-400"}`}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Distribution Load & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Load Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-5">Agent Distribution Load</h2>
            <div className="space-y-5">
              {data.agent_loads.map((agent, index) => {
                const loadPercent = Math.min(100, agent.max_load > 0 ? (agent.current_load / agent.max_load) * 100 : 0);
                const isOverloaded = agent.current_load >= agent.max_load;
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm font-medium mb-1.5">
                      <span className="text-slate-700">{agent.agent_name}</span>
                      <span className={`text-xs font-mono ${isOverloaded ? "text-rose-600 font-bold" : "text-slate-500"}`}>
                        {agent.current_load}/{agent.max_load}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isOverloaded
                            ? "bg-rose-500"
                            : loadPercent >= 75
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-slate-400">Weight: {agent.weight}</span>
                      <span className="text-[10px] text-slate-400">{Math.round(loadPercent)}% capacity</span>
                    </div>
                  </div>
                );
              })}
              {data.agent_loads.length === 0 && (
                <div className="text-center py-8">
                  <svg className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-xs text-slate-400">No active agents in shift</p>
                </div>
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
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Recent Ingestion & Routing Logs</h2>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live — refreshing every 15s
            </span>
          </div>
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
              <tbody className="divide-y divide-slate-50 text-sm">
                {data.recent_logs.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 font-semibold text-slate-900">{act.lead_name}</td>
                    <td className="py-3.5 text-slate-600 max-w-[220px] truncate" title={act.action}>
                      {act.action}
                    </td>
                    <td className="py-3.5 text-slate-600">{act.agent}</td>
                    <td className="py-3.5 text-slate-400 text-xs">{act.time}</td>
                    <td className="py-3.5 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        act.status === "success" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10" :
                        act.status === "warning" ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10" :
                        act.status === "danger" ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10" :
                        "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"
                      }`}>
                        {act.status === "success" ? "✓ Routed" :
                         act.status === "danger" ? "✕ Failed" :
                         act.status === "warning" ? "⚠ Duplicate" :
                         "● Logged"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recent_logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No routing activity logged yet. Ingest a lead to begin.
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
