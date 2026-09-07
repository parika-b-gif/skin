import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { MongoClient } from 'mongodb'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = process.env.PORT || 3001
const mongoUri = process.env.MONGODB_URI
const databaseName = process.env.MONGODB_DB || 'luma_store'
const seedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'store.json')

if (!mongoUri) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB connection string.')
  process.exit(1)
}

app.use(cors())
app.use(express.json())

let database
let productsCollection
let cartsCollection
let wishlistsCollection
let ordersCollection

async function connectDatabase() {
  const client = new MongoClient(mongoUri)
  await client.connect()
  database = client.db(databaseName)
  productsCollection = database.collection('products')
  cartsCollection = database.collection('carts')
  wishlistsCollection = database.collection('wishlists')
  ordersCollection = database.collection('orders')

  if (await productsCollection.countDocuments() === 0) {
    const seed = JSON.parse(await readFile(seedPath, 'utf8'))
    if (seed.products?.length) await productsCollection.insertMany(seed.products)
  }

  await productsCollection.createIndex({ category: 1 })
  await productsCollection.createIndex({ name: 'text' })
  await cartsCollection.createIndex({ _id: 1 }, { unique: true })
  await wishlistsCollection.createIndex({ _id: 1 }, { unique: true })
}

async function getProducts() {
  return productsCollection.find({}, { projection: { _id: 0 } }).toArray()
}

async function normalizeItems(items) {
  if (!Array.isArray(items)) return null
  const products = await getProducts()
  const normalized = []
  for (const item of items) {
    const product = products.find((entry) => entry.id === Number(item.productId))
    const quantity = Number(item.quantity)
    if (!product || !Number.isInteger(quantity) || quantity < 1) return null
    const existing = normalized.find((entry) => entry.productId === product.id)
    if (existing) existing.quantity += quantity
    else normalized.push({ productId: product.id, quantity })
  }
  return normalized
}

app.get('/', (_request, response) => response.json({
  name: 'Luma Store API',
  status: 'running',
  database: databaseName,
  health: '/api/health',
  products: '/api/products',
  cart: '/api/cart/:sessionId',
  wishlist: '/api/wishlist/:sessionId',
  orders: '/api/orders',
}))

app.get('/api/health', async (_request, response) => {
  try {
    await database.command({ ping: 1 })
    response.json({ ok: true, service: 'luma-store-api', database: 'connected' })
  } catch {
    response.status(503).json({ ok: false, service: 'luma-store-api', database: 'disconnected' })
  }
})

app.get('/api/products', async (request, response) => {
  const query = String(request.query.search || '').toLowerCase()
  const category = String(request.query.category || '')
  const maxPrice = Number(request.query.maxPrice || Number.MAX_SAFE_INTEGER)
  const sort = String(request.query.sort || 'featured')
  const products = (await getProducts()).filter((product) => (!category || product.category === category) && product.price <= maxPrice && product.name.toLowerCase().includes(query))
  products.sort((first, second) => sort === 'price-low' ? first.price - second.price : sort === 'price-high' ? second.price - first.price : sort === 'rating' ? second.rating - first.rating : sort === 'name' ? first.name.localeCompare(second.name) : first.id - second.id)
  response.json({ products, total: products.length })
})

app.get('/api/products/:id', async (request, response) => {
  const product = await productsCollection.findOne({ id: Number(request.params.id) }, { projection: { _id: 0 } })
  if (!product) return response.status(404).json({ error: 'Product not found' })
  response.json(product)
})

app.get('/api/cart/:sessionId', async (request, response) => {
  const cart = await cartsCollection.findOne({ _id: request.params.sessionId }, { projection: { _id: 0, items: 1 } })
  response.json({ sessionId: request.params.sessionId, items: cart?.items || [] })
})

app.put('/api/cart/:sessionId', async (request, response) => {
  const items = await normalizeItems(request.body.items)
  if (!items) return response.status(400).json({ error: 'items must contain valid productId and quantity values' })
  await cartsCollection.replaceOne({ _id: request.params.sessionId }, { _id: request.params.sessionId, items, updatedAt: new Date() }, { upsert: true })
  response.json({ sessionId: request.params.sessionId, items })
})

app.get('/api/wishlist/:sessionId', async (request, response) => {
  const wishlist = await wishlistsCollection.findOne({ _id: request.params.sessionId }, { projection: { _id: 0, productIds: 1 } })
  const productIds = wishlist?.productIds || []
  const products = await productsCollection.find({ id: { $in: productIds } }, { projection: { _id: 0 } }).toArray()
  response.json({ productIds, products })
})

app.post('/api/wishlist/:sessionId/:productId', async (request, response) => {
  const productId = Number(request.params.productId)
  if (!await productsCollection.findOne({ id: productId })) return response.status(404).json({ error: 'Product not found' })
  const wishlist = await wishlistsCollection.findOne({ _id: request.params.sessionId })
  const productIds = wishlist?.productIds || []
  const nextIds = productIds.includes(productId) ? productIds.filter((id) => id !== productId) : [...productIds, productId]
  await wishlistsCollection.replaceOne({ _id: request.params.sessionId }, { _id: request.params.sessionId, productIds: nextIds, updatedAt: new Date() }, { upsert: true })
  response.json({ productIds: nextIds })
})

app.post('/api/orders', async (request, response) => {
  const { sessionId, customer, items } = request.body
  const normalizedItems = await normalizeItems(items)
  if (!sessionId || !customer?.email || !normalizedItems?.length) return response.status(400).json({ error: 'sessionId, customer.email, and items are required' })
  const products = await getProducts()
  const lineItems = normalizedItems.map(({ productId, quantity }) => {
    const product = products.find((entry) => entry.id === productId)
    return { productId, name: product.name, price: product.price, quantity }
  })
  const subtotal = lineItems.reduce((total, item) => total + item.price * item.quantity, 0)
  const order = { id: `LUMA-${randomUUID().slice(0, 8).toUpperCase()}`, sessionId, customer, items: lineItems, subtotal, createdAt: new Date(), status: 'received' }
  await ordersCollection.insertOne(order)
  await cartsCollection.deleteOne({ _id: sessionId })
  response.status(201).json({ ...order, _id: undefined })
})

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }))

connectDatabase().then(() => {
  app.listen(port, () => console.log(`Luma API running at http://localhost:${port} with MongoDB`))
}).catch((error) => {
  console.error(`MongoDB connection failed: ${error.message}`)
  process.exit(1)
})
