import mongoose from 'mongoose'
import {isEmpty, isNil, get, forEach, omit, map, isString, isBoolean, mapValues} from 'lodash'
import crypto from 'crypto'
import {query, mutation} from './utils'
import {Folder, Item} from '../models'
import SearchService from '../services/search'
import Promise from 'bluebird'

export default class {
  @query
  static folders({site}, {catalog}) {
    return Folder.where({site: site.id, catalog, deleted: false})
  }

  @query
  static folder({site}, {id}) {
    return Folder.findOne({site: site.id, _id: id, deleted: false})
  }

  @query
  static async item({site}, {id}) {
    const item = await Item.findOne({site: site.id, _id: id})
    const schema = site.documentTypes[item.catalog]
    const hiddenFields = Object.keys(schema.fields).filter(f => schema.fields[f].type === 'password')
    const label = schema.labelField ? item.get(schema.labelField) : ''
    return {
      id: item.id,
      label,
      data: omit(item.toObject(), hiddenFields)
    }
  }

  @query
  static async items({site}, {folder, search, catalog}) {
    const q = {site: site.id, deleted: false}
    let schema
    if (folder) {
      q.folder = folder
      if (catalog) {
        schema = site.documentTypes[catalog]
      } else {
        const folderObject = await Folder.findById(folder)
        if (!folderObject) return []
        schema = site.documentTypes[folderObject.catalog]
      }
    } else if (catalog) {
      q.catalog = catalog
      schema = site.documentTypes[catalog]
    }

    if (search) {
      const ids = await SearchService.simple_search(search, `${catalog}-${site.id}`, '*')
      q['_id'] = {$in: ids}
    }
    const referenceFields = Object.keys(schema.fields).filter(f =>
      schema.fields[f].type === 'select' && schema.fields[f].documentType
    )
    const hiddenFields = Object.keys(schema.fields).filter(f => schema.fields[f].type === 'password')
    const result = await referenceFields.reduce((acc, field) =>
      acc.populate({
        path: field,
        match: {site: site._id},
        select: site.documentTypes[schema.fields[field].documentType].labelField,
        model: 'Item'
      }), Item.where(q).sort(schema.sortBy || 'position'))
    return result.map(item => {
      const label = schema.labelField ? item.get(schema.labelField) : ''
      return {
        id: item.id,
        folder: item.folder,
        position: item.position,
        label,
        data: mapValues(item.toObject(), (value, key) => {
          if (hiddenFields.includes(key)) {
            return null
          }
          if (referenceFields.includes(key)) {
            const labelField = site.documentTypes[schema.fields[key].documentType].labelField
            return get(value, labelField)
          }
          return value
        }),
      }
    })
  }

  @mutation
  static async upsertFolder({site}, {folder}) {
    let {id, name, parent, locale, catalog, hidden, image} = folder
    if (id) {
      const folder = await Folder.findOne({_id: id, site: site.id})
      if (!folder) {
        throw new Error("Folder doesn't exist or you don't have access to it")
      }
      if (parent) {
        const parentFolder = await Folder.findOne({_id: parent, site: site.id})
        if (!parentFolder) {
          throw new Error("Folder doesn't exist or you don't have access to it")
        }
        folder.parent = parent
      }
      if (name) {
        folder.set('name', {
          ...folder.name,
          [locale]: name
        })
      }
      folder.set('image', image)
      if (isBoolean(hidden)) {
        folder.hidden = hidden
      }
      await folder.save()
      return folder
    } else {
      if (parent) {
        const parentFolder = await Folder.findOne({_id: parent, site: site.id})
        if (!parentFolder) {
          throw new Error("Folder doesn't exist or you don't have access to it")
        }
        catalog = parentFolder.catalog
      }
      if (!parent && !catalog) {
        throw new Error("Either parent folder or catalog have to be defined")
      }

      let position = 0
      const lastFolder = await Folder.findOne({parent}).sort('-position').select('position')
      if (lastFolder) {
        position = lastFolder.position
      }
      position++

      const folder = new Folder({name: {[locale]: name}, parent, position, catalog, image, site: site.id, deleted: false})
      await folder.save()
      return folder
    }
  }

