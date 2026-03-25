# Human Label CSV Editor

Standalone tool to edit `human_label_v1.csv` without touching your existing frontend.

## Features
- Displays rows from CSV.
- Dropdown labels for each aspect (`0=none`, `1=positive`, `2=negative`).
- Auto-save on every change.
- Highlight edited rows.

## Run
```powershell
cd tools/human-label-editor
npm install
npm start
```

Open: `http://localhost:8787`

## Notes
- File edited by default:
  - `data/data_crawl/pipeline/artifacts/step4/human_label_v1.csv`
- API endpoints:
  - `GET /api/data`
  - `POST /api/update`
