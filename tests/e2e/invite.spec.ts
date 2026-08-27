import { expect, test } from "@playwright/test";

test("enabled bundle stops at the invite boundary without public Supabase configuration",async({page})=>{
  test.skip(process.env.TEST_INVITE_MODE!=="true","invite-mode build only");
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Dress from what you own."})).toBeVisible();
  await expect(page.getByRole("button",{name:"Email me a private link"})).toBeVisible();
  await expect(page.getByText("Starter Closet",{exact:true})).toHaveCount(0);
});
