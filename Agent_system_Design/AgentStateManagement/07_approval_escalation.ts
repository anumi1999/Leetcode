/**
 * ============================================================
 *  07 — Approval / Escalation Patterns (Human-in-the-Loop)
 * ============================================================
 *
 *  WHY THIS EXISTS
 *  ---------------
 *  Real agents often need permission before executing risky actions:
 *  - Sending external emails
 *  - Triggering refunds/transfers
 *  - Deleting records
 *  - Changing production configs
 *
 *  Interview signal: show that you can model approval as explicit state,
 *  not ad-hoc if/else sprinkled around tool handlers.
 *
 *  CORE PATTERNS
 *  -------------
 *  1) Risk-based approval:
 *     low risk   -> auto-approve
 *     medium     -> manager approval
 *     high       -> security + manager (multi-step)
 *
 *  2) SLA-based escalation:
 *     if approver does not respond within N minutes, escalate to next level.
 *
 *  3) Fail-open vs fail-closed on timeout:
 *     - fail-open (low risk): continue with audit trail.
 *     - fail-closed (high risk): stop and require manual intervention.
 *
 *  4) Auditability:
 *     every decision is immutable and replayable.
 */

export type RiskLevel = "low" | "medium" | "high";

export interface ActionRequest {
    requestId: string;
    runId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    risk: RiskLevel;
    requestedBy: string;
    createdAt: number;
}

export interface ApprovalPolicy {
    /** Should this request require human approval? */
    needsApproval(req: ActionRequest): boolean;
    /** Ordered list of approver groups used for escalation. */
    approverChain(req: ActionRequest): string[];
    /** SLA per escalation level. */
    slaMs(req: ActionRequest, level: number): number;
    /** Timeout behavior when end of chain is reached. */
    timeoutMode(req: ActionRequest): "fail_open" | "fail_closed";
}

export type ApprovalEvent =
    | { type: "SUBMIT"; at: number; request: ActionRequest }
    | { type: "APPROVED"; at: number; by: string; note?: string }
    | { type: "REJECTED"; at: number; by: string; reason: string }
    | { type: "TICK"; at: number }
    | { type: "CANCELLED"; at: number; by: string; reason: string };

export type ApprovalState =
    | { status: "idle" }
    | {
          status: "awaiting_approval";
          request: ActionRequest;
          level: number;
          currentApproverGroup: string;
          deadline: number;
          history: ApprovalAuditEntry[];
      }
    | { status: "approved"; request: ActionRequest; by: string; at: number; history: ApprovalAuditEntry[] }
    | { status: "auto_approved"; request: ActionRequest; at: number; history: ApprovalAuditEntry[] }
    | { status: "rejected"; request: ActionRequest; by: string; at: number; reason: string; history: ApprovalAuditEntry[] }
    | { status: "timed_out_open"; request: ActionRequest; at: number; history: ApprovalAuditEntry[] }
    | { status: "timed_out_closed"; request: ActionRequest; at: number; history: ApprovalAuditEntry[] }
    | { status: "cancelled"; request?: ActionRequest; by: string; at: number; reason: string; history: ApprovalAuditEntry[] };

export interface ApprovalAuditEntry {
    at: number;
    action:
        | "submitted"
        | "routed"
        | "approved"
        | "rejected"
        | "escalated"
        | "timed_out_open"
        | "timed_out_closed"
        | "cancelled";
    by?: string;
    detail?: string;
}

export class IllegalApprovalTransitionError extends Error {
    constructor(state: string, event: string) {
        super(`illegal approval transition: state=\"${state}\", event=\"${event}\"`);
        this.name = "IllegalApprovalTransitionError";
    }
}

function appendAudit(history: ApprovalAuditEntry[], entry: ApprovalAuditEntry): ApprovalAuditEntry[] {
    return [...history, entry];
}

export function initialApprovalState(): ApprovalState {
    return { status: "idle" };
}

