/* RupeeTrack – script.js
   Flow: state (from localStorage) -> render functions draw the UI from state -> user actions change state -> save() + renderAll(). */

/* ---------- 1. DATA & CONSTANTS ---------- */
const KEY_TX = "rt_transactions",
  KEY_LIM = "rt_limits",
  KEY_USER = "rt_user";
const TARGET_RATE = 30; // savings-rate goal (%) used by the Vibe Check badge

// Category name -> emoji, bar colour, and whether it is income or expense
const CATS = {
  Rent: { icon: "🏠", color: "#8B5CF6", type: "expense" },
  Food: { icon: "🍕", color: "#EC4899", type: "expense" },
  Groceries: { icon: "🛒", color: "#34D399", type: "expense" },
  Shopping: { icon: "🛍️", color: "#A78BFA", type: "expense" },
  Utilities: { icon: "💡", color: "#FACC15", type: "expense" },
  Transport: { icon: "🚕", color: "#22D3EE", type: "expense" },
  Other: { icon: "📦", color: "#9CA3AF", type: "expense" },
  Salary: { icon: "💼", color: "#34D399", type: "income" },
  Freelance: { icon: "🎨", color: "#34D399", type: "income" },
  "Pocket Money": { icon: "👛", color: "#34D399", type: "income" },
};
const EXPENSE_CATS = Object.keys(CATS).filter(
  (c) => CATS[c].type === "expense",
);
const DEFAULT_LIMITS = {
  Rent: 12000,
  Food: 6000,
  Groceries: 4000,
  Shopping: 4000,
  Utilities: 2500,
  Transport: 2500,
  Other: 2000,
};

let transactions = []; // array of {id, title, amount, type, category, date}
let limits = {}; // {category: monthly ₹ limit}
let user = "You";
let ui = { period: "month", filter: "all", search: "", formType: "expense" };

/* ---------- 2. SMALL HELPERS ---------- */
const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().slice(0, 10); // "2026-11-21"
const thisMonth = () => todayStr().slice(0, 7); // "2026-11"
const inr = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
// Escape user text before putting it in innerHTML (stops someone typing <script> as a title)
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Simple unique ID (works even when opened via file://, unlike crypto.randomUUID)
const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);
const sum = (list) => list.reduce((s, t) => s + t.amount, 0);

// Shows a small popup message (warn = red style)
function toast(msg, warn = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "show" + (warn ? " warn" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = ""), 2600);
}

/* ---------- 3. STORAGE ---------- */
// Saves current data to the browser's localStorage so it survives refresh
function save() {
  localStorage.setItem(KEY_TX, JSON.stringify(transactions));
  localStorage.setItem(KEY_LIM, JSON.stringify(limits));
  localStorage.setItem(KEY_USER, user);
}

// Creates sample data (dates are placed in the current month)
function seedData() {
  const day = (d) =>
    `${thisMonth()}-${String(Math.min(d, new Date().getDate())).padStart(2, "0")}`;
  const mk = (d, title, amount, type, category) => ({
    id: newId(),
    title,
    amount,
    type,
    category,
    date: day(d),
  });
  transactions = [
    mk(1, "Monthly stipend / pocket money", 15000, "income", "Pocket Money"),
    mk(2, "Freelance website project", 12500, "income", "Freelance"),
    mk(3, "Hostel rent", 7000, "expense", "Rent"),
    mk(6, "Swiggy dinner", 480, "expense", "Food"),
    mk(9, "Blinkit groceries", 1240, "expense", "Groceries"),
    mk(12, "Jio recharge + WiFi", 799, "expense", "Utilities"),
    mk(15, "Myntra hoodie", 1899, "expense", "Shopping"),
    mk(18, "Metro card + Uber", 650, "expense", "Transport"),
  ];
  limits = { ...DEFAULT_LIMITS };
}

// Runs once at startup: load from localStorage, or seed if empty
function loadData() {
  try {
    transactions = JSON.parse(localStorage.getItem(KEY_TX));
    limits = JSON.parse(localStorage.getItem(KEY_LIM));
  } catch {
    transactions = null;
  }
  user = localStorage.getItem(KEY_USER) || "You";
  if (!Array.isArray(transactions) || !limits) {
    seedData();
    save();
  }
}

/* ---------- 4. CALCULATIONS ---------- */
// Transactions that match the "This month / All time" toggle
function periodTx() {
  return ui.period === "all"
    ? transactions
    : transactions.filter((t) => t.date.startsWith(thisMonth()));
}
// Total spent per expense category for a list of transactions
function spendByCat(list) {
  const out = {};
  list
    .filter((t) => t.type === "expense")
    .forEach((t) => (out[t.category] = (out[t.category] || 0) + t.amount));
  return out;
}

