import {isNil, omitBy} from 'lodash'
import {AuditLog} from '../models'
import {query} from './utils'
import {resolveItem} from './catalog'

export default class {
  @query
  static async auditLog({site}, {limit, offset, user, object, admin}) {
    return (
      await AuditLog.find(omitBy({site: site._id, user, object, admin}, isNil))
        .populate('user')
        .populate('object')
        .populate('admin')
        .sort('-createdAt')
        .skip(offset || 0)
        .limit(limit || 50)
    ).map((log) => {
      return {
        id: log._id,
        meta: log.meta,
        action: log.get('action'),
        createdAt: log.createdAt,
        user: resolveItem(site, log.user),
        object: resolveItem(site, log.object),
        admin: log.get('admin'),
      }
    })
  }

  static queries = {}
  static mutations = {}
}