export function transitionApproval(
    state: ApprovalState,
    ev: ApprovalEvent,
    policy: ApprovalPolicy,
): ApprovalState {
    // Terminal states ignore all events except cancel, which stays cancelled.
    if (
        state.status === "approved" ||
        state.status === "auto_approved" ||
        state.status === "rejected" ||
        state.status === "timed_out_open" ||
        state.status === "timed_out_closed" ||
        state.status === "cancelled"
    ) {
        if (ev.type === "CANCELLED") {
            return state.status === "cancelled"
                ? state
                : {
                      status: "cancelled",
                      request: "request" in state ? state.request : undefined,
                      by: ev.by,
                      at: ev.at,
                      reason: ev.reason,
                      history: appendAudit("history" in state ? state.history : [], {
                          at: ev.at,
                          action: "cancelled",
                          by: ev.by,
                          detail: ev.reason,
                      }),
                  };
        }
        return state;
    }

    if (state.status === "idle") {
        if (ev.type !== "SUBMIT") {
            throw new IllegalApprovalTransitionError(state.status, ev.type);
        }

        const req = ev.request;
        const baseHistory: ApprovalAuditEntry[] = [
            { at: ev.at, action: "submitted", by: req.requestedBy, detail: req.toolName },
        ];

        if (!policy.needsApproval(req)) {
            return {
                status: "auto_approved",
                request: req,
                at: ev.at,
                history: appendAudit(baseHistory, {
                    at: ev.at,
                    action: "approved",
                    by: "policy:auto",
                    detail: "low-risk auto-approval",
                }),
            };
        }

        const chain = policy.approverChain(req);
        if (chain.length === 0) {
            throw new Error("approval chain is empty for request requiring approval");
        }

        const level = 0;
        const deadline = ev.at + policy.slaMs(req, level);
        return {
            status: "awaiting_approval",
            request: req,
            level,
            currentApproverGroup: chain[level],
            deadline,
            history: appendAudit(baseHistory, {
                at: ev.at,
                action: "routed",
                detail: `routed to ${chain[level]} (level ${level})`,
            }),
        };
    }

    // awaiting_approval
    if (state.status === "awaiting_approval") {
        if (ev.type === "APPROVED") {
            return {
                status: "approved",
                request: state.request,
                by: ev.by,
                at: ev.at,
                history: appendAudit(state.history, {
                    at: ev.at,
                    action: "approved",
                    by: ev.by,
                    detail: ev.note,
                }),
            };
        }

        if (ev.type === "REJECTED") {
            return {
                status: "rejected",
                request: state.request,
                by: ev.by,
                at: ev.at,
                reason: ev.reason,
                history: appendAudit(state.history, {
                    at: ev.at,
                    action: "rejected",
                    by: ev.by,
                    detail: ev.reason,
                }),
            };
        }

        if (ev.type === "CANCELLED") {
            return {
                status: "cancelled",
                request: state.request,
                by: ev.by,
                at: ev.at,
                reason: ev.reason,
                history: appendAudit(state.history, {
                    at: ev.at,
                    action: "cancelled",
                    by: ev.by,
                    detail: ev.reason,
                }),
            };
        }

        if (ev.type === "TICK") {
            if (ev.at <= state.deadline) return state;

            const chain = policy.approverChain(state.request);
            const nextLevel = state.level + 1;

            if (nextLevel < chain.length) {
                return {
                    status: "awaiting_approval",
                    request: state.request,
                    level: nextLevel,
                    currentApproverGroup: chain[nextLevel],
                    deadline: ev.at + policy.slaMs(state.request, nextLevel),
                    history: appendAudit(state.history, {
                        at: ev.at,
                        action: "escalated",
                        detail: `escalated to ${chain[nextLevel]} (level ${nextLevel})`,
                    }),
                };
            }

            const mode = policy.timeoutMode(state.request);
            if (mode === "fail_open") {
                return {
                    status: "timed_out_open",
                    request: state.request,
                    at: ev.at,
                    history: appendAudit(state.history, {
                        at: ev.at,
                        action: "timed_out_open",
                        detail: "approval chain exhausted; allowed by fail-open policy",
                    }),
                };
            }

            return {
                status: "timed_out_closed",
                request: state.request,
                at: ev.at,
                history: appendAudit(state.history, {
                    at: ev.at,
                    action: "timed_out_closed",
                    detail: "approval chain exhausted; blocked by fail-closed policy",
                }),
            };
        }

        throw new IllegalApprovalTransitionError(state.status, ev.type);
    }

    throw new IllegalApprovalTransitionError("unknown", (ev as { type: string }).type);
}

