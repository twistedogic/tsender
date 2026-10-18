/**
 * Event-emitter pattern for inline form validation, matching
 * scenario-loading's failure modes.
 */

import type { Event } from "@/scenario/types";

export interface FieldIssue {
  field: string;
  message: string;
}

export function validateEvent(e: Event): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!Number.isInteger(e.when) || e.when < 0) {
    issues.push({ field: "when", message: "month index must be a non-negative integer" });
  }
  switch (e.type) {
    case "pension":
      if (!e.pension) issues.push({ field: "pension", message: "pension body is required" });
      break;
    case "refinance":
      if (!e.id) issues.push({ field: "id", message: "refinance requires an id matching a mortgage" });
      break;
    case "end":
      if (!e.id) issues.push({ field: "id", message: "end requires an id" });
      break;
    case "buy_home":
    case "buy_to_let":
    case "investment": {
      const body = e.type === "buy_home" ? e.home : e.type === "buy_to_let" ? e.to_let : e.fund;
      if (!body) issues.push({ field: e.type, message: "body required" });
      break;
    }
    default:
      break;
  }
  return issues;
}
