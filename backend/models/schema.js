import {Schema} from 'mongoose'

const userSchema = new Schema({
  email: {type: String, required: true, lowercase: true, trim: true, index: true, unique: true},
  name: {type: String},
  avatar: {type: String},
})

const siteSchema = new Schema({
  key: {type: String, required: true},
  domains: [String],
  allowedModules: [String],
  supportedLanguages: [String],
  users: [String],
  features: [String],
  documentTypes: JSON,
  eshop: JSON,
})

const itemSchema = new Schema({
  catalog: String,
  deleted: Boolean,
  position: Number,
  folder: {type: Schema.Types.ObjectId, ref: 'Folder'},
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
}, {strict: false, timestamps: true})

const folderSchema = new Schema({
  name: Object,
  slug: String,
  position: {type: Number, default: 9999},
  parent: {type: Schema.Types.ObjectId, ref: 'Folder'},
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
  hidden: {type: Boolean, default: false},
  image: String,
  catalog: String,
  deleted:  {type: Boolean, default: false},
})

const pageSchema = new Schema({
  slug: {type: String, required: "{PATH} is required"},
  published: Boolean,
  layout: String,
  parent: {type: Schema.Types.ObjectId, ref: 'Page'},
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
  title: Object,
  sections: Object,
  properties: Object,
  position: {type: Number, default: 9999}
})

const staticTextSchema = new Schema({
  content: Object,
  images: [String],
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
  key: String,
  global: {type: Boolean, default: false},
  type: String,
})

const fileSchema = new Schema({
  originalName: String,
  displayName: Object,
  size: Number,
  type: String,
  url: String,
})

const fileListSchema = new Schema({
  files: [fileSchema],
  template: String,
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
})

const addressSchema = new Schema({
  country: String,
  city: String,
  postalCode: String,
  streetAddress: String,
  name: String,
  email: String,
  phone: String,
})

const orderLineSchema = new Schema({
  product: {type: Schema.Types.ObjectId, ref: 'Item'},
  productData: Object,
  name: String,
  image: String,
  count: Number,
  price: Number,
  discount: Number,
  discountType: String,
  tax: Number,
  taxAmount: Number,
  subtotal: Number,
  total: Number,
})

const orderSchema = new Schema({
  number: Number,
  lines: [orderLineSchema],
  site: {type: Schema.Types.ObjectId, ref: 'Site'},
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  status: String,
  paymentMethod: String,
  paymentStatus: String,
  subtotal: Number,
  tax: Number,
  deliveryMethod: String,
  deliveryCost: Number,
  deliveryDiscount: Number,
  total: Number,
  taxTotal: Number,
  comments: String,
  user: {type: Schema.Types.ObjectId, ref: 'Item'},
  // createdAt: Date,
  // updatedAt: Date,
}, {strict: false, timestamps: true})

// orderSchema.pre('save', function(next) {
//   const now = new Date()
//   this.updatedAt = now
//   if (!this.createdAt) {
//     this.created_at = now
//   }
//   next()
// })

export {
  userSchema,
  pageSchema,
  siteSchema,
  staticTextSchema,
  itemSchema,
  folderSchema,
  fileListSchema,
  orderSchema,
}
