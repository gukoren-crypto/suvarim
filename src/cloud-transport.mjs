import config from "./cloud-config.json" with { type: "json" };
export const cloudAvailable = Boolean(config.endpoint);
export function cloudTransport(endpoint = config.endpoint) {
  if (!endpoint) throw new Error("שירות הסנכרון עדיין לא הוגדר.");
  async function call(action, params) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        "לא התקבל אישור מהענן. התחברו לרשת ורעננו לפני ניסיון חוזר.",
      );
    }
    if (response.status === 409) return { conflict: true };
    if (response.status === 403 || response.status === 401)
      throw new Error("הארנק לא נמצא או שמפתח הארנק אינו נכון.");
    if (response.status === 413)
      throw new Error("הארנק גדול מדי לסנכרון. הקטינו את התמונות ונסו שוב.");
    if (response.status === 429)
      throw new Error("בוצעו יותר מדי בקשות. המתינו מעט ונסו שוב.");
    if (!response.ok)
      throw new Error("שירות הסנכרון אינו זמין כרגע. השינוי לא אושר.");
    return response.json();
  }
  return Object.fromEntries(
    ["create", "read", "write"].map((action) => [
      action,
      (params) => call(action, params),
    ]),
  );
}
