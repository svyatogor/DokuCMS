import express from 'express'
import mongoose from 'mongoose'
import cachegoose from 'cachegoose'
import s3 from 's3'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import Promise from 'bluebird'
import {Site} from './models'
import auth from './auth'
import admin from './admin'
import frontend from './frontend'

import './models'
mongoose.Promise = require('bluebird')
mongoose.connect(process.env.DB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useCreateIndex: true,
	useFindAndModify: false,
})
mongoose.connection.on('error', (err) => {
	console.error('Mongoose connection error:', err)
})
mongoose.connection.on('disconnected', () => {
	console.log('Mongoose disconnected')
})
mongoose.set('debug', process.env.NODE_ENV === 'development')

process.on('unhandledRejection', (err) => {
	console.error('Unhandled promise rejection:', err)
})
cachegoose(mongoose)

const app = express()
app.use(require('cookie-parser')())
const syncS3 = () => {
	const client = s3.createClient({
		s3Options: {
			// accessKeyId: "your s3 key",
			// secretAccessKey: "your s3 secret",
			region: 'eu-west-1'
		},
	})

	Site.find().then(sites => {
		sites.forEach(site => {
			console.log(`Syncing layout for ${site.key}`)
			const downloader = client.downloadDir({
				localDir: `./data/${site.key}`,
				s3Params: {
					Bucket: process.env.S3_BUCKET,
					Prefix: `${site.key}`
				}
			})
			downloader.on('error', err => {
				// TODO: Report error
				console.error(`Error syncing layout for ${site.key}`, err)
			})
			downloader.on('end', () => {
				console.log(`Finished syncing layout for ${site.key}`)
			})
		})
	})
}

const setSnsBodyType = (req, res, next) => {
	req.headers['content-type'] = 'application/json;charset=UTF-8';
	next()
}

export default () => {
	app.use(auth)
	app.post('/sns/assets_modified',setSnsBodyType, bodyParser.json(), (req, res) => {
		if (req.headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
			fetch(req.body['SubscribeURL'])
				.catch(e => console.log(e))
				.then(r => {
					res.sendStatus(200)
				})
		} else if (req.headers['x-amz-sns-message-type'] === 'Notification') {
			try {
				const message = JSON.parse(req.body.Message)
				Promise.map(message.Records, record => {
					const key = record.s3.object.key
					const [siteKey, file] = /^([^/]+)\/(.*)$/.exec(key).slice(1)
					console.log(key, siteKey, file);
					return Site.findOne({key: siteKey}).then(site => {
						if (site) {
							return site.syncFile(file)
						} else {
							return Promise.resolve()
						}
					})
				})
					.catch(e => console.log(e))
					.then(() => {
						res.sendStatus(200)
					})
			} catch (e) {
				console.log(e)
				res.sendStatus(400)
			}
		}
	})
	app.use(async (req, res, next) => {
		const regex = new RegExp(`(.*).${process.env.ROOT_DOMAIN}`, 'i')
		const match = req.hostname.match(regex)
		if (match) {
			const key = match[1].toLowerCase()
			req.site = await Site.findOne({key})//.cache()
		} else {
			req.site = await Site.findOne({
    		domains: {$elemMatch: {$regex: new RegExp(req.hostname, 'i')}}
  		})//.cache()
		}
		req.site = req.site && req.site.toObject({virtuals: true})
		if (req.site) {
			next()
		} else {
			console.error(`Site for ${req.hostname} not found`)
			res.sendStatus(404)
		}
	})

	app.use('/admin/static', express.static('./admin/static'))
	app.use('/admin', admin)
	app.use('/', frontend)
	app.get('/', (req, res) => {
		res.send('w00t?')
		res.status(404)
		res.end()
	})

	if (process.env.NODE_ENV === 'production') {
		syncS3()
	}
	app.listen(process.env.PORT || process.env.BACKEND_PORT)
}
