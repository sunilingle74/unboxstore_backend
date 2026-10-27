const CATEGORY_NAMES = [
  'Tops',
  'Jeans',
  'Shorts',
  'T-Shirts',
  'Bottoms',
  'Sweatpants',
  'Jackets & Coats',
  'Hoodies & Sweatshirts',
]

function slugify(str) {
  return str.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

module.exports = { CATEGORY_NAMES, slugify }
