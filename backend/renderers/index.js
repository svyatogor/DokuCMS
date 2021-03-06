import nunjucks from 'nunjucks'
import {filter, zipObject, map, reduce, forEach, isNil, isEmpty, isNaN, get} from 'lodash'
import qs from 'querystring'
import langs from 'langs'
import Promise from 'bluebird'
import cheerio from 'cheerio'
import * as tags from './tags'

const renderPage = async ({req, res}, page, context) => {
  const {site} = context
  const locale = req.locale
  const breadcrumbs = await Promise.map(page.parents, p => p.toContext({locale, site}))
  const flash = req.flash()
  const referrer = get(flash, 'referrer.0')

  require('moment').locale(req.locale)
  reduce(
    breadcrumbs,
    (path, page) => {
      page.path = `${path}/${page.slug}`
      return page.path
    }, "")
  breadcrumbs[breadcrumbs.length-1].active = true
  try {
    context = {
      ...context,
      site: {
        ...site,
        assetsRoot: `${process.env.ASSETS_DOMAIN}/${site.key}/layouts`,
        uploadRoot: process.env.ASSETS_DOMAIN,
        localeName: langs.where('1', locale).name,
        supportedLanguages: zipObject(site.supportedLanguages,
          map(site.supportedLanguages, l => ({
            name: langs.where('1', l).local,
            locale: l,
          })))
      },
      page: {
        ...(await page.toContext({locale, site})),
        fullPath: req.originalUrl.replace(new RegExp(`^/${req.locale}`), ''),
        parents: page.parents,
      },
      breadcrumbs,
      currentYear: (new Date()).getFullYear(),
      res,
      req: {
        ...req,
        localeName: langs.where('1', req.locale).local,
      },
      flash,
      referrer,
    }
    console.log(context.page.fullPath)
    const env = nunjucks.configure(`./data/${site.key}/layouts`, {autoescape: false})
    forEach(tags, (tag, name) => {
      env.addExtension(name, new tag())
    })
    // TODO: Refactor me
    env.addFilter('currency', (str, currency, defaultValue = '-', zeroCents = undefined) => {
      if (isNil(currency) || isEmpty(currency)) {
        return defaultValue
      }
      // eslint-disable-next-line eqeqeq
      const hasCents = parseInt(str, 10) != parseFloat(str)
      const val = parseFloat(str).toLocaleString(locale, {style: 'currency', currency})
      const res = isNaN(val) ? defaultValue : val
      if (!zeroCents || hasCents) {
        return res
      } else {
        if (/[,\.]\d{2}$/.test(res)) {
          return res.replace(/\d{2}$/, '-')
        }
      }
    })
    env.addFilter('initials', (str) =>
      str.split(' ').slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
    )
    env.addFilter('setQS', (query, ...params) =>
      qs.stringify({...query, ...zipObject(filter(params, (_, i) => i % 2 === 0), filter(params, (_, i) => i % 2 === 1))})
    )
    env.addFilter('date', require('nunjucks-date-filter'))
    env.addFilter('postalCodeToCity', (code) => {
      if (code <= 2999) return 'Nicosia'
      if (code <= 4999) return 'Limassol'
      if (code <= 5999) return 'Famagusta'
      if (code <= 7999) return 'Larnaca'
      if (code <= 8999) return 'Paphos'
      if (code <= 9999) return 'Kyrenia'
    })
    return new Promise((resolve, reject) => {
      env.render(`${page.layout}/index.html`, {...context, env}, (err, result) => {
        if (err) {
          console.log(err)
          return reject(err)
        }
        res.send(result)
        resolve()
      })
    })
  } catch(e) {
    console.log(e)
    return Promise.reject(e)
  }
}

const renderEmail = async (req, template, context) => {
  const {site} = req
  try {
    context = {
      ...context,
      site: {
        ...site,
        assetsRoot: `${process.env.ASSETS_DOMAIN}/${site.key}/layouts`,
      },
      req
    }
    const env = nunjucks.configure(`./data/${site.key}/layouts`, {autoescape: false})
    env.addFilter('currency', (str, currency, defaultValue = '-') => {
      if (isNil(currency) || isEmpty(currency)) {
        return defaultValue
      }
      const val = parseFloat(str).toLocaleString(req.locale, {style: 'currency', currency})
      return isNaN(val) ? defaultValue : val
    })
    return new Promise((resolve, reject) => {
      env.render(`${template}/index.html`, context, (err, body) => {
        if (err) {
          console.log(err)
          return reject(err)
        }

        const subject = cheerio.load(body)('title').text()
        return resolve({body, subject})
      })
    })
  } catch(e) {
    console.log(e)
    return Promise.reject(e)
  }
}

export {renderPage, renderEmail}
