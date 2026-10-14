// Temporary: show the E2E stock test entries and their counts.
import 'dotenv/config'
import mongoose from 'mongoose'
const fromCwd = p => new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { StockItem } = await import(fromCwd('src/models/StockItem.js'))

await mongoose.connect(process.env.MONGODB_URI)
const items = await StockItem.find({ name: /^E2E /i }).select('name unit plates totalAdded totalUsed approved -_id').lean()
console.log(JSON.stringify(items, null, 1))
await mongoose.disconnect()
