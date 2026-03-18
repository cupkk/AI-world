import {
  Building2,
  FileText,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import type {
  ApplicationTargetType,
  Content,
  ContentDetailSection,
  ContentDomain,
} from "../types";

type Translate = (key: string) => string;

export type ContentDomainMeta = {
  label: string;
  Icon: LucideIcon;
  className: string;
};

export type ContentPreviewSection = {
  key: string;
  label: string;
  value: string;
};

type ContentSectionDefinition = {
  key: string;
  labelKey: string;
  detailKind: ContentDetailSection["kind"];
  value: string;
};

function buildContentSectionDefinitions(
  content: Pick<
    Content,
    "contentDomain" | "description" | "background" | "goal" | "deliverables" | "neededSupport"
  >,
): ContentSectionDefinition[] {
  const sections: ContentSectionDefinition[] =
    content.contentDomain === "ENTERPRISE_NEED"
      ? [
          {
            key: "background",
            labelKey: "hub_detail.section_background",
            detailKind: "BACKGROUND",
            value: content.background ?? "",
          },
          {
            key: "goal",
            labelKey: "hub_detail.section_goal",
            detailKind: "GOAL",
            value: content.goal ?? "",
          },
          {
            key: "deliverables",
            labelKey: "hub_detail.section_deliverables",
            detailKind: "DELIVERABLES",
            value: content.deliverables ?? content.description ?? "",
          },
        ]
      : content.contentDomain === "RESEARCH_PROJECT"
        ? [
            {
              key: "summary",
              labelKey: "hub_detail.section_summary",
              detailKind: "SUMMARY",
              value: content.description ?? "",
            },
            {
              key: "neededSupport",
              labelKey: "hub_detail.section_needed_support",
              detailKind: "NEEDED_SUPPORT",
              value: content.neededSupport ?? "",
            },
          ]
        : [
            {
              key: "summary",
              labelKey: "hub_detail.section_summary",
              detailKind: "SUMMARY",
              value: content.description ?? "",
            },
          ];

  return sections
    .map((section) => ({
      ...section,
      value: section.value.trim(),
    }))
    .filter((section) => section.value.length > 0);
}

export function getContentDomainMeta(
  contentDomain: ContentDomain,
  t: Translate,
): ContentDomainMeta {
  switch (contentDomain) {
    case "ENTERPRISE_NEED":
      return {
        label: t("profile.domain_enterprise_need"),
        Icon: Building2,
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };
    case "RESEARCH_PROJECT":
      return {
        label: t("profile.domain_research_project"),
        Icon: FlaskConical,
        className: "border-sky-500/20 bg-sky-500/10 text-sky-300",
      };
    case "HUB_ITEM":
    default:
      return {
        label: t("profile.domain_hub_item"),
        Icon: FileText,
        className: "border-violet-500/20 bg-violet-500/10 text-violet-300",
      };
  }
}

export function getContentDetailHref(
  content: Pick<Content, "id" | "type">,
): string {
  return `/hub/${content.type.toLowerCase()}/${content.id}`;
}

export function getContentPreviewSections(
  content: Pick<
    Content,
    "contentDomain" | "description" | "background" | "goal" | "deliverables" | "neededSupport"
  >,
  t: Translate,
): ContentPreviewSection[] {
  return buildContentSectionDefinitions(content).map((section) => ({
    key: section.key,
    label: t(section.labelKey),
    value: section.value,
  }));
}

export function getContentDetailSections(
  content: Pick<
    Content,
    "contentDomain" | "description" | "background" | "goal" | "deliverables" | "neededSupport"
  >,
): ContentDetailSection[] {
  return buildContentSectionDefinitions(content).map((section) => ({
    kind: section.detailKind,
    content: section.value,
  }));
}

export function getOwnerDashboardContentHref(
  content: Pick<Content, "id">,
): string {
  return `/publish/${content.id}`;
}

export function getApplicationTargetTypeForContent(
  content: Pick<Content, "contentDomain">,
): ApplicationTargetType {
  switch (content.contentDomain) {
    case "ENTERPRISE_NEED":
      return "ENTERPRISE_NEED";
    case "RESEARCH_PROJECT":
      return "RESEARCH_PROJECT";
    case "HUB_ITEM":
    default:
      return "PROJECT";
  }
}
