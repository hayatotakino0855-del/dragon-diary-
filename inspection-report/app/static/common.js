// 共通ユーティリティ
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (e) { /* noop */ }
    throw new Error(detail);
  }
  return res.json();
}

let toastTimer = null;
function toast(msg, warn = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.toggle("warn", warn);
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), warn ? 8000 : 3000);
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

// ダイアログフォーム: 値を入れて開き、OKなら値を返す
function openDialogForm(dlg, initial = {}) {
  const form = dlg.querySelector("form");
  form.reset();
  for (const [k, v] of Object.entries(initial)) {
    if (form.elements[k] !== undefined) form.elements[k].value = v ?? "";
  }
  return new Promise((resolve) => {
    dlg.onclose = () => {
      if (dlg.returnValue !== "ok") return resolve(null);
      const data = {};
      for (const el of form.elements) {
        if (el.name) data[el.name] = el.value;
      }
      resolve(data);
    };
    dlg.showModal();
  });
}

// Excelダウンロード(X-Warningsヘッダの警告をトーストで表示)
async function downloadExport(ids) {
  const res = await fetch(`/api/export?ids=${ids.join(",")}`);
  if (!res.ok) { toast("出力に失敗しました", true); return; }
  const warn = decodeURIComponent(res.headers.get("X-Warnings") || "");
  const disp = res.headers.get("Content-Disposition") || "";
  const m = disp.match(/filename\*=UTF-8''(.+)$/);
  const filename = m ? decodeURIComponent(m[1]) : "report.xlsx";
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  if (warn) toast(warn, true);
  else toast(`${filename} をダウンロードしました`);
}
