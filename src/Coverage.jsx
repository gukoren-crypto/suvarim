import React, { useState } from "react";
import { products } from "./catalog.mjs";
import { coverageFor } from "./coverage.mjs";
const labels = {
  complete: "הושלם מול המקור",
  partial: "מיפוי חלקי",
  blocked: "נבדק — דרושה השלמה",
  pending: "טרם נבדק",
};
export function Coverage() {
  const [productId, setProductId] = useState("dreamcard-multipass-include"),
    [status, setStatus] = useState("all");
  const rows = coverageFor(productId),
    complete = rows.filter((r) => r.status === "complete").length;
  return (
    <section
      className="settings-card coverage-panel"
      aria-label="מעקב מיפוי חנויות"
    >
      <h2>מעקב מיפוי חנויות</h2>
      <label className="field">
        <span>רשימת עסקים למעקב</span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        <strong>
          {complete} מתוך {rows.length} רשתות ובתי עסק הושלמו
        </strong>{" "}
        · {rows.length - complete} להשלמה
      </p>
      <progress
        value={complete}
        max={rows.length || 1}
        aria-label="רשתות שהושלמו"
      />
      <p>
        {rows.filter((r) => r.mapped > 0).length} עם מיקומים ·{" "}
        {rows.reduce((n, r) => n + r.mapped, 0)} סניפים במפה ·{" "}
        {rows.filter((r) => r.status === "pending").length} טרם נבדקו
      </p>
      <p className="muted">
        זהו מעקב אחר רשימת העסקים הציבורית של סוג השובר. עסקים מקוונים בלבד אינם
        נספרים. מספר הסניפים שנותרו מוצג רק כשגודל רשימת המקור ידוע; המיפוי אינו
        אישור לתנאי מימוש בסניף.
      </p>
      <label className="field">
        <span>מצב המיפוי</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">כל המצבים</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="coverage-list">
        {rows
          .filter((r) => status === "all" || r.status === status)
          .map((r) => (
            <article className="coverage-row" key={r.name}>
              <h3>{r.name}</h3>
              <p>
                {labels[r.status]} · {r.mapped} סניפים במפה
              </p>
              <small>
                {r.remaining === null
                  ? "מספר הסניפים שנותרו עדיין לא ידוע"
                  : `${r.examined} רשומות ברשימה שנבדקה · ${r.remaining} להשלמה או בירור`}
              </small>
              {r.note && /[א-ת]/.test(r.note) && (
                <p className="muted">{r.note}</p>
              )}
              {r.sourceUrl && (
                <p>
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                    מקור רשמי
                  </a>{" "}
                  · נבדק {r.checkedAt || "בתאריך לא ידוע"}
                </p>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
