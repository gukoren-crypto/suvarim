import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { get, set } from "idb-keyval";
import {
  Ticket,
  Wallet,
  MapPin,
  Store,
  Plus,
  Search,
  ArrowUpLeft,
  X,
  Link as LinkIcon,
  ImagePlus,
  FileText,
  Check,
  Clock,
  ChevronLeft,
  SlidersHorizontal,
  Download,
  Upload,
  Navigation,
  Copy,
  Trash2,
  Pencil,
  Gift,
  ShieldCheck,
  Smartphone,
  Settings,
  LoaderCircle,
} from "lucide-react";
import {
  categories,
  money,
  daysLeft,
  statusOf,
  extractVoucher,
  redeem,
  safeUrl,
  validateBackup,
  distanceKm,
} from "./domain.mjs";
import { demoData } from "./demo.mjs";
import { ProductInfo, ProductSelector } from "./ProductInfo.jsx";
import {
  applyCatalog,
  clearCatalogAssociation,
  getProduct,
  merchantIndex,
} from "./catalog.mjs";
import "./style.css";
import { CloudPanel } from "./CloudPanel.jsx";
import { openCloudWallet } from "./cloud-wallet.mjs";
import { newWalletKey } from "./cloud-crypto.mjs";
import { cloudTransport } from "./cloud-transport.mjs";
import { Coverage } from "./Coverage.jsx";
import { sameStore, branchesForStores } from "./branches.mjs";

