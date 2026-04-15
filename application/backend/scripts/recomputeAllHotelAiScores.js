import { initDatabase, getDb } from '../config/database.js'
import CanBoDbModel from '../models/canBoDbModel.js'
import CanBoService from '../services/canBoService.js'

const parseArgs = (argv) => {
  const options = {
    limit: null,
    fromDate: null,
    toDate: null,
    concurrency: 1
  }

  for (const rawArg of argv) {
    if (rawArg.startsWith('--limit=')) {
      const parsed = Number(rawArg.slice('--limit='.length))
      options.limit = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
      continue
    }

    if (rawArg.startsWith('--fromDate=')) {
      options.fromDate = rawArg.slice('--fromDate='.length).trim() || null
      continue
    }

    if (rawArg.startsWith('--toDate=')) {
      options.toDate = rawArg.slice('--toDate='.length).trim() || null
      continue
    }

    if (rawArg.startsWith('--concurrency=')) {
      const parsed = Number(rawArg.slice('--concurrency='.length))
      if (Number.isFinite(parsed) && parsed > 0) {
        options.concurrency = Math.min(Math.trunc(parsed), 10)
      }
    }
  }

  return options
}

const formatScore = (value) => {
  const score = Number(value)
  if (!Number.isFinite(score)) return 'N/A'
  return score.toFixed(4)
}

const isNoReviewError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return error?.statusCode === 400 && message.includes('không có review hợp lệ')
}

const run = async () => {
  const options = parseArgs(process.argv.slice(2))

  await initDatabase()

  const rows = await CanBoDbModel.findHotelsWithLatestAiSummary(10000)
  const hotelIds = rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0)

  const targetIds = options.limit ? hotelIds.slice(0, options.limit) : hotelIds

  console.log(`[AI RESCORE] Tổng khách sạn tìm thấy: ${hotelIds.length}`)
  console.log(`[AI RESCORE] Số khách sạn sẽ xử lý: ${targetIds.length}`)
  console.log(`[AI RESCORE] Concurrency: ${options.concurrency}`)
  if (options.fromDate || options.toDate) {
    console.log(`[AI RESCORE] Bộ lọc ngày: fromDate=${options.fromDate || 'null'}, toDate=${options.toDate || 'null'}`)
  }

  if (targetIds.length === 0) {
    console.log('[AI RESCORE] Không có khách sạn để xử lý.')
    return
  }

  const startedAt = Date.now()
  const failed = []
  const skipped = []
  let successCount = 0

  let cursor = 0

  const claimNext = () => {
    if (cursor >= targetIds.length) return null
    const order = cursor + 1
    const hotelId = targetIds[cursor]
    cursor += 1
    return { order, hotelId }
  }

  const worker = async () => {
    while (true) {
      const next = claimNext()
      if (!next) break

      try {
        const result = await CanBoService.getThongKeAiTheoCoSo({
          coSoId: next.hotelId,
          fromDate: options.fromDate,
          toDate: options.toDate
        })

        successCount += 1
        const score = result?.ketQuaAi?.diemTongQuan
        console.log(`[AI RESCORE] (${next.order}/${targetIds.length}) #${next.hotelId} OK - diemTongQuan=${formatScore(score)}`)
      } catch (error) {
        if (isNoReviewError(error)) {
          skipped.push({
            order: next.order,
            hotelId: next.hotelId,
            reason: error.message
          })
          console.warn(`[AI RESCORE] (${next.order}/${targetIds.length}) #${next.hotelId} SKIP - ${error.message}`)
          continue
        }

        failed.push({
          order: next.order,
          hotelId: next.hotelId,
          reason: error?.message || 'Unknown error'
        })
        console.error(`[AI RESCORE] (${next.order}/${targetIds.length}) #${next.hotelId} FAIL - ${error?.message || 'Unknown error'}`)
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()))

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  console.log(`[AI RESCORE] Hoàn tất trong ${durationSec}s`)
  console.log(`[AI RESCORE] Thành công: ${successCount}`)
  console.log(`[AI RESCORE] Bỏ qua (không có review hợp lệ): ${skipped.length}`)
  console.log(`[AI RESCORE] Thất bại: ${failed.length}`)

  if (failed.length > 0) {
    console.log('[AI RESCORE] Danh sách thất bại:')
    for (const item of failed) {
      console.log(`  - (${item.order}/${targetIds.length}) #${item.hotelId}: ${item.reason}`)
    }
    process.exitCode = 1
  }
}

run()
  .catch((error) => {
    console.error(`[AI RESCORE] Lỗi không xử lý được: ${error?.message || error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      const db = getDb()
      await db.end()
    } catch {
      // ignore close errors
    }
  })
