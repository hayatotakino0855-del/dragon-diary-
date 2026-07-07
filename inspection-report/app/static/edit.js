// テンプレート編集画面
const TYPES = {
  bilateral: "両側公差",
  bilateral_with_sub: "両側+サブ",
  unilateral: "片側(以下)",
  weight: "重量",
  visual: "外観(○×)",
  measured: "実測値記入",
};
const tbody = document.querySelector("#chars-table tbody");
let productId = null;

function charRow(c = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="drag" title="ドラッグまたは▲▼で並べ替え">
      <button type="button" class="ghost" data-move="-1">▲</button>
      <button type="button" class="ghost" data-move="1">▼</button></td>
    <td class="narrow"><input name="number" type="number" value="${c.number ?? ""}"
        placeholder="自動"></td>
    <td><input name="name" value="${escAttr(c.name)}" placeholder="A面 外径"></td>
    <td><select name="type">${Object.entries(TYPES).map(([k, v]) =>
      `<option value="${k}" ${c.type === k ? "selected" : ""}>${v}</option>`).join("")}
    </select></td>
    <td class="narrow"><input name="center_value" value="${escAttr(c.center_value)}"></td>
    <td class="narrow"><input name="tolerance" value="${escAttr(c.tolerance)}"></td>
    <td><input name="sub_name" value="${escAttr(c.sub_name)}"></td>
    <td class="narrow"><input name="sub_tolerance" value="${escAttr(c.sub_tolerance)}"></td>
    <td class="narrow"><input name="axis_range" type="number" step="0.1"
        value="${c.axis_range ?? ""}" placeholder="自動"></td>
    <td class="narrow"><input name="axis_step" type="number" step="0.05"
        value="${c.axis_step ?? ""}" placeholder="0.1"></td>
    <td><button type="button" class="danger" data-del>×</button></td>`;
  tr.querySelector("[data-del]").onclick = () => tr.remove();
  for (const b of tr.querySelectorAll("[data-move]")) {
    b.onclick = () => {
      const dir = Number(b.dataset.move);
      const target = dir < 0 ? tr.previousElementSibling : tr.nextElementSibling;
      if (target) dir < 0 ? tbody.insertBefore(tr, target)
                          : tbody.insertBefore(target, tr);
    };
  }
  // visual用: 判定基準はサブ名称欄を流用せず hidden で保持
  tr.dataset.criteria = c.criteria || "";
  return tr;
}

function escAttr(s) { return esc(s).replaceAll('"', "&quot;"); }

function collect() {
  const chars = [];
  for (const tr of tbody.children) {
    const g = (n) => tr.querySelector(`[name=${n}]`).value.trim();
    chars.push({
      number: g("number") ? Number(g("number")) : null,
      name: g("name"),
      type: g("type"),
      center_value: g("center_value"),
      tolerance: g("tolerance"),
      sub_name: g("sub_name"),
      sub_tolerance: g("sub_tolerance"),
      criteria: tr.dataset.criteria || "",
      axis_range: g("axis_range") ? Number(g("axis_range")) : null,
      axis_step: g("axis_step") ? Number(g("axis_step")) : null,
    });
  }
  return {
    name: document.getElementById("t-name").value.trim(),
    sheet_name: document.getElementById("t-sheet-name").value.trim(),
    author: document.getElementById("t-author").value.trim(),
    date_label: document.getElementById("t-date-label").value,
    special_notes: document.getElementById("t-notes").value,
    characteristics: chars,
  };
}

async function load() {
  const t = await api(`/api/templates/${TEMPLATE_ID}`);
  productId = t.product_id;
  document.getElementById("edit-title").textContent =
    `テンプレート編集: ${t.name} (Rev.${t.revision})`;
  setVal("t-name", t.name);
  setVal("t-sheet-name", t.sheet_name);
  setVal("t-author", t.author);
  setVal("t-date-label", t.date_label);
  setVal("t-notes", t.special_notes);
  setVal("p-part-no", t.product.part_no);
  setVal("p-drawing-no", t.product.drawing_no);
  setVal("p-material", t.product.material);
  setVal("p-container", t.product.container_qty_note);
  setVal("p-frequency", t.product.frequency_note);
  tbody.innerHTML = "";
  for (const c of t.characteristics) tbody.appendChild(charRow(c));

  const masters = await api("/api/char-masters");
  const sel = document.getElementById("master-select");
  for (const m of masters) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = `${m.name} (${TYPES[m.type] || m.type})`;
    o.dataset.def = JSON.stringify(m);
    sel.appendChild(o);
  }
}

function setVal(id, v) { document.getElementById(id).value = v ?? ""; }

async function saveAll() {
  const body = collect();
  if (!body.name) { toast("帳票名を入力してください", true); return null; }
  // 品番側の情報も保存
  const p = {
    company_id: null, part_no: val("p-part-no"), drawing_no: val("p-drawing-no"),
    material: val("p-material"), container_qty_note: val("p-container"),
    frequency_note: val("p-frequency"),
  };
  const prod = (await api(`/api/templates/${TEMPLATE_ID}`)).product;
  p.company_id = prod.company_id;
  await api(`/api/products/${productId}`, { method: "PUT", body: JSON.stringify(p) });
  const r = await api(`/api/templates/${TEMPLATE_ID}`, {
    method: "PUT", body: JSON.stringify(body) });
  showWarnings(r.warnings);
  return r;
}

function val(id) { return document.getElementById(id).value.trim(); }

function showWarnings(warnings) {
  const el = document.getElementById("fit-warning");
  const shrinkBtn = document.getElementById("btn-shrink");
  if (warnings && warnings.length) {
    el.textContent = "⚠ " + warnings.join(" / ");
    shrinkBtn.classList.remove("hidden");
  } else {
    el.textContent = "";
    shrinkBtn.classList.add("hidden");
  }
}

document.getElementById("btn-add-char").onclick = () =>
  tbody.appendChild(charRow({ type: "bilateral" }));

document.getElementById("master-select").onchange = (e) => {
  const opt = e.target.selectedOptions[0];
  if (opt && opt.dataset.def) {
    tbody.appendChild(charRow(JSON.parse(opt.dataset.def)));
    e.target.value = "";
  }
};

document.getElementById("btn-save").onclick = async () => {
  try {
    const r = await saveAll();
    if (r) toast(r.warnings.length ? "保存しました(警告あり)" : "保存しました",
                 r.warnings.length > 0);
  } catch (err) { toast(err.message, true); }
};

document.getElementById("btn-preview").onclick = async () => {
  try {
    await saveAll();
    const dlg = document.getElementById("dlg-preview");
    document.getElementById("preview-frame").src =
      `/api/templates/${TEMPLATE_ID}/preview?ts=${Date.now()}`;
    dlg.showModal();
  } catch (err) { toast(err.message, true); }
};
document.getElementById("btn-close-preview").onclick = () =>
  document.getElementById("dlg-preview").close();

document.getElementById("btn-export").onclick = async () => {
  try {
    await saveAll();
    downloadExport([TEMPLATE_ID]);
  } catch (err) { toast(err.message, true); }
};

document.getElementById("btn-shrink").onclick = async () => {
  try {
    await saveAll();
    const r = await api(`/api/templates/${TEMPLATE_ID}/auto-shrink`, { method: "POST" });
    await load();
    showWarnings(r.warnings);
    toast(r.changed ? "軸延長範囲を自動短縮しました" : "短縮できる軸がありません",
          !r.changed || r.warnings.length > 0);
  } catch (err) { toast(err.message, true); }
};

load().catch((err) => toast(err.message, true));
