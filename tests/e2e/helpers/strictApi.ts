import type { Page } from "@playwright/test";

type StrictApiOptions = {
  allowPassthrough?: Array<string | RegExp>;
};

function matchesAllowedRequest(
  url: string,
  allowPassthrough: Array<string | RegExp>,
) {
  return allowPassthrough.some((entry) =>
    typeof entry === "string" ? url.includes(entry) : entry.test(url),
  );
}

export async function installStrictApiMocking(
  page: Page,
  options: StrictApiOptions = {},
) {
  const allowPassthrough = options.allowPassthrough ?? [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = request.url();

    if (matchesAllowedRequest(url, allowPassthrough)) {
      await route.fallback();
      return;
    }

    const message = `Unexpected API request in mocked E2E: ${request.method()} ${url}`;
    await route.fulfill({
      status: 599,
      contentType: "application/json",
      body: JSON.stringify({ code: 599, message }),
    });
    throw new Error(message);
  });
}
