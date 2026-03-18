import {
  serializeApplication,
  serializeEnterpriseNeed,
  serializeInvite,
  serializeKbFile,
  serializeUser,
} from "./serialize";

describe("serialize helpers", () => {
  it("serializes profile email visibility to the shared PUBLIC enum", () => {
    const result = serializeUser({
      id: "user-1",
      email: "expert@example.com",
      role: "EXPERT",
      profile: {
        displayName: "Expert",
        emailVisibility: "public",
        profileTags: [],
      },
    });

    expect(result.role).toBe("EXPERT");
    expect(result.privacySettings?.emailVisibility).toBe("PUBLIC");
  });

  it("serializes enterprise need status and visibility with canonical API enums", () => {
    const result = serializeEnterpriseNeed({
      id: "need-1",
      title: "Pilot AI copilot",
      background: "Need delivery support",
      reviewStatus: "pending_review",
      visibility: "experts_and_learners",
      enterpriseUserId: "enterprise-1",
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
      requiredRoles: ["EXPERT"],
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.contentDomain).toBe("ENTERPRISE_NEED");
    expect(result.visibility).toBe("EXPERTS_LEARNERS");
    expect(result.tags).toEqual(["EXPERT"]);
    expect(result.background).toBe("Need delivery support");
  });

  it("serializes invite, kb file, and application enums without compatibility fallbacks", () => {
    const invite = serializeInvite({
      id: "invite-1",
      code: "AIWORLD-LEARNER-2026",
      status: "unused",
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
    });
    const kbFile = serializeKbFile({
      id: "file-1",
      ownerUserId: "user-1",
      fileName: "guide.pdf",
      sizeBytes: 128,
      mimeType: "application/pdf",
      status: "embedded",
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
    });
    const application = serializeApplication({
      id: "app-1",
      applicantUserId: "user-1",
      targetType: "research_project",
      targetId: "project-1",
      status: "accepted",
      createdAt: new Date("2026-03-08T00:00:00.000Z"),
    });

    expect(invite.status).toBe("UNUSED");
    expect(kbFile.status).toBe("PROCESSING");
    expect(application.targetType).toBe("RESEARCH_PROJECT");
    expect(application.status).toBe("ACCEPTED");
  });
});
