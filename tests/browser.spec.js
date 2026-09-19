import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.route("**/__local/wallet-import", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
});
test("a balance-only voucher can be saved without inventing its original amount", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page
    .getByLabel("ההודעה שקיבלת")
    .fill("Swish Premium\nיתרה בכרטיס: ₪97.35\nבתוקף עד: 26.03.2031");
  await page.getByRole("button", { name: "זיהוי פרטים מהטקסט" }).click();
  await expect(page.getByLabel("סכום מקורי")).toHaveValue("");
  await expect(page.getByLabel("יתרה נוכחית")).toHaveValue("97.35");
  await page.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.locator(".voucher-card").click();
  await expect(page.locator(".detail-ticket")).toContainText(
    "הסכום המקורי לא ידוע",
  );
  await expect(page.locator(".detail-ticket>strong")).toContainText("97.35");
  await page.getByRole("button", { name: "עריכה", exact: true }).click();
  await expect(page.getByLabel("סכום מקורי")).toHaveValue("");
});

test("Swish catalog is explicitly confirmed, persists and distinguishes online merchants", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page
    .getByLabel("ההודעה שקיבלת")
    .fill("Swish Premium\nשווי 250 ₪\nקוד: FAKE-9876\nתוקף: 31/12/2029");
  await page.getByRole("button", { name: "זיהוי פרטים מהטקסט" }).click();
  await expect(page.getByLabel("סוג השובר והרשימה המתאימה לו")).toHaveValue(
    "swish-premium",
  );
  await expect(
    page.getByLabel("חנויות למימוש, מופרדות בפסיקים", { exact: false }),
  ).toHaveValue("");
  await page.getByRole("button", { name: /אישור סוג השובר והוספת/ }).click();
  await expect(
    page.getByLabel("חנויות למימוש, מופרדות בפסיקים", { exact: false }),
  ).toContainText("סופר פארם");
  await page
    .getByLabel("יתרה נוכחית")
    .fill(await page.getByLabel("סכום מקורי").inputValue());
  await page.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "איפה מממשים", exact: true }).click();
  await expect(page.locator(".store-card")).toHaveCount(36);
  await page
    .getByLabel("תחום החנות", { exact: true })
    .selectOption("רשתות שיווק מזון ופארמה");
  await expect(
    page.getByRole("heading", { name: "סופר פארם", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("תחום החנות", { exact: true })
    .selectOption("רכישה אונליין");
  await expect(page.locator(".store-card a").first()).toContainText(
    "הוראות מימוש אונליין",
  );
  await expect(
    page.locator('.store-card a[href*="google.com/maps"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "על המפה", exact: true }).click();
  await page.getByLabel("תחום החנות", { exact: true }).selectOption("רכישה אונליין");
  await expect(page.locator(".branch-card")).toHaveCount(0);
});

test("DREAMCARD variant change removes previous catalog and preserves cashier directions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page
    .getByLabel("ההודעה שקיבלת")
    .fill(
      "DREAMCARD\nקוד מולטיפאס: 9000000000001\nשווי 200 ₪\nהנחיות לקופאי/ת: תשלום אחר > מולטיפאס",
    );
  await page.getByRole("button", { name: "זיהוי פרטים מהטקסט" }).click();
  await expect(page.getByLabel("סוג השובר והרשימה המתאימה לו")).toHaveValue("");
  await page
    .getByLabel("סוג השובר והרשימה המתאימה לו")
    .selectOption("dreamcard-paybox-sport");
  await page.getByRole("button", { name: /אישור סוג השובר והוספת/ }).click();
  await expect(
    page.getByLabel("חנויות למימוש, מופרדות בפסיקים", { exact: false }),
  ).toContainText("NIKE");
  await page
    .getByLabel("סוג השובר והרשימה המתאימה לו")
    .selectOption("dreamcard-paybox-baby");
  await expect(
    page.getByLabel("חנויות למימוש, מופרדות בפסיקים", { exact: false }),
  ).toHaveValue("");
  await page.getByRole("button", { name: /אישור סוג השובר והוספת/ }).click();
  await page
    .getByLabel("יתרה נוכחית")
    .fill(await page.getByLabel("סכום מקורי").inputValue());
  await page.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".voucher-card").click();
  await expect(page.locator(".detail .notes")).toContainText(
    "תשלום אחר > מולטיפאס",
  );
  await expect(page.locator(".detail-stores")).toContainText("שילב");
  await expect(page.locator(".detail-stores")).not.toContainText("NIKE");
});

test("personal wallet persists and supports partial redemption and store lookup", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("המתנה הראשונה שלך מתחילה כאן")).toBeVisible();
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page
    .getByLabel("ההודעה שקיבלת")
    .fill(
      "BUYME שווי 250 ₪\nקוד: TEST-1234\nתוקף: 31/12/2029\nחנויות: קפה בדיקה, חנות בדיקה",
    );
  await page.getByRole("button", { name: "זיהוי פרטים מהטקסט" }).click();
  await expect(page.getByLabel("סכום מקורי")).toHaveValue("250");
  await expect(page.getByLabel("קוד מימוש", { exact: true })).toHaveValue(
    "TEST-1234",
  );
  await page.getByLabel("שם השובר *", { exact: true }).fill("מתנת בדיקה");
  await page
    .getByLabel("יתרה נוכחית")
    .fill(await page.getByLabel("סכום מקורי").inputValue());
  await page.getByRole("button", { name: "שמירת השובר בארנק" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.locator(".voucher-card").filter({ hasText: "מתנת בדיקה" }).click();
  await page.getByLabel("מימשת חלק מהשובר? כמה שילמת?").fill("75.50");
  await page.getByRole("button", { name: "עדכון היתרה" }).click();
  await expect(page.locator(".detail-ticket>strong")).toContainText("174.50");
  await page.getByRole("button", { name: "סגירה", exact: true }).click();
  await page.getByRole("button", { name: "איפה מממשים", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "קפה בדיקה", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "הוספת סניף", exact: true }).click();
  await page.getByLabel("עיר *", { exact: true }).fill("תל אביב");
  await page.getByLabel("כתובת *", { exact: true }).fill("רחוב בדיקה 1");
  await page.getByLabel("קו רוחב").fill("32.075");
  await page.getByLabel("קו אורך").fill("34.775");
  await page.getByRole("button", { name: "שמירת הסניף" }).click();
  await page.getByRole("button", { name: "על המפה", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(1);
  await expect(page.locator(".branch-card")).toContainText("רחוב בדיקה 1");
  expect(errors).toEqual([]);
});

test("demo is isolated, responsive, and keyboard accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "רק להציץ? פתיחת ארנק לדוגמה" })
    .click();
  await expect(page.locator(".voucher-card")).toHaveCount(4);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) => ["serious", "critical"].includes(v.impact)),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".voucher-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".voucher-card").first()).toBeFocused();
  await page
    .getByRole("button", { name: "לארנק האישי שלי", exact: true })
    .click();
  await expect(page.locator(".voucher-card")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("restore requires confirmation and rejects invalid data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "הארנק והמכשיר", exact: true })
    .click();
  const upload = page.locator("input[type=file]");
  await upload.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"vouchers":[],"branches":[{}]}'),
  });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("פרטי סניף אינם תקינים");
  const backup = {
    version: 1,
    vouchers: [
      {
        id: "restored",
        name: "שובר משוחזר",
        issuer: "בדיקה",
        amount: 100,
        balance: 80,
        expiry: "2029-12-31",
        stores: ["חנות"],
        history: [],
      },
    ],
    branches: [],
  };
  await upload.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("dialog")).toContainText("1 שוברים");
  await page.getByRole("button", { name: "החלפה ושחזור" }).click();
  await page
    .getByRole("button", { name: "הארנק שלי", exact: false })
    .first()
    .click();
  await expect(page.locator(".voucher-card")).toContainText("שובר משוחזר");
});

