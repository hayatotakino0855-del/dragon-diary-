// マスタ管理画面: 会社マスタ + 特性マスタ
const TYPES = {
  bilateral: "両側公差", bilateral_with_sub: "両側+サブ",
  unilateral: "片側(以下)", weight: "重量", visual: "外観(○×)",
  measured: "実測値記入",
};

async function loadCompanies() {
  const rows = await api("/api/companies");
  const tb = document.querySelector("#companies-table tbody");
  tb.innerHTML = rows.map((c) => `<tr data-id="${c.id}">
    <td>${esc(c.name)}</td><td>${esc(c.note)}</td>
    <td><button data-act="edit">編集</button>
        <button class="danger" data-act="del">削除</button></td></tr>`).join("");
  tb.onclick = async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.closest("tr").dataset.id);
    const c = rows.find((x) => x.id === id);
    try {
      if (btn.dataset.act === "del") {
        if (confirm("会社と配下の品番・テンプレートをすべて削除します。よろしいですか?")) {
          await api(`/api/companies/${id}`, { method: "DELETE" });
          loadCompanies();
        }
      } else {
        const data = await openDialogForm(document.getElementById("dlg-company"), c);
        if (data) {
          await api(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(data) });
          loadCompanies();
        }
      }
    } catch (err) { toast(err.message, true); }
  };
}

async function loadMasters() {
  const rows = await api("/api/char-masters");
  const tb = document.querySelector("#masters-table tbody");
  tb.innerHTML = rows.map((m) => `<tr data-id="${m.id}">
    <td>${esc(m.name)}</td><td>${TYPES[m.type] || esc(m.type)}</td>
    <td>${esc(m.center_value)}</td><td>${esc(m.tolerance)}</td>
    <td>${esc(m.sub_name)}</td><td>${esc(m.sub_tolerance)}</td>
    <td><button data-act="edit">編集</button>
        <button class="danger" data-act="del">削除</button></td></tr>`).join("");
  tb.onclick = async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.closest("tr").dataset.id);
    const m = rows.find((x) => x.id === id);
    try {
      if (btn.dataset.act === "del") {
        if (confirm("特性マスタから削除します。よろしいですか?")) {
          await api(`/api/char-masters/${id}`, { method: "DELETE" });
          loadMasters();
        }
      } else {
        const data = await openDialogForm(document.getElementById("dlg-master"), m);
        if (data) {
          await api(`/api/char-masters/${id}`, { method: "PUT", body: JSON.stringify(data) });
          loadMasters();
        }
      }
    } catch (err) { toast(err.message, true); }
  };
}

document.getElementById("btn-add-company").onclick = async () => {
  const data = await openDialogForm(document.getElementById("dlg-company"));
  if (data) {
    try { await api("/api/companies", { method: "POST", body: JSON.stringify(data) }); loadCompanies(); }
    catch (err) { toast(err.message, true); }
  }
};

document.getElementById("btn-add-master").onclick = async () => {
  const data = await openDialogForm(document.getElementById("dlg-master"));
  if (data) {
    try { await api("/api/char-masters", { method: "POST", body: JSON.stringify(data) }); loadMasters(); }
    catch (err) { toast(err.message, true); }
  }
};

loadCompanies();
loadMasters();
