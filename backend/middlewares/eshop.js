import express from 'express'
import BaseJoi from 'joi'
import JoiPhoneNumberExtensions from 'joi-phone-number-extensions'
import {form as  joiToForms} from 'joi-errors-for-forms'
import bodyParser from 'body-parser'
import {get, includes} from 'lodash'
import fetch from 'node-fetch'
import numeral from 'numeral'
import Cart from '../models/eshop/cart'
import Order from '../models/eshop/order'
import PaymentServices from './payment_services'

const Joi = BaseJoi.extend(JoiPhoneNumberExtensions)

const addressSchema = Joi.object().keys({
  name: Joi.string().max(250).required(),
  email: Joi.string().email().required(),
  phone: Joi.phoneNumber().defaultRegion('CY').format('NATIONAL'),
  country: Joi.string().max(2).optional().default('CY'),
  city: Joi.string().required(),
  postalCode: Joi.string().required(),
  streetAddress: Joi.string().required(),
})

const orderSchema = Joi.object().keys({
  billingAddress: addressSchema.required(),
  shippingAddress: addressSchema.optional(),
  deliveryMethod: Joi.string().optional(),
})

export const eshop = express()
eshop.use(bodyParser.urlencoded({extended: true}))

eshop.get('/eshop/add_to_cart/:id', async (req, res, next) => {
  const cart = new Cart(req)
  cart.add(req.params.id)
  res.cookie('cart', cart.serialize())
  req.flash('info', 'eshop.info.product_added')
  res.redirect(get(req.site, 'eshop.cartPage'))
})

eshop.post('/eshop/checkout', async (req, res, next) => {
  const cart = new Cart(req)

  if (cart.count < 1) {
    res.redirect(req.site.eshop.rootPage || '/')
    return
  }

  const {value, error} = Joi.validate(req.body, orderSchema, {abortEarly: false, stripUnknown: true})
  if (error) {
    req.flash('validation', joiToForms()(error))
    res.redirect(get(req.site, 'eshop.cartPage') || req.get('Referrer'))
    return
  }

  const order = await Order.buildFromCart(cart)
  order.billingAddress = value.billingAddress
  order.shippingAddress = value.shippingAddress
  order.deliveryMethod = value.deliveryMethod
  order.status = 'draft'

  try {
    await order.save()
    res.redirect(get(req.site, 'eshop.cartPage') + '/complete/' + order._id)
  } catch (e) {
    console.log(e)
    req.flash('error', 'eshop.errors.generic_checkout_error')
    res.redirect(req.get('Referrer'))
    return
  }
})

eshop.get('/eshop/order/:order/completeWithCashOnDelivery', async (req, res, next) => {
  if (!includes(req.site.eshop.allowedPaymentMethods, 'cash_on_delivery')) {
    res.sendStatus(404)
    return
  }
  const order = await Order.findOne({_id: req.params.order, site: req.site._id, status: 'draft'})
  if (!order) {
    res.sendStatus(404)
    return
  }

  order.set({paymentMethod: 'cash_on_delivery', paymentStatus: 'pending', status: 'new'})
  // deduct stock!
  await order.save()
  res.cookie('cart', [])
  res.redirect(get(req.site, 'eshop.cartPage') + '/thankyou')
})

eshop.post('/eshop/order/:order/completeWithPayPal', async (req, res, next) => {
  if (!includes(req.site.eshop.allowedPaymentMethods, 'paypal')) {
    res.sendStatus(404)
    return
  }
  const order = await Order.findOne({_id: req.params.order, site: req.site._id, status: 'draft'})
  if (!order) {
    res.sendStatus(404)
    return
  }

  const auth = 'Basic ' + new Buffer(req.site.eshop.paypalClientId + ':' + req.site.eshop.paypalSecret).toString('base64');
  const credentials = await fetch(`${process.env.PAYPAL_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: auth
    },
    body: "grant_type=client_credentials"
  })
  const accessToken = (await credentials.json()).access_token

  const executeRes = await fetch(`${process.env.PAYPAL_API_URL}/payments/payment/${order.get('paypalPaymentRequest').id}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `bearer ${accessToken}`
    },
    body: JSON.stringify({payer_id: req.body.payerID})
  })
  const receipt = await executeRes.json()
  if (receipt.state === 'approved') {
    order.set({
      receipt,
      paymentStatus: 'paid',
      status: 'new'
    })
    res.cookie('cart', [])
  }
  await order.save()
  res.json(receipt)
})

eshop.post('/eshop/order/:order/createPayPalPayment', async (req, res, next) => {
  const order = await Order.findOne({_id: req.params.order, site: req.site._id, status: 'draft'})
  if (!order) {
    res.sendStatus(404)
    return
  }
  const cartPage = get(req.site, 'eshop.cartPage')
  const payload = {
    intent: "sale",
    redirect_urls: {
      return_url: `${req.protocol}://${req.hostname}${cartPage}/thankyou`,
      cancel_url: `${req.protocol}://${req.hostname}${cartPage}/complete/${order._id}`,
    },
    payer: {
      payment_method: "paypal"
    },
    transactions: [
      {
        amount: {
          total: numeral(order.total).format('0.00'),
          currency: "EUR",
          // "details": {
          //   "subtotal": "2.00",
          //   "shipping": "1.00",
          //   "tax": "2.00",
          //   "shipping_discount": "-1.00"
          // }
        },
        item_list: {
          items: order.lines.map(line => ({
            name: line.name,
            quantity: line.count,
            price: numeral(line.total).format('0.00'),
            currency: 'EUR',
          })),
          shipping_address: {
            recipient_name: get(order.shippingAddress, 'name', order.billingAddress.name),
            line1: get(order.shippingAddress, 'streetAddress', order.billingAddress.streetAddress),
            city: get(order.shippingAddress, 'city', order.billingAddress.city),
            country_code: get(order.shippingAddress, 'country', order.billingAddress.country || 'CY'),
            postal_code: get(order.shippingAddress, 'postalCode', order.billingAddress.postalCode),
            phone: get(order.shippingAddress, 'phone', order.billingAddress.phone),
          }
        },
        description: `Payment for order #${order.number} at ${req.site.eshop.legalName}`,
        invoice_number: order.number,
        payment_options: {
          allowed_payment_method: "INSTANT_FUNDING_SOURCE"
        },
      }
    ]
  }

  const auth = 'Basic ' + new Buffer(req.site.eshop.paypalClientId + ':' + req.site.eshop.paypalSecret).toString('base64');
  const credentials = await fetch(`${process.env.PAYPAL_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: auth
    },
    body: "grant_type=client_credentials"
  })
  const accessToken = (await credentials.json()).access_token

  const paymentRes = await fetch(`${process.env.PAYPAL_API_URL}/payments/payment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  })
  const paypalPaymentRequest = await paymentRes.json()
  order.set({paymentMethod: 'paypal', paypalPaymentRequest})
  await order.save()
  res.json(paypalPaymentRequest)
})