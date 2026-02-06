import {map, pickBy, mapValues, omit, find, has, reverse} from 'lodash'
import mongoose from 'mongoose'
import {t} from '../common/utils'
import {pageSchema} from './schema'

let Page
class PageClass {
  get path() {
    return Page.find({site: this.site}).select(['_id', 'parent', 'slug']).cache().then(allPages => {
      const fullPath = [this.slug]
      let self = this
      while(self.parent) {
        const needle = self.parent._id || self.parent
        const parent = find(allPages, p => p._id.toString() === needle.toString())
        fullPath.push(parent.slug)
        self = parent
      }
      return reverse(fullPath).join('/')
    })
  }

  async url({locale, site}) {
    if (this.slug.startsWith('http')) {
      return this.slug
    }

    let path = await this.path //TODO: Optimize
    return `/${locale}/${path}`
  }

  async toContext({locale, site}) {
    const layout = site.layouts[this.layout]
    const localizedProperies = map(pickBy(layout.properties, 'localized'), 'key')
    return {
      ...omit(this.toObject({virtuals: true}), ['properties', 'title']),
      title: t(this.title, locale),
      path: await this.path,
      url: await this.url({locale, site}),
      target: this.slug.startsWith('http') ? '_blank' : '_self',
      params: this.params,
      ...mapValues(this.properties, (prop, key) => {
        if (localizedProperies.includes(key)) {
          return t(prop, locale)
        } else {
          return prop
        }
      })
    }
  }
}
pageSchema.loadClass(PageClass)
Page = mongoose.model('Page', pageSchema)
export default Page
