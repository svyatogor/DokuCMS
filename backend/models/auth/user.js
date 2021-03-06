import Item from '../item'
import crypto from 'crypto'


export default class User extends Item {
  authenticate(password) {
    const passwordHash = crypto
      .createHash('sha256')
      .update(password, 'utf8')
      .digest().toString('hex')
    return this.get('password') === passwordHash && !this.get('deleted')
  }
}
