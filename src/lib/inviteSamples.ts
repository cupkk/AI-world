import type { PublicInviteSample, Role } from "../types";

export const DEFAULT_PUBLIC_INVITE_SAMPLES: PublicInviteSample[] = [
  { code: "AIWORLD-EXPERT-2026", role: "EXPERT" },
  { code: "AIWORLD-LEARNER-2026", role: "LEARNER" },
  { code: "AIWORLD-ENTERPRISE-2026", role: "ENTERPRISE_LEADER" },
];

export const INVITE_SAMPLE_DESCRIPTION_KEYS: Partial<Record<Role, string>> = {
  EXPERT: "invite_page.sample_expert_desc",
  LEARNER: "invite_page.sample_learner_desc",
  ENTERPRISE_LEADER: "invite_page.sample_enterprise_desc",
};

export function getInviteSampleTestId(role: Role) {
  return role.toLowerCase();
}
