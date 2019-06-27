import express from 'express'
import jwt from 'jsonwebtoken'
import {omit, some, includes, map} from 'lodash'
import bodyParser from 'body-parser'
import Joi from 'joi'
import User from '../models/auth/user'
export const auth = express()

const loginSchema = usernameField => Joi.object().keys({
  [usernameField]: Joi.string().required(),
  password: Joi.string().required(),
})
auth.use(bodyParser.urlencoded({extended: true}))
auth.use('/*', (req, res, next) => {
  if (includes(req.site.features, 'auth')) {
    const config = {...req.site.auth}
    if (!config) {
      res.sendStatus(401)
    }
    const regexps = map(config.secureUrls, r => new RegExp(r))
    if (req.path !== config.loginUrl && !req.originalUrl.startsWith('/auth/') && some(regexps, r => req.path.match(r))) {
      const token = req.cookies[`${req.site.key}-authtoken`]
      if (!token) {
        res.redirect(config.loginUrl)
        return
      }
      req.viewer = jwt.verify(token, process.env.JWT_SECRET)
      if (req.viewer) {
        next()
      } else {
        res.redirect(config.loginUrl)
      }
    } else {
      next()
    }
  } else {
    next()
  }
})

auth.post('/auth/login', (req, res) => {
  const {site: {auth: config, key}} = req
  const {usernameField = 'email'} = req.site.auth
  const {value, error} = Joi.validate(req.body, loginSchema(usernameField), {abortEarly: false, stripUnknown: true})

  if (error) {
    res.redirect(config.loginUrl)
    return
  }
  User.findOne({site: req.site._id, catalog: req.site.auth.userModel, [usernameField]: value[usernameField]}).then(user => {
    if (!user || user.authenticate(value.password)) {
      req.flash('error', `Invalid ${usernameField} or password`)
      res.redirect(config.loginUrl)
      return
    }
    const viewer = omit(user.toObject(), 'password')
    res.cookie(`${key}-authtoken`, jwt.sign(viewer, process.env.JWT_SECRET), {
      domain: req.hostname,
      httpOnly: true,
      path: '/',
      expires: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    })
    res.redirect(config.afterLogin || '/')
  })
})

auth.get('/auth/logout', (req, res) => {
  const {site: {auth: config, key}} = req
  res.clearCookie(`${key}-authtoken`, {domain: req.hostname})
  res.redirect(config.afterLogout || config.loginUrl)
})
