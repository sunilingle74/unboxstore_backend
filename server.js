require('dotenv').config()

const app = require('./src/app')
const connectDB = require('./src/config/db')

const PORT = process.env.PORT || 5000

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })

module.exports = app