test("link input clearly states that the page content is not fetched", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "הוספת שובר", exact: true }).click();
  await page.getByRole("button", { name: "קישור", exact: true }).click();
  await page.locator("textarea").first().fill("https://buyme.co.il/gift/test");
  await page.getByRole("button", { name: "שמירת קישור וזיהוי המנפיק" }).click();
  await expect(page.locator(".info-box")).toContainText("לא נקרא תוכן האתר");
  await expect(page.getByLabel("מנפיק", { exact: true })).toHaveValue("BUYME");
  await expect(
    page.getByLabel("קישור לשובר", { exact: true }).last(),
  ).toHaveValue("https://buyme.co.il/gift/test");
});

test("voucher detail opens a scoped map and reuses shared locations for another voucher", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { set } = await import("/node_modules/.vite/deps/idb-keyval.js");
    const base = {
      amount: 100,
      balance: 100,
      expiry: "",
      category: "כללי",
      history: [],
    };
    await set("suvarim-wallet-v1", {
      vouchers: [
        { ...base, id: "a", name: "שובר ללין", stores: ["LALINE"] },
        { ...base, id: "b", name: "שובר אחר", stores: ["עסק בדיקה"] },
        { ...base, id: "c", name: "שובר חדש לאותה רשת", stores: ["ללין"] },
      ],
      branches: [
        {
          id: "manual",
          store: "עסק בדיקה",
          city: "תל אביב",
          address: "בדיקה",
          lat: 32.08,
          lng: 34.78,
        },
      ],
    });
  });
  await page.reload();
  await page.locator(".voucher-card").filter({ hasText: "שובר ללין" }).click();
  await page
    .getByRole("button", { name: "הצג חנויות על המפה", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("חנויות לפי שובר", { exact: true })).toHaveValue(
    "a",
  );
  const count = await page.locator(".branch-card").count();
  expect(count).toBeGreaterThan(0);
  await expect(
    page.locator(".branch-card").filter({ hasText: "עסק בדיקה" }),
  ).toHaveCount(0);
  await page.getByLabel("חנויות לפי שובר", { exact: true }).selectOption("b");
  await expect(page.locator(".branch-card")).toHaveCount(1);
  await expect(page.locator(".branch-card")).toContainText("עסק בדיקה");
  await page.getByLabel("חנויות לפי שובר", { exact: true }).selectOption("c");
  await expect(page.locator(".branch-card")).toHaveCount(count);
  await expect(page.locator(".branch-card").first()).toContainText(
    "שובר חדש לאותה רשת",
  );
  await expect(page.locator(".branch-card").first()).not.toContainText(
    "שובר ללין",
  );
  await page
    .getByRole("button", { name: "הצגת כל השוברים", exact: true })
    .click();
  await expect(page.locator(".branch-card")).toHaveCount(count + 1);
});

test('coverage dashboard distinguishes incomplete source totals and works on mobile', async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('navigation',{name:'ניווט בנייד'}).getByRole('button',{name:'הגדרות'}).click();
 const panel=page.getByRole('region',{name:'מעקב מיפוי חנויות'});
 await expect(panel).toContainText('מתוך 20');
 await expect(panel.locator('.coverage-row')).toHaveCount(20);
 await expect(panel.locator('.coverage-row').filter({has:page.getByRole('heading',{name:'FOX',exact:true})})).toContainText('59 להשלמה');
 await expect(panel.locator('.coverage-row').filter({has:page.getByRole('heading',{name:'LALINE',exact:true})})).toContainText('עדיין לא ידוע');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
