import React, { useState } from "react";
import { cloudAvailable } from "./cloud-transport.mjs";
export function CloudPanel({
  connected,
  secret,
  status,
  busy,
  onCreate,
  onJoin,
  onRefresh,
  onDisconnect,
}) {
  const [key, setKey] = useState(""),
    [show, setShow] = useState(false),
    [ack, setAck] = useState(false);
  return (
    <section className="settings-card" aria-label="סנכרון בין מכשירים">
      <h2>אותו ארנק בכל מכשיר</h2>
      <p role="status">{status}</p>
      {!cloudAvailable && <p>שירות הסנכרון עדיין בהכנה.</p>}
      {connected ? (
        <>
          <p>
            מחובר לארנק בענן. שינויים נשמרים עם חיבור לאינטרנט. העדכונים נבדקים
            גם כשחוזרים לאפליקציה.
          </p>
          <button className="secondary" disabled={busy} onClick={onRefresh}>
            רענון מהענן
          </button>
          <button className="secondary" onClick={() => setShow(!show)}>
            {show ? "הסתרת מפתח" : "הצגת מפתח לחיבור מכשיר נוסף"}
          </button>
          {show && (
            <label className="field">
              <span>מפתח ארנק פרטי — שמרו במקום בטוח</span>
              <input
                aria-label="מפתח הארנק שלך"
                readOnly
                value={secret}
                dir="ltr"
                onFocus={(e) => e.target.select()}
              />
              <small>
                מי שמחזיק במפתח יכול לפתוח ולשנות את הארנק. אין שחזור דרך מייל
                אם המפתח אבד.
              </small>
            </label>
          )}
          <button className="secondary" disabled={busy} onClick={onDisconnect}>
            ניתוק המכשיר ושמירת עותק מקומי
          </button>
        </>
      ) : (
        <>
          <p>
            ללא מייל. יוצרים ארנק מוצפן פעם אחת, ובמכשיר השני מזינים את אותו
            מפתח. השוברים הקיימים במכשיר יועלו בעת יצירה.
          </p>
          <button
            className="primary"
            disabled={busy || !cloudAvailable}
            onClick={onCreate}
          >
            יצירת ארנק מסונכרן מהשוברים שלי
          </button>
          <label className="field">
            <span>מפתח מארנק קיים</span>
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              dir="ltr"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            בפתיחת ארנק קיים, הארנק שבמכשיר יוחלף. הורדתי גיבוי אם נדרש.
          </label>
          <button
            className="secondary"
            disabled={busy || !cloudAvailable || !ack || !key.trim()}
            onClick={() => onJoin(key.trim())}
          >
            חיבור לארנק קיים
          </button>
        </>
      )}
      <p className="muted">
        תוכן הארנק מוצפן לפני השליחה. הסנכרון כולל שוברים, תמונות, יתרות וסניפים
        ידניים. עריכה מקבילה לא תדרוס גרסה חדשה יותר.
      </p>
    </section>
  );
}