/* ---------- 5. RENDER: SUMMARY CARDS (Home) ---------- */
function renderSummary() {
  const list = periodTx();
  const inflow = sum(list.filter((t) => t.type === "income"));
  const outflow = sum(list.filter((t) => t.type === "expense"));
  const net = inflow - outflow;
  const rate = inflow > 0 ? (net / inflow) * 100 : 0;
  const budget = Object.values(limits).reduce((a, b) => a + Number(b), 0);

  $("sumIn").textContent = inr(inflow);
  $("sumInSub").textContent =
    `${list.filter((t) => t.type === "income").length} income entries`;
  $("sumOut").textContent = inr(outflow);
  $("sumOutSub").textContent =
    inflow > 0
      ? `${((outflow / inflow) * 100).toFixed(1)}% of inflow • Total limits ${inr(budget)}`
      : `Total limits ${inr(budget)}`;
  $("sumNet").textContent = (net < 0 ? "-" : "") + inr(Math.abs(net));
  $("sumNet").className = "big mono " + (net < 0 ? "out" : "in");
  $("sumNetSub").textContent =
    `${rate.toFixed(1)}% savings rate • goal ${TARGET_RATE}%`;

  // "Vibe Check" badge: depends on savings rate
  let text,
    cls = "pill good";
  if (!list.length) {
    text = "No data yet";
    cls = "pill";
  } else if (net < 0) {
    text = "In the red 🚨";
    cls = "pill bad";
  } else if (rate >= TARGET_RATE) {
    text = "Slaying the budget 🔥";
  } else if (rate >= 10) {
    text = "Mid, but alive 😐";
    cls = "pill";
  } else {
    text = "Tight month ⚠️";
    cls = "pill bad";
  }
  $("vibe").textContent = text;
  $("vibe").className = cls;
}

/* ---------- 6. RENDER: TRANSACTION ROWS ---------- */
// Builds the HTML for one transaction row
function rowHTML(t, actions) {
  const c = CATS[t.category] || CATS.Other,
    sign = t.type === "income" ? "+" : "-";
  return `<div class="row">
    <div class="ico">${c.icon}</div>
    <div class="mid"><b>${esc(t.title)}</b><span>${esc(t.category)} • ${esc(t.date)}</span></div>
    <b class="mono ${t.type === "income" ? "in" : "out"}">${sign}${inr(t.amount)}</b>
    ${actions ? `<div class="acts"><button data-edit="${t.id}">Edit</button><button data-del="${t.id}">Delete</button></div>` : ""}
  </div>`;
}
// Builds one <tr> for the Ledger table
function tableRowHTML(t) {
  const c = CATS[t.category] || CATS.Other,
    inc = t.type === "income";
  return `<tr>
    <td class="mono">${esc(t.date)}</td>
    <td>${c.icon} ${esc(t.title)}</td>
    <td>${esc(t.category)}</td>
    <td><span class="pill ${inc ? "good" : "bad"}">${inc ? "Income" : "Expense"}</span></td>
    <td class="r mono ${inc ? "in" : "out"}">${inc ? "+" : "-"}${inr(t.amount)}</td>
    <td class="acts"><button data-edit="${t.id}">Edit</button><button data-del="${t.id}">Delete</button></td>
  </tr>`;
}
const newestFirst = (a, b) => b.date.localeCompare(a.date);

// Home tab: only the 5 latest transactions
function renderRecent() {
  const list = [...transactions].sort(newestFirst).slice(0, 5);
  $("recentList").innerHTML = list.length
    ? list.map((t) => rowHTML(t, true)).join("")
    : `<p class="empty">Nothing logged yet. Add your first transaction.</p>`;
}

// Ledger tab: applies the search box + filter chips
function filteredTx() {
  const q = ui.search.trim().toLowerCase(),
    f = ui.filter;
  return transactions
    .filter(
      (t) =>
        (f === "all" || f === t.type || f === t.category) &&
        (!q ||
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)),
    )
    .sort(newestFirst);
}
function renderLedger() {
  const chips = ["all", "income", "expense", ...EXPENSE_CATS];
  $("chips").innerHTML = chips
    .map(
      (c) =>
        `<button class="chip ${ui.filter === c ? "active" : ""}" data-chip="${c}">${c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}</button>`,
    )
    .join("");
  const list = filteredTx();
  $("countPill").textContent = list.length + " items";
  $("ledgerBody").innerHTML = list.length
    ? list.map(tableRowHTML).join("")
    : `<tr><td colspan="6" class="empty">No transactions match your search or filter.</td></tr>`;
}

