import mongoose from 'mongoose'
import {sumBy, some, isNil, get, includes, pickBy, pick, mapValues, map} from 'lodash'
import Promise from 'bluebird'
import {orderSchema} from '../schema'
import Product from './product'
import Site from '../site'
import AsyncLock from 'async-lock'
import * as deliveryMethods from '../../services/delivery'
import {t} from '../../common/utils'

const lock = new AsyncLock({Promise})

class OrderClass {
  async toContext({site, locale}) {
    const object = this.toObject()
    return {
      ...object,
      id: object._id,
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
      const fieldsToCopy = get(cart.req.site.eshop, 'copyToOrder', [])
      return {
        product: item.product,
        productData: pick(item.product.toObject(), fieldsToCopy),
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

  async setDeliveryMethod(key) {
    const allMethods = await this.availableDeliveryMethods
    const method = allMethods[key]
    let deliveryCost = 0

    if (method.policy in deliveryMethods) {
      deliveryCost = deliveryMethods[method.policy](method, this)
    } else {
      const {key: siteKey} = await Site.findOne({_id: this.site}).cache()
      const delveryMethodFile = `../../../data/${siteKey}/modules/${method.policy}`
      const deliveryCostFunction = require(delveryMethodFile).default
      if (deliveryCostFunction) {
        deliveryCost = deliveryCostFunction(method, this)
      } else {
        throw new Error('Invalid delivery method configuration')
      }
    }

    this.set({
      deliveryMethod: key,
      deliveryCost,
      total: this.subtotal + this.taxTotal + (this.get('processingFee') || 0) + deliveryCost
    })
  }

  async setPaymentMethod(method) {
    const site = await Site.findOne({_id: this.site}).cache()
    const paymentMethod = site.eshop.paymentMethods[method]
    if (!paymentMethod) {
      throw new Error('Unsupported payment method')
    }
    const {processingFee = 0} = paymentMethod
    this.set({
      paymentMethod: method,
      processingFee,
      total: this.subtotal + this.taxTotal + (this.deliveryCost || 0) + processingFee
    })
  }

  finalize(completePayment) {
    return lock.acquire('eshop-stock-reduce', async () => {
      const products = await Promise.map(this.lines, async line => {
        return Product.findOne({_id: line.product, site: this.site, $or: [{stock: {$gte: line.count}}, {byOrder: true}]})
      })
      if (some(products, isNil)) {
        // const outOfStockLines = map(this.lines, (_, idx) => this.lines[idx])
        throw new Error("Not enough stock")
      }
      await completePayment()
      await Promise.map(this.lines, line =>
        Product.findByIdAndUpdate(line.product, {$inc: {stock: -1 * line.count}})
      )
    }).then(async () => {
      this.set({status: 'new'})
      const site = (await Site.findById(this.get('site'))).toObject()
      const afterCreateHookFile = get(site, 'eshop.afterCreateOrderHook')
      if (afterCreateHookFile) {
        const afterCreateHookFilePath = `../../../data/${site.key}/modules/${afterCreateHookFile}`
        const afterCreateHook = require(afterCreateHookFilePath).default
        if (afterCreateHook) {
          await afterCreateHook(site, this)
        }
      }
      await this.save()
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

  _availableDeliveryMethods = undefined
  get availableDeliveryMethods() {
    if (this._availableDeliveryMethods) {
      return this._availableDeliveryMethods
    }
    const country = get(this.shippingAddress, 'country')
    return Site.findOne({_id: this.site}).cache().then(site => {
      this._availableDeliveryMethods = pickBy(site.get('eshop').deliveryMethods, method =>
        (!method.countries || includes(method.countries, country)) &&
        (!method.excludedCountries  || !includes(method.excludedCountries, country))
      )
      return this._availableDeliveryMethods
    })
  }

  async setDefaultDeliveryMethod() {
    const methods = await this.availableDeliveryMethods
    const method = Object.keys(pickBy(methods, 'default'))[0]
    if (method) {
      await this.setDeliveryMethod(method)
    }
  }

  async setDefaultPaymentMethod() {
    const site = await Site.findOne({_id: this.site}).cache()
    const method = Object.keys(pickBy(site.eshop.paymentMethods, 'default'))[0]
    if (method) {
      await this.setPaymentMethod(method)
    }
  }
}

orderSchema.pre('save', function(next) {
  if (this.number) {
    next()
    return
  }
  Order.findOne({site: this.site}).sort('-number').select('number').then(lastOrder => {
    this.number = get(lastOrder, 'number', 10000)
    this.number++
    next()
  })
})

orderSchema.loadClass(OrderClass)
const Order = mongoose.model('Order', orderSchema)
export default Order
