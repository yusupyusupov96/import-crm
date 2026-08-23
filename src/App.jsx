import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Package, Users, Calculator, LayoutGrid, Plus, TrendingUp, Truck, X,
  Download, ChevronRight, Lock, Pencil, Trash2, FileText, Check, LogOut, Loader2, Menu,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const RED = "#C8102E";
const BLACK = "#1A1A1A";
const WHITE = "#FFFFFF";
const GRAY = "#F5F5F5";
const INK = "#333333";
const MUTED = "#5C5C5C";
const MUTED_2 = "#6E6E6E";
const NAV_MUTED = "#AEB4BF";

const mono = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };
const display = { fontFamily: "'Manrope', system-ui, sans-serif" };

const FREE_LIMIT = 5;

// ============================================================
// Data layer — реальный Supabase через @supabase/supabase-js
// ============================================================
async function fetchClientsRemote() {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
async function createClientRemote(userId, name, code) {
  const { error } = await supabase.from("clients").insert({ user_id: userId, name, tag: "новый", code: code || null });
  if (error) throw error;
}
async function updateClientRemote(id, patch) {
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) throw error;
}
async function deleteClientRemote(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

async function fetchSubscriptionRemote(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchOrdersRemote() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
async function createOrderRemote(payload) {
  const { error } = await supabase.from("orders").insert(payload);
  if (error) throw error;
}
async function updateOrderRemote(id, patch) {
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

async function fetchInvoicesRemote() {
  const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
async function createInvoiceRemote(payload) {
  const { error } = await supabase.from("invoices").insert(payload);
  if (error) throw error;
}
async function deleteInvoiceRemote(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}
async function updateInvoiceRemote(id, patch) {
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw error;
}
function dbInvoiceToUi(row) {
  return {
    id: row.id,
    number: row.number,
    items: row.items || [],
    logisticsRate: row.logistics_rate,
    logisticsCost: (row.total_weight || 0) * (row.logistics_rate || 0),
    packaging: row.packaging,
    insurance: row.insurance,
    other: row.other,
    totalWeight: row.total_weight,
    totalVolume: row.total_volume,
    density: row.density,
    total: row.total,
    date: row.created_at ? new Date(row.created_at).toLocaleDateString("ru-RU") : "",
  };
}

async function fetchCalculationsRemote() {
  const { data, error } = await supabase.from("calculations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
async function createCalculationRemote(payload) {
  const { error } = await supabase.from("calculations").insert(payload);
  if (error) throw error;
}
async function deleteCalculationRemote(id) {
  const { error } = await supabase.from("calculations").delete().eq("id", id);
  if (error) throw error;
}
async function updateCalculationRemote(id, patch) {
  const { error } = await supabase.from("calculations").update(patch).eq("id", id);
  if (error) throw error;
}
function dbCalcToUi(row) {
  return {
    id: row.id,
    number: row.number,
    clientName: row.client_name || "",
    price: row.price,
    chinaDelivery: row.china_delivery,
    rate: row.rate,
    weight: row.weight,
    shipRateUsd: row.ship_rate_usd,
    usdRate: row.usd_rate,
    buyerFee: row.buyer_fee,
    other: row.other,
    marginRub: row.margin_rub,
    costTotal: row.cost_total,
    sellPrice: row.sell_price,
    profit: row.profit,
    date: row.created_at ? new Date(row.created_at).toLocaleDateString("ru-RU") : "",
  };
}

// ---- маппинг DB (snake_case) <-> UI (camelCase) ----
function dbOrderToUi(row, clients) {
  const client = clients.find((c) => c.id === row.client_id);
  return {
    id: row.id,
    number: row.order_number,
    clientId: row.client_id,
    client: client ? client.name : "—",
    item: row.item,
    price: Number(row.price),
    status: row.status,
    dateIso: row.order_date,
    date: fmtDate(row.order_date),
    route: row.route,
    estimatedDays: row.estimated_days,
    paymentMethod: row.payment_method,
    currency: row.currency,
    paymentStatus: row.payment_status,
    paidAmount: Number(row.paid_amount || 0),
  };
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function statusColor(status) {
  if (status === "доставлен") return { bg: "#E9F6EE", fg: "#1D8A4E" };
  if (status === "на складе") return { bg: "#FFF4DC", fg: "#9A6B00" };
  return { bg: "#FCEBEC", fg: RED }; // "в пути" и по умолчанию
}

function deliveryCountdown(order) {
  if (!order.estimatedDays || order.status === "доставлен" || !order.dateIso) return null;
  const orderDate = new Date(order.dateIso + "T00:00:00");
  const today = new Date();
  const daysElapsed = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
  const daysLeft = order.estimatedDays - daysElapsed;
  return {
    overdue: daysLeft < 0,
    label: daysLeft < 0 ? `Просрочено на ${Math.abs(daysLeft)} дн.` : `Осталось ${daysLeft} дн.`,
  };
}

function exportToExcel(clients, orders, filename) {
  const wb = XLSX.utils.book_new();
  const clientsSheet = XLSX.utils.json_to_sheet(clients.map((c) => ({ Клиент: c.name, Статус: c.tag })));
  const ordersSheet = XLSX.utils.json_to_sheet(
    orders.map((o) => ({ Клиент: o.client, Товар: o.item, Цена: o.price, Дата: o.date, Статус: o.status }))
  );
  XLSX.utils.book_append_sheet(wb, clientsSheet, "Клиенты");
  XLSX.utils.book_append_sheet(wb, ordersSheet, "Заказы");
  XLSX.writeFile(wb, filename);
}

function exportInvoiceToExcel(invoice) {
  const wb = XLSX.utils.book_new();
  const itemsSheet = XLSX.utils.json_to_sheet(
    invoice.items.map((it) => ({
      Наименование: it.name,
      "Вес, кг": it.weight,
      "Объём, м³": it.volume,
      "Плотность, кг/м³": it.volume > 0 ? Math.round(it.weight / it.volume) : 0,
    }))
  );
  const summarySheet = XLSX.utils.json_to_sheet([
    { Показатель: "Тариф логистики, $/кг", Значение: invoice.logisticsRate },
    { Показатель: "Логистика (расчёт), $", Значение: invoice.logisticsCost },
    { Показатель: "Упаковка, $", Значение: invoice.packaging },
    { Показатель: "Страховка, $", Значение: invoice.insurance },
    { Показатель: "Прочие расходы, $", Значение: invoice.other },
    { Показатель: "Итого доставка, $", Значение: invoice.total },
  ]);
  XLSX.utils.book_append_sheet(wb, itemsSheet, "Товары");
  XLSX.utils.book_append_sheet(wb, summarySheet, "Итоги");
  XLSX.writeFile(wb, `Накладная_${invoice.number}.xlsx`);
}

function exportCalcToExcel(calc) {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    { Показатель: "Товар, ¥", Значение: calc.price },
    { Показатель: "Доставка по Китаю, ¥", Значение: calc.chinaDelivery },
    { Показатель: "Курс юаня, ₽", Значение: calc.rate },
    { Показатель: "Вес партии, кг", Значение: calc.weight },
    { Показатель: "Тариф доставки, $/кг", Значение: calc.shipRateUsd },
    { Показатель: "Курс доллара, ₽", Значение: calc.usdRate },
    { Показатель: "Себестоимость, ₽", Значение: calc.costTotal },
    { Показатель: "Цена продажи, ₽", Значение: calc.sellPrice },
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, "Расчёт");
  XLSX.writeFile(wb, `Расчёт_${calc.number || calc.id}.xlsx`);
}

function printCalcPDF(calc) {
  const win = window.open("", "_blank", "width=850,height=1000");
  if (!win) return;
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Расчёт ${calc.number || ""}</title>
        <style>
          body { font-family: 'Manrope', Arial, sans-serif; color: #1A1A1A; padding: 40px; }
          h1 { font-size: 22px; margin-bottom: 2px; }
          .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
          .costs { margin-top: 16px; width: 360px; }
          .costs div { display: flex; justify-content: space-between; padding: 7px 0; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
          .total { border-top: 2px solid #1A1A1A; margin-top: 8px; padding-top: 12px !important; font-weight: 800; font-size: 21px; color: #C8102E; border-bottom: none; }
          .brand { font-weight: 800; font-size: 15px; letter-spacing: 0.02em; margin-bottom: 24px; }
          .brand span { color: #C8102E; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="brand">ИМПОРТ<span>·</span>CRM</div>
        <h1>Коммерческий расчёт ${calc.number || ""}</h1>
        <div class="sub">Дата: ${calc.date}${calc.clientName ? ` · Клиент: ${calc.clientName}` : ""}</div>
        <div class="costs">
          <div><span>Товар</span><span>${Math.round(calc.price * calc.rate).toLocaleString("ru-RU")} ₽</span></div>
          <div><span>Доставка по Китаю</span><span>${Math.round(calc.chinaDelivery * calc.rate).toLocaleString("ru-RU")} ₽</span></div>
          <div><span>Международная доставка</span><span>${Math.round(calc.weight * calc.shipRateUsd * calc.usdRate).toLocaleString("ru-RU")} ₽</span></div>
          <div><span>Прочие расходы</span><span>${Math.round(calc.other).toLocaleString("ru-RU")} ₽</span></div>
          <div class="total"><span>Итого к оплате</span><span>${Math.round(calc.sellPrice).toLocaleString("ru-RU")} ₽</span></div>
        </div>
      </body>
    </html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function printInvoicePDF(invoice) {
  const win = window.open("", "_blank", "width=850,height=1000");
  if (!win) return;
  const rows = invoice.items
    .map(
      (it) => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:right">${it.weight}</td>
        <td style="text-align:right">${it.volume}</td>
        <td style="text-align:right">${it.volume > 0 ? Math.round(it.weight / it.volume).toLocaleString("ru-RU") : "—"}</td>
      </tr>`
    )
    .join("");
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Накладная ${invoice.number}</title>
        <style>
          body { font-family: 'Manrope', Arial, sans-serif; color: #1A1A1A; padding: 40px; }
          h1 { font-size: 22px; margin-bottom: 2px; }
          .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #E0E0E0; font-size: 13px; text-align: left; }
          th { background: #F5F5F5; font-size: 11px; text-transform: uppercase; color: #666; }
          .costs { margin-top: 24px; width: 320px; margin-left: auto; }
          .costs div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13.5px; }
          .total { border-top: 2px solid #1A1A1A; margin-top: 8px; padding-top: 10px !important; font-weight: 800; font-size: 19px; color: #C8102E; }
          .brand { font-weight: 800; font-size: 15px; letter-spacing: 0.02em; margin-bottom: 24px; }
          .brand span { color: #C8102E; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="brand">ИМПОРТ<span>·</span>CRM</div>
        <h1>Накладная ${invoice.number}</h1>
        <div class="sub">Дата: ${invoice.date} · Общий вес: ${invoice.totalWeight.toLocaleString("ru-RU")} кг · Объём: ${invoice.totalVolume.toLocaleString("ru-RU")} м³ · Плотность: ${Math.round(invoice.density).toLocaleString("ru-RU")} кг/м³</div>
        <table>
          <thead><tr><th>Наименование</th><th style="text-align:right">Вес, кг</th><th style="text-align:right">Объём, м³</th><th style="text-align:right">Плотность, кг/м³</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="costs">
          <div><span>Логистика (${invoice.logisticsRate} $/кг)</span><span>$${invoice.logisticsCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></div>
          <div><span>Упаковка</span><span>$${invoice.packaging.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></div>
          <div><span>Страховка</span><span>$${invoice.insurance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></div>
          <div><span>Прочие расходы</span><span>$${invoice.other.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></div>
          <div class="total"><span>Итого</span><span>$${invoice.total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></div>
        </div>
      </body>
    </html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// ============================================================
// AUTH SCREEN
// ============================================================
function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    setError(""); setNotice("");
    if (!email.trim() || !password) { setError("Заполни email и пароль"); return; }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Регистрация прошла. Проверь почту и подтверди email, затем войди.");
          setMode("signin");
        }
      }
    } catch (e) {
      setError(e.message || "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: GRAY, ...display }}>
      <div className="w-full max-w-sm p-7 rounded-lg" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
        <div style={{ ...display, fontWeight: 800, fontSize: 22, color: BLACK }}>
          ИМПОРТ<span style={{ color: RED }}>·</span>CRM
        </div>
        <div style={{ color: MUTED, fontSize: 14, marginTop: 2, marginBottom: 20, fontWeight: 500 }}>
          {mode === "signin" ? "Вход в аккаунт" : "Регистрация"}
        </div>

        <div className="space-y-3">
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded text-base outline-none"
              style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 rounded text-base outline-none"
              style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded text-sm font-semibold" style={{ background: "#FCEBEC", color: RED }}>{error}</div>
          )}
          {notice && (
            <div className="px-3 py-2 rounded text-sm font-semibold" style={{ background: "#E9F6EE", color: "#1D8A4E" }}>{notice}</div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-2.5 rounded text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: RED, color: WHITE, opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {mode === "signin" ? "Войти" : "Зарегистрироваться"}
          </button>

          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}
            className="w-full py-2 text-sm font-semibold"
            style={{ color: MUTED }}
          >
            {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Nav({ tab, setTab, clientsCount, userEmail, isPro, mobileOpen, setMobileOpen }) {
  const [showPrice, setShowPrice] = useState(false);
  const items = [
    { id: "dashboard", label: "Дашборд", icon: LayoutGrid },
    { id: "clients", label: "Клиенты", icon: Users },
    { id: "orders", label: "Заказы", icon: Package },
    { id: "calc", label: "Калькулятор", icon: Calculator },
    { id: "invoices", label: "Накладные", icon: FileText },
  ];
  const used = Math.min(clientsCount, FREE_LIMIT);
  const pct = (used / FREE_LIMIT) * 100;

  const content = (
    <div className="flex flex-col w-60 shrink-0 h-full" style={{ background: BLACK }}>
      <div className="px-5 py-6 flex items-center justify-between">
        <div>
          <div style={{ ...display, color: WHITE, fontWeight: 800, fontSize: 20, letterSpacing: "0.02em" }}>
            ИМПОРТ<span style={{ color: RED }}>·</span>CRM
          </div>
          <div style={{ color: NAV_MUTED, fontSize: 13, marginTop: 2, ...mono }}>ДЛЯ БАЙЕРОВ ИЗ КИТАЯ</div>
        </div>
        <button className="md:hidden p-1" onClick={() => setMobileOpen(false)} style={{ color: WHITE }}>
          <X size={22} />
        </button>
      </div>
      <nav className="flex-1 px-2 overflow-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => { setTab(it.id); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded transition-colors text-left"
              style={{ background: active ? RED : "transparent", color: active ? WHITE : "#D5D8DE" }}
            >
              <Icon size={16} strokeWidth={2} />
              <span style={{ fontSize: 15.5, fontWeight: active ? 700 : 600 }}>{it.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-4" style={{ borderTop: "1px solid #2C2C2C" }}>
        {isPro ? (
          <div className="p-2.5 rounded flex items-center justify-between" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)" }}>
            <div>
              <div style={{ color: "#4ADE80", fontSize: 13, fontWeight: 800, ...mono }}>ТАРИФ PRO</div>
              <div style={{ color: "#8A9099", fontSize: 11.5, fontWeight: 600, marginTop: 1 }}>Безлимит клиентов</div>
            </div>
            <span style={{ fontSize: 18 }}>⭐</span>
          </div>
        ) : (
          <>
            <div>
              <div style={{ color: NAV_MUTED, fontSize: 12.5, fontWeight: 700, ...mono }}>ТАРИФ FREE</div>
              <div style={{ color: "#8A9099", fontSize: 11.5, fontWeight: 600, marginTop: 1 }}>до {FREE_LIMIT} клиентов</div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span style={{ color: "#E5E5E5", fontSize: 13.5, fontWeight: 600 }}>Использовано</span>
              <span style={{ color: WHITE, fontSize: 13.5, fontWeight: 700, ...mono }}>{used}/{FREE_LIMIT}</span>
            </div>
            <div className="w-full h-1.5 rounded mt-1.5" style={{ background: "#3A3A3A" }}>
              <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: pct >= 100 ? RED : "#5A8DEE" }} />
            </div>
          </>
        )}

        {!isPro && (!showPrice ? (
          <button
            onClick={() => setShowPrice(true)}
            className="w-full mt-2.5 py-2 rounded text-sm font-bold flex items-center justify-center gap-1.5"
            style={{ background: RED, color: WHITE }}
          >
            <Lock size={13} /> Приобрести PRO
          </button>
        ) : (
          <div className="mt-2.5 p-2.5 rounded" style={{ background: "#242424" }}>
            <div className="flex items-baseline justify-between">
              <span style={{ color: WHITE, fontSize: 13.5, fontWeight: 700 }}>PRO-версия</span>
              <span style={{ color: "#4ADE80", fontSize: 15, fontWeight: 800, ...mono }}>999₽/мес</span>
            </div>
            <button className="w-full mt-2 py-1.5 rounded text-sm font-bold" style={{ background: RED, color: WHITE }}>
              Оформить подписку
            </button>
          </div>
        ))}

        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid #2C2C2C" }}>
          <span style={{ color: NAV_MUTED, fontSize: 12, fontWeight: 600 }} className="truncate">{userEmail}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ color: NAV_MUTED }} title="Выйти">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: постоянно видимый сайдбар */}
      <div className="hidden md:flex">{content}</div>

      {/* Mobile: верхняя панель с гамбургером */}
      <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ background: BLACK }}>
        <div style={{ ...display, color: WHITE, fontWeight: 800, fontSize: 17 }}>
          ИМПОРТ<span style={{ color: RED }}>·</span>CRM
        </div>
        <button onClick={() => setMobileOpen(true)} style={{ color: WHITE }}>
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile: выпадающая панель поверх контента */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMobileOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>{content}</div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="p-4 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
      <div style={{ color: MUTED, fontSize: 13.5, fontWeight: 700, ...mono }}>{label}</div>
      <div style={{ ...display, fontSize: 29, fontWeight: 800, color: BLACK, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 14, color: accent || MUTED, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ clients, orders }) {
  const totalRevenue = clients.reduce((s, c) => {
    const co = orders.filter((o) => o.clientId === c.id);
    return s + co.reduce((cs, o) => cs + o.price, 0);
  }, 0);
  const regularCount = clients.filter((c) => c.tag === "постоянный").length;
  const inTransit = orders.filter((o) => o.status !== "доставлен");
  const etaDays = inTransit.map((o) => o.estimatedDays).filter((n) => n != null);
  const etaLabel = etaDays.length
    ? `ETA ${Math.min(...etaDays)}–${Math.max(...etaDays)} дней`
    : inTransit.length
    ? "Срок уточняется"
    : "Нет заказов в пути";

  return (
    <div>
      <h1 style={{ ...display, fontSize: 25, fontWeight: 800, color: BLACK }}>Дашборд</h1>
      <p style={{ color: MUTED, fontSize: 15.5, marginTop: 2, fontWeight: 500 }}>Сводка по вашему импорт-бизнесу</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <StatCard label="ОБОРОТ" value={`${totalRevenue.toLocaleString("ru-RU")} ₽`} sub={`По ${orders.length} заказам`} accent="#1D8A4E" />
        <StatCard label="АКТИВНЫХ КЛИЕНТОВ" value={clients.length} sub={`${regularCount} постоянных`} />
        <StatCard label="ЗАКАЗОВ В ПУТИ" value={inTransit.length} sub={etaLabel} />
      </div>

      <div className="mt-6 p-4 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
        <div className="flex items-center gap-2 mb-3">
          <Truck size={15} color={RED} />
          <span style={{ fontWeight: 700, fontSize: 15.5, color: BLACK }}>Заказы в работе</span>
        </div>
        {orders.length === 0 && (
          <div style={{ fontSize: 14.5, color: MUTED, fontWeight: 500, padding: "8px 0" }}>Заказов пока нет — добавь первого клиента и создай заказ.</div>
        )}
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between py-2.5" style={{ borderTop: "1px solid #EEE" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: BLACK }}>{o.client}</div>
              <div style={{ fontSize: 14.5, color: MUTED, fontWeight: 500 }}>{o.item}</div>
            </div>
            <div className="text-right">
              <div
                className="px-2 py-0.5 rounded text-xs font-bold inline-block"
                style={{ background: statusColor(o.status).bg, color: statusColor(o.status).fg }}
              >
                {o.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onSavePayment }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState(order.paymentMethod || "Перевод");
  const [currency, setCurrency] = useState(order.currency || "₽");
  const [status, setStatus] = useState(order.paymentStatus || "Полностью");
  const [paid, setPaid] = useState(order.paidAmount ?? order.price);
  const [route, setRoute] = useState(order.route || "Авто (Гуанчжоу — Москва)");
  const [estimatedDays, setEstimatedDays] = useState(order.estimatedDays || "");
  const [deliveryStatus, setDeliveryStatus] = useState(order.status || "в пути");

  const due = status === "Частично" ? Math.max(0, order.price - Number(paid || 0)) : 0;
  const countdown = deliveryCountdown(order);

  const save = async () => {
    setSaving(true);
    try {
      await onSavePayment(order.id, {
        status: deliveryStatus,
        payment_method: method,
        currency,
        payment_status: status,
        paid_amount: status === "Полностью" ? order.price : Number(paid || 0),
        route,
        estimated_days: estimatedDays === "" ? null : Number(estimatedDays),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded" style={{ border: "1px solid #E0E0E0" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 15, color: BLACK, fontWeight: 700 }}>{order.item}</span>
        <span
          className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ background: statusColor(order.status).bg, color: statusColor(order.status).fg }}
        >
          {order.status}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span style={{ fontSize: 13.5, color: MUTED, fontWeight: 600, ...mono }}>{order.date}</span>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: BLACK, ...mono }}>{order.price.toLocaleString("ru-RU")} ₽</span>
      </div>

      {(order.route || order.estimatedDays || countdown) && (
        <div className="flex items-center justify-between mt-2 px-2.5 py-2 rounded" style={{ background: countdown?.overdue ? "#FCEBEC" : GRAY }}>
          <div>
            {order.route && <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{order.route}</div>}
            {order.estimatedDays && <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginTop: 1 }}>Срок: {order.estimatedDays} дн.</div>}
          </div>
          {countdown && (
            <span style={{ fontSize: 13.5, fontWeight: 800, color: countdown.overdue ? RED : "#1D8A4E" }}>{countdown.label}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed #E0E0E0" }}>
        {!editing ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: GRAY, color: BLACK, fontSize: 13 }}>
                {order.paymentMethod || "—"} · {order.currency || "₽"}
              </span>
              <span
                className="px-2 py-1 rounded font-bold"
                style={{ fontSize: 13, background: order.paymentStatus === "Полностью" ? "#E9F6EE" : "#FFF4DC", color: order.paymentStatus === "Полностью" ? "#1D8A4E" : "#9A6B00" }}
              >
                {order.paymentStatus === "Полностью" ? "Оплачено" : `Долг ${Math.max(0, order.price - (order.paidAmount || 0)).toLocaleString("ru-RU")} ₽`}
              </span>
            </div>
            <button onClick={() => setEditing(true)} style={{ color: MUTED }}>
              <Pencil size={15} />
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Статус доставки</label>
              <select value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)} className="w-full px-2.5 py-2 rounded text-sm font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                <option value="на складе">на складе</option>
                <option value="в пути">в пути</option>
                <option value="доставлен">доставлен</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Маршрут доставки</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className="w-full px-2.5 py-2 rounded text-sm font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                <option>Авто (Гуанчжоу — Москва)</option>
                <option>Ж/Д</option>
                <option>Авиа</option>
                <option>Море</option>
                <option>Мультимодальная</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Ориентировочный срок, дней</label>
              <input
                type="number"
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                placeholder="Например: 25"
                className="w-full px-2.5 py-2 rounded text-sm outline-none"
                style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 800, ...mono, background: WHITE }}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Способ</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-2.5 py-2 rounded text-sm font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                  <option>Наличные</option>
                  <option>Перевод</option>
                  <option>USDT</option>
                </select>
              </div>
              <div className="flex-1">
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Валюта</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-2.5 py-2 rounded text-sm font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                  <option value="₽">₽ рубли</option>
                  <option value="$">$ доллары</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Статус оплаты</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-2.5 py-2 rounded text-sm font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                <option>Полностью</option>
                <option>Частично</option>
              </select>
            </div>
            {status === "Частично" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: "block", marginBottom: 3 }}>Оплаченная сумма, ₽</label>
                <input
                  type="number"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-2 rounded text-sm outline-none"
                  style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 800, ...mono, background: WHITE }}
                />
                <div className="flex items-center justify-between mt-2 px-2.5 py-1.5 rounded" style={{ background: "#FCEBEC" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: RED }}>Долг</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: RED, ...mono }}>{due.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-1.5" style={{ background: BLACK, color: WHITE, opacity: saving ? 0.7 : 1 }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded text-sm font-bold" style={{ background: WHITE, color: BLACK, border: "1px solid #BBB" }}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientDetail({ client, orders, onClose, onSave, onDelete, onSaveOrderPayment, onAddOrder, nextOrderNumber }) {
  const clientOrders = orders.filter((o) => o.clientId === client.id);
  const total = clientOrders.reduce((s, o) => s + o.price, 0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [tag, setTag] = useState(client.tag);
  const [code, setCode] = useState(client.code || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStatus, setNewStatus] = useState("в пути");
  const [newMethod, setNewMethod] = useState("Перевод");
  const [newCurrency, setNewCurrency] = useState("₽");
  const [newPayStatus, setNewPayStatus] = useState("Полностью");
  const [newPaid, setNewPaid] = useState("");
  const [newRoute, setNewRoute] = useState("Авто (Гуанчжоу — Москва)");
  const [newEstDays, setNewEstDays] = useState("");

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave(client.id, { name: name.trim(), tag, code: code.trim() || null });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const priceNum = Number(newPrice || 0);
  const paidNum = newPayStatus === "Полностью" ? priceNum : Number(newPaid || 0);
  const dueNum = Math.max(0, priceNum - paidNum);

  const submitOrder = async () => {
    if (!newItem.trim() || !newPrice) return;
    setBusy(true);
    try {
      await onAddOrder(client.id, {
        order_number: nextOrderNumber,
        item: newItem.trim(),
        price: priceNum,
        status: newStatus,
        route: newRoute,
        estimated_days: newEstDays === "" ? null : Number(newEstDays),
        payment_method: newMethod,
        currency: newCurrency,
        payment_status: newPayStatus,
        paid_amount: paidNum,
      });
      setNewItem(""); setNewPrice(""); setNewStatus("в пути");
      setNewMethod("Перевод"); setNewCurrency("₽"); setNewPayStatus("Полностью"); setNewPaid("");
      setNewRoute("Авто (Гуанчжоу — Москва)"); setNewEstDays("");
      setShowOrderForm(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(client.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-auto p-6" style={{ background: WHITE }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          {!editing ? (
            <div>
              <div style={{ ...display, fontSize: 21, fontWeight: 800, color: BLACK }}>{client.name}</div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: GRAY, color: BLACK }}>{client.tag}</span>
                {client.code && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "#EEF2FF", color: "#4338CA", ...mono }}>
                    код: {client.code}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 pr-3 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя клиента" className="w-full px-3 py-2 rounded text-base font-bold outline-none" style={{ border: "1px solid #CCC", color: BLACK }} />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код клиента (необязательно)" className="w-full px-3 py-2 rounded text-sm outline-none" style={{ border: "1px solid #CCC", color: BLACK, ...mono }} />
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="px-2 py-1.5 rounded text-sm font-semibold outline-none" style={{ border: "1px solid #CCC", color: BLACK, background: WHITE }}>
                <option value="новый">новый</option>
                <option value="постоянный">постоянный</option>
                <option value="опт">опт</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="p-1.5 rounded" style={{ color: MUTED }}><Pencil size={17} /></button>
            ) : (
              <button onClick={save} disabled={busy} className="p-1.5 rounded" style={{ color: "#1D8A4E" }}><Check size={19} /></button>
            )}
            <button onClick={onClose} className="p-1.5 rounded" style={{ color: MUTED }}><X size={19} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <div className="p-3 rounded" style={{ background: GRAY }}>
            <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 700, ...mono }}>ЗАКАЗОВ</div>
            <div style={{ ...display, fontSize: 23, fontWeight: 800, color: BLACK, marginTop: 2 }}>{clientOrders.length}</div>
          </div>
          <div className="p-3 rounded" style={{ background: GRAY }}>
            <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 700, ...mono }}>НА СУММУ</div>
            <div style={{ ...display, fontSize: 23, fontWeight: 800, color: BLACK, marginTop: 2 }}>{total.toLocaleString("ru-RU")} ₽</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <span style={{ fontWeight: 700, fontSize: 15.5, color: BLACK }}>История заказов</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowOrderForm(!showOrderForm)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: RED, color: WHITE }}>
              <Plus size={12} /> Заказ
            </button>
            <button onClick={() => exportToExcel([client], clientOrders, `${client.name.replace(/[«»"]/g, "")}.xlsx`)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: BLACK, color: WHITE }}>
              <Download size={12} /> Excel
            </button>
          </div>
        </div>

        {showOrderForm && (
          <div className="p-3.5 rounded mb-2 space-y-3" style={{ background: GRAY }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Что заказал</label>
              <input autoFocus value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Например: Мотозапчасти, партия 20шт" className="w-full px-3 py-2.5 rounded text-base outline-none" style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 600, background: WHITE }} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Цена, ₽</label>
                <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded text-base outline-none" style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 800, ...mono, background: WHITE }} />
              </div>
              <div className="flex-1">
                <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Статус доставки</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-3 py-2.5 rounded text-base font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                  <option value="на складе">на складе</option>
                  <option value="в пути">в пути</option>
                  <option value="доставлен">доставлен</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Маршрут доставки</label>
                <select value={newRoute} onChange={(e) => setNewRoute(e.target.value)} className="w-full px-3 py-2.5 rounded text-base font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                  <option>Авто (Гуанчжоу — Москва)</option>
                  <option>Ж/Д</option>
                  <option>Авиа</option>
                  <option>Море</option>
                  <option>Мультимодальная</option>
                </select>
              </div>
              <div className="flex-1">
                <label style={{ fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Срок, дней</label>
                <input type="number" value={newEstDays} onChange={(e) => setNewEstDays(e.target.value)} placeholder="25" className="w-full px-3 py-2.5 rounded text-base outline-none" style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 800, ...mono, background: WHITE }} />
              </div>
            </div>

            <div className="pt-2.5 mt-1" style={{ borderTop: "1px solid #DDD" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: BLACK, ...mono, marginBottom: 8 }}>ОПЛАТА</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Способ</label>
                  <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className="w-full px-3 py-2.5 rounded text-base font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                    <option>Наличные</option>
                    <option>Перевод</option>
                    <option>USDT</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Валюта</label>
                  <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} className="w-full px-3 py-2.5 rounded text-base font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                    <option value="₽">₽ рубли</option>
                    <option value="$">$ доллары</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
              </div>
              <div className="mt-2.5">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Статус оплаты</label>
                <select value={newPayStatus} onChange={(e) => setNewPayStatus(e.target.value)} className="w-full px-3 py-2.5 rounded text-base font-bold outline-none" style={{ border: "1px solid #BBB", color: BLACK, background: WHITE }}>
                  <option>Полностью</option>
                  <option>Частично</option>
                </select>
              </div>
              {newPayStatus === "Частично" && (
                <div className="mt-2.5">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: INK, display: "block", marginBottom: 4 }}>Сколько уже оплатил, ₽</label>
                  <input type="number" value={newPaid} onChange={(e) => setNewPaid(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded text-base outline-none" style={{ border: "1px solid #BBB", color: BLACK, fontWeight: 800, ...mono, background: WHITE }} />
                  <div className="flex items-center justify-between mt-2 px-3 py-2 rounded" style={{ background: "#FCEBEC" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: RED }}>Остаток к оплате</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: RED, ...mono }}>{dueNum.toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={submitOrder} disabled={busy} className="flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-1.5" style={{ background: BLACK, color: WHITE, opacity: busy ? 0.7 : 1 }}>
                {busy && <Loader2 size={14} className="animate-spin" />} Сохранить заказ
              </button>
              <button onClick={() => setShowOrderForm(false)} className="px-3 py-2 rounded text-sm font-bold" style={{ background: WHITE, color: BLACK, border: "1px solid #CCC" }}>Отмена</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {clientOrders.map((o) => (
            <OrderCard key={o.id} order={o} onSavePayment={onSaveOrderPayment} />
          ))}
          {clientOrders.length === 0 && (
            <div style={{ fontSize: 15, color: MUTED, textAlign: "center", padding: "20px 0", fontWeight: 500 }}>Заказов пока нет</div>
          )}
        </div>

        <div className="mt-8 pt-4" style={{ borderTop: "1px solid #EEE" }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded text-sm font-bold" style={{ color: RED, border: "1px solid #F0C4CA", background: "#FCEBEC" }}>
              <Trash2 size={15} /> Удалить клиента
            </button>
          ) : (
            <div className="p-3 rounded" style={{ background: "#FCEBEC" }}>
              <div style={{ fontSize: 14, color: RED, fontWeight: 700, marginBottom: 8 }}>Удалить {client.name} и всю историю? Это необратимо.</div>
              <div className="flex gap-2">
                <button onClick={remove} disabled={busy} className="flex-1 py-2 rounded text-sm font-bold" style={{ background: RED, color: WHITE }}>Да, удалить</button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded text-sm font-bold" style={{ background: WHITE, color: BLACK, border: "1px solid #DDD" }}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Clients({ clients, orders, userId, onDataChanged, isPro }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [newClientCode, setNewClientCode] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const atLimit = !isPro && clients.length >= FREE_LIMIT;

  const addClient = async () => {
    if (!name.trim() || atLimit) return;
    setBusy(true);
    try {
      await createClientRemote(userId, name.trim(), newClientCode.trim());
      await onDataChanged();
      setName(""); setNewClientCode("");
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  const saveClient = async (id, patch) => {
    await updateClientRemote(id, patch);
    await onDataChanged();
    setSelected((s) => (s ? { ...s, ...patch } : s));
  };

  const deleteClient = async (id) => {
    await deleteClientRemote(id);
    await onDataChanged();
    setSelected(null);
  };

  const saveOrderPayment = async (orderId, patch) => {
    await updateOrderRemote(orderId, patch);
    await onDataChanged();
  };

  const addOrder = async (clientId, payload) => {
    await createOrderRemote({
      user_id: userId,
      client_id: clientId,
      order_number: `З-${String(1000 + orders.length + 1).slice(-4)}`,
      order_date: new Date().toISOString().slice(0, 10),
      ...payload,
    });
    await onDataChanged();
  };

  const selectedClient = selected ? clients.find((c) => c.id === selected.id) || selected : null;
  const nextOrderNumber = `З-${String(1000 + orders.length + 1).slice(-4)}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ ...display, fontSize: 25, fontWeight: 800, color: BLACK }}>Клиенты</h1>
          <p style={{ color: MUTED, fontSize: 15.5, marginTop: 2, fontWeight: 500 }}>
            {isPro ? `${clients.length} клиентов · PRO без лимита` : `${clients.length} из ${FREE_LIMIT} доступно на Free`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToExcel(clients, orders, "клиенты_и_заказы.xlsx")} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-bold" style={{ background: WHITE, color: BLACK, border: "1px solid #CCC" }}>
            <Download size={15} /> Excel
          </button>
          <button onClick={() => setShowForm(true)} disabled={atLimit} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-bold" style={{ background: atLimit ? "#DDD" : RED, color: WHITE, cursor: atLimit ? "not-allowed" : "pointer" }}>
            <Plus size={15} /> Добавить
          </button>
        </div>
      </div>

      {atLimit && (
        <div className="mt-3 px-3 py-2 rounded text-sm font-bold" style={{ background: "#FCEBEC", color: RED }}>
          Достигнут лимит бесплатного тарифа (5 клиентов) — перейдите на PRO для безлимита
        </div>
      )}

      {showForm && (
        <div className="mt-4 p-4 rounded flex flex-col md:flex-row items-stretch md:items-center gap-2" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addClient()} placeholder="Имя клиента" className="flex-1 px-2.5 py-2 rounded text-sm outline-none" style={{ border: "1px solid #CCC" }} />
          <input value={newClientCode} onChange={(e) => setNewClientCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addClient()} placeholder="Код (необязательно)" className="md:w-40 px-2.5 py-2 rounded text-sm outline-none" style={{ border: "1px solid #CCC", ...mono }} />
          <div className="flex gap-2">
            <button onClick={addClient} disabled={busy} className="flex-1 md:flex-none px-3 py-2 rounded text-sm font-bold" style={{ background: BLACK, color: WHITE }}>Сохранить</button>
            <button onClick={() => setShowForm(false)} className="p-2 rounded" style={{ color: MUTED }}><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded overflow-hidden" style={{ border: "1px solid #E0E0E0" }}>
        <div className="hidden md:grid grid-cols-5 px-4 py-2.5" style={{ background: GRAY, fontSize: 13, fontWeight: 800, color: MUTED, ...mono }}>
          <div>КЛИЕНТ</div><div>ЗАКАЗОВ</div><div>СУММА</div><div>СТАТУС</div><div></div>
        </div>
        {clients.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: MUTED, fontSize: 14.5, fontWeight: 500, background: WHITE }}>
            Пока нет ни одного клиента — нажми "Добавить"
          </div>
        )}
        {clients.map((c) => {
          const co = orders.filter((o) => o.clientId === c.id);
          const coTotal = co.reduce((s, o) => s + o.price, 0);
          return (
            <button key={c.id} onClick={() => setSelected(c)} className="w-full flex flex-col gap-2 md:grid md:grid-cols-5 md:gap-0 px-4 py-3 items-start md:items-center text-left" style={{ background: WHITE, borderTop: "1px solid #EEE" }}>
              <div className="flex items-center justify-between w-full md:block md:w-auto">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: BLACK }}>{c.name}</div>
                  {c.code && <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, ...mono }}>код: {c.code}</div>}
                </div>
                <ChevronRight size={17} color={MUTED_2} className="md:hidden" />
              </div>
              <div className="flex items-center gap-3 md:contents">
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, ...mono }} className="md:hidden">Заказов: {co.length}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: INK, ...mono }} className="hidden md:block">{co.length}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: INK, ...mono }}>{coTotal.toLocaleString("ru-RU")} ₽</div>
              </div>
              <div><span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: GRAY, color: BLACK }}>{c.tag}</span></div>
              <div className="hidden md:flex justify-end"><ChevronRight size={17} color={MUTED_2} /></div>
            </button>
          );
        })}
      </div>

      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          orders={orders}
          onClose={() => setSelected(null)}
          onSave={saveClient}
          onDelete={deleteClient}
          onSaveOrderPayment={saveOrderPayment}
          onAddOrder={addOrder}
          nextOrderNumber={nextOrderNumber}
        />
      )}
    </div>
  );
}

function Orders({ orders, clients }) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ ...display, fontSize: 25, fontWeight: 800, color: BLACK }}>Заказы</h1>
          <p style={{ color: MUTED, fontSize: 15.5, marginTop: 2, fontWeight: 500 }}>{orders.length} активных позиций</p>
        </div>
        <button onClick={() => exportToExcel(clients, orders, "клиенты_и_заказы.xlsx")} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-bold" style={{ background: WHITE, color: BLACK, border: "1px solid #CCC" }}>
          <Download size={15} /> Excel
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {orders.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: MUTED, fontSize: 14.5, fontWeight: 500, background: WHITE, border: "1px solid #E0E0E0", borderRadius: 8 }}>
            Заказов пока нет
          </div>
        )}
        {orders.map((o) => {
          const countdown = deliveryCountdown(o);
          return (
            <div key={o.id} className="flex items-center justify-between p-3.5 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: GRAY }}><Package size={16} color={BLACK} /></div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: BLACK }}>{o.client}</div>
                  <div style={{ fontSize: 14.5, color: MUTED, fontWeight: 500 }}>{o.item}</div>
                  {o.route && <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 600, marginTop: 2 }}>{o.route}</div>}
                  {o.paymentMethod && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-2 py-1 rounded font-bold" style={{ fontSize: 13, background: GRAY, color: BLACK }}>{o.paymentMethod} · {o.currency}</span>
                      <span className="px-2 py-1 rounded font-bold" style={{ fontSize: 13, background: o.paymentStatus === "Полностью" ? "#E9F6EE" : "#FFF4DC", color: o.paymentStatus === "Полностью" ? "#1D8A4E" : "#9A6B00" }}>
                        {o.paymentStatus === "Полностью" ? "Оплачено" : `Долг ${Math.max(0, o.price - (o.paidAmount || 0)).toLocaleString("ru-RU")} ₽`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: 15.5, fontWeight: 700, color: BLACK, ...mono }}>{o.price.toLocaleString("ru-RU")} ₽</div>
                <div className="px-2.5 py-0.5 rounded text-xs font-bold mt-1 inline-block" style={{ background: statusColor(o.status).bg, color: statusColor(o.status).fg }}>{o.status}</div>
                {countdown && <div style={{ fontSize: 13, fontWeight: 800, color: countdown.overdue ? RED : "#1D8A4E", marginTop: 4 }}>{countdown.label}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalcField({ label, value, setValue, unit, step = 1 }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1">
        <label style={{ fontSize: 14, fontWeight: 700, color: INK }}>{label}</label>
        <span className="px-2 py-0.5 rounded" style={{ fontSize: 12.5, fontWeight: 700, color: unit === "%" ? RED : BLACK, background: unit === "%" ? "#FCEBEC" : GRAY, ...mono }}>
          {unit === "%" ? "% ставка" : unit}
        </span>
      </div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => { const v = e.target.value; setValue(v === "" ? "" : parseFloat(v) || 0); }}
        className="w-full px-3 py-2.5 rounded text-base outline-none"
        style={{ border: "1px solid #CCC", ...mono, fontWeight: 700, color: BLACK }}
      />
    </div>
  );
}

const CALC_STORAGE_KEY = "importcrm_calc_draft_v1";
function loadCalcDraft() {
  try {
    const raw = localStorage.getItem(CALC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function CostCalculator({ calculations, userId, onDataChanged }) {
  const draft = loadCalcDraft();
  const [price, setPrice] = useState(draft.price ?? "");
  const [chinaDelivery, setChinaDelivery] = useState(draft.chinaDelivery ?? "");
  const [rate, setRate] = useState(draft.rate ?? "");
  const [weight, setWeight] = useState(draft.weight ?? "");
  const [shipRateUsd, setShipRateUsd] = useState(draft.shipRateUsd ?? "");
  const [usdRate, setUsdRate] = useState(draft.usdRate ?? "");
  const [buyerFee, setBuyerFee] = useState(draft.buyerFee ?? "");
  const [other, setOther] = useState(draft.other ?? "");
  const [marginRub, setMarginRub] = useState(draft.marginRub ?? "");
  const [clientName, setClientName] = useState("");
  const [calcNumber, setCalcNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const n = (v) => (v === "" || v === null || v === undefined || isNaN(v) ? 0 : Number(v));

  useEffect(() => {
    localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify({ price, chinaDelivery, rate, weight, shipRateUsd, usdRate, buyerFee, other, marginRub }));
  }, [price, chinaDelivery, rate, weight, shipRateUsd, usdRate, buyerFee, other, marginRub]);

  const calc = useMemo(() => {
    const priceRub = n(price) * n(rate);
    const chinaDeliveryRub = n(chinaDelivery) * n(rate);
    const shipping = n(weight) * n(shipRateUsd) * n(usdRate);
    const buyerFeeRub = priceRub * (n(buyerFee) / 100);
    const costTotal = priceRub + chinaDeliveryRub + shipping + n(other);
    const profit = buyerFeeRub + n(marginRub);
    const sellPrice = costTotal + profit;
    return { priceRub, chinaDeliveryRub, shipping, buyerFeeRub, costTotal, sellPrice, profit };
  }, [price, chinaDelivery, rate, weight, shipRateUsd, usdRate, buyerFee, other, marginRub]);

  const saveCalculation = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        number: calcNumber.trim() || `Р-${String(calculations.length + 1).padStart(4, "0")}`,
        client_name: clientName.trim() || null,
        price: n(price),
        china_delivery: n(chinaDelivery),
        rate: n(rate),
        weight: n(weight),
        ship_rate_usd: n(shipRateUsd),
        usd_rate: n(usdRate),
        buyer_fee: n(buyerFee),
        other: n(other),
        margin_rub: n(marginRub),
        cost_total: calc.costTotal,
        sell_price: calc.sellPrice,
        profit: calc.profit,
      };
      if (editingId) {
        await updateCalculationRemote(editingId, payload);
      } else {
        await createCalculationRemote({ ...payload, user_id: userId });
      }
      await onDataChanged();
      setClientName("");
      setCalcNumber("");
      setEditingId(null);
    } catch (e) {
      alert("Не удалось сохранить расчёт: " + (e.message || "ошибка"));
    } finally {
      setSaving(false);
    }
  };

  const startEditCalc = (c) => {
    setEditingId(c.id);
    setCalcNumber(c.number || "");
    setClientName(c.clientName || "");
    setPrice(c.price ?? "");
    setChinaDelivery(c.chinaDelivery ?? "");
    setRate(c.rate ?? "");
    setWeight(c.weight ?? "");
    setShipRateUsd(c.shipRateUsd ?? "");
    setUsdRate(c.usdRate ?? "");
    setBuyerFee(c.buyerFee ?? "");
    setOther(c.other ?? "");
    setMarginRub(c.marginRub ?? "");
    setExpanded(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditCalc = () => {
    setEditingId(null);
    setClientName("");
    setCalcNumber("");
  };

  const deleteCalculation = async (id) => {
    try {
      await deleteCalculationRemote(id);
      await onDataChanged();
    } catch (e) {
      alert("Не удалось удалить расчёт: " + (e.message || "ошибка"));
    }
  };

  const Field = CalcField;
  const rows = [
    { label: "Товар (¥ → ₽)", value: calc.priceRub },
    { label: "Доставка по Китаю (¥ → ₽)", value: calc.chinaDeliveryRub },
    { label: "Межд. доставка ($ → ₽)", value: calc.shipping },
    { label: "Прочие расходы", value: n(other) },
  ];
  const maxVal = calc.costTotal;

  return (
    <div>
      <h1 style={{ ...display, fontSize: 25, fontWeight: 800, color: BLACK }}>Калькулятор себестоимости</h1>
      <p style={{ color: MUTED, fontSize: 15.5, marginTop: 2, fontWeight: 500 }}>Закупка, доставка, курс — всё в одном месте</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="p-4 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
          <Field label="Закупочная цена" value={price} setValue={setPrice} unit="юань" />
          <Field label="Доставка по Китаю" value={chinaDelivery} setValue={setChinaDelivery} unit="юань" />
          <Field label="Курс юаня" value={rate} setValue={setRate} unit="₽/¥" step={0.1} />
          <Field label="Вес партии" value={weight} setValue={setWeight} unit="кг" />
          <Field label="Тариф доставки" value={shipRateUsd} setValue={setShipRateUsd} unit="$ / кг" step={0.1} />
          <Field label="Курс доллара" value={usdRate} setValue={setUsdRate} unit="₽ / $" step={0.1} />
          <Field label="Комиссия байера" value={buyerFee} setValue={setBuyerFee} unit="%" />
          <Field label="Прочие расходы" value={other} setValue={setOther} unit="₽" />
          <Field label="Наценка на продажу" value={marginRub} setValue={setMarginRub} unit="₽" step={500} />
        </div>

        <div className="p-4 rounded flex flex-col" style={{ background: BLACK }}>
          <div style={{ color: "#B5B5B5", fontSize: 13, fontWeight: 800, ...mono }}>СТРУКТУРА СЕБЕСТОИМОСТИ</div>
          <div className="mt-3 space-y-2.5">
            {rows.map((r, i) => (
              <div key={i}>
                <div className="flex justify-between" style={{ fontSize: 14, color: "#D5D5D5", fontWeight: 500 }}>
                  <span>{r.label}</span>
                  <span style={{ ...mono, fontWeight: 700, color: WHITE }}>{Math.round(r.value).toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="w-full h-1.5 rounded mt-1" style={{ background: "#3A3A3A" }}>
                  <div className="h-1.5 rounded" style={{ width: `${maxVal > 0 ? Math.min(100, (r.value / maxVal) * 100) : 0}%`, background: RED }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid #3A3A3A" }}>
            <div className="flex justify-between items-baseline">
              <span style={{ color: WHITE, fontSize: 15, fontWeight: 700 }}>Себестоимость</span>
              <span style={{ ...display, color: WHITE, fontSize: 23, fontWeight: 800 }}>{Math.round(calc.costTotal).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between items-baseline mt-2">
              <span style={{ color: "#D5D5D5", fontSize: 15, fontWeight: 700 }}>Цена продажи</span>
              <span style={{ ...display, color: "#4ADE80", fontSize: 23, fontWeight: 800 }}>{Math.round(calc.sellPrice).toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 px-2.5 py-2 rounded" style={{ background: "rgba(200,16,46,0.2)" }}>
              <TrendingUp size={14} color="#FF6B7F" />
              <span style={{ color: WHITE, fontSize: 14.5, fontWeight: 700 }}>Прибыль: {Math.round(calc.profit).toLocaleString("ru-RU")} ₽ с партии</span>
            </div>
            <div className="flex justify-between mt-2" style={{ fontSize: 12.5, color: "#B5B5B5", fontWeight: 600 }}>
              <span>Комиссия {buyerFee || 0}% + наценка</span>
              <span style={mono}>{Math.round(calc.buyerFeeRub).toLocaleString("ru-RU")} + {Math.round(n(marginRub)).toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 p-4 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: BLACK, marginBottom: 10 }}>{editingId ? "Изменить сохранённый расчёт" : "Сохранить этот расчёт"}</div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Имя клиента (необязательно)" className="flex-1 px-3 py-2.5 rounded text-sm outline-none" style={{ border: "1px solid #CCC", color: BLACK, fontWeight: 500 }} />
          <input value={calcNumber} onChange={(e) => setCalcNumber(e.target.value)} placeholder="Номер (необязательно)" className="sm:w-48 px-3 py-2.5 rounded text-sm outline-none" style={{ border: "1px solid #CCC", color: BLACK, fontWeight: 500 }} />
          <button onClick={saveCalculation} disabled={saving} className="px-5 py-2.5 rounded text-sm font-bold flex items-center justify-center gap-2" style={{ background: RED, color: WHITE, opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Сохраняем..." : editingId ? "Сохранить изменения" : "Сохранить расчёт"}
          </button>
          {editingId && (
            <button onClick={cancelEditCalc} className="px-5 py-2.5 rounded text-sm font-bold" style={{ background: GRAY, color: BLACK }}>Отмена</button>
          )}
        </div>
      </div>

      {calculations.length > 0 && (
        <div className="mt-6">
          <div style={{ fontWeight: 700, fontSize: 15.5, color: BLACK, marginBottom: 8 }}>Сохранённые расчёты</div>
          <div className="space-y-2">
            {calculations.map((c) => (
              <div key={c.id} className="rounded overflow-hidden" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="w-full flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: GRAY }}><Calculator size={16} color={BLACK} /></div>
                    <div className="text-left">
                      <div style={{ fontWeight: 700, fontSize: 15, color: BLACK, ...mono }}>{c.number}</div>
                      <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{c.clientName ? `${c.clientName} · ` : ""}{c.date}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: BLACK, ...mono }}>{Math.round(c.sellPrice).toLocaleString("ru-RU")} ₽</div>
                </button>
                {expanded === c.id && (
                  <div className="px-3.5 pb-3.5" style={{ borderTop: "1px solid #EEE" }}>
                    <div className="flex items-center justify-between mt-2 pt-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportCalcToExcel(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: BLACK, color: WHITE }}><Download size={12} /> Excel</button>
                        <button onClick={() => printCalcPDF(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: RED, color: WHITE }}><FileText size={12} /> PDF для клиента</button>
                        <button onClick={() => startEditCalc(c)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: GRAY, color: BLACK }}><Pencil size={12} /> Изменить</button>
                      </div>
                      <button onClick={() => deleteCalculation(c.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ color: RED }}><Trash2 size={13} /> Удалить</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceBuilder({ invoices, userId, onDataChanged }) {
  const blankItem = () => ({ id: Date.now() + Math.random(), name: "", weight: "", volume: "" });
  const [items, setItems] = useState([blankItem()]);
  const [logisticsRate, setLogisticsRate] = useState("");
  const [packaging, setPackaging] = useState("");
  const [insurance, setInsurance] = useState("");
  const [other, setOther] = useState("");
  const [number, setNumber] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const n = (v) => (v === "" || v === null || v === undefined || isNaN(v) ? 0 : Number(v));

  const totals = useMemo(() => {
    const weight = items.reduce((s, it) => s + n(it.weight), 0);
    const volume = items.reduce((s, it) => s + n(it.volume), 0);
    const density = volume > 0 ? weight / volume : 0;
    const logisticsCost = weight * n(logisticsRate);
    const cost = logisticsCost + n(packaging) + n(insurance) + n(other);
    return { weight, volume, density, logisticsCost, cost };
  }, [items, logisticsRate, packaging, insurance, other]);

  const updateItem = (id, field, value) => setItems(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (id) => setItems(items.length > 1 ? items.filter((it) => it.id !== id) : items);

  const saveInvoice = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        number: number.trim() || `Н-${String(invoices.length + 1).padStart(4, "0")}`,
        items: items.filter((it) => it.name.trim()),
        logistics_rate: n(logisticsRate),
        packaging: n(packaging),
        insurance: n(insurance),
        other: n(other),
        total_weight: totals.weight,
        total_volume: totals.volume,
        density: totals.density,
        total: totals.cost,
      };
      if (editingId) {
        await updateInvoiceRemote(editingId, payload);
      } else {
        await createInvoiceRemote({ ...payload, user_id: userId });
      }
      await onDataChanged();
      setItems([blankItem()]);
      setLogisticsRate(""); setPackaging(""); setInsurance(""); setOther(""); setNumber("");
      setEditingId(null);
    } catch (e) {
      alert("Не удалось сохранить накладную: " + (e.message || "ошибка"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (inv) => {
    setEditingId(inv.id);
    setNumber(inv.number || "");
    setItems(inv.items && inv.items.length ? inv.items.map((it) => ({ id: Date.now() + Math.random(), name: it.name, weight: it.weight, volume: it.volume })) : [blankItem()]);
    setLogisticsRate(inv.logisticsRate || "");
    setPackaging(inv.packaging || "");
    setInsurance(inv.insurance || "");
    setOther(inv.other || "");
    setExpanded(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setItems([blankItem()]);
    setLogisticsRate(""); setPackaging(""); setInsurance(""); setOther(""); setNumber("");
  };

  const deleteInvoice = async (id) => {
    try {
      await deleteInvoiceRemote(id);
      await onDataChanged();
    } catch (e) {
      alert("Не удалось удалить накладную: " + (e.message || "ошибка"));
    }
  };

  return (
    <div>
      <h1 style={{ ...display, fontSize: 25, fontWeight: 800, color: BLACK }}>Накладные</h1>
      <p style={{ color: MUTED, fontSize: 15.5, marginTop: 2, fontWeight: 500 }}>Товар, вес и объём — плотность и стоимость доставки в долларах считаются автоматически</p>

      <div className="mt-5 p-4 rounded" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
        <div className="flex items-center justify-between mb-3">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Номер накладной (необязательно)" className="px-3 py-2 rounded text-sm font-semibold outline-none" style={{ border: "1px solid #CCC", color: BLACK, width: 260 }} />
        </div>

        <div className="grid grid-cols-12 gap-2 px-2 py-2" style={{ fontSize: 12.5, fontWeight: 800, color: MUTED, ...mono }}>
          <div className="col-span-5">ТОВАР</div><div className="col-span-3">ВЕС, КГ</div><div className="col-span-3">ОБЪЁМ, М³</div><div className="col-span-1"></div>
        </div>

        {items.map((it) => {
          const density = n(it.volume) > 0 ? Math.round(n(it.weight) / n(it.volume)) : null;
          return (
            <div key={it.id} className="grid grid-cols-12 gap-2 px-2 py-1.5 items-center">
              <input className="col-span-5 px-2.5 py-2 rounded text-sm outline-none" style={{ border: "1px solid #DDD", color: BLACK, fontWeight: 500 }} placeholder="Наименование товара" value={it.name} onChange={(e) => updateItem(it.id, "name", e.target.value)} />
              <input type="number" className="col-span-3 px-2.5 py-2 rounded text-sm outline-none" style={{ border: "1px solid #DDD", ...mono, fontWeight: 700, color: BLACK }} placeholder="0" value={it.weight} onChange={(e) => updateItem(it.id, "weight", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} />
              <input type="number" className="col-span-3 px-2.5 py-2 rounded text-sm outline-none" style={{ border: "1px solid #DDD", ...mono, fontWeight: 700, color: BLACK }} placeholder="0" value={it.volume} onChange={(e) => updateItem(it.id, "volume", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} />
              <div className="col-span-1 flex items-center justify-end"><button onClick={() => removeItem(it.id)} style={{ color: MUTED_2 }}><X size={16} /></button></div>
              {density !== null && <div className="col-span-12 -mt-1 pl-2.5" style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>плотность: {density.toLocaleString("ru-RU")} кг/м³</div>}
            </div>
          );
        })}

        <button onClick={addItem} className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded text-sm font-bold" style={{ color: BLACK }}><Plus size={15} /> Добавить товар</button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid #EEE" }}>
          <div>
            <CalcField label="Тариф логистики" value={logisticsRate} setValue={setLogisticsRate} unit="$ / кг" step={0.1} />
            <div className="-mt-2 mb-3.5 pl-1" style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>
              расчёт: {totals.weight.toLocaleString("ru-RU")} кг × {n(logisticsRate)} $ = <b style={{ color: BLACK }}>{totals.logisticsCost.toLocaleString("ru-RU")} $</b>
            </div>
            <CalcField label="Упаковка" value={packaging} setValue={setPackaging} unit="$" />
          </div>
          <div>
            <CalcField label="Страховка" value={insurance} setValue={setInsurance} unit="$" />
            <CalcField label="Прочие расходы" value={other} setValue={setOther} unit="$" />
          </div>
        </div>

        <div className="mt-2 p-4 rounded" style={{ background: BLACK }}>
          <div className="grid grid-cols-3 gap-3">
            <div><div style={{ fontSize: 12, color: "#B5B5B5", fontWeight: 700, ...mono }}>ОБЩИЙ ВЕС</div><div style={{ ...display, color: WHITE, fontSize: 19, fontWeight: 800, marginTop: 2 }}>{totals.weight.toLocaleString("ru-RU")} кг</div></div>
            <div><div style={{ fontSize: 12, color: "#B5B5B5", fontWeight: 700, ...mono }}>ОБЪЁМ</div><div style={{ ...display, color: WHITE, fontSize: 19, fontWeight: 800, marginTop: 2 }}>{totals.volume.toLocaleString("ru-RU")} м³</div></div>
            <div><div style={{ fontSize: 12, color: "#B5B5B5", fontWeight: 700, ...mono }}>ПЛОТНОСТЬ</div><div style={{ ...display, color: WHITE, fontSize: 19, fontWeight: 800, marginTop: 2 }}>{Math.round(totals.density).toLocaleString("ru-RU")} кг/м³</div></div>
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #3A3A3A" }}>
            <div style={{ fontSize: 12.5, color: "#B5B5B5", fontWeight: 700, ...mono }}>ИТОГОВАЯ СТОИМОСТЬ ДОСТАВКИ</div>
            <div style={{ ...display, color: "#4ADE80", fontSize: 32, fontWeight: 800, marginTop: 4 }}>${totals.cost.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={saveInvoice} disabled={saving} className="flex-1 py-2.5 rounded text-sm font-bold flex items-center justify-center gap-2" style={{ background: RED, color: WHITE, opacity: saving ? 0.7 : 1 }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Сохраняем..." : editingId ? "Сохранить изменения" : "Сохранить накладную"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="px-5 py-2.5 rounded text-sm font-bold" style={{ background: GRAY, color: BLACK }}>Отмена</button>
          )}
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="mt-6">
          <div style={{ fontWeight: 700, fontSize: 15.5, color: BLACK, marginBottom: 8 }}>Сохранённые накладные</div>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="rounded overflow-hidden" style={{ background: WHITE, border: "1px solid #E0E0E0" }}>
                <button onClick={() => setExpanded(expanded === inv.id ? null : inv.id)} className="w-full flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: GRAY }}><FileText size={16} color={BLACK} /></div>
                    <div className="text-left">
                      <div style={{ fontWeight: 700, fontSize: 15, color: BLACK, ...mono }}>{inv.number}</div>
                      <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{inv.items.length} товар(ов) · {inv.date}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: BLACK, ...mono }}>${inv.total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                </button>
                {expanded === inv.id && (
                  <div className="px-3.5 pb-3.5" style={{ borderTop: "1px solid #EEE" }}>
                    {inv.items.map((it, i) => (
                      <div key={i} className="flex justify-between py-1.5" style={{ fontSize: 13.5, color: INK, fontWeight: 500 }}>
                        <span>{it.name}</span><span style={mono}>{it.weight} кг / {it.volume} м³</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid #EEE" }}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportInvoiceToExcel(inv)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: BLACK, color: WHITE }}><Download size={12} /> Excel</button>
                        <button onClick={() => printInvoicePDF(inv)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: RED, color: WHITE }}><FileText size={12} /> PDF для клиента</button>
                        <button onClick={() => startEdit(inv)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ background: GRAY, color: BLACK }}><Pencil size={12} /> Изменить</button>
                      </div>
                      <button onClick={() => deleteInvoice(inv.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold" style={{ color: RED }}><Trash2 size={13} /> Удалить</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ещё не проверили, null = не залогинен
  const [tab, setTab] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    setLoadError("");
    try {
      const rawClients = await fetchClientsRemote();
      const rawOrders = await fetchOrdersRemote();
      const rawInvoices = await fetchInvoicesRemote();
      const rawCalculations = await fetchCalculationsRemote();
      const uiClients = rawClients.map((c) => ({ id: c.id, name: c.name, tag: c.tag, code: c.code }));
      const uiOrders = rawOrders.map((o) => dbOrderToUi(o, uiClients));
      const uiInvoices = rawInvoices.map(dbInvoiceToUi);
      const uiCalculations = rawCalculations.map(dbCalcToUi);
      setClients(uiClients);
      setOrders(uiOrders);
      setInvoices(uiInvoices);
      setCalculations(uiCalculations);
      if (session?.user?.id) {
        const sub = await fetchSubscriptionRemote(session.user.id);
        setIsPro(sub?.plan === "pro" && sub?.status === "active");
      }
    } catch (e) {
      setLoadError(e.message || "Не удалось загрузить данные");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: GRAY }}>
        <Loader2 size={24} className="animate-spin" color={MUTED} />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ background: GRAY, ...display }}>
      <Nav tab={tab} setTab={setTab} clientsCount={clients.length} userEmail={session.user?.email} isPro={isPro} mobileOpen={mobileNavOpen} setMobileOpen={setMobileNavOpen} />
      <div className="flex-1 p-4 md:p-7 overflow-auto">
        {loadingData && (
          <div className="flex items-center gap-2 mb-4" style={{ color: MUTED, fontSize: 14, fontWeight: 600 }}>
            <Loader2 size={16} className="animate-spin" /> Загрузка данных из базы...
          </div>
        )}
        {loadError && (
          <div className="mb-4 px-3 py-2 rounded text-sm font-semibold" style={{ background: "#FCEBEC", color: RED }}>{loadError}</div>
        )}
        {tab === "dashboard" && <Dashboard clients={clients} orders={orders} />}
        {tab === "clients" && <Clients clients={clients} orders={orders} userId={session.user.id} onDataChanged={loadData} isPro={isPro} />}
        {tab === "orders" && <Orders orders={orders} clients={clients} />}
        {tab === "calc" && <CostCalculator calculations={calculations} userId={session.user.id} onDataChanged={loadData} />}
        {tab === "invoices" && <InvoiceBuilder invoices={invoices} userId={session.user.id} onDataChanged={loadData} />}
      </div>
    </div>
  );
}
