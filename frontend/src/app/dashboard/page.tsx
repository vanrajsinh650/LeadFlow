import React from "react";
import Link from "next/link";

interface LeadActivity {
  id: string;
  lead_name: string;
  action: string;
  agent: string;
  time: string;
  status: "success" | "warning" | "danger" | "neutral";
}

const mockActivities: LeadActivity[] = [
  { id: "1", lead_name: "James Johnson", action: "Assigned via WRR", agent: "Jane Smith", time: "2 minutes ago", status: "success" },
  { id: "2", lead_name: "Mary Brown", action: "SLA Breach Reassignment", agent: "Alice Miller", time: "15 minutes ago", status: "danger" },
  { id: "3", lead_name: "John Taylor", action: "Duplicate Lead Merged", agent: "Jane Smith", time: "45 minutes ago", status: "warning" },
  { id: "4", lead_name: "Robert Moore", action: "Lead Ingested", agent: "Unassigned", time: "1 hour ago", status: "neutral" },
  { id: "5", lead_name: "Patricia Thomas", action: "Status: Converted", agent: "Bob Jones", time: "2 hours ago", status: "success" },
];

export default function DashboardPage() {
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
          <span className="text-3xl font-bold text-slate-900 mt-2">100</span>
          <span className="text-xs text-slate-400 mt-2">Across 30-day window</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Agents</span>
          <span className="text-3xl font-bold text-slate-900 mt-2">6 / 10</span>
          <span className="text-xs text-emerald-600 font-medium mt-2">● 6 currently in shift</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA Violations</span>
          <span className="text-3xl font-bold text-rose-600 mt-2">2</span>
          <span className="text-xs text-rose-500 font-medium mt-2">Reassignment triggered</span>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion Rate</span>
          <span className="text-3xl font-bold text-slate-900 mt-2">10%</span>
          <span className="text-xs text-emerald-600 font-medium mt-2">↑ 1.2% from last week</span>
        </div>
      </div>

      {/* Distribution Load & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Load Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Agent Distribution Load</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Jane Smith (Weight: 8)</span>
                <span>35 leads</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: "70%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Bob Jones (Weight: 5)</span>
                <span>20 leads</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: "40%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Alice Miller (Weight: 3)</span>
                <span>12 leads</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: "24%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <span>Charlie Davis (Weight: 2)</span>
                <span>8 leads</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: "16%" }}></div>
              </div>
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
                <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-3">Lead Name</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Assigned Owner</th>
                  <th className="pb-3">Time</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {mockActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-semibold text-slate-900">{act.lead_name}</td>
                    <td className="py-4 text-slate-600">{act.action}</td>
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
