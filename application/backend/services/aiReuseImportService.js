import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { AiReuseImportDbModel } from '../models/aiReuseImportDbModel.js'

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
const SUMMARY_PATH = path.join(
  REPO_ROOT,
  'data',
  'data_crawl',
  'pipeline',
  'artifacts',
  'step4',
  'import_ai_reuse_summary.json'
)

const LOG_LIMIT = 16000
const JOB_HISTORY_LIMIT = 20

let runningJob = null
const jobStore = new Map()
const jobOrder = []

const normalizeLog = (text = '') => {
  if (!text) return ''
  if (text.length <= LOG_LIMIT) return text
  return text.slice(text.length - LOG_LIMIT)
}

const withTruncatedLog = (current, chunk) => normalizeLog(`${current}${chunk}`)

const buildJobView = (job) => ({
  id: job.id,
  status: job.status,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  durationMs: job.finishedAt
    ? new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()
    : Date.now() - new Date(job.startedAt).getTime(),
  exitCode: job.exitCode,
  command: job.command,
  scriptPath: job.scriptPath,
  pythonExecutable: job.pythonExecutable,
  summary: job.summary,
  stdoutTail: normalizeLog(job.stdout),
  stderrTail: normalizeLog(job.stderr)
})

const registerJob = (job) => {
  jobStore.set(job.id, job)
  jobOrder.push(job.id)

  while (jobOrder.length > JOB_HISTORY_LIMIT) {
    const oldId = jobOrder.shift()
    if (oldId) jobStore.delete(oldId)
  }
}

const getPythonExecutable = (preferred) => {
  const candidates = []

  if (preferred) candidates.push(preferred)
  if (process.env.PYTHON_EXECUTABLE) candidates.push(process.env.PYTHON_EXECUTABLE)
  candidates.push(path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe'))
  candidates.push('python')

  for (const candidate of candidates) {
    if (!candidate) continue

    if (candidate === 'python') return candidate

    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return 'python'
}

const tryReadSummary = () => {
  try {
    if (!fs.existsSync(SUMMARY_PATH)) return null
    const raw = fs.readFileSync(SUMMARY_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const ensureScriptExists = () => {
  if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
    const err = new Error(`Không tìm thấy script preprocess/import: ${PYTHON_SCRIPT_PATH}`)
    err.statusCode = 500
    throw err
  }
}

export const AiReuseImportService = {
  startImportJob: ({ pythonExecutable } = {}) => {
    if (runningJob && runningJob.status === 'running') {
      const err = new Error('Đang có job preprocess/import chạy. Vui lòng đợi job hiện tại hoàn tất.')
      err.statusCode = 409
      throw err
    }

    ensureScriptExists()

    const executable = getPythonExecutable(pythonExecutable)

    const job = {
      id: crypto.randomUUID(),
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      command: `${executable} ${PYTHON_SCRIPT_PATH}`,
      scriptPath: PYTHON_SCRIPT_PATH,
      pythonExecutable: executable,
      stdout: '',
      stderr: '',
      summary: null
    }

    registerJob(job)
    runningJob = job

    const child = spawn(executable, [PYTHON_SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: process.env,
      shell: false
    })

    child.stdout.on('data', (chunk) => {
      job.stdout = withTruncatedLog(job.stdout, chunk.toString())
    })

    child.stderr.on('data', (chunk) => {
      job.stderr = withTruncatedLog(job.stderr, chunk.toString())
    })

    child.on('error', (spawnError) => {
      job.status = 'failed'
      job.finishedAt = new Date().toISOString()
      job.exitCode = -1
      job.stderr = withTruncatedLog(job.stderr, `\n${spawnError.message}\n`)
      runningJob = null
    })

    child.on('close', (code) => {
      job.exitCode = Number(code)
      job.finishedAt = new Date().toISOString()
      job.summary = tryReadSummary()
      job.status = code === 0 ? 'succeeded' : 'failed'
      runningJob = null
    })

    return buildJobView(job)
  },

  getJobStatus: (jobId = null) => {
    if (jobId) {
      const job = jobStore.get(jobId)
      if (!job) {
        const err = new Error('Không tìm thấy job theo id')
        err.statusCode = 404
        throw err
      }
      return buildJobView(job)
    }

    const latestId = jobOrder[jobOrder.length - 1]
    if (!latestId) {
      return null
    }

    const latestJob = jobStore.get(latestId)
    return latestJob ? buildJobView(latestJob) : null
  },

  getImportStats: async () => {
    const stats = await AiReuseImportDbModel.getImportStats()
    const latestJob = AiReuseImportService.getJobStatus()

    return {
      ...stats,
      latestJob
    }
  }
}

export default AiReuseImportService