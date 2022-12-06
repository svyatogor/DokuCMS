import mongoose from 'mongoose'
import {omit, isNil, forEach, has, map, reject, get, pickBy} from 'lodash'
import {query, mutation} from './utils'
import {Page} from '../models'
import CatalogResolver from './catalog'

export default class {
  @query
  static pages({site}) {
    return Page.where({site: site.id}).populate('parent')
  }

  @query
  static page({site}, {id}) {
    return Page.findOne({_id: id, site: site.id}).populate('parent')
  }

  @mutation
  static async upsertPage({site}, {page, locale = 'en'}) {
    let _page
    const i18nfields = (layout) => {
      const properties = site.layouts[layout].properties
      return [
       'title',
        ...map(pickBy(properties, 'localized'), p => `properties.${p.key}`)
      ]
    }

    const clean = (page, layout) => {
      const properties = site.layouts[layout].properties
      const localizedProperties = Object.keys(pickBy(properties, 'localized'))
      return {
        ...omit(page, ['title', 'site']),
        properties: omit(get(page, 'properties'), localizedProperties)
      }
    }

    if (page.id) {
      _page = await Page.findOne({_id: page.id, site: site.id}).populate('parent')
      const {properties = {}, ...pageProperties} = clean(page, _page.layout)
      _page.set(pageProperties)
      forEach(properties, (value, key) => {
        _page.set(`properties.${key}`, value)
      })
    } else {
      locale = 'en'
      _page = new Page(clean(page, page.layout))
      let position = 0
      const lastPage = await Page.findOne({site: site._id}).sort('-position').select('position')
      if (lastPage) {
        position = lastPage.position
      }
      _page.site = site.id
      _page.position = position + 1
    }

    i18nfields(_page.layout).filter(f => has(page, f) && !isNil(get(page, f))).forEach(field => {
      _page.set(field, {
        ...get(_page, field, {}),
        [locale]: get(page, field)
      })
    })
    await _page.save()
    return _page
  }

  @mutation
  static async deletePage({site}, {id}) {
    const page = await Page.findOne({_id: id, site: site.id})
    if (!page) {
      return false
    } else {
      page.set('site', null)
      await page.save()
      return true
    }
  }

  @mutation
  static async addBlock({site}, {block}) {
    const {page: id, section, _type} = block
    let page = await Page.findById(id)
    page.sections = page.sections || {}
    page.sections[section] = page.sections[section] || []
    let objectId
    if (site.documentTypes && Object.keys(site.documentTypes).includes(_type)) {
      const object = await CatalogResolver.upsertItem({site}, {catalog: _type})
      objectId = object.id
    } else {
      const klass = require('../models')[_type]
      const blockObj = new klass({site})
      await blockObj.save()
      objectId = blockObj.id
    }

    page.sections[section].push({ref: mongoose.Types.ObjectId(objectId), _type})
    page.markModified('sections')
    await page.save()
    return objectId
  }

  @mutation
  static async removeBlock(context, {block: {page: pageId, ref}}) {
    let page = await Page.findById(pageId)
    forEach(page.sections, (section, key) => {
      if (map(section, block => String(block.ref)).includes(ref)) {
        page.sections[key] = reject(section, block => String(block.ref) === ref)
      }
    })
    page.markModified('sections')
    await page.save()
  }

  @mutation
  static async attachImage(context, {type, id, url}) {
    const klass = require('../models')[type]
    if (!klass) {
      throw new Error(`No model found for ${type}`)
    }
    const object = await klass.findById(id)
    return object.attach(url)
  }

  @mutation
  static async orderPages({site}, {pages, parent}) {
    return Promise.all(map(pages, (page, position) =>
      Page.findOneAndUpdate({_id: page, site: site._id}, {$set: {position, parent}}, {new: true}).populate('parent')
    ))
  }

  static queries = {}
  static mutations = {}
}
