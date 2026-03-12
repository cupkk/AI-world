import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EmailVisibility } from "../types";
import { normalizeEmailVisibilityValue } from "./contracts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROLE_LABELS: Record<string, string> = {
  EXPERT: "AI Scientist",
  LEARNER: "AI Talent",
  ENTERPRISE_LEADER: "Enterprise Leader",
  ADMIN: "Admin",
};

/** Format a role enum value to a human-readable label */
export function formatRole(role: string): string {
  return ROLE_LABELS[role] || role.replace(/_/g, " ");
}

/** Format a status enum value (e.g. PENDING_REVIEW → Pending Review) */
export function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\B\w+/g, (w) => w.toLowerCase());
}

export function normalizeEmailVisibility(value: unknown): EmailVisibility {
  return normalizeEmailVisibilityValue(value);
}
