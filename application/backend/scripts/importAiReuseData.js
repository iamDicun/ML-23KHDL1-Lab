import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const PYTHON_SCRIPT_PATH = path.join(
  REPO_ROOT,
  'data',
  'data_crawl',
  'pipeline',
  'scripts',
  'step6_preprocess_and_import_filtered_hotels_reviews.py'
)
const DEFAULT_PYTHON_PATH = path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe')

const parseArgs = (argv) => {
  const args = { pythonExecutable: null }

  for (const rawArg of argv) {
    if (rawArg.startsWith('--python=')) {
      args.pythonExecutable = rawArg.slice('--python='.length).trim()
    }
  }

  return args
}

const resolvePythonExecutable = (preferredFromArg) => {
  if (preferredFromArg) {
    return preferredFromArg
  }

  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE
  }

  if (fs.existsSync(DEFAULT_PYTHON_PATH)) {
    return DEFAULT_PYTHON_PATH
  }

  return 'python'
}

const ensureRequiredFiles = () => {
  if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
    throw new Error(`Missing import script: ${PYTHON_SCRIPT_PATH}`)
  }

  const hotelsCsv = path.join(
    REPO_ROOT,
    'data',
    'data_crawl',
    'hotels_all_reviews_filtered_out_step2_top10.csv'
  )
  const reviewsCsv = path.join(
    REPO_ROOT,
    'data',
    'data_crawl',
    'reviews_all_filtered_out_step2_top10_no_labels.csv'
  )

  if (!fs.existsSync(hotelsCsv)) {
    throw new Error(`Missing input file: ${hotelsCsv}`)
  }

  if (!fs.existsSync(reviewsCsv)) {
    throw new Error(`Missing input file: ${reviewsCsv}`)
  }
}

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  const pythonExecutable = resolvePythonExecutable(args.pythonExecutable)

  ensureRequiredFiles()

  console.log('[AI REUSE IMPORT] Starting import job...')
  console.log(`[AI REUSE IMPORT] Python: ${pythonExecutable}`)
  console.log(`[AI REUSE IMPORT] Script: ${PYTHON_SCRIPT_PATH}`)

  const child = spawn(pythonExecutable, [PYTHON_SCRIPT_PATH], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: false
  })

  child.on('error', (error) => {
    console.error(`[AI REUSE IMPORT] Failed to start process: ${error.message}`)
    process.exit(1)
  })

  child.on('close', (code) => {
    if (code === 0) {
      console.log('[AI REUSE IMPORT] Completed successfully.')
      process.exit(0)
    }

    console.error(`[AI REUSE IMPORT] Failed with exit code: ${code}`)
    process.exit(code ?? 1)
  })
}

run().catch((error) => {
  console.error(`[AI REUSE IMPORT] ${error.message}`)
  process.exit(1)
})