/* ---------- 7. RENDER: INSIGHTS ---------- */
function renderInsights() {
  const list = periodTx(),
    exp = list.filter((t) => t.type === "expense");
  const by = spendByCat(list),
    total = sum(exp);
  const sorted = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const biggest = [...exp].sort((a, b) => b.amount - a.amount)[0];

  const stats = [
    ["Transactions", list.length],
    ["Avg expense", exp.length ? inr(total / exp.length) : "—"],
    ["Biggest expense", biggest ? inr(biggest.amount) : "—"],
    ["Top category", sorted[0] ? sorted[0][0] : "—"],
  ];
  $("statCards").innerHTML = stats
    .map(
      ([l, v]) =>
        `<div class="bento p-5"><p class="label">${l}</p><p class="mono text-2xl font-bold">${esc(v)}</p></div>`,
    )
    .join("");

  $("totalSpent").textContent = inr(total);
  $("stackBar").innerHTML = sorted
    .map(
      ([c, v]) =>
        `<div style="width:${(v / total) * 100}%;background:${CATS[c].color}"></div>`,
    )
    .join("");
  $("breakdown").innerHTML = sorted.length
    ? sorted
        .map(([c, v]) => {
          const pct = (v / total) * 100;
          return `<div><div class="flex justify-between text-sm mb-1"><span>${CATS[c].icon} ${esc(c)}</span><span class="mono">${pct.toFixed(1)}% • ${inr(v)}</span></div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${CATS[c].color}"></div></div></div>`;
        })
        .join("")
    : `<p class="empty">No expenses in this period.</p>`;
  $("insightText").textContent = sorted.length
    ? `${sorted[0][0]} takes ${((sorted[0][1] / total) * 100).toFixed(0)}% of your spending. Cutting it by 10% would save ${inr(sorted[0][1] * 0.1)}.`
    : "Add some expenses to see insights.";
}

/* ---------- 8. RENDER: LIMITS ---------- */
// Always uses THIS month's spending, regardless of the period toggle
function renderLimits() {
  const spent = spendByCat(
    transactions.filter((t) => t.date.startsWith(thisMonth())),
  );
  $("limitList").innerHTML = EXPENSE_CATS.map((c) => {
    const lim = Number(limits[c]) || 0,
      s = spent[c] || 0;
    const pct = lim > 0 ? Math.min((s / lim) * 100, 100) : s > 0 ? 100 : 0;
    const over = lim > 0 && s > lim,
      near = lim > 0 && s >= lim * 0.8 && !over;
    const color = over ? "#F43F5E" : near ? "#FACC15" : "#34D399";
    const msg = over
      ? `<span class="out">Over by ${inr(s - lim)}</span>`
      : near
        ? `<span style="color:#FACC15">Close to the limit</span>`
        : lim
          ? `${inr(lim - s)} left`
          : "No limit set";
    return `<div class="lim"><div class="flex justify-between items-center gap-3 mb-2">
        <span>${CATS[c].icon} ${c}</span>
        <label class="flex items-center gap-2 text-sm">Limit ₹<input class="field" type="number" min="0" value="${lim}" data-limit="${c}" aria-label="${c} monthly limit" /></label></div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
      <p class="sub mt-1 mono">${inr(s)} of ${inr(lim)} • ${msg}</p></div>`;
  }).join("");
}

// Re-draws everything (called after any change)
function renderAll() {
  $("userName").textContent = user;
  $("avatar").textContent = user.trim().charAt(0).toUpperCase() || "U";
  $("greeting").textContent = `What's the play, ${user}?`;
  $("monthLabel").textContent =
    ui.period === "all"
      ? "All time"
      : new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  renderSummary();
  renderRecent();
  renderInsights();
  renderLimits();
  renderLedger();
}

/* ---------- 9. FORM: VALIDATE, ADD, EDIT ---------- */
// Fills the category dropdown based on Expense/Income choice
function fillCategories(selected) {
  const cats = Object.keys(CATS).filter((c) => CATS[c].type === ui.formType);
  $("fCat").innerHTML = cats
    .map((c) => `<option ${c === selected ? "selected" : ""}>${c}</option>`)
    .join("");
}
function setFormType(type, selectedCat) {
  ui.formType = type;
  document
    .querySelectorAll("#typeSeg button")
    .forEach((b) => b.classList.toggle("active", b.dataset.t === type));
  fillCategories(selectedCat);
}
function showError(inputId, errId, msg) {
  $(errId).textContent = msg;
  $(inputId).classList.toggle("bad", !!msg);
}

