import {auditLogSchema} from '../schema'
import mongoose from 'mongoose'

let AuditLog
export class AuditLogClass {
  static async logEvent(data, {throttleBy, throttleTime} = {}) {
    const {action, user, object, admin, meta} = data
    const site = (user || object).site
    if (throttleBy && throttleTime) {
      const lastEvent = await AuditLog.findOne({action, [throttleBy]: data[throttleBy], site}).sort({createdAt: -1})
      if (lastEvent && (Date.now() - lastEvent.createdAt.getTime()) < throttleTime) {
        return
      }
    }

    const auditLog = new AuditLog({action, user, object, admin, meta, site})
    await auditLog.save()
  }

  static async userLoggedIn(user, meta) {
    await this.logEvent({action: 'userLoggedIn', user, meta})
  }

  static async userDailyAccess(user, meta) {
    await this.logEvent({action: 'userDailyAccess', user, meta}, {throttleBy: 'user', throttleTime: 1000 * 60 * 60 * 24})
  }
}

auditLogSchema.loadClass(AuditLogClass)
AuditLog = mongoose.model('AuditLog', auditLogSchema)
export default AuditLog
