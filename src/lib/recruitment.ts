const RECRUITMENT_KEYWORDS = [
  "hiring",
  "recruit",
  "recruitment",
  "job",
  "position",
  "salary",
  "resume",
  "cv",
  "apply now",
  "join our team",
  "薪资",
  "简历",
  "入职",
  "五险一金",
  "招聘",
  "应聘",
  "岗位",
  "猎头",
  "年薪",
  "offer",
];

export function detectRecruitmentKeywords(input: string): string[] {
  const normalized = input.toLowerCase();
  return RECRUITMENT_KEYWORDS.filter((keyword) => normalized.includes(keyword));
}
