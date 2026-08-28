import { expect, test } from "@playwright/test";
import path from "node:path";

const demoImage = path.join(
  process.cwd(),
  "public/assets/onboarding/generic-reference.webp",
);

test("high-value demo screens remain one clear action away", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today’s look" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Closet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Add one item/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Add one item/i }).click();
  await expect(
    page.getByRole("heading", { name: /Start with a clear photo/i }),
  ).toBeVisible();
});

test("shopping CTA opens a screenshot-first decision flow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Should I buy this/i }).click();
  await expect(
    page.getByRole("heading", { name: /Should I buy this/i }),
  ).toBeVisible();
  await expect(page.getByText("Buy, Save, or Skip")).toBeVisible();
});

test("demo Scan and shopping decisions complete without private API failures", async ({
  page,
}) => {
  const authFailures: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 401 && response.url().includes("/api/"))
      authFailures.push(response.url());
  });
  await page.goto("/closet");
  await page.getByRole("button", { name: /Scan photos/i }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles(demoImage);
  await expect(
    page.getByRole("heading", { name: /pilot found 1 piece/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Save 1 to my closet/i }).click();
  await expect(
    page.getByRole("heading", { name: /pilot learned/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: /Should I buy this/i }).click();
  await page.locator('input[type="file"]').setInputFiles(demoImage);
  await expect(page.getByRole("heading", { name: "BUY" })).toBeVisible();
  await expect(page.getByText(/three outfits already/i)).toBeVisible();
  expect(authFailures).toEqual([]);
});

test("bottom sheets trap focus, close with Escape, and restore the trigger", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Should I buy this/i });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Shopping decision" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Shopping decision" }),
  ).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("History never opens a blank step-five result", async ({ page }) => {
  await page.goto("/history");
  await page.getByRole("button", { name: "Tried On" }).click();
  const open = page.getByRole("button", { name: /Open preview/i });
  if (await open.count()) {
    await open.click();
    await expect(
      page.getByRole("heading", { name: "Review every piece", exact: true }),
    ).toBeVisible();
  }
});

test("Try On opens on the outfit and can create a full 360 preview", async ({
  page,
}) => {
  await page.goto("/try-on");
  await expect(
    page.getByRole("heading", { name: "Make the look yours" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview this outfit in 360°" })
    .click();
  await expect(page.getByRole("button", { name: "360° spin" })).toBeVisible();
  const rotation = page.getByRole("slider", { name: "Outfit rotation angle" });
  await expect(rotation).toBeVisible();
  await rotation.fill("180");
  await expect(rotation).toHaveValue("180");
  await expect(page.getByText("Verified selection")).toBeVisible();
  await page.getByRole("button", { name: "Front", exact: true }).last().click();
  await expect(rotation).toHaveValue("0");
  await page.getByRole("button", { name: "Change a piece" }).click();
  await page
    .getByRole("button", { name: "Preview this outfit in 360°" })
    .click();
  await expect(page.getByRole("slider", { name: "Outfit rotation angle" })).toBeVisible();
});

test("Thursday story completes from decision through learning", async ({
  page,
}) => {
  const authFailures: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 401 && response.url().includes("/api/"))
      authFailures.push(response.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Best match" })).toBeVisible();
  await page.getByRole("button", { name: /Try it on.*360/i }).first().click();
  await expect(page.getByRole("button", { name: "360° spin" })).toBeVisible();
  await expect(page.getByText(/not a simulated body view/i)).toBeVisible();
  await page.getByRole("button", { name: "Wear today" }).click();
  await expect(page.getByText(/Added to Worn/i)).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add feedback" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add feedback" }).first().click();
  await page.getByRole("button", { name: "Loved it" }).click();
  await page.getByRole("button", { name: "Just right" }).click();
  await page.getByRole("button", { name: "Save feedback" }).click();
  await expect(page.getByText("Feedback saved")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Loved it.*change/i }).first(),
  ).toBeVisible();
  expect(authFailures).toEqual([]);
});

test("guided setup completes with credential-free fallbacks", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Dress for the day ahead" })).toBeVisible();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Temperature °F").fill("67");
  await page.getByLabel("Rain chance %").fill("25");
  await page.getByRole("button", { name: "Check weather" }).click();
  await expect(page.getByText("Weather is ready.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Or describe the day").fill("Office, presentation, then dinner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Optional reference photos" })).toBeVisible();
  await page.getByRole("button", { name: "Continue or skip" }).click();
  await page.getByRole("button", { name: "Start empty Add only your real garments" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your daily decision system is ready" })).toBeVisible();
  await expect(page.getByText("Empty personal closet")).toBeVisible();
});
