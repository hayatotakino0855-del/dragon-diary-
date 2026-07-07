// 一覧画面: 会社 → 品番 → テンプレートのツリー表示 + フィルター
const treeEl = document.getElementById("tree");

async function search() {
  const params = new URLSearchParams({
    q: val("f-q"), company: val("f-company"), part_no: val("f-part"),
    drawing_no: val("f-drawing"), template: val("f-template"),
    archived: document.getElementById("f-archived").checked ? 1 : 0,
  });
  const rows = await api(`/api/tree?${params}`);
  render(rows);
}

function val(id) { return document.getElementById(id).value.trim(); }

function render(rows) {
  const companies = new Map();
  for (const r of rows) {
    if (!companies.has(r.company_id)) {
      companies.set(r.company_id, { name: r.company_name, products: new Map() });
    }
    const comp = companies.get(r.company_id);
    if (r.product_id && !comp.products.has(r.product_id)) {
      comp.products.set(r.product_id, { ...r, templates: [] });
    }
    if (r.template_id) {
      comp.products.get(r.product_id).templates.push(r);
    }
  }
  treeEl.innerHTML = "";
  if (!companies.size) {
    treeEl.innerHTML = "<p class='hint'>データがありません。「会社を追加」またはサンプルデータ投入から始めてください。</p>";
    return;
  }
  for (const [cid, comp] of companies) {
    const div = document.createElement("div");
    div.className = "company-block card";
    let html = `<h2>${esc(comp.name)}
      <button class="ghost" data-act="edit-company" data-id="${cid}">編集</button>
      <button class="danger" data-act="del-company" data-id="${cid}">削除</button></h2>`;
    for (const [pid, p] of comp.products) {
      html += `<table class="list"><thead>
        <tr><th colspan="6">
          <b>${esc(p.part_no)}</b> / 図番: ${esc(p.drawing_no)} / ${esc(p.material)}
          <button data-act="edit-product" data-id="${pid}">品番編集</button>
          <button data-act="new-template" data-id="${pid}">+ テンプレート</button>
          <button data-act="export-product" data-id="${pid}">Excel出力</button>
          <button class="danger" data-act="del-product" data-id="${pid}">削除</button>
        </th></tr>
        <tr><th>帳票名</th><th>改訂</th><th>作成者</th><th>更新日時</th><th style="width:340px"></th></tr>
        </thead><tbody>`;
      for (const t of p.templates) {
        html += `<tr class="tpl-row ${t.archived ? "archived-row" : ""}">
          <td>${esc(t.template_name)}${t.archived ? "<span class='rev-badge'>旧版</span>" : ""}</td>
          <td>Rev.${t.revision}</td>
          <td>${esc(t.author || "")}</td>
          <td>${esc(t.updated_at)}</td>
          <td class="actions-cell">
            <a class="btn-like" href="/templates/${t.template_id}/edit">編集</a>
            <button data-act="dup" data-id="${t.template_id}">複製</button>
            <button data-act="rev" data-id="${t.template_id}">改訂</button>
            <button data-act="export" data-id="${t.template_id}">Excel出力</button>
            <button class="danger" data-act="del-template" data-id="${t.template_id}">削除</button>
          </td></tr>`;
      }
      if (!p.templates.length) {
        html += "<tr><td colspan='5' class='hint'>テンプレートなし</td></tr>";
      }
      html += "</tbody></table>";
    }
    div.innerHTML = html;
    treeEl.appendChild(div);
  }
}

treeEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  try {
    if (act === "del-company" && confirm("会社と配下の品番・テンプレートをすべて削除します。よろしいですか?")) {
      await api(`/api/companies/${id}`, { method: "DELETE" }); search();
    } else if (act === "del-product" && confirm("品番と配下のテンプレートを削除します。よろしいですか?")) {
      await api(`/api/products/${id}`, { method: "DELETE" }); search();
    } else if (act === "del-template" && confirm("テンプレートを削除します。よろしいですか?")) {
      await api(`/api/templates/${id}`, { method: "DELETE" }); search();
    } else if (act === "dup") {
      await api(`/api/templates/${id}/duplicate`, {
        method: "POST", body: JSON.stringify({ as_revision: false }) });
      toast("複製しました"); search();
    } else if (act === "rev") {
      if (confirm("図面改訂として複製します(現行版は旧版として保存されます)。よろしいですか?")) {
        const r = await api(`/api/templates/${id}/duplicate`, {
          method: "POST", body: JSON.stringify({ as_revision: true }) });
        location.href = `/templates/${r.id}/edit`;
      }
    } else if (act === "export") {
      downloadExport([id]);
    } else if (act === "export-product") {
      exportProduct(id);
    } else if (act === "edit-company") {
      const companies = await api("/api/companies");
      const c = companies.find((x) => x.id === id);
      const data = await openDialogForm(document.getElementById("dlg-company"), c);
      if (data) { await api(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }); search(); }
    } else if (act === "edit-product") {
      const products = await api("/api/products");
      const p = products.find((x) => x.id === id);
      await fillCompanySelect();
      const data = await openDialogForm(document.getElementById("dlg-product"), p);
      if (data) {
        data.company_id = Number(data.company_id);
        await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(data) });
        search();
      }
    } else if (act === "new-template") {
      const data = await openDialogForm(document.getElementById("dlg-new-template"));
      if (data) {
        const r = await api(`/api/products/${id}/templates`, {
          method: "POST", body: JSON.stringify({ ...data, characteristics: [] }) });
        location.href = `/templates/${r.id}/edit`;
      }
    }
  } catch (err) { toast(err.message, true); }
});

// 品番単位の出力: 単独 or 1ブック複数シート
async function exportProduct(pid) {
  const rows = await api(`/api/tree?archived=0`);
  const tpls = rows.filter((r) => r.product_id === pid && r.template_id && !r.archived);
  if (!tpls.length) { toast("出力できるテンプレートがありません", true); return; }
  const dlg = document.getElementById("dlg-export");
  const box = document.getElementById("export-choices");
  box.innerHTML = "";
  const all = document.createElement("button");
  all.type = "button";
  all.className = "primary";
  all.textContent = `1ブック複数シートでまとめて出力(${tpls.map((t) => t.template_name).join(" + ")})`;
  all.onclick = () => { dlg.close(); downloadExport(tpls.map((t) => t.template_id)); };
  box.appendChild(all);
  for (const t of tpls) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${t.template_name} を単独で出力`;
    b.onclick = () => { dlg.close(); downloadExport([t.template_id]); };
    box.appendChild(b);
  }
  dlg.showModal();
}

async function fillCompanySelect() {
  const companies = await api("/api/companies");
  const sel = document.querySelector("#dlg-product select[name=company_id]");
  sel.innerHTML = companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

document.getElementById("btn-search").onclick = search;
for (const id of ["f-q", "f-company", "f-part", "f-drawing", "f-template"]) {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") search();
  });
}
document.getElementById("f-archived").onchange = search;

document.getElementById("btn-add-company").onclick = async () => {
  const data = await openDialogForm(document.getElementById("dlg-company"));
  if (data) {
    try { await api("/api/companies", { method: "POST", body: JSON.stringify(data) }); search(); }
    catch (err) { toast(err.message, true); }
  }
};

document.getElementById("btn-add-product").onclick = async () => {
  await fillCompanySelect();
  const sel = document.querySelector("#dlg-product select[name=company_id]");
  if (!sel.options.length) { toast("先に会社を追加してください", true); return; }
  const data = await openDialogForm(document.getElementById("dlg-product"));
  if (data) {
    data.company_id = Number(data.company_id);
    try { await api("/api/products", { method: "POST", body: JSON.stringify(data) }); search(); }
    catch (err) { toast(err.message, true); }
  }
};

document.getElementById("btn-seed").onclick = async () => {
  const r = await api("/api/seed", { method: "POST" });
  toast(r.ok ? "サンプルデータを投入しました" : r.message, !r.ok);
  search();
};

search();