  @mutation
  static async upsertItem({site}, params) {
    const {id, folder, locale, data = {}} = params
    const folderObject = folder && await Folder.findOne({_id: folder, site: site.id})

    let catalogKey = folderObject ? folderObject.catalog : params.catalog
    let catalog = site.documentTypes[catalogKey]

    let item
    if (id) {
      item = await Item.findOne({_id: id}).populate('folder')
      catalogKey = item.catalog
      catalog = site.documentTypes[catalogKey]
      if (String(get(item, 'site')) !== String(site.id)) {
        throw new Error("Item doesn't exist or you don't have access to it")
      }
    } else {
      let position = 0
      if (folder && !folderObject) {
        throw new Error("Folder doesn't exist or you don't have access to it")
      }

      const lastItemQuery = {catalog: catalogKey}
      if (folder) { lastItemQuery.folder = folder }
      const lastItem = await Item.findOne(lastItemQuery).sort('-position').select('position')
      if (lastItem) {
        position = lastItem.position || 0
      }
      position++
      item = new Item({site: site.id, folder, position, deleted: false, catalog: catalogKey})
    }

    forEach(omit(catalog.fields, (_, f) => isNil(data[f])), ({localized, type, ...fieldSchema}, field) => {
      if (localized) {
        item.set(field, {
          ...(item.get(field) || {}),
          [locale]: data[field],
        })
      } else {
        if (type === "number" || type === "money") {
          if (isString(data[field]) && type === 'money') {
            data[field] = data[field].replace(',', '.')
          }
          const val = type === 'money' ? parseFloat(data[field]) : parseInt(data[field], 10)
          item.set(field, isNaN(val) ? null : val)
        } else if (type === 'boolean') {
          item.set(field, data[field])
        } else if (type === 'date') {
          item.set(field, new Date(data[field]))
        } else if (type === 'datetime') {
          const dateValue = new Date(data[field])
          console.log(data[field], dateValue.getTime())
          if (isNaN(dateValue.getTime()) || dateValue.getTime() < 24 * 3600 * 1000) {
            item.set(field, null)
          } else {
            item.set(field, dateValue)
          }
        } else if (type === 'password') {
          if (!isEmpty(data[field])) {
            const hash = crypto
              .createHash('sha256')
              .update(data[field], 'utf8')
              .digest().toString('hex')
            item.set(field, hash)
          }
        } else if (type === 'select' && fieldSchema.documentType && !isEmpty(data[field])) {
          item.set(field, mongoose.Types.ObjectId(data[field]))
        } else if (isEmpty(data[field])) {
          item.set(field, null)
        } else {
          item.set(field, data[field])
        }
      }
    })

    await item.save()
    try {
      await Promise.map(site.supportedLanguages, async locale => {
        const body = await item.toSearchableDocument(catalog, site, locale)
        await SearchService.index({
          index: locale,
          type: `${catalogKey}-${site.id}`,
          id: item.id,
          body,
        })
      })
    } catch (e) {
      console.error(e)
    }

    return {
      id: item.id,
      position: item.position,
      data: item.toObject(),
    }
  }

  @mutation
  static async moveItem({site}, {id, newPosition}) {
    const item = await Item.findOne({site, _id: id})
    if (newPosition === item.position) {
      return
    } else if (newPosition < item.position) {
      await Item.update({folder: item.folder, position: {$gte: newPosition, $lt: item.position}},
        {$inc: {position: 1}},
        {multi: true}
      )
    } else if (newPosition > item.position) {
      await Item.update({folder: item.folder, position: {$gt: item.position, $lte: newPosition}},
        {$inc: {position: -1}},
        {multi: true}
      )
    }

    item.set('position', newPosition)
    await item.save()
  }

  @mutation
  static async deleteItem({site}, {id}) {
    const q = { _id: id, site: site.id }
    const item = await Item.findOne(q)
    await Promise.all(
      site.supportedLanguages.map(locale =>
        SearchService.delete({
          index: locale,
          type: item.catalog + '-' + site.id,
          id,
        }).catch(() => null)
      )
    )
    return Item.update(q, { $set: { deleted: true }})
  }

  @mutation
  static deleteFolder({site}, {id}) {
    // TODO: Remove all nested items from search
    return Folder.update({ _id: id, site: site.id }, { $set: { deleted: true }})
  }

  @mutation
  static async orderFolders({site}, {folders, parent}) {
    return Promise.all(map(folders, (folder, position) =>
      Folder.findOneAndUpdate({_id: folder, site: site._id}, {$set: {position, parent}}, {new: true})
    ))
  }

  static queries = {}
  static mutations = {}
}
