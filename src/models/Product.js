const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
  },
  { _id: false }
)

const colorSchema = new mongoose.Schema({ name: String, hex: String }, { _id: false })

const dimensionsSchema = new mongoose.Schema(
  { length: Number, width: Number, height: Number },
  { _id: false }
)

const seoSchema = new mongoose.Schema(
  {
    metaTitle: String,
    metaDescription: String,
    tags: { type: [String], default: [] },
  },
  { _id: false }
)

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    sku: { type: String, unique: true, sparse: true, uppercase: true, trim: true },

    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    collection: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },

    shortDescription: String,
    description: String,
    details: [String],

    // Selling price is what customers see; costPrice is internal-only (margin tracking).
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0 },
    originalPrice: { type: Number, min: 0 }, // compare-at / strikethrough price
    discountType: { type: String, enum: ['None', 'Percent', 'Flat'], default: 'None' },
    discountValue: { type: Number, default: 0, min: 0 },

    images: { type: [imageSchema], default: [] },
    sizes: { type: [String], default: [] },
    colors: { type: [colorSchema], default: [] },

    material: String,
    gender: { type: String, enum: ['Men', 'Women', 'Unisex', 'Kids'], default: 'Unisex' },
    weightKg: Number,
    dimensions: dimensionsSchema,

    stockCount: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    sold: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },

    seo: seoSchema,

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    // "collection" is a reserved Mongoose path name (it shadows Model.collection,
    // the raw driver accessor) — safe here since nothing in this codebase calls
    // Product.collection directly, only Query/populate on the field.
    suppressReservedKeysWarning: true,
  }
)

productSchema.virtual('status').get(function status() {
  if (this.stockCount === 0) return 'Out of Stock'
  if (this.stockCount <= this.lowStockThreshold) return 'Low Stock'
  return 'In Stock'
})
productSchema.set('toJSON', { virtuals: true })
productSchema.set('toObject', { virtuals: true })

productSchema.index({ name: 'text', description: 'text' })

module.exports = mongoose.model('Product', productSchema)
