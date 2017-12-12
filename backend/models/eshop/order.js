import mongoose from 'mongoose'
import {sumBy, some, isNil, get, includes, pickBy, mapValues} from 'lodash'
import Promise from 'bluebird'
import {orderSchema} from '../schema'
import Product from './product'
import Site from '../site'
import AsyncLock from 'async-lock'
import {mailTransporter} from '../../common/mailer'
import {renderEmail} from '../../renderers'
import * as deliveryMethods from '../../services/delivery'
import {t} from '../../common/utils'

const lock = new AsyncLock({Promise})

class OrderClass {
  async toContext({site, locale}) {
    const object = this.toObject()
    return {
      ...object,
      deliveryMethodLabel: t(get(site.eshop.deliveryMethods, [object.deliveryMethod, 'label'], object.deliveryMethod), locale),
      availableDeliveryMethods: await this.availableDeliveryMethods.then(methods =>
        mapValues(methods, method => ({...method, label: t(method.label, locale)}))
      )
    }
  }

  async addItemsFromCart(cart) {
    const items = await cart.items
    const lines = await Promise.map(items, async item => {
      const {
        count,
        product: {priceWithoutTaxes, taxAmount, finalPrice, tax, productName, productImage}
      } = item
      return {
        product: item.product,
        name: await productName,
        image: await productImage,
        count: count,
        discount: 0,
        discountType: 'none',

        price: priceWithoutTaxes,
        tax: tax,
        taxAmount: taxAmount,

        subtotal: priceWithoutTaxes * count,
        taxTotal: taxAmount * count,
        total: finalPrice * count,
      }
    })
    this.set({
      lines,
      subtotal: sumBy(lines, 'subtotal'),
      taxTotal: sumBy(lines, 'taxTotal'),
      total: sumBy(lines, 'total'),
    })
  }

  async setDeliveryMethod(key, method) {
    const deliveryCost = deliveryMethods[method.policy](method, this)
    this.set({
      deliveryMethod: key,
      deliveryCost,
      total: this.subtotal + this.taxTotal + deliveryCost
    })
  }

  finilize(completePayment) {
    return lock.acquire('eshop-stock-reduce', async () => {
      const products = await Promise.map(this.lines, async line => {
        return Product.findOne({_id: line.product, site: this.site, $where: `this.stock >= ${line.count}`})
      })
      if (some(products, isNil)) {
        throw new Error("Not enough stock")
      }
      await completePayment()
      await Promise.map(this.lines, line =>
        Product.findByIdAndUpdate(line.product, {$inc: {stock: -1 * line.count}})
      )
    }).then(async () => {
      this.set({status: 'new'})
      await this.save()

      const site = await Site.findOne({_id: this.site}).cache(10)
      await renderEmail({site}, 'email_order_confirmation', {order: this}).then(({body, subject}) => {
        mailTransporter.sendMail({
          from: get(site, 'fromEmail', process.env.FROM_EMAIL),
          to: this.billingAddress.email,
          subject,
          html: body,
        })
      })

      // await renderEmail({site}, 'email_admin_new_order', this).then((html, subject) => {
      //   mailTransporter.sendMail({
      //     from: get(site, 'fromEmail', process.env.FROM_EMAIL),
      //     to: site.notificationEmail,
      //     subject,
      //     html,
      //   })
      // })
    })

  }

  async cancel() {
    await Promise.all(this.lines, line =>
      Product.findOneAndUpdate({_id: line.product}, {$inc: {stock: 1}})
    )
    this.set({status: 'canceled'})
    await this.save()
  }

  returnStock() {
    return Promise.map(this.lines, line =>
      Product.findByIdAndUpdate(line.product, {$inc: {stock: line.count}})
    )
  }

  get availableDeliveryMethods() {
    return Site.findOne({_id: this.site}).then(site => {
      return pickBy(site.get('eshop').deliveryMethods, method =>
        (!method.countries || includes(method.countries, this.shippingAddress.country)) &&
        (!method.excludedCountries  || !includes(method.excludedCountries, this.shippingAddress.country))
      )
    })

  }

  async setDefaultDeliveryMethod() {
    const methods = await this.availableDeliveryMethods
    const method = Object.keys(pickBy(methods, 'default'))[0]
    if (method) {
      await this.setDeliveryMethod(method, methods[method])
    }
  }
}
orderSchema.loadClass(OrderClass)
const Order = mongoose.model('Order', orderSchema)
export default Order
