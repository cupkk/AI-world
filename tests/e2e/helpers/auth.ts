import type { Page } from "@playwright/test";

type Role = "LEARNER" | "EXPERT" | "ENTERPRISE_LEADER" | "ADMIN";

export type TestUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  onboardingDone?: boolean;
};

export const USERS = {
  learner: {
    id: "u-learner-1",
    name: "Learner One",
    email: "learner@example.com",
    role: "LEARNER",
    avatar: "",
  },
  admin: {
    id: "u-admin-1",
    name: "Admin One",
    email: "admin@example.com",
    role: "ADMIN",
    avatar: "",
  },
  expert: {
    id: "u-expert-1",
    name: "Expert One",
    email: "expert@example.com",
    role: "EXPERT",
    avatar: "",
  },
  enterprise: {
    id: "u-enterprise-1",
    name: "Enterprise One",
    email: "enterprise@example.com",
    role: "ENTERPRISE_LEADER",
    avatar: "",
  },
} as const;

export async function seedAuth(page: Page, user: TestUser): Promise<void> {
  await page.addInitScript((seedUser) => {
    const authState = {
      state: {
        user: {
          id: seedUser.id,
          name: seedUser.name,
          email: seedUser.email,
          role: seedUser.role,
          avatar: seedUser.avatar || "",
          onboardingDone: seedUser.onboardingDone ?? true,
        },
        isAuthenticated: true,
        verifiedInviteCode: null,
        sessionChecked: true,
      },
      version: 0,
    };

    const settingsState = {
      state: {
        theme: "dark",
        language: "en",
      },
      version: 0,
    };

    localStorage.setItem("ai-world-auth", JSON.stringify(authState));
    localStorage.setItem("ai-world-settings", JSON.stringify(settingsState));
  }, user);
}
