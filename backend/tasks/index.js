require('babel-register')
require('../../config/env')
require('../models')
const mongoose = require('mongoose')
mongoose.Promise = require('bluebird')
mongoose.connect(process.env.MONGODB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useCreateIndex: true,
	useFindAndModify: false,
})
mongoose.connection.on('error', (err) => {
	console.error('Mongoose connection error:', err)
})
mongoose.set('debug', process.env.NODE_ENV === 'development')

process.on('unhandledRejection', (err) => {
	console.error('Unhandled promise rejection:', err)
})

const task = require(`./${process.argv[2]}`).default
task().then(_ => process.exit(0))