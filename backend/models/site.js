import {siteSchema} from './schema'
import mongoose from 'mongoose'
import fs from 'fs'
import {humanize} from 'inflection'
import {zipObject, forEach} from 'lodash'
import nunjucks from 'nunjucks'
import {S3} from '@aws-sdk/client-s3'
import * as tags from '../renderers/tags'

const s3 = new S3({region: 'eu-west-1'});

class SiteClass {
  get layouts() {
    // return redis.getAsync(key).then((layoutsJson) => {
    //   if (layoutsJson) {
    //     return JSON.parse(layoutsJson)
    //   } else {
    //     try {
          const layoutNames = fs.readdirSync(`./data/${this.key}/layouts`).filter(name => name.indexOf('.') !== 0)
          const layoutValues = layoutNames.map(layout => {
            const layoutInfo = this.layoutInfo(layout)
            return {
              name: humanize(layout.replace('-', '_')),
              sections: layoutInfo.sections,
              properties: layoutInfo.properties
            }
          })
          const layouts = zipObject(layoutNames, layoutValues)
          // redis.setAsync(key, JSON.stringify(layouts))
          return layouts
    //     } catch(e) {
    //       return {}
    //     }
    //   }
    // })
  }

  layoutInfo(layout) {
    if (!this.env) {
      this.env = nunjucks.configure(`./data/${this.key}/layouts`)
      this.env.addFilter('postalCodeToCity', () => null)
      this.env.addFilter('currency', () => null)
      this.env.addFilter('initials', () => null)
      this.env.addFilter('setQS', () => null)
      this.env.addFilter('date', () => null)
      forEach(tags, (tag, name) => {
        this.env.addExtension(name, new tag())
      })
    }
    if (!fs.existsSync(`./data/${this.key}/layouts/${layout}/index.html`)) {
      return {}
    }
    try {
      const context = {inspect: true, sections: [], properties: {}}
      this.env.render(`${layout}/index.html`, context)
      return {
        sections: zipObject(context.sections, context.sections.map(s => ({name: humanize(s)}))),
        properties: context.properties,
      }
    } catch(e) {
      console.log(e);
      return {}
    }
  }

  syncFile(file) {
    if (file.indexOf('layouts') !== 0) {
      return Promise.resolve()
    }
    return new Promise(async (resolve, reject) => {
      const obj = await s3.getObject({
        Bucket: process.env.S3_BUCKET,
        Key: `${this.key}/${file}`
      })
      const outFileStream = fs.createWriteStream(`./data/${this.key}/${file}`)
      obj.Body.pipe(outFileStream)
      outFileStream.on('finish', () => {
        console.error(`Done syncing ${this.key}/${file}`)
        resolve()
      })
      outFileStream.on('error', (err) => {
        console.error(`Error syncing ${this.key}/${file}`, err)
        reject(err)
      })
    })
  }
}

siteSchema.loadClass(SiteClass)
export default mongoose.model('Site', siteSchema)
