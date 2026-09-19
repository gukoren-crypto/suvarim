import React from "react";
import { getProduct, products } from "./catalog.mjs";

export function ProductSelector({ fields, onChange, onImport }) {
  return (
    <section className="product-info" aria-label="זיהוי סוג השובר">
      <label className="field">
        <span>סוג השובר והרשימה המתאימה לו</span>
        <select
          value={fields.voucherProductId || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">לא זוהה סוג מדויק / שובר אחר</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <ProductInfo voucher={fields} />
      {getProduct(fields.voucherProductId) && (
        <>
          <p>
            בדקו שזה סוג השובר שמופיע בכרטיס שלכם. הוספת הרשימה אינה מאמתת יתרה,
            תוקף אישי או כל סניף בנפרד.
          </p>
          <button type="button" className="secondary full" onClick={onImport}>
            אישור סוג השובר והוספת{" "}
            {getProduct(
              fields.voucherProductId,
            ).merchants.length.toLocaleString("he-IL")}{" "}
            עסקים
          </button>
          {fields.storesSourceProductId === fields.voucherProductId && (
            <p role="status">
              הרשימה צורפה. אפשר לערוך את החנויות לפני השמירה.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function ProductInfo({ voucher }) {
  const product = getProduct(voucher.voucherProductId);
  return (
    <>
      {voucher.paymentProvider && (
        <p>
          <b>פלטפורמת התשלום: {voucher.paymentProvider}.</b> הפלטפורמה לבדה אינה
          מזהה את רשימת החנויות של הכרטיס.
        </p>
      )}
      {!product && /dream\s?card|דרים\s?קארד/i.test(voucher.issuer || "") && (
        <p>
          זוהה DREAM CARD, אבל קיימים מסלולים שונים: ALL, SPORT, BABY וגם גרסאות
          פרקסל עם ובלי מבצעים. בחרו רק את המסלול שמופיע בכרטיס או בתנאים שצורפו
          אליו.
        </p>
      )}
      {!product && /swish/i.test(voucher.issuer || "") && (
        <p>
          זוהה Swish. לא ניתן להסיק שזה Premium: גם Plus וסוגים נוספים משתמשים
          במותג הזה.
        </p>
      )}
      {product && (
        <div className="public-product">
          <b>{product.name}</b>
          <ul>
            {product.terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
          <a href={product.sourceUrl} target="_blank" rel="noreferrer">
            רשימת עסקים ותנאים באתר הרשמי ↗
          </a>
          <small>
            מידע ציבורי שנבדק ב־
            {new Date(product.checkedAt + "T12:00:00").toLocaleDateString(
              "he-IL",
            )}
            . אינו מתעדכן אוטומטית.
          </small>
        </div>
      )}
    </>
  );
}