export function replayApproval(
    initial: ApprovalState,
    events: ApprovalEvent[],
    policy: ApprovalPolicy,
): ApprovalState {
    return events.reduce((s, e) => transitionApproval(s, e, policy), initial);
}

export const defaultApprovalPolicy: ApprovalPolicy = {
    needsApproval(req: ActionRequest): boolean {
        return req.risk !== "low";
    },
    approverChain(req: ActionRequest): string[] {
        if (req.risk === "medium") return ["manager"];
        if (req.risk === "high") return ["security", "manager", "director_on_call"];
        return [];
    },
    slaMs(req: ActionRequest, level: number): number {
        if (req.risk === "medium") return 5 * 60_000;
        if (req.risk === "high") {
            if (level === 0) return 3 * 60_000;
            if (level === 1) return 5 * 60_000;
            return 10 * 60_000;
        }
        return 0;
    },
    timeoutMode(req: ActionRequest): "fail_open" | "fail_closed" {
        return req.risk === "high" ? "fail_closed" : "fail_open";
    },
};

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

declare const require: any;
declare const module: any;

if (require.main === module) {
    const now = Date.now();

    const lowRisk: ActionRequest = {
        requestId: "req_low_1",
        runId: "run_42",
        toolName: "search_docs",
        toolArgs: { query: "vacation policy" },
        risk: "low",
        requestedBy: "agent",
        createdAt: now,
    };

    const highRisk: ActionRequest = {
        requestId: "req_high_1",
        runId: "run_42",
        toolName: "issue_refund",
        toolArgs: { amount: 2500, currency: "USD" },
        risk: "high",
        requestedBy: "agent",
        createdAt: now,
    };

    let s = initialApprovalState();
    s = transitionApproval(s, { type: "SUBMIT", at: now, request: lowRisk }, defaultApprovalPolicy);
    console.log("low risk final status:", s.status);

    let s2 = initialApprovalState();
    s2 = transitionApproval(s2, { type: "SUBMIT", at: now, request: highRisk }, defaultApprovalPolicy);
    console.log("high risk after submit:", s2.status, s2.status === "awaiting_approval" ? s2.currentApproverGroup : "-");

    s2 = transitionApproval(
        s2,
        { type: "TICK", at: now + 4 * 60_000 },
        defaultApprovalPolicy,
    );
    console.log(
        "after first SLA breach:",
        s2.status,
        s2.status === "awaiting_approval" ? s2.currentApproverGroup : "-",
    );

    s2 = transitionApproval(
        s2,
        { type: "APPROVED", at: now + 4 * 60_000 + 10_000, by: "manager", note: "verified" },
        defaultApprovalPolicy,
    );
    console.log("after approval:", s2.status);

    const replayed = replayApproval(
        initialApprovalState(),
        [
            { type: "SUBMIT", at: now, request: highRisk },
            { type: "TICK", at: now + 4 * 60_000 },
            { type: "APPROVED", at: now + 4 * 60_000 + 10_000, by: "manager" },
        ],
        defaultApprovalPolicy,
    );
    console.log("replay status:", replayed.status);
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 * Q: Where should approval live, tool layer or state machine?
 * A: State machine. Tool layer only executes once state is approved.
 *    This prevents accidental side effects before approval.
 *
 * Q: How do you avoid duplicate approvals on retries?
 * A: Use requestId as idempotency key in durable storage.
 *
 * Q: What if approver approves after timeout/closure?
 * A: Treat as late event. Keep audit record but do not reopen terminal state.
 *
 * Q: Fail-open sounds risky. When is it acceptable?
 * A: Low-risk read-only actions where business impact is tiny and latency matters.
 *
 * Q: How does this connect to 06_control_state FSM?
 * A: Add an "awaiting_approval" control state before risky tool execution.
 *    Resume "waiting_for_tools" or "calling_llm" only after approval terminal.
 */
