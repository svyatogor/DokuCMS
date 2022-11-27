import express from 'express'
import jwt from 'jsonwebtoken'
import {omit, some, includes, map} from 'lodash'
import bodyParser from 'body-parser'
import Joi from 'joi'
import User from '../models/auth/user'
import {AuditLogClass} from '../models'
export const auth = express()

const loginSchema = usernameField => Joi.object().keys({
  [usernameField]: Joi.string().required(),
  password: Joi.string().required(),
})
auth.use(bodyParser.urlencoded({extended: true}))
auth.use(async (req, res, next) => {
  if (includes(req.site.features, 'auth')) {
    const config = req.site.auth
    if (!config) {
      res.sendStatus(401)
      return
    }
    const regexps = map(config.secureUrls, r => new RegExp(r))
    if (req.path !== config.loginUrl && !req.originalUrl.startsWith('/auth/') && some(regexps, r => req.originalUrl.match(r))) {
      const token = req.cookies[`${req.site.key}-authtoken`]
      if (!token) {
        res.redirect(config.loginUrl)
        return
      }
      req.viewer = jwt.verify(token, process.env.JWT_SECRET)
      if (req.viewer) {
        try {
          const user = await User.findOne({site: req.site._id, catalog: req.site.auth.userModel, _id: req.viewer._id})
          const now = new Date()
          if (!user.get('lastActiveAt') || now - user.get('lastActiveAt') > 1000 * 60 * 60 * 24) {
            user.set('lastActiveAt', now)
            await user.save()
          }
          await AuditLogClass.userDailyAccess(user, {ip: req.ip})
          next()
        } catch (e) {
          console.error(e)
          res.sendStatus(500).end()
        }
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

auth.post('/auth/login', async (req, res) => {
  const {site: {auth: config, key}} = req
  const {usernameField = 'email'} = req.site.auth
  const {value, error} = Joi.validate(req.body, loginSchema(usernameField), {abortEarly: false, stripUnknown: true})

  if (error) {
    res.redirect(config.loginUrl)
    return
  }
  const schema = req.site.documentTypes[req.site.auth.userModel]
  const referenceFields = Object.keys(schema.fields).filter(f =>
    schema.fields[f].type === 'select' && schema.fields[f].documentType
  )
  const user = await referenceFields.reduce((acc, field) =>
      acc.populate({
        path: field,
        match: {site: req.site._id},
        select: req.site.documentTypes[schema.fields[field].documentType].labelField,
        model: 'Item'
      }), User.findOne({site: req.site._id, catalog: req.site.auth.userModel, [usernameField]: value[usernameField]}))
  if (!user ) {
    req.flash('error', `Invalid ${usernameField} or password`)
    res.redirect(config.loginUrl)
    return
  }
  user.set('lastLogin', new Date())
  await AuditLogClass.userLoggedIn(user, {ip: req.ip})
  await user.save()
  const viewer = omit(user.toObject(), 'password')
  res.cookie(`${key}-authtoken`, jwt.sign(viewer, process.env.JWT_SECRET), {
    domain: req.hostname,
    httpOnly: true,
    path: '/',
    expires: new Date(Date.now() + 365 * 24 * 3600 * 1000)
  })
  res.redirect(config.afterLogin || '/')
})

auth.get('/auth/logout', (req, res) => {
  const {site: {auth: config, key}} = req
  res.clearCookie(`${key}-authtoken`, {domain: req.hostname})
  res.redirect(config.afterLogout || config.loginUrl)
})
