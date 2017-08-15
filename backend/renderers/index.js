import nunjucks from 'nunjucks'
import {zipObject, map, reduce, forEach} from 'lodash'
import langs from 'langs'
import * as tags from './tags'

const renderPage = ({req, res}, page, context) => {
  const {site} = context
  const locale = req.locale
  const breadcrumbs = map(page.parents, (p) => page.toContext({locale, site}))
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
        assetsRoot: `${process.env.ASSETS_DOMAIN}/data/${site.key}/layouts`,
        localeName: langs.where('1', locale).name,
        supportedLanguages: zipObject(site.supportedLanguages,
          map(site.supportedLanguages, l => ({
            name: langs.where('1', l).local,
            locale: l,
          })))
      },
      page: page.toContext({locale, site}),
      breadcrumbs,
      req: {
        ...req,
        localeName: langs.where('1', req.locale).local,
      }
    }
    const env = nunjucks.configure(`./data/${site.key}/layouts`, {autoescape: false})
    forEach(tags, (tag, name) => {
      env.addExtension(name, new tag())
    })
    return new Promise((resolve, reject) => {
      env.render(`${page.layout}/index.html`, context, (err, result) => {
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

export {renderPage}