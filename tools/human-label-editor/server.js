import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const CSV_PATH = path.resolve(
  __dirname,
  "../../data/data_crawl/pipeline/artifacts/step4/human_label_v1.csv"
);

const LABEL_COLUMNS = [
  "human_vệ sinh_label",
  "human_đồ ăn thức uống_label",
  "human_khách sạn_label",
  "human_vị trí_label",
  "human_phòng ốc_label",
  "human_dịch vụ_label",
];

let headers = [];
let rows = [];

async function loadCsv() {
  const content = await fs.readFile(CSV_PATH, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });

  if (!records.length) {
    throw new Error("CSV is empty");
  }

  headers = Object.keys(records[0]);
  rows = records;
}

async function saveCsv() {
  const csv = stringify(rows, {
    header: true,
    columns: headers,
  });
  await fs.writeFile(CSV_PATH, csv, "utf8");
}

function assertLabelValue(value) {
  return value === "0" || value === "1" || value === "2";
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/data", (_req, res) => {
  res.json({
    csvPath: CSV_PATH,
    headers,
    labelColumns: LABEL_COLUMNS,
    rows,
  });
});

app.post("/api/update", async (req, res) => {
  const { review_id, column, value } = req.body || {};

  if (!review_id || !column || typeof value === "undefined") {
    return res.status(400).json({ error: "Missing review_id, column or value" });
  }
  if (!LABEL_COLUMNS.includes(column)) {
    return res.status(400).json({ error: "Invalid label column" });
  }
  if (!assertLabelValue(String(value))) {
    return res.status(400).json({ error: "Label value must be 0, 1, or 2" });
  }

  const row = rows.find((r) => String(r.review_id) === String(review_id));
  if (!row) {
    return res.status(404).json({ error: "review_id not found" });
  }

  row[column] = String(value);

  try {
    await saveCsv();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: `Failed to save CSV: ${err.message}` });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

loadCsv()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Human label editor running at http://localhost:${PORT}`);
      console.log(`Editing file: ${CSV_PATH}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