// Checks the 3 fields; returns true only if all are valid
function validateForm() {
  const title = $("fTitle").value.trim(),
    amount = Number($("fAmount").value),
    date = $("fDate").value;
  const badTitle = !title ? "Title can't be empty." : "";
  const badAmt =
    $("fAmount").value === "" || isNaN(amount)
      ? "Enter a valid amount."
      : amount <= 0
        ? "Amount must be greater than ₹0."
        : "";
  const badDate = !date ? "Pick a date." : "";
  showError("fTitle", "eTitle", badTitle);
  showError("fAmount", "eAmount", badAmt);
  showError("fDate", "eDate", badDate);
  return !(badTitle || badAmt || badDate);
}

function resetForm() {
  $("txForm").reset();
  $("editId").value = "";
  $("fDate").value = todayStr();
  ["fTitle:eTitle", "fAmount:eAmount", "fDate:eDate"].forEach((p) =>
    showError(...p.split(":"), ""),
  );
  setFormType("expense");
  $("formTitle").textContent = "Fast drop";
  $("submitBtn").textContent = "Add transaction";
  $("cancelBtn").classList.add("hidden");
}

// Form submit: ADD a new transaction, or UPDATE one if editId is set
function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;
  const data = {
    title: $("fTitle").value.trim(),
    amount: Math.round(Number($("fAmount").value) * 100) / 100,
    type: ui.formType,
    category: $("fCat").value,
    date: $("fDate").value,
  };
  const id = $("editId").value;
  if (id) {
    Object.assign(
      transactions.find((t) => t.id === id),
      data,
    );
    toast("Transaction updated");
  } else {
    transactions.push({ id: newId(), ...data });
    toast("Transaction added");
  }
  save();
  resetForm();
  renderAll();
  // Warn if this expense pushed the category over its monthly limit
  if (data.type === "expense" && data.date.startsWith(thisMonth())) {
    const spent =
        spendByCat(transactions.filter((t) => t.date.startsWith(thisMonth())))[
          data.category
        ] || 0,
      lim = Number(limits[data.category]) || 0;
    if (lim > 0 && spent > lim)
      toast(
        `⚠️ ${data.category} is over its limit by ${inr(spent - lim)}`,
        true,
      );
  }
}

// Edit: load a transaction into the form (Home tab)
function startEdit(id) {
  const t = transactions.find((x) => x.id === id);
  if (!t) return;
  switchView("home");
  setFormType(t.type, t.category);
  $("editId").value = t.id;
  $("fTitle").value = t.title;
  $("fAmount").value = t.amount;
  $("fDate").value = t.date;
  $("formTitle").textContent = "Edit transaction";
  $("submitBtn").textContent = "Save changes";
  $("cancelBtn").classList.remove("hidden");
  $("fTitle").focus();
}

// Delete: remove after confirmation
function deleteTx(id) {
  if (!confirm("Delete this transaction?")) return;
  transactions = transactions.filter((t) => t.id !== id);
  if ($("editId").value === id) resetForm();
  save();
  renderAll();
  toast("Transaction deleted");
}