const KEY = "suvarim-wallet-v1";
const empty = { vouchers: [], branches: [] };
const dateLabel = (d) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("he-IL") : "ללא תוקף שהוזן";
function App() {
  const [data, setData] = useState(empty),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  const [demo, setDemo] = useState(false),
    [demoState, setDemoState] = useState(() => demoData());
  const [mapVoucherId, setMapVoucherId] = useState("");
  const [page, setPage] = useState("wallet"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(categories[0]),
    [status, setStatus] = useState("active"),
    [sort, setSort] = useState("expiry");
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [location, setLocation] = useState(null),
    [install, setInstall] = useState(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [page, mapVoucherId]);
  const modalRef = useRef(modal);
  modalRef.current = modal;
  const cloud = useRef(null),
    cloudBusy = useRef(false);
  const [cloudState, setCloudState] = useState(null),
    [cloudStatus, setCloudStatus] = useState("השוברים נשמרים במכשיר הזה בלבד."),
    [syncBusy, setSyncBusy] = useState(false);
  const renderedRevision = cloudState?.revision;
  const restore = useRef(null);
  const wallet = demo ? demoState : data;
  useEffect(() => {
    get(KEY)
      .then(async (value) => {
        let loaded = value ? validateBackup({ ...value, version: 1 }) : empty;
        if (import.meta.env.DEV && !value?.cloud) {
          try {
            const response = await fetch("/__local/wallet-import", {
              cache: "no-store",
            });
            if (response.ok) {
              const batch = await response.json();
              if (!(await get(KEY + "-import-" + batch.batchId))) {
                const incoming = validateBackup(batch);
                const additions = incoming.vouchers.filter(
                  (v) =>
                    !loaded.vouchers.some(
                      (old) =>
                        old.id === v.id || (v.code && old.code === v.code),
                    ),
                );
                loaded = {
                  ...loaded,
                  vouchers: [...loaded.vouchers, ...additions],
                };
                await set(KEY, loaded);
                await set(KEY + "-import-" + batch.batchId, true);
              }
            }
          } catch {
            setStorageError("הייבוא המקומי לא הושלם. נסו לרענן את הדף.");
          }
        }
        if (value?.cloud) {
          const { secret, revision } = value.cloud;
          cloud.current = {
            secret,
            revision,
            client: await openCloudWallet(secret, cloudTransport(), revision),
          };
          setCloudState({ secret, revision });
          try {
            const result = await cloud.current.client.read();
            loaded = result.wallet;
            cloud.current.revision = result.revision;
            await set(KEY, {
              ...loaded,
              cloud: { secret, revision: result.revision },
            });
            setCloudState({ secret, revision: result.revision });
            setCloudStatus("מעודכן מהענן");
          } catch {
            setCloudStatus(
              "מוצג עותק מקומי. יש להתחבר לרשת ולרענן לפני עריכה.",
            );
          }
        }
        setData(loaded);
        setReady(true);
      })
      .catch(() => {
        setStorageError("לא הצלחנו לקרוא את הארנק. נסו לפתוח שוב בדפדפן רגיל.");
        setReady(true);
      });
  }, []);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  async function applyCloud(result, connection) {
    const state = { secret: connection.secret, revision: result.revision };
    cloud.current = { ...connection, revision: result.revision };
    setCloudState(state);
    setData(result.wallet);
    try {
      await set(KEY, { ...result.wallet, cloud: state });
      setStorageError("");
    } catch {
      setStorageError(
        "נשמר בענן, אך העותק במכשיר לא נשמר. שמרו את מפתח הארנק לפני סגירה.",
      );
    }
    setCloudStatus("נשמר בענן · " + new Date().toLocaleTimeString("he-IL"));
  }
  async function refreshCloud() {
    if (!cloud.current || cloudBusy.current || modal || demo) return;
    cloudBusy.current = true;
    setSyncBusy(true);
    try {
      const result = await cloud.current.client.read();
      if (modalRef.current) {
        setCloudStatus("נמצאה גרסה בענן. סגרו את העריכה ורעננו לפני שמירה.");
        return;
      }
      await applyCloud(result, cloud.current);
    } catch (e) {
      setCloudStatus(e.message);
    } finally {
      cloudBusy.current = false;
      setSyncBusy(false);
    }
  }
  useEffect(() => {
    if (!ready || !cloudState || modal || demo) return;
    const refresh = () => {
      if (document.visibilityState === "visible") refreshCloud();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [ready, Boolean(cloudState), modal, demo]);
  async function connectCloud(secret, create) {
    if (cloudBusy.current) return;
    cloudBusy.current = true;
    setSyncBusy(true);
    setCloudStatus("מתחבר לארנק…");
    try {
      const connection = {
        secret,
        client: await openCloudWallet(secret, cloudTransport()),
      };
      await set(KEY + "-before-cloud", data);
      const result = create
        ? await connection.client.create(data)
        : await connection.client.read();
      await applyCloud(result, connection);
    } catch (e) {
      setCloudStatus(e.message);
    } finally {
      cloudBusy.current = false;
      setSyncBusy(false);
    }
  }
  async function disconnectCloud() {
    if (cloudBusy.current) return;
    try {
      await set(KEY, data);
      cloud.current = null;
      setCloudState(null);
      setCloudStatus("המכשיר נותק. העותק המקומי נשמר; הארנק בענן לא נמחק.");
    } catch {
      setStorageError("לא ניתן לנתק לפני שמירת עותק מקומי.");
    }
  }
  async function save(next) {
    if (demo) {
      setDemoState(next);
      return true;
    }
    if (cloud.current) {
      if (cloudBusy.current) {
        setStorageError("מתבצע סנכרון. נסו לשמור שוב בעוד רגע.");
        return false;
      }
      if (cloud.current.revision !== renderedRevision) {
        setStorageError("הארנק עודכן. פתחו מחדש את העריכה לפני שמירה.");
        return false;
      }
      cloudBusy.current = true;
      setSyncBusy(true);
      setCloudStatus("שומר בענן…");
      try {
        const result = await cloud.current.client.save(next, renderedRevision);
        await applyCloud(result, cloud.current);
        return true;
      } catch (e) {
        setStorageError(e.message);
        setCloudStatus(e.message);
        return false;
      } finally {
        cloudBusy.current = false;
        setSyncBusy(false);
      }
    }
    try {
      await set(KEY, next);
      setData(next);
      setStorageError("");
      return true;
    } catch {
      setStorageError(
        "השמירה נכשלה. ייתכן שאחסון המכשיר מלא. השינויים לא נשמרו.",
      );
      return false;
    }
  }
  const active = wallet.vouchers.filter((v) => statusOf(v) === "active");
  const expiring = active.filter((v) => v.expiry && daysLeft(v.expiry) <= 30);
  const stores = [...new Set(active.flatMap((v) => v.stores))];
  const storeDirectory = merchantIndex(active);
  const filtered = wallet.vouchers
    .filter(
      (v) =>
        (status === "all" || statusOf(v) === status) &&
        (category === categories[0] || v.category === category) &&
        `${v.name} ${v.issuer} ${v.stores.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "amount"
        ? b.balance - a.balance
        : sort === "name"
          ? a.name.localeCompare(b.name, "he")
          : (a.expiry || "9999").localeCompare(b.expiry || "9999"),
    );
  function navigate(next) {
    setMapVoucherId("");
    setPage(next);
    setQuery("");
    setCategory(categories[0]);
  }
  function backup() {
    const blob = new Blob(
      [JSON.stringify({ ...wallet, version: 1 }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suvarim-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("הגיבוי כולל קודי מימוש — שמרו אותו במקום פרטי.");
  }
  async function importBackup(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (f.size > 25000000) throw new Error("הקובץ גדול מדי (עד 25MB).");
      const imported = validateBackup(JSON.parse(await f.text()));
      setModal({ type: "restore", data: imported });
    } catch (err) {
      setToast(
        err.message === "Unexpected end of JSON input"
          ? "קובץ הגיבוי אינו תקין."
          : err.message,
      );
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setToast("הדפדפן אינו תומך במיקום.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setToast("החנויות ממוינות לפי המרחק ממך.");
      },
      () => setToast("המיקום לא זמין. אפשר לאפשר גישה למיקום בהגדרות הדפדפן."),
      { timeout: 12000 },
    );
  }
  if (!ready)
    return (
      <div className="loading">
        <LoaderCircle className="spin" /> טוענים את הארנק…
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("wallet");
          }}
        >
          <span className="brand-mark">
            <Ticket />
          </span>
          <span>
            שוברים<small>כל הטוב, במקום אחד.</small>
          </span>
        </a>
        <nav aria-label="ניווט ראשי">
          {[
            ["wallet", Wallet, "הארנק שלי"],
            ["stores", Store, "איפה מממשים"],
            ["map", MapPin, "על המפה"],
            ["settings", Settings, "הארנק והמכשיר"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={page === id ? "nav-item selected" : "nav-item"}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
              {id === "wallet" && (
                <span className="nav-count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-ticket">
            <Gift size={25} />
            <b>מתנות נועדו למימוש.</b>
            <p>כל השוברים שלך, תמיד בהישג יד.</p>
          </div>
          <div className="local-label">
            <ShieldCheck size={17} />{" "}
            {cloudState ? "ארנק אישי · מחובר לענן" : "ארנק אישי · נשמר במכשיר"}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>הארנק האישי שלך</span>
          <span className="today">
            {new Date().toLocaleDateString("he-IL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <button className="mobile-brand" onClick={() => navigate("wallet")}>
            <Ticket /> שוברים
          </button>
          <button
            className="avatar"
            onClick={() => navigate("settings")}
            aria-label="הגדרות הארנק"
          >
            <Wallet size={19} />
          </button>
        </header>
        <main id="main">
          {demo && (
            <div className="demo-banner">
              <span>
                <b>מצב הדגמה</b> · השוברים והחנויות כאן פיקטיביים.
              </span>
              <button
                onClick={() => {
                  setDemo(false);
                  setModal(null);
                  setQuery("");
                }}
              >
                לארנק האישי שלי <ChevronLeft size={16} />
              </button>
            </div>
          )}
          {storageError && (
            <div role="alert" className="error-box">
              {storageError}
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="greeting">
                {page === "wallet"
                  ? "נעים שיש למה לצפות"
                  : page === "settings"
                    ? "בדיוק כמו שנוח לך"
                    : "המתנה הבאה שלך מחכה קרוב"}
              </p>
              <h1>
                {
                  {
                    wallet: "הארנק שלי",
                    stores: "איפה מממשים?",
                    map: "השוברים שלך, על המפה",
                    settings: "הארנק והמכשיר",
                  }[page]
                }
              </h1>
              <p className="subtitle">
                {
                  {
                    wallet: "פחות לחפש בהודעות. יותר ליהנות ממה שכבר יש לך.",
                    stores: "כל החנויות שהוספת לשוברים הפעילים שלך.",
                    map: "סניפים שהוספת, עם ניווט ישיר לחנות.",
                    settings: "גיבוי, התקנה וניהול הנתונים האישיים שלך.",
                  }[page]
                }
              </p>
            </div>
            <button
              className="primary add-main"
              onClick={() => setModal({ type: "add" })}
            >
              <Plus size={20} /> הוספת שובר
            </button>
          </div>
          {page === "wallet" && (
            <>
              <section className="overview" aria-label="סיכום הארנק">
                <div className="balance-overview">
                  <span className="balance-label">
                    <Wallet size={20} /> עוד רגעים טובים בשווי
                  </span>
                  <strong>
                    {money(active.reduce((s, v) => s + v.balance, 0))}
                  </strong>
                  <span>{active.length} שוברים פעילים בארנק שלך</span>
                  {active.some((v) => v.balance === null) && (
                    <small>
                      הסכום כולל יתרות ידועות בלבד ·{" "}
                      {active.filter((v) => v.balance === null).length} ללא יתרה
                      ידועה
                    </small>
                  )}
                  <Ticket className="balance-art" aria-hidden="true" />
                </div>
                <div className="stat-box">
                  <span className="stat-icon">
                    <Store size={22} />
                  </span>
                  <strong>{stores.length}</strong>
                  <span>חנויות לבחירה</span>
                  <button onClick={() => navigate("stores")}>
                    בואו נמצא משהו טוב <ArrowUpLeft size={16} />
                  </button>
                </div>
                <div className="stat-box expiry-stat">
                  <span className="stat-icon">
                    <Clock size={22} />
                  </span>
                  <strong>{expiring.length}</strong>
                  <span>שוברים למימוש בחודש הקרוב</span>
                  <span className="stat-caption">
                    {expiring.length
                      ? `${money(expiring.reduce((s, v) => s + v.balance, 0))} שכדאי לזכור לממש`
                      : "יש זמן ליהנות מהמתנות שלך"}
                  </span>
                </div>
              </section>
              {expiring.length > 0 && (
                <div className="expiry-notice">
                  <Clock size={19} />
                  <span>
                    <b>חבל שיישאר בארנק.</b> {expiring[0].name} בתוקף עד{" "}
                    {dateLabel(expiring[0].expiry)}.
                  </span>
                  <button
                    onClick={() =>
                      setModal({ type: "detail", id: expiring[0].id })
                    }
                  >
                    לשובר <ChevronLeft size={17} />
                  </button>
                </div>
              )}
              <section className="wallet-section">
                <div className="section-title">
                  <h2>
                    השוברים שלך <span>{wallet.vouchers.length}</span>
                  </h2>
                  <label className="sort-label">
                    <SlidersHorizontal size={16} />
                    <select
                      aria-label="מיון שוברים"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="expiry">תוקף קרוב קודם</option>
                      <option value="amount">יתרה גבוהה קודם</option>
                      <option value="name">לפי שם</option>
                    </select>
                  </label>
                </div>
                <div className="filters">
                  <label className="search-field">
                    <Search size={19} />
                    <input
                      aria-label="חיפוש שובר או חנות"
                      placeholder="איזה שובר או חנות מחפשים?"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="קטגוריה"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="tabs" aria-label="סינון מצב שובר">
                  {[
                    ["active", "פעילים"],
                    ["used", "מומשו"],
                    ["expired", "פג תוקף"],
                    ["all", "הכול"],
                  ].map(([id, label]) => (
                    <button
                      aria-pressed={status === id}
                      className={status === id ? "active" : ""}
                      key={id}
                      onClick={() => setStatus(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filtered.length ? (
                  <div className="voucher-grid">
                    {filtered.map((v, i) => (
                      <VoucherCard
                        key={v.id}
                        voucher={v}
                        index={i}
                        open={() => setModal({ type: "detail", id: v.id })}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Gift}
                    title={
                      wallet.vouchers.length
                        ? "לא נמצאו שוברים מתאימים"
                        : "המתנה הראשונה שלך מתחילה כאן"
                    }
                    text={
                      wallet.vouchers.length
                        ? "נסו חיפוש אחר או שנו את הסינון."
                        : "הדביקו הודעה, הוסיפו קישור או צלמו שובר. אנחנו נעזור לעשות סדר."
                    }
                  >
                    <button
                      className="primary"
                      onClick={() => setModal({ type: "add" })}
                    >
                      <Plus size={18} /> הוספת השובר הראשון
                    </button>
                    {!demo && !wallet.vouchers.length && (
                      <button
                        className="text-button"
                        onClick={() => setDemo(true)}
                      >
                        רק להציץ? פתיחת ארנק לדוגמה
                      </button>
                    )}
                  </Empty>
                )}
              </section>
              <div className="wallet-footer">
                <ShieldCheck size={16} />
                <span>
                  {cloudState
                    ? cloudStatus
                    : "הפרטים נשמרים בדפדפן הזה בלבד. מומלץ לגבות מדי פעם."}
                </span>
                <button onClick={backup}>גיבוי הארנק</button>
              </div>
            </>
          )}
          {(page === "stores" || page === "map") && (
            <Stores
              key={`${page}-${mapVoucherId}`}
              selectedVoucherId={mapVoucherId}
              onSelectVoucher={(id) => {
                setMapVoucherId(id);
                setQuery("");
                setCategory(categories[0]);
              }}
              {...{
                wallet,
                query,
                setQuery,
                category,
                setCategory,
                location,
                locate,
              }}
              map={page === "map"}
              onAdd={() => setModal({ type: "branch" })}
              onVoucher={(id) => setModal({ type: "detail", id })}
            />
          )}
          {page === "settings" && (
            <div className="settings-grid">
              {!demo && (
                <CloudPanel
                  connected={Boolean(cloudState)}
                  secret={cloudState?.secret || ""}
                  status={cloudStatus}
                  busy={syncBusy}
                  onCreate={() => connectCloud(newWalletKey(), true)}
                  onJoin={(secret) => connectCloud(secret, false)}
                  onRefresh={refreshCloud}
                  onDisconnect={disconnectCloud}
                />
              )}
              <Coverage />
              <section className="settings-card">
                <Smartphone />
                <h2>תמיד במסך הבית</h2>
                <ol>
                  <li>
                    פותחים בטלפון את כתובת ה־HTTPS של האפליקציה לאחר פרסום.
                  </li>
                  <li>
                    במחשב מורידים גיבוי ומעבירים את הקובץ לטלפון באופן פרטי.
                  </li>
                  <li>
                    בטלפון בוחרים ״שחזור מגיבוי״. השחזור מחליף את הארנק שבמכשיר.
                  </li>
                  <li>מתקינים ממסך הבית דרך תפריט Chrome.</li>
                </ol>
                <p>
                  אחרי העלאת האפליקציה לכתובת HTTPS, פתחו אותה ב־Chrome
                  באנדרואיד ובחרו בתפריט ״הוספה למסך הבית״ או ״התקנת אפליקציה״.
                </p>
                {install && (
                  <button
                    className="primary"
                    onClick={async () => {
                      await install.prompt();
                      setInstall(null);
                    }}
                  >
                    התקנת האפליקציה
                  </button>
                )}
                <p className="muted">
                  לשימוש באותו ארנק במחשב ובטלפון, חברו את שניהם עם אותו מפתח
                  ארנק.
                </p>
              </section>
              <section className="settings-card">
                <ShieldCheck />
                <h2>הנתונים שלך, אצלך</h2>
                <p>
                  השוברים והתמונות נשמרים במכשיר הזה. מחיקת נתוני הדפדפן תמחק גם
                  את העותק המקומי. אם חיברתם ארנק לענן, ניתן לשחזר אותו באמצעות
                  המפתח.
                </p>
                <div className="button-row">
                  <button className="secondary" onClick={backup}>
                    <Download size={18} /> הורדת גיבוי
                  </button>
                  <button
                    className="secondary"
                    onClick={() => restore.current.click()}
                  >
                    <Upload size={18} /> שחזור מגיבוי
                  </button>
                </div>
                <p className="muted">
                  קובץ הגיבוי מכיל קודי מימוש ותמונות. שמרו אותו באופן פרטי.
                </p>
              </section>
              <section className="settings-card">
                <Gift />
                <h2>מקום להתנסות</h2>
                <p>
                  אפשר לבדוק את כל המסכים עם שוברים וחנויות לדוגמה, בנפרד מהארנק
                  שלך.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    setDemo(!demo);
                    navigate("wallet");
                  }}
                >
                  {demo ? "חזרה לארנק שלי" : "פתיחת מצב הדגמה"}
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="ניווט בנייד">
        {[
          ["wallet", Wallet, "הארנק"],
          ["stores", Store, "חנויות"],
          ["map", MapPin, "מפה"],
          ["settings", Settings, "הגדרות"],
        ].map(([id, Icon, label]) => (
          <button
            key={id}
            className={page === id ? "selected" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <input
        ref={restore}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={importBackup}
      />
      {modal && (
        <Modal
          toast={toast}
          title={
            {
              add: "שובר חדש בארנק",
              edit: "עריכת שובר",
              detail: "פרטי השובר",
              branch: "הוספת סניף למפה",
              restore: "שחזור הארנק",
              delete: "מחיקת שובר",
            }[modal.type]
          }
          close={() => setModal(null)}
        >
          {(modal.type === "add" || modal.type === "edit") && (
            <VoucherForm
              initial={
                modal.type === "edit"
                  ? wallet.vouchers.find((v) => v.id === modal.id)
                  : null
              }
              onSave={async (v) => {
                if (
                  wallet.vouchers.some(
                    (x) =>
                      x.id !== v.id &&
                      v.code &&
                      x.code === v.code &&
                      x.issuer === v.issuer,
                  )
                ) {
                  setToast("כבר קיים שובר עם אותו קוד ומנפיק.");
                  return false;
                }
                const next = {
                  ...wallet,
                  vouchers:
                    modal.type === "edit"
                      ? wallet.vouchers.map((x) => (x.id === v.id ? v : x))
                      : [v, ...wallet.vouchers],
                };
                if (await save(next)) {
                  setModal(null);
                  setToast("השובר נשמר בארנק.");
                  return true;
                }
                return false;
              }}
            />
          )}
          {modal.type === "detail" && (
            <VoucherDetail
              voucher={wallet.vouchers.find((v) => v.id === modal.id)}
              onMap={() => {
                const id = modal.id;
                navigate("map");
                setMapVoucherId(id);
                setModal(null);
              }}
              onEdit={() => setModal({ type: "edit", id: modal.id })}
              onDelete={() => setModal({ type: "delete", id: modal.id })}
              onCopy={async (code) => {
                try {
                  await navigator.clipboard.writeText(code);
                  setToast("קוד השובר הועתק.");
                } catch {
                  setToast("לא ניתן להעתיק. אפשר לסמן ולהעתיק את הקוד ידנית.");
                }
              }}
              onRedeem={async (amount) => {
                try {
                  const v = redeem(
                    wallet.vouchers.find((v) => v.id === modal.id),
                    amount,
                  );
                  if (
                    await save({
                      ...wallet,
                      vouchers: wallet.vouchers.map((x) =>
                        x.id === v.id ? v : x,
                      ),
                    })
                  ) {
                    setToast("המימוש נרשם והיתרה עודכנה.");
                    return true;
                  }
                } catch (err) {
                  setToast(err.message);
                }
                return false;
              }}
            />
          )}
          {modal.type === "branch" && (
            <BranchForm
              stores={stores.filter(
                (name) => storeDirectory.get(name)?.channel !== "online",
              )}
              onSave={async (branch) => {
                if (
                  await save({
                    ...wallet,
                    branches: [...wallet.branches, branch],
                  })
                ) {
                  setModal(null);
                  setToast("הסניף נוסף למפה.");
                }
              }}
            />
          )}
          {modal.type === "restore" && (
            <>
              <p>
                הגיבוי מכיל {modal.data.vouchers.length} שוברים ו־
                {modal.data.branches.length} סניפים. השחזור יחליף את הנתונים
                בארנק {demo ? "ההדגמה" : "האישי"} הנוכחי.
              </p>
              <button className="secondary" onClick={backup}>
                גיבוי הארנק הקיים לפני החלפה
              </button>
              <button
                className="primary full"
                onClick={async () => {
                  if (await save(modal.data)) {
                    setModal(null);
                    setToast("הארנק שוחזר.");
                  }
                }}
              >
                החלפה ושחזור
              </button>
            </>
          )}
          {modal.type === "delete" && (
            <>
              <p>
                למחוק את ״{wallet.vouchers.find((v) => v.id === modal.id)?.name}
                ״ מהארנק? אי אפשר לבטל את המחיקה.
              </p>
              <button
                className="danger full"
                onClick={async () => {
                  if (
                    await save({
                      ...wallet,
                      vouchers: wallet.vouchers.filter(
                        (v) => v.id !== modal.id,
                      ),
                    })
                  ) {
                    setModal(null);
                    setToast("השובר נמחק.");
                  }
                }}
              >
                מחיקת השובר
              </button>
            </>
          )}
        </Modal>
      )}
      <div className="toast" role="status" aria-live="polite">
        {toast && (
          <span>
            <Check size={18} />
            {toast}
          </span>
        )}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={36} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
function VoucherCard({ voucher: v, index, open }) {
  const state = statusOf(v),
    days = daysLeft(v.expiry);
  return (
    <button
      className={`voucher-card tone-${v.color ?? index % 4}`}
      onClick={open}
    >
      <div className="ticket-top">
        <span className="issuer">{v.issuer || "שובר אישי"}</span>
        <span className="category-tag">{v.category || "כללי"}</span>
      </div>
      <div className="ticket-body">
        <h3>{v.name}</h3>
        <div className="voucher-value">
          {money(v.balance)}
          <span>יתרה למימוש</span>
        </div>
        <div className="store-chips">
          {v.stores.slice(0, 2).map((s) => (
            <span key={s}>{s}</span>
          ))}
          {v.stores.length > 2 && <span>+{v.stores.length - 2}</span>}
          {!v.stores.length && <span>עדיין לא שויכו חנויות</span>}
        </div>
      </div>
      <div className="ticket-stub">
        <span
          className={
            state === "expired" || (days !== null && days <= 30) ? "soon" : ""
          }
        >
          <Clock size={14} />
          {state === "used"
            ? "מומש במלואו"
            : state === "expired"
              ? "פג תוקף"
              : days !== null
                ? `בתוקף עד ${dateLabel(v.expiry)}`
                : "ללא תוקף שהוזן"}
        </span>
        <span className="open-voucher">
          לשובר <ChevronLeft size={16} />
        </span>
      </div>
    </button>
  );
}
function Modal({ title, close, children, toast }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" onClick={close} aria-label="סגירה">
          <X />
        </button>
      </div>
      <div className="modal-content">
        {toast && (
          <p className="info-box" role="status">
            {toast}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}

function VoucherForm({ initial, onSave }) {
  const [source, setSource] = useState("text"),
    [raw, setRaw] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [image, setImage] = useState(initial?.image || "");
  const [fields, setFields] = useState({
    ...{
      name: "",
      issuer: "",
      amount: "",
      balance: "",
      expiry: "",
      code: "",
      category: "כללי",
      stores: "",
      notes: "",
      link: "",
      voucherProductId: "",
      paymentProvider: "",
      cashierInstructions: "",
      storesSourceProductId: "",
      storesSourceCheckedAt: "",
    },
    ...initial,
    amount: initial?.amount ?? "",
    balance: initial?.balance ?? "",
    stores: initial?.stores?.join(", ") || "",
  });
  const alive = useRef(true),
    workerRef = useRef(null);
  useEffect(
    () => () => {
      alive.current = false;
      workerRef.current?.terminate();
    },
    [],
  );
  const field = (key, value) =>
    setFields((prev) => ({ ...prev, [key]: value }));
  function analyze(text) {
    const found = extractVoucher(text);
    setFields((prev) => ({
      ...(found.voucherProductId !== prev.voucherProductId
        ? clearCatalogAssociation(prev)
        : prev),
      ...Object.fromEntries(
        Object.entries(found).filter(([k, v]) => k !== "stores" && v !== ""),
      ),
      ...(found.stores.length ? { stores: found.stores.join(", ") } : {}),
      voucherProductId: found.voucherProductId,
      paymentProvider: found.paymentProvider,
      amount: found.amount,
      balance: found.balance,
    }));
    setNotice(
      "הפרטים שזוהו הועתקו לשדות. יש לבדוק סכום, קוד, תוקף וחנויות לפני השמירה.",
    );
  }
  async function scan(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8000000
    ) {
      setError("בחרו תמונת JPG, PNG או WebP עד 8MB.");
      return;
    }
    setBusy(true);
    setProgress("מכינים את התמונה…");
    try {
      const encoded = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      if (!alive.current) return;
      setImage(encoded);
      const { createWorker } = await import("tesseract.js");
      if (!alive.current) return;
      const worker = await createWorker(["heb", "eng"], 1, {
        logger: (m) => {
          if (alive.current)
            setProgress(
              m.status === "recognizing text"
                ? `מזהים טקסט… ${Math.round(m.progress * 100)}%`
                : "טוענים זיהוי עברית ואנגלית…",
            );
        },
      });
      if (!alive.current) {
        await worker.terminate();
        return;
      }
      workerRef.current = worker;
      const result = await worker.recognize(file);
      if (alive.current) {
        setRaw(result.data.text);
        analyze(result.data.text);
        if (!result.data.text.trim())
          setError("לא זוהה טקסט קריא. אפשר להזין את הפרטים ידנית.");
      }
      await worker.terminate();
      workerRef.current = null;
    } catch {
      if (alive.current)
        setError(
          "הזיהוי לא הושלם. נדרש אינטרנט לטעינה הראשונה; אפשר להזין את הפרטים ידנית.",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    const amount = fields.amount === "" ? null : Number(fields.amount),
      balance = fields.balance === "" ? null : Number(fields.balance);
    if (
      !fields.name.trim() ||
      (amount !== null && (!Number.isFinite(amount) || amount <= 0)) ||
      (balance !== null && !Number.isFinite(balance)) ||
      balance < 0 ||
      (amount !== null && balance > amount)
    ) {
      setError(
        "יש להזין יתרה נוכחית תקינה. הסכום המקורי יכול להישאר ריק; אם הוזן, היתרה לא יכולה לעלות עליו.",
      );
      return;
    }
    if (fields.link && !safeUrl(fields.link)) {
      setError("יש להזין קישור מלא שמתחיל ב־https:// או http://.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        ...initial,
        ...fields,
        name: fields.name.trim(),
        issuer: fields.issuer.trim(),
        id: initial?.id || crypto.randomUUID(),
        amount,
        balance,
        stores: [
          ...new Set(
            fields.stores
              .split(/[,\n;]/)
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ],
        link: safeUrl(fields.link),
        image,
        history: initial?.history || [],
        createdAt: initial?.createdAt || new Date().toISOString(),
        color: initial?.color ?? Math.floor(Math.random() * 4),
      });
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {!initial && (
        <>
          <div className="source-tabs">
            {[
              ["text", FileText, "טקסט"],
              ["link", LinkIcon, "קישור"],
              ["image", ImagePlus, "תמונה"],
            ].map(([id, Icon, label]) => (
              <button
                type="button"
                key={id}
                disabled={busy}
                className={source === id ? "active" : ""}
                aria-pressed={source === id}
                onClick={() => setSource(id)}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </div>
          {source === "image" ? (
            <label className="upload-zone">
              <ImagePlus size={28} />
              <b>בחירת תמונה או צילום שובר</b>
              <span>הזיהוי מתבצע במכשיר, בעברית ובאנגלית</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={scan}
                disabled={busy}
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>
                  {source === "link" ? "קישור לשובר" : "ההודעה שקיבלת"}
                </span>
                <textarea
                  rows={3}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={
                    source === "link"
                      ? "https://…"
                      : "למשל: BUYME, שווי 250 ₪, קוד: ABC1234, תוקף: 31/12/2027"
                  }
                />
              </label>
              <button
                type="button"
                className="secondary full"
                onClick={() => {
                  if (source === "link") {
                    const url = safeUrl(raw.trim());
                    if (!url) {
                      setError("יש להזין קישור תקין.");
                      return;
                    }
                    field("link", url);
                    analyze(url);
                    setNotice(
                      "הקישור נשמר. לא נקרא תוכן האתר: מלאו את פרטי השובר או הדביקו את הטקסט מהעמוד.",
                    );
                  } else analyze(raw);
                }}
                disabled={!raw.trim()}
              >
                {" "}
                {source === "link"
                  ? "שמירת קישור וזיהוי המנפיק"
                  : "זיהוי פרטים מהטקסט"}
              </button>
            </>
          )}
          {busy && (
            <p className="scan-status" role="status">
              <LoaderCircle size={17} className="spin" />
              {progress || "שומרים…"}
            </p>
          )}
          {notice && <p className="info-box">{notice}</p>}
          {raw && source === "image" && (
            <label className="field">
              <span>הטקסט שזוהה</span>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} />
              <button
                type="button"
                className="text-button"
                onClick={() => analyze(raw)}
              >
                זיהוי מחדש מהטקסט המתוקן
              </button>
            </label>
          )}
          <div className="form-divider">פרטי השובר לאישור שלך</div>
        </>
      )}
      <ProductSelector
        fields={fields}
        onChange={(id) =>
          setFields((prev) => ({
            ...clearCatalogAssociation(prev),
            voucherProductId: id,
            ...(getProduct(id) ? { issuer: getProduct(id).issuer } : {}),
          }))
        }
        onImport={() => setFields((prev) => applyCatalog(prev))}
      />
      <div className="form-grid">
        <label className="field wide">
          <span>שם השובר *</span>
          <input
            required
            maxLength={120}
            value={fields.name}
            onChange={(e) => field("name", e.target.value)}
            placeholder="למשל: מתנת יום ההולדת"
          />
        </label>
        <label className="field">
          <span>מנפיק</span>
          <input
            value={fields.issuer}
            onChange={(e) => field("issuer", e.target.value)}
            placeholder="למשל: BUYME"
          />
        </label>
        <label className="field">
          <span>קטגוריה</span>
          <select
            value={fields.category}
            onChange={(e) => field("category", e.target.value)}
          >
            {categories.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>סכום מקורי (₪), אם ידוע</span>
          <input
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            value={fields.amount}
            onChange={(e) => field("amount", e.target.value)}
          />
        </label>
        {
          <label className="field">
            <span>יתרה נוכחית (₪), אם ידועה</span>
            <input
              type="number"
              min="0"
              max={fields.amount === "" ? undefined : fields.amount}
              step="0.01"
              value={fields.balance}
              onChange={(e) => field("balance", e.target.value)}
            />
            <small>
              אפשר להשאיר ריק כשהיתרה אינה ידועה. השווי המקורי אינו בהכרח היתרה.
              אם טרם מימשת את השובר, אפשר להזין אותו סכום בשני השדות.
            </small>
          </label>
        }
        <label className="field">
          <span>בתוקף עד</span>
          <input
            type="date"
            value={fields.expiry}
            onChange={(e) => field("expiry", e.target.value)}
          />
        </label>
        <label className="field wide">
          <span>קוד מימוש</span>
          <input
            dir="ltr"
            value={fields.code}
            onChange={(e) => field("code", e.target.value)}
          />
        </label>
        <label className="field wide">
          <span>הנחיות לקופאי/ת</span>
          <textarea
            rows={2}
            value={fields.cashierInstructions}
            onChange={(e) => field("cashierInstructions", e.target.value)}
            placeholder="למשל: תשלום אחר, מולטיפאס, והקלדת הקוד"
          />
        </label>
        <label className="field wide">
          <span>חנויות למימוש, מופרדות בפסיקים</span>
          <textarea
            rows={2}
            value={fields.stores}
            onChange={(e) => field("stores", e.target.value)}
            placeholder="הוסיפו רק חנויות שמופיעות בתנאי השובר"
          />
          <small>
            אפשר להזין ידנית, או לצרף למעלה רשימה ציבורית אחרי אישור סוג השובר.
            יש לבדוק חריגים ותנאי מימוש מול המנפיק.
          </small>
        </label>
        <label className="field wide">
          <span>קישור לשובר</span>
          <input
            type="url"
            dir="ltr"
            value={fields.link}
            onChange={(e) => field("link", e.target.value)}
          />
        </label>
        <label className="field wide">
          <span>תנאים והערות</span>
          <textarea
            value={fields.notes}
            onChange={(e) => field("notes", e.target.value)}
            placeholder="למשל: לא תקף על מבצעים או בסניפי עודפים"
          />
        </label>
      </div>
      {image && (
        <div className="attachment">
          <img src={image} alt="תמונת השובר שצורפה" />
          <button
            className="text-button"
            type="button"
            onClick={() => setImage("")}
          >
            הסרת התמונה
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy} type="submit">
        <Check size={18} />
        {busy ? "רגע…" : "שמירת השובר בארנק"}
      </button>
    </form>
  );
}

function VoucherDetail({
  voucher: v,
  onEdit,
  onDelete,
  onCopy,
  onRedeem,
  onMap,
}) {
  const [amount, setAmount] = useState(""),
    [busy, setBusy] = useState(false),
    [allStores, setAllStores] = useState(false);
  if (!v) return null;
  return (
    <div className="detail">
      <div className={`detail-ticket tone-${v.color || 0}`}>
        <span className="issuer">{v.issuer || "שובר אישי"}</span>
        <h3>{v.name}</h3>
        <strong>{money(v.balance)}</strong>
        <p>
          {v.amount === null
            ? "הסכום המקורי לא ידוע"
            : `יתרה מתוך ${money(v.amount)}`}{" "}
          · {dateLabel(v.expiry)}
        </p>
      </div>
      <button className="primary full" onClick={onMap}>
        <MapPin size={18} />
        הצג חנויות על המפה
      </button>
      {v.demo && (
        <p className="info-box">זהו שובר הדגמה. אי אפשר לממש אותו בחנות.</p>
      )}
      {v.code && (
        <div className="code-box">
          <span>קוד מימוש</span>
          <b dir="ltr">{v.code}</b>
          <button
            className="icon-button"
            onClick={() => onCopy(v.code)}
            aria-label="העתקת קוד"
          >
            <Copy size={18} />
          </button>
        </div>
      )}
      {safeUrl(v.link) && (
        <a
          className="secondary full"
          href={safeUrl(v.link)}
          target="_blank"
          rel="noreferrer"
        >
          פתיחת השובר המקורי <ArrowUpLeft size={18} />
        </a>
      )}
      {v.cashierInstructions && (
        <p className="notes">
          <b>הנחיות לקופאי/ת: </b>
          {v.cashierInstructions}
        </p>
      )}
      {(v.voucherProductId ||
        v.paymentProvider ||
        /dream\s?card|swish/i.test(v.issuer || "")) && (
        <section className="product-info">
          <ProductInfo voucher={v} />
        </section>
      )}
      <h3>איפה אפשר לממש?</h3>
      <div className="detail-stores">
        {v.stores.length ? (
          v.stores.slice(0, allStores ? undefined : 20).map((s) => (
            <span key={s}>
              <Store size={15} />
              {s}
            </span>
          ))
        ) : (
          <p>עדיין לא הוזנו חנויות. ניתן להוסיף בעריכת השובר.</p>
        )}
      </div>
      {v.stores.length > 20 && (
        <button
          className="text-button"
          onClick={() => setAllStores(!allStores)}
        >
          {allStores ? "צמצום הרשימה" : `הצגת כל ${v.stores.length} העסקים`}
        </button>
      )}
      <p className="muted">
        {v.storesSourceProductId
          ? `הרשימה כוללת עסקים מהמקור הציבורי שאישרת (${v.storesSourceCheckedAt || "תאריך לא ידוע"}), וייתכן שגם שינויים ידניים.`
          : "הרשימה לפי הפרטים שהזנת."}{" "}
        יש לוודא מול תנאי המנפיק.
      </p>
      {v.notes && <p className="notes">{v.notes}</p>}
      {statusOf(v) === "active" && v.balance !== null && (
        <form
          className="redeem-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            if (await onRedeem(amount)) setAmount("");
            setBusy(false);
          }}
        >
          <label className="field">
            <span>מימשת חלק מהשובר? כמה שילמת?</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={v.balance}
              required
              placeholder="סכום ב־₪"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            עדכון היתרה
          </button>
        </form>
      )}
      {statusOf(v) === "expired" && (
        <p className="error-box">תוקף השובר שהוזן חלף.</p>
      )}
      {statusOf(v) === "used" && <p className="info-box">השובר מומש במלואו.</p>}
      {v.history?.length > 0 && (
        <>
          <h3>היסטוריית מימושים</h3>
          <ul className="history">
            {v.history.map((h, i) => (
              <li key={h.id || i}>
                <span>{new Date(h.at).toLocaleDateString("he-IL")}</span>
                <b>{money(h.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      {v.image && (
        <details>
          <summary>הצגת תמונת השובר</summary>
          <img className="voucher-image" src={v.image} alt="השובר המקורי" />
        </details>
      )}
      <div className="detail-actions">
        <button className="secondary" onClick={onEdit}>
          <Pencil size={16} /> עריכה
        </button>
        <button className="text-button danger-text" onClick={onDelete}>
          <Trash2 size={16} /> מחיקה
        </button>
      </div>
    </div>
  );
}

function Stores({
  wallet,
  query,
  setQuery,
  category,
  setCategory,
  location,
  locate,
  map,
  onAdd,
  onVoucher,
  selectedVoucherId,
  onSelectVoucher,
}) {
  const [city, setCity] = useState(""),
    [storeFilter, setStoreFilter] = useState(""),
    [merchantCategory, setMerchantCategory] = useState(""),
    [visibleCount, setVisibleCount] = useState(36);
  useEffect(() => setVisibleCount(36), [query, category, merchantCategory]);
  const selectedVoucher = wallet.vouchers.find(
    (v) => v.id === selectedVoucherId,
  );
  const active = selectedVoucher
    ? [selectedVoucher]
    : wallet.vouchers.filter((v) => statusOf(v) === "active");
  const metadata = merchantIndex(active);
  const merchantCategories = [
    ...new Set([...metadata.values()].flatMap((m) => m.categories)),
  ];
  const names = [...new Set(active.flatMap((v) => v.stores))];
  const vouchersFor = (name) =>
    active.filter(
      (v) =>
        v.stores.some((s) => sameStore(s, name)) &&
        (category === categories[0] || v.category === category),
    );
  const filteredNames = names.filter(
    (n) =>
      n.toLowerCase().includes(query.toLowerCase()) &&
      vouchersFor(n).length &&
      (!merchantCategory ||
        metadata.get(n)?.categories.includes(merchantCategory)),
  );
  const availableBranches = branchesForStores(
    names,
    wallet.branches,
    wallet.vouchers.some((v) => v.demo) ? [] : undefined,
  );
  const branches = availableBranches
    .filter(
      (b) =>
        filteredNames.some((n) => sameStore(n, b.store)) &&
        metadata.get(b.store)?.channel !== "online" &&
        (!city || b.city === city) &&
        (!storeFilter || sameStore(b.store, storeFilter)),
    )
    .map((b) => ({ ...b, distance: location ? distanceKm(location, b) : null }))
    .sort((a, b) =>
      location ? a.distance - b.distance : a.store.localeCompare(b.store, "he"),
    );
  return (
    <>
      {map && (
        <div className="info-box">
          <label className="field">
            <span>חנויות לפי שובר</span>
            <select
              aria-label="חנויות לפי שובר"
              value={selectedVoucher?.id || ""}
              onChange={(e) => onSelectVoucher(e.target.value)}
            >
              <option value="">כל השוברים הפעילים</option>
              {wallet.vouchers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {selectedVoucher && (
            <p>
              מוצגות רק חנויות המשויכות ל־{selectedVoucher.name}.{" "}
              <button className="secondary" onClick={() => onSelectVoucher("")}>
                הצגת כל השוברים
              </button>
            </p>
          )}
          {selectedVoucher && statusOf(selectedVoucher) !== "active" && (
            <p>השובר פג תוקף או מומש; מיקומי החנויות מוצגים לעיון בלבד.</p>
          )}
        </div>
      )}
      <div className="filters store-filters">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם חנות"
            aria-label="חיפוש חנות"
          />
        </label>
        <select
          aria-label="סינון חנויות לפי קטגוריית שובר"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {merchantCategories.length > 0 && (
          <select
            aria-label="תחום החנות"
            value={merchantCategory}
            onChange={(e) => setMerchantCategory(e.target.value)}
          >
            <option value="">כל תחומי החנויות</option>
            {merchantCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        {map && (
          <>
            <select
              aria-label="סינון עיר"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">כל הערים</option>
              {[...new Set(availableBranches.map((b) => b.city))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="סינון חנות במפה"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="">כל החנויות</option>
              {names.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="section-title">
        <p>
          {map
            ? `${branches.length} סניפים עם מיקום`
            : `${filteredNames.length} חנויות בשוברים הפעילים שלך`}
        </p>
        <div className="button-row">
          {map && (
            <button className="secondary" onClick={locate}>
              <Navigation size={16} /> קרוב אליי
            </button>
          )}
          <button className="secondary" onClick={onAdd}>
            <Plus size={17} /> הוספת סניף
          </button>
        </div>
      </div>
      {map ? (
        <>
          <MapView branches={branches} location={location} />
          <p className="muted map-disclaimer">
            מפה חלקית: סניפים מהמאגר המשותף עם מקור רשמי, וסניפים שהוזנו ידנית.
            שיוך השוברים מבוסס על רשימת הרשתות; יש לוודא את תנאי המימוש בסניף.
          </p>
          <div className="branch-grid">
            {branches.map((b) => (
              <article className="branch-card" key={b.id}>
                <MapPin size={22} />
                <div>
                  <h3>
                    {b.store}
                    {b.name ? ` · ${b.name}` : ""}
                  </h3>
                  <p>
                    {b.city} · {b.address}
                  </p>
                  {b.sourceUrl && (
                    <p>
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer">
                        מקור הסניף · {b.checkedAt}
                      </a>
                    </p>
                  )}
                  <div className="store-vouchers">
                    {vouchersFor(b.store).map((v) => (
                      <button key={v.id} onClick={() => onVoucher(v.id)}>
                        {v.name} · {money(v.balance)}
                      </button>
                    ))}
                  </div>
                  {b.distance !== null && (
                    <small>{b.distance.toFixed(1)} ק״מ בקו אווירי</small>
                  )}
                </div>
                <a
                  className="icon-button"
                  aria-label={`ניווט אל ${b.store} ${b.city}`}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={20} />
                </a>
              </article>
            ))}
          </div>
          {!branches.length && (
            <p className="info-box">
              אין סניפים עם מיקום בסינון הזה. הוסיפו סניף של חנות שמשויכת לשובר
              פעיל.
            </p>
          )}
        </>
      ) : filteredNames.length ? (
        <>
          <div className="store-grid">
            {filteredNames.slice(0, visibleCount).map((name, i) => {
              const vouchers = vouchersFor(name);
              const meta = metadata.get(name);
              return (
                <article className="store-card" key={name}>
                  <div className={`store-initial tone-${i % 4}`}>{name[0]}</div>
                  <h3>{name}</h3>
                  {meta?.categories.length > 0 && (
                    <small>{meta.categories.join(" · ")}</small>
                  )}
                  <p>
                    {vouchers.length} שוברים · יתרה ידועה{" "}
                    {money(vouchers.reduce((s, v) => s + v.balance, 0))}
                  </p>
                  {vouchers.some((v) => v.balance === null) && (
                    <small>כולל שובר שיתרתו לא ידועה</small>
                  )}
                  <small>הסכום הכולל אינו מבטיח שאפשר לשלב שוברים</small>
                  <div className="store-vouchers">
                    {vouchers.map((v) => (
                      <button key={v.id} onClick={() => onVoucher(v.id)}>
                        {v.name}
                        <ChevronLeft size={16} />
                      </button>
                    ))}
                  </div>
                  {meta?.channel === "online" ? (
                    <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
                      הוראות מימוש אונליין באתר המנפיק <ArrowUpLeft size={16} />
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " ישראל")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      חיפוש סניפים ב־Google Maps <ArrowUpLeft size={16} />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
          {filteredNames.length > visibleCount && (
            <button
              className="secondary full"
              onClick={() => setVisibleCount((n) => n + 36)}
            >
              הצגת עסקים נוספים ({visibleCount} מתוך {filteredNames.length})
            </button>
          )}
        </>
      ) : (
        <Empty
          icon={Store}
          title="החנויות שלך יופיעו כאן"
          text="הוסיפו לשובר את החנויות שמכבדות אותו, לפי תנאי המימוש."
        />
      )}
    </>
  );
}
function MapView({ branches, location }) {
  const element = useRef(null),
    instance = useRef(null),
    layer = useRef(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([module]) => {
        if (cancelled) return;
        const L = module.default;
        const map = L.map(element.current).setView([32.074, 34.781], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .addTo(map)
          .on("tileerror", () =>
            setError("לא ניתן לטעון חלק מהמפה. בדקו חיבור לאינטרנט."),
          );
        instance.current = { map, L };
        layer.current = L.layerGroup().addTo(map);
        setLoaded(true);
      })
      .catch(() => setError("המפה לא נטענה. רשימת הסניפים זמינה למטה."));
    return () => {
      cancelled = true;
      instance.current?.map.remove();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !instance.current) return;
    const { map, L } = instance.current;
    layer.current.clearLayers();
    const points = [];
    branches.forEach((b) => {
      const p = [b.lat, b.lng];
      points.push(p);
      const content = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = `${b.store} ${b.name || ""}`;
      const detail = document.createElement("p");
      detail.textContent = `${b.city} · ${b.address}`;
      const link = document.createElement("a");
      link.textContent = "ניווט ב־Google Maps";
      link.href = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      content.dir = "rtl";
      content.append(title, detail, link);
      L.marker(p, {
        icon: L.divIcon({
          className: "map-pin",
          html: "<span>⌖</span>",
          iconSize: [36, 44],
          iconAnchor: [18, 40],
        }),
      })
        .bindPopup(content)
        .addTo(layer.current);
    });
    if (location) {
      const p = [location.lat, location.lng];
      points.push(p);
      L.circleMarker(p, {
        radius: 8,
        color: "#fff",
        fillColor: "#3b73dd",
        fillOpacity: 1,
      })
        .bindPopup("המיקום שלך")
        .addTo(layer.current);
    }
    if (points.length)
      map.fitBounds(points, { padding: [45, 45], maxZoom: 14 });
  }, [loaded, branches, location]);
  return (
    <div className="map-wrap">
      <div ref={element} className="map" aria-label="מפת סניפי החנויות" />
      {error && (
        <p className="map-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
function BranchForm({ stores, onSave }) {
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        try {
          await onSave({
            id: crypto.randomUUID(),
            store: data.get("store"),
            city: data.get("city").trim(),
            address: data.get("address").trim(),
            lat: Number(data.get("lat")),
            lng: Number(data.get("lng")),
          });
        } catch {
          setError("לא הצלחנו לשמור את הסניף.");
        }
      }}
    >
      <p className="info-box">
        הוסיפו סניף שמכבד את השובר. אפשר להעתיק קו רוחב ואורך מתפריט הלחיצה על
        מיקום ב־Google Maps.
      </p>
      {!stores.length ? (
        <p>יש להוסיף קודם חנות לשובר פעיל בארנק.</p>
      ) : (
        <>
          <label className="field">
            <span>חנות</span>
            <select name="store" required>
              {stores.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>עיר *</span>
            <input name="city" required />
          </label>
          <label className="field">
            <span>כתובת *</span>
            <input name="address" required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>קו רוחב (Latitude) *</span>
              <input
                name="lat"
                type="number"
                dir="ltr"
                min="-90"
                max="90"
                step="any"
                placeholder="32.075"
                required
              />
            </label>
            <label className="field">
              <span>קו אורך (Longitude) *</span>
              <input
                name="lng"
                type="number"
                dir="ltr"
                min="-180"
                max="180"
                step="any"
                placeholder="34.775"
                required
              />
            </label>
          </div>
          {error && <p role="alert">{error}</p>}
          <button className="primary full">שמירת הסניף</button>
        </>
      )}
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
