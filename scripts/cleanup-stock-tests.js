// Cleanup for the stock E2E runs: removes temp chef/approver accounts and all
// test stock entries, and reports what remains so the check is observable.
import 'dotenv/config'
import mongoose from 'mongoose'
const fromCwd = p => new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { User } = await import(fromCwd('src/models/User.js'))
const { StockItem } = await import(fromCwd('src/models/StockItem.js'))

await mongoose.connect(process.env.MONGODB_URI)
const users = await User.deleteMany({ email: { $in: ['stock-e2e-chef@stayserve.local', 'stock-e2e-approver@stayserve.local'] } })
const stocks = await StockItem.deleteMany({ name: { $in: ['E2E KG Test', 'E2E Plates Test', 'API Pending Test'] } })
console.log('deleted temp users:', users.deletedCount, '| deleted test stock items:', stocks.deletedCount)
const leftUsers = await User.countDocuments({ email: /e2e-chef|e2e-approver|e2e-test-chef/ })
const leftStocks = await StockItem.countDocuments({ name: { $in: ['E2E KG Test', 'E2E Plates Test', 'API Pending Test'] } })
console.log('remaining temp users:', leftUsers, '| remaining test stocks:', leftStocks)
await mongoose.disconnect()
