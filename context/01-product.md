# 01-product.md - Product Context

## Overview
LeadFlow is a sales lead distribution platform designed to automate lead routing, duplicate prevention, SLA enforcement, follow-up tracking, and performance reporting. It ensures that inbound customer leads are distributed to the most appropriate sales agents instantly, preventing leads from getting lost, ignored, or routed incorrectly.

## Problem Statement & Why It Exists
In high-velocity sales environments, speed-to-contact is the single most critical driver of conversion rates. Traditional manual lead routing suffers from:
1. **Response Latency (SLA Breaches):** Leads sit in a queue for hours before being manually assigned, resulting in cold leads and missed opportunities.
2. **Inequitable Distribution:** Leads are manually cherry-picked or randomly assigned without taking agent availability, capacity, or performance/weight into account.
3. **High Duplicate Rates:** Multiple reps contact the same prospect due to lack of automated duplicate checking, causing customer frustration and poor team collaboration.
4. **Poor Accountability:** Managers lack visibility into lead status, follow-up times, and SLA violations.

LeadFlow solves these challenges by acting as the automated brain for sales lead distribution.

## Target Audience & Personas
- **Inbound Lead Sources (Systems):** Web forms, third-party lead generators, marketing campaigns, and external APIs.
- **Sales Agents / Reps:** Frontline team members who receive assigned leads and need to act on them immediately within strict SLA timelines.
- **Sales Managers / Directors:** Operations leaders who configure routing weights, monitor team capacity, view response metrics, and handle SLA escalations.
- **System Administrators:** IT/Ops staff managing system configurations, API integrations, and monitoring routing health.

## Success Metrics
- **Speed to Contact:** Reduce the average time between lead ingestion and agent assignment to < 5 seconds.
- **SLA Adherence:** Maintain a > 95% rate of first contact within the configured SLA timeframe (e.g., 15 minutes).
- **Distribution Efficiency:** Ensure exact matching of Weighted Round Robin targets across active agents.
- **Zero Orphaned Leads:** Eliminate instances of leads being lost or unassigned without automated escalation.

## Product Scope
### In Scope
- **Lead Ingestion API:** High-throughput REST API endpoint for third-party systems.
- **Duplicate Prevention Engine:** Automated check based on email, phone, and metadata matching within a configurable time window.
- **Weighted Round Robin Router:** Distribution of leads to agents based on active status, working hours, and capacity weights.
- **SLA Enforcement & Escalation:** Active background tracking of lead status and automated reassignment/alerting if a rep fails to make contact in time.
- **Agent Availability/Capacity Management:** API/UI controls for agents to toggle "Active/Inactive" status and for managers to set agent weights.
- **Activity & Lifecycle Auditing:** Fully-audited logs of every state change, assignment, and action taken on a lead.

### Out of Scope (For Current Phase)
- **Direct CRM Integration:** Deep bidirectional syncs with Salesforce/Hubspot (to be handled via webhook outbox patterns in the future).
- **Communication Client:** Built-in email client or VoIP softphone. LeadFlow tracks the *events* of contact but does not provide the calling/emailing interface.
- **Lead Scoring AI:** Predictive lead quality scoring based on demographic data.