/* ---------- 10. EXPORT & RESET ---------- */
// Builds a CSV text from all transactions and downloads it as a file
function exportCSV() {
  if (!transactions.length) return toast("Nothing to export yet", true);
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`; // wrap in quotes so commas don't break columns
  const rows = [
    ["Date", "Title", "Type", "Category", "Amount (INR)"],
    ...[...transactions]
      .sort(newestFirst)
      .map((t) => [t.date, t.title, t.type, t.category, t.amount]),
  ];
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(q).join(",")).join("\n")],
    { type: "text/csv" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rupeetrack-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
// Export to Excel: builds a 2-sheet .xlsx with SheetJS (window.XLSX). Falls back to CSV if the library didn't load.
function exportExcel() {
  if (!transactions.length) return toast("Nothing to export yet", true);
  if (!window.XLSX) {
    // CDN blocked / no Wi-Fi -> library is undefined
    toast(
      "Offline mode: Excel library unavailable, exported CSV instead",
      true,
    );
    return exportCSV();
  }
  const income = sum(transactions.filter((t) => t.type === "income"));
  const expense = sum(transactions.filter((t) => t.type === "expense"));
  const net = income - expense;
  const rate = income > 0 ? Math.round((net / income) * 10000) / 100 : 0;

  // Sheet 1 (Summary): aoa_to_sheet turns an "array of arrays" into rows/cells
  const aoa = [
    ["RupeeTrack Summary"],
    [],
    ["Total Income (INR)", income],
    ["Total Expenses (INR)", expense],
    ["Net Savings (INR)", net],
    ["Savings Rate (%)", rate],
    [],
    ["Category", "Spent (INR)", "Share (%)"],
    ...Object.entries(spendByCat(transactions))
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => [
        c,
        v,
        expense ? Math.round((v / expense) * 10000) / 100 : 0,
      ]),
  ];
  const summary = XLSX.utils.aoa_to_sheet(aoa);
  summary["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }]; // column widths

  // Sheet 2 (Transactions): json_to_sheet turns an array of objects into a table;
  // the object keys become the header row, so we build objects with the exact column names we want.
  const rows = [...transactions].sort(newestFirst).map((t) => ({
    Date: t.date,
    Title: t.title,
    Type: t.type,
    Category: t.category,
    "Amount (INR)": t.amount,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
  ];

  // A workbook is a container of sheets; writeFile builds the .xlsx and triggers the browser download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summary, "Summary");
  XLSX.utils.book_append_sheet(wb, sheet, "Transactions");
  XLSX.writeFile(wb, `RupeeTrack_${todayStr()}.xlsx`);
  toast("Excel file exported");
}
function resetDemo() {
  if (
    !confirm("This erases ALL your data and restores the demo data. Continue?")
  )
    return;
  seedData();
  save();
  resetForm();
  renderAll();
  toast("Demo data restored");
}

/* ---------- 11. NAVIGATION ---------- */
// Shows one view, hides the others, highlights the active tab
function switchView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  history.replaceState(null, "", "#" + name); // keep the URL hash in sync (no page jump)
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 12. EVENT LISTENERS ---------- */
function bindEvents() {
  // Nav links are <a href="#home"> etc.; preventDefault stops the browser jumping, JS swaps the view instead
  $("tabs").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    switchView(link.dataset.view);
  });
  document
    .querySelector("[data-go]")
    .addEventListener("click", (e) => switchView(e.target.dataset.go));
  $("period").addEventListener("click", (e) => {
    if (!e.target.dataset.p) return;
    ui.period = e.target.dataset.p;
    document
      .querySelectorAll("#period button")
      .forEach((b) => b.classList.toggle("active", b === e.target));
    renderAll();
  });
  $("typeSeg").addEventListener(
    "click",
    (e) => e.target.dataset.t && setFormType(e.target.dataset.t),
  );
  $("txForm").addEventListener("submit", handleSubmit);
  $("cancelBtn").addEventListener("click", resetForm);
  // One listener handles Edit/Delete buttons in both lists (event delegation)
  ["recentList", "ledgerBody"].forEach((id) =>
    $(id).addEventListener("click", (e) => {
      if (e.target.dataset.edit) startEdit(e.target.dataset.edit);
      if (e.target.dataset.del) deleteTx(e.target.dataset.del);
    }),
  );
  $("search").addEventListener("input", (e) => {
    ui.search = e.target.value;
    renderLedger();
  });
  $("chips").addEventListener("click", (e) => {
    if (e.target.dataset.chip) {
      ui.filter = e.target.dataset.chip;
      renderLedger();
    }
  });
  // Limits: save when the user finishes typing a new number
  $("limitList").addEventListener("change", (e) => {
    const c = e.target.dataset.limit;
    if (!c) return;
    const v = Number(e.target.value);
    if (isNaN(v) || v < 0) {
      toast("Limit must be 0 or more", true);
      return renderLimits();
    }
    limits[c] = v;
    save();
    renderAll();
    toast(`${c} limit set to ${inr(v)}`);
  });
  $("csvBtn").addEventListener("click", exportCSV);
  $("excelBtn").addEventListener("click", exportExcel);
  $("resetBtn").addEventListener("click", resetDemo);
  // Avatar: click to change the displayed name
  $("userBtn").addEventListener("click", () => {
    const n = prompt("Your name:", user);
    if (n && n.trim()) {
      user = n.trim().slice(0, 20);
      save();
      renderAll();
    }
  });
}

/* ---------- 13. START ---------- */
loadData();
bindEvents();
resetForm();
renderAll();
if (["home", "insights", "limits", "ledger"].includes(location.hash.slice(1)))
  switchView(location.hash.slice(1)); // open the tab named in the URL
