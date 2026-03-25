const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");
const filePathEl = document.getElementById("filePath");

const labelText = {
  0: "none",
  1: "positive",
  2: "negative",
};

let labelColumns = [];
const originalValues = new Map();

function setStatus(text, ok = false) {
  statusEl.textContent = text;
  statusEl.className = ok ? "status ok" : "status";
}

function buildSelect(reviewId, col, value) {
  const sel = document.createElement("select");
  sel.dataset.reviewId = reviewId;
  sel.dataset.column = col;

  ["0", "1", "2"].forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = `${v} - ${labelText[v]}`;
    if (String(value) === v) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });

  sel.addEventListener("change", async (e) => {
    const target = e.target;
    const rowEl = target.closest("tr");
    const payload = {
      review_id: target.dataset.reviewId,
      column: target.dataset.column,
      value: target.value,
    };

    setStatus(`Đang lưu ${payload.review_id} / ${payload.column}...`);
    try {
      const resp = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Save failed");
      }

      rowEl.classList.add("edited");
      setStatus(`Đã lưu tự động: ${payload.review_id}`, true);
    } catch (err) {
      setStatus(`Lỗi lưu: ${err.message}`);
    }
  });

  return sel;
}

function renderTable(rows) {
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const trHead = document.createElement("tr");
  ["review_id", "relabel_group", "Review", ...labelColumns].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.dataset.reviewId = row.review_id;

    const tdId = document.createElement("td");
    tdId.textContent = row.review_id;
    tr.appendChild(tdId);

    const tdGroup = document.createElement("td");
    tdGroup.textContent = row.relabel_group;
    tr.appendChild(tdGroup);

    const tdReview = document.createElement("td");
    tdReview.className = "review";
    tdReview.textContent = row.Review;
    tr.appendChild(tdReview);

    labelColumns.forEach((col) => {
      originalValues.set(`${row.review_id}:${col}`, String(row[col] ?? "0"));

      const td = document.createElement("td");
      td.appendChild(buildSelect(row.review_id, col, row[col]));
      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

async function init() {
  try {
    const resp = await fetch("/api/data");
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || "Không tải được dữ liệu");
    }

    labelColumns = data.labelColumns;
    filePathEl.textContent = `CSV: ${data.csvPath}`;
    renderTable(data.rows);
    setStatus(`Đã tải ${data.rows.length} dòng. Sửa dropdown sẽ auto-save.`, true);
  } catch (err) {
    setStatus(`Lỗi khởi tạo: ${err.message}`);
  }
}

init();
