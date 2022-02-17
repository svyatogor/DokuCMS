import {defaults, map, isString} from 'lodash'
import {Folder} from '../../models'
import Promise from 'bluebird'
export class catalogmenu {
  constructor(renderContext) {
    this.tags = ['catalogmenu']
  }

  parse(parser, nodes, lexer) {
    const tok = parser.nextToken();

    const root = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    let body = parser.parseUntilBlocks('endcatalogmenu');
    parser.advanceAfterBlockEnd();

    return new nodes.CallExtensionAsync(this, 'run', root, [body]);
  }

  async run({ctx}, catalog, options, body, callback) {
    if (ctx.inspect) {
      return callback(null, '')
    }

    try {
      const opts = defaults(options, {as: 'folder'})
      const key = opts.as
      const originalValue = ctx[key]
      let foldersQuery

      let parent
      if (isString(opts.root)) {
        parent = opts.root
      } else if (opts.root && opts.root._id) {
        parent = opts.root._id
      }
      foldersQuery = Folder.find({site: ctx.site._id, catalog, parent, deleted: false, hidden: {$ne: true}})
      // if (root === 'self') {
      //   pagesQuery = Page.find({site: ctx.site._id, parent: ctx.page._id})
      // } else if (root === 'parent') {
      //   pagesQuery = Page.find({site: ctx.site._id, parent: ctx.page.parent})
      // } else if (root === 'root') {

      // } else if (isString(root)) {
      //   const {id: parent} = await resolvePath(root, ctx.req)
      //   pagesQuery = Page.find({site: ctx.site._id, parent})
      // } else if (root._id) {
      //   pagesQuery = Page.find({site: ctx.site._id, parent: root._id})
      // } else {
      //   callback(new Error(`Invalid menu root object ${root}`), null)
      //   return
      // }

      return foldersQuery.sort('position').cache().then(async folders => {
        return Promise.mapSeries(folders, async folder => {
          const contentFolder = await folder.toContext({locale: ctx.req.locale})
          ctx[key] = {
            ...contentFolder,
            // active: TODO: implement
          }
          return new Promise((resolve, reject) => {
            body((error, data) => {
              if (error) { reject(error) }
              else { resolve(data) }
            })
          })
        }).then(data => {
          ctx[key] = originalValue
          callback(null, data.join(''))
        })
      }).catch(err => callback(err))
    } catch (e) {
      console.log(e);
      callback(e)
    }
  }
}