import "dotenv/config";
import cors from "cors";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import Stripe from "stripe";
import {
  createToken,
  hashPassword,
  readToken,
  verifyPassword,
} from "./auth.js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3001;
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "luma_store";
const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "data",
  "store.json",
);
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const jwtSecret =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "local-development-only-change-me");

if (!mongoUri) {
  console.error(
    "Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB connection string.",
  );
  process.exit(1);
}
if (!jwtSecret) {
  console.error("Missing JWT_SECRET. Add a private JWT_SECRET to .env.");
  process.exit(1);
}

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET)
      return response
        .status(503)
        .json({ error: "Stripe webhook is not configured" });
    try {
      const event = stripe.webhooks.constructEvent(
        request.body,
        request.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        const order = await ordersCollection.findOne({ id: orderId });
        if (order && order.paymentStatus !== "paid") {
          await ordersCollection.updateOne(
            { id: orderId },
            {
              $set: {
                paymentStatus: "paid",
                status: "processing",
                paidAt: new Date(),
              },
            },
          );
          await Promise.all(
            order.items.map((item) =>
              productsCollection.updateOne(
                { id: item.productId },
                { $inc: { inventory: -item.quantity } },
              ),
            ),
          );
          await cartsCollection.deleteOne({ _id: order.sessionId });
        }
      }
      response.json({ received: true });
    } catch (error) {
      response.status(400).send(`Webhook Error: ${error.message}`);
    }
  },
);
app.use(express.json());

let database;
let productsCollection;
let cartsCollection;
let wishlistsCollection;
let ordersCollection;
let reviewsCollection;
let contentCollection;
let usersCollection;
let contactMessagesCollection;

const categoryMedia = {
  Cleansers:
    "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85",
  Serums:
    "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=85",
  Moisturizers:
    "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=900&q=85",
  "Sun Care":
    "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=85",
  Treatments:
    "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85",
  Toners:
    "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=85",
  Exfoliators:
    "https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=85",
  "Body Care":
    "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=900&q=85",
  "Lip Care":
    "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=85",
};

async function connectDatabase() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  database = client.db(databaseName);
  productsCollection = database.collection("products");
  cartsCollection = database.collection("carts");
  wishlistsCollection = database.collection("wishlists");
  ordersCollection = database.collection("orders");
  reviewsCollection = database.collection("reviews");
  contentCollection = database.collection("content");
  usersCollection = database.collection("users");
  contactMessagesCollection = database.collection("contactMessages");

  if (
    process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD &&
    !(await usersCollection.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
    }))
  ) {
    await usersCollection.insertOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
      role: "admin",
      createdAt: new Date(),
    });
  }
  await usersCollection.createIndex({ email: 1 }, { unique: true });

  const seed = JSON.parse(await readFile(seedPath, "utf8"));
  if (seed.products?.length) {
    await Promise.all(
      seed.products.map((product) => {
        const seededProduct = {
          ...product,
          inventory: product.inventory ?? 25,
        };
        const insertProduct = { ...seededProduct };
        for (const field of [
          "name",
          "category",
          "price",
          "rating",
          "reviews",
          "size",
          "image",
          "description",
        ])
          delete insertProduct[field];
        const update = {
          $setOnInsert: insertProduct,
          $set: {
            name: product.name,
            category: product.category,
            price: product.price,
            rating: product.rating,
            reviews: product.reviews,
            size: product.size,
            ...(product.image ? { image: product.image } : {}),
            ...(product.description
              ? { description: product.description }
              : {}),
          },
        };
        return productsCollection.updateOne({ id: product.id }, update, {
          upsert: true,
        });
      }),
    );
  }

  if ((await contentCollection.countDocuments()) === 0) {
    await contentCollection.insertMany([
      {
        key: "journal",
        entries: [
          {
            title: "The quiet morning routine",
            type: "Rituals",
            text: "A three-step start for skin that feels calm all day.",
          },
          {
            title: "How to read your skin barrier",
            type: "Ingredients",
            text: "The signs your skin is asking for less, not more.",
          },
          {
            title: "SPF is an everyday essential",
            type: "Sun care",
            text: "Why protection belongs in every season and every routine.",
          },
        ],
      },
      {
        key: "contact",
        email: "hello@luma.skin",
        phone: "+1 800 555 1234",
        address: "24 Orchard Street\nNew York, NY",
        hours: "Monday to Friday, 9am to 5pm",
      },
    ]);
  }

  await productsCollection.createIndex({ category: 1 });
  await productsCollection.createIndex({ name: "text" });
}

async function getProducts() {
  const products = await productsCollection
    .find({}, { projection: { _id: 0 } })
    .toArray();
  return products.map((product) => ({
    ...product,
    image:
      product.image ||
      categoryMedia[product.category] ||
      categoryMedia.Treatments,
    description:
      product.description ||
      `${product.name}, thoughtfully made for a simple everyday ritual.`,
    inventory: product.inventory ?? 25,
  }));
}

async function normalizeItems(items) {
  if (!Array.isArray(items)) return null;
  const products = await getProducts();
  const normalized = [];
  for (const item of items) {
    const product = products.find(
      (entry) => entry.id === Number(item.productId),
    );
    const quantity = Number(item.quantity);
    if (
      !product ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > product.inventory
    )
      return null;
    const existing = normalized.find((entry) => entry.productId === product.id);
    if (existing) existing.quantity += quantity;
    else normalized.push({ productId: product.id, quantity });
  }
  return normalized;
}

const shippingRates = {
  US: 5,
  CA: 12,
  GB: 15,
  AU: 25,
  IN: 18,
  DE: 10,
  FR: 10,
  JP: 20,
};

function sendError(response, error, status = 500) {
  console.error(error);
  response.status(status).json({
    ok: false,
    error: status === 500 ? "Something went wrong. Please try again." : error,
  });
}

function publicUser(user) {
  return { id: user._id.toString(), email: user.email, role: user.role };
}

async function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token)
    return response
      .status(401)
      .json({ ok: false, error: "Authentication required" });
  try {
    const claims = readToken(token, jwtSecret);
    const user = await usersCollection.findOne({
      _id: new ObjectId(claims.sub),
    });
    if (!user)
      return response
        .status(401)
        .json({ ok: false, error: "User account not found" });
    request.user = user;
    next();
  } catch {
    response.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (request, response, next) =>
    request.user?.role === role
      ? next()
      : response.status(403).json({ ok: false, error: "Permission denied" });
}

app.get("/", (_request, response) =>
  response.json({
    name: "Luma Store API",
    status: "running",
    database: databaseName,
    health: "/api/health",
    products: "/api/products",
    cart: "/api/cart/:sessionId",
    wishlist: "/api/wishlist/:sessionId",
    orders: "/api/orders",
  }),
);

app.get("/api/health", async (_request, response) => {
  try {
    await database.command({ ping: 1 });
    response.json({
      ok: true,
      service: "luma-store-api",
      database: "connected",
    });
  } catch {
    response
      .status(503)
      .json({ ok: false, service: "luma-store-api", database: "disconnected" });
  }
});

app.post("/api/auth/register", async (request, response) => {
  try {
    const email = String(request.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(request.body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
      return response.status(400).json({
        ok: false,
        error: "Use a valid email and a password of at least 8 characters",
      });
    if (await usersCollection.findOne({ email }))
      return response.status(409).json({
        ok: false,
        error: "An account with this email already exists",
      });
    const user = {
      email,
      passwordHash: await hashPassword(password),
      role: "user",
      createdAt: new Date(),
    };
    const result = await usersCollection.insertOne(user);
    user._id = result.insertedId;
    response.status(201).json({
      ok: true,
      data: { user: publicUser(user), token: createToken(user, jwtSecret) },
    });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const email = String(request.body.email || "")
      .trim()
      .toLowerCase();
    const user = await usersCollection.findOne({ email });
    if (
      !user ||
      !(await verifyPassword(
        String(request.body.password || ""),
        user.passwordHash,
      ))
    )
      return response
        .status(401)
        .json({ ok: false, error: "Invalid email or password" });
    response.json({
      ok: true,
      data: { user: publicUser(user), token: createToken(user, jwtSecret) },
    });
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) =>
  response.json({ ok: true, data: { user: publicUser(request.user) } }),
);
app.post("/api/auth/logout", requireAuth, (_request, response) =>
  response.json({ ok: true, message: "Logged out" }),
);

app.get("/api/products", async (request, response) => {
  const query = String(request.query.search || "").toLowerCase();
  const category = String(request.query.category || "");
  const maxPrice = Number(request.query.maxPrice || Number.MAX_SAFE_INTEGER);
  const sort = String(request.query.sort || "featured");
  const products = (await getProducts()).filter(
    (product) =>
      (!category || product.category === category) &&
      product.price <= maxPrice &&
      product.name.toLowerCase().includes(query),
  );
  products.sort((first, second) =>
    sort === "price-low"
      ? first.price - second.price
      : sort === "price-high"
        ? second.price - first.price
        : sort === "rating"
          ? second.rating - first.rating
          : sort === "name"
            ? first.name.localeCompare(second.name)
            : first.id - second.id,
  );
  response.json({ products, total: products.length });
});

app.get("/api/products/:id", async (request, response) => {
  try {
    const product = (await getProducts()).find(
      (entry) => entry.id === Number(request.params.id),
    );
    if (!product)
      return response.status(404).json({ error: "Product not found" });
    response.json(product);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/api/content/:key", async (request, response) => {
  try {
    const content = await contentCollection.findOne(
      { key: request.params.key },
      { projection: { _id: 0, key: 0 } },
    );
    if (!content)
      return response.status(404).json({ error: "Content not found" });
    response.json(content);
  } catch (error) {
    sendError(response, error);
  }
});

app.get("/api/products/:id/reviews", async (request, response) => {
  try {
    const reviews = await reviewsCollection
      .find(
        { productId: Number(request.params.id) },
        { projection: { authorToken: 0 } },
      )
      .sort({ createdAt: -1 })
      .toArray();
    response.json({
      reviews: reviews.map((review) => ({
        ...review,
        _id: review._id.toString(),
        userId: review.userId?.toString(),
      })),
    });
  } catch (error) {
    sendError(response, error);
  }
});

app.post("/api/checkout-session", requireAuth, async (request, response) => {
  try {
    if (!stripe)
      return response.status(503).json({
        error:
          "Payments are not configured. Add STRIPE_SECRET_KEY to the server environment.",
      });
    const { sessionId, customer, items } = request.body;
    const normalizedItems = await normalizeItems(items);
    if (!sessionId || !customer?.email || !normalizedItems?.length)
      return response
        .status(400)
        .json({ error: "sessionId, customer.email, and items are required" });
    const products = await getProducts();
    const lineItems = normalizedItems.map(({ productId, quantity }) => {
      const product = products.find((entry) => entry.id === productId);
      return { productId, name: product.name, price: product.price, quantity };
    });
    const subtotal = lineItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const shipping = subtotal >= 50 ? 0 : shippingRates[customer.country] || 5;
    const order = {
      id: `LUMA-${randomUUID().slice(0, 8).toUpperCase()}`,
      sessionId,
      customer,
      items: lineItems,
      subtotal,
      shipping,
      total: subtotal + shipping,
      paymentStatus: "pending",
      createdAt: new Date(),
      status: "awaiting_payment",
    };
    await ordersCollection.insertOne(order);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      shipping_options: shipping
        ? [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: {
                  amount: Math.round(shipping * 100),
                  currency: "usd",
                },
                display_name: `Shipping to ${customer.country}`,
              },
            },
          ]
        : undefined,
      metadata: { orderId: order.id },
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/checkout?paid=1&order=${order.id}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/checkout?cancelled=1`,
    });
    response.status(201).json({ url: checkoutSession.url, orderId: order.id });
  } catch (error) {
    sendError(response, error);
  }
});

app.post(
  "/api/products/:id/reviews",
  requireAuth,
  async (request, response) => {
    try {
      const productId = Number(request.params.id);
      if (!(await productsCollection.findOne({ id: productId })))
        return response.status(404).json({ error: "Product not found" });
      const { name, rating, text } = request.body;
      if (
        !name?.trim() ||
        !Number.isInteger(Number(rating)) ||
        Number(rating) < 1 ||
        Number(rating) > 5 ||
        !text?.trim()
      )
        return response
          .status(400)
          .json({ ok: false, error: "name, rating, and text are required" });
      const review = {
        productId,
        userId: request.user._id,
        name: name.trim().slice(0, 80),
        rating: Number(rating),
        text: text.trim().slice(0, 1000),
        createdAt: new Date(),
      };
      await reviewsCollection.insertOne(review);
      response.status(201).json({
        _id: review._id.toString(),
        productId,
        userId: request.user._id.toString(),
        name: review.name,
        rating: review.rating,
        text: review.text,
        createdAt: review.createdAt,
      });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.delete(
  "/api/products/:id/reviews/:reviewId",
  requireAuth,
  async (request, response) => {
    try {
      if (!ObjectId.isValid(request.params.reviewId))
        return response
          .status(400)
          .json({ error: "A valid reviewId is required" });
      const review = await reviewsCollection.findOne({
        _id: new ObjectId(request.params.reviewId),
        productId: Number(request.params.id),
      });
      if (!review)
        return response
          .status(404)
          .json({ ok: false, error: "Review not found" });
      if (
        request.user.role !== "admin" &&
        review.userId?.toString() !== request.user._id.toString()
      )
        return response
          .status(403)
          .json({ ok: false, error: "You can only delete your own review" });
      const result = await reviewsCollection.deleteOne({ _id: review._id });
      if (!result.deletedCount)
        return response
          .status(404)
          .json({ ok: false, error: "Review not found" });
      response.json({ deleted: true });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get("/api/cart/:sessionId", async (request, response) => {
  const cart = await cartsCollection.findOne(
    { _id: request.params.sessionId },
    { projection: { _id: 0, items: 1 } },
  );
  response.json({
    sessionId: request.params.sessionId,
    items: cart?.items || [],
  });
});

app.put("/api/cart/:sessionId", async (request, response) => {
  const items = await normalizeItems(request.body.items);
  if (!items)
    return response.status(400).json({
      error: "items must contain valid productId and quantity values",
    });
  await cartsCollection.replaceOne(
    { _id: request.params.sessionId },
    { _id: request.params.sessionId, items, updatedAt: new Date() },
    { upsert: true },
  );
  response.json({ sessionId: request.params.sessionId, items });
});

app.get("/api/wishlist/:sessionId", async (request, response) => {
  const wishlist = await wishlistsCollection.findOne(
    { _id: request.params.sessionId },
    { projection: { _id: 0, productIds: 1 } },
  );
  const productIds = wishlist?.productIds || [];
  const products = await productsCollection
    .find({ id: { $in: productIds } }, { projection: { _id: 0 } })
    .toArray();
  response.json({ productIds, products });
});

app.post("/api/wishlist/:sessionId/:productId", async (request, response) => {
  const productId = Number(request.params.productId);
  if (!(await productsCollection.findOne({ id: productId })))
    return response.status(404).json({ error: "Product not found" });
  const wishlist = await wishlistsCollection.findOne({
    _id: request.params.sessionId,
  });
  const productIds = wishlist?.productIds || [];
  const nextIds = productIds.includes(productId)
    ? productIds.filter((id) => id !== productId)
    : [...productIds, productId];
  await wishlistsCollection.replaceOne(
    { _id: request.params.sessionId },
    {
      _id: request.params.sessionId,
      productIds: nextIds,
      updatedAt: new Date(),
    },
    { upsert: true },
  );
  response.json({ productIds: nextIds });
});

app.post("/api/contact", async (request, response) => {
  try {
    const { name, email, message } = request.body;
    if (!name?.trim() || !email?.trim() || !message?.trim())
      return response
        .status(400)
        .json({ ok: false, error: "name, email, and message are required" });
    const result = await contactMessagesCollection.insertOne({
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 160),
      message: message.trim().slice(0, 2000),
      read: false,
      createdAt: new Date(),
    });
    response.status(201).json({
      ok: true,
      data: { id: result.insertedId.toString() },
      message: "Message sent",
    });
  } catch (error) {
    sendError(response, error);
  }
});

app.get(
  "/api/admin/summary",
  requireAuth,
  requireRole("admin"),
  async (_request, response) => {
    try {
      const [
        totalProducts,
        totalOrders,
        totalUsers,
        totalReviews,
        lowStockProducts,
        contactMessages,
      ] = await Promise.all([
        productsCollection.countDocuments(),
        ordersCollection.countDocuments(),
        usersCollection.countDocuments(),
        reviewsCollection.countDocuments(),
        productsCollection.countDocuments({ inventory: { $lte: 5 } }),
        contactMessagesCollection.countDocuments({ read: false }),
      ]);
      response.json({
        ok: true,
        data: {
          totalProducts,
          totalOrders,
          totalUsers,
          totalReviews,
          lowStockProducts,
          contactMessages,
        },
      });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get(
  "/api/admin/products",
  requireAuth,
  requireRole("admin"),
  async (_request, response) => {
    try {
      response.json({ ok: true, data: await getProducts() });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.post(
  "/api/admin/products",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const product = request.body;
      if (
        !product.name?.trim() ||
        !product.category?.trim() ||
        Number(product.price) < 0 ||
        !Number.isInteger(Number(product.inventory)) ||
        Number(product.inventory) < 0
      )
        return response.status(400).json({
          ok: false,
          error:
            "name, category, price, and non-negative integer inventory are required",
        });
      const id =
        Number(product.id) ||
        ((
          await productsCollection
            .find({}, { projection: { id: 1, _id: 0 } })
            .sort({ id: -1 })
            .limit(1)
            .next()
        )?.id || 0) + 1;
      const created = {
        ...product,
        id,
        price: Number(product.price),
        inventory: Number(product.inventory),
      };
      await productsCollection.insertOne(created);
      response.status(201).json({ ok: true, data: created });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.patch(
  "/api/admin/products/:id",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const updates = { ...request.body };
      if (
        updates.inventory !== undefined &&
        (!Number.isInteger(Number(updates.inventory)) ||
          Number(updates.inventory) < 0)
      )
        return response.status(400).json({
          ok: false,
          error: "inventory must be a non-negative integer",
        });
      if (updates.inventory !== undefined)
        updates.inventory = Number(updates.inventory);
      if (updates.price !== undefined) updates.price = Number(updates.price);
      const result = await productsCollection.findOneAndUpdate(
        { id: Number(request.params.id) },
        { $set: updates },
        { returnDocument: "after", projection: { _id: 0 } },
      );
      if (!result)
        return response
          .status(404)
          .json({ ok: false, error: "Product not found" });
      response.json({ ok: true, data: result });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.delete(
  "/api/admin/products/:id",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const result = await productsCollection.deleteOne({
        id: Number(request.params.id),
      });
      if (!result.deletedCount)
        return response
          .status(404)
          .json({ ok: false, error: "Product not found" });
      response.json({ ok: true, message: "Product deleted" });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get(
  "/api/admin/orders",
  requireAuth,
  requireRole("admin"),
  async (_request, response) => {
    try {
      response.json({
        ok: true,
        data: await ordersCollection
          .find({}, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray(),
      });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.patch(
  "/api/admin/orders/:id",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const result = await ordersCollection.findOneAndUpdate(
        { id: request.params.id },
        { $set: { status: String(request.body.status || "").slice(0, 40) } },
        { returnDocument: "after", projection: { _id: 0 } },
      );
      if (!result)
        return response
          .status(404)
          .json({ ok: false, error: "Order not found" });
      response.json({ ok: true, data: result });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get(
  "/api/admin/reviews",
  requireAuth,
  requireRole("admin"),
  async (_request, response) => {
    try {
      response.json({
        ok: true,
        data: await reviewsCollection
          .find({}, { projection: { authorToken: 0 } })
          .sort({ createdAt: -1 })
          .toArray(),
      });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.delete(
  "/api/admin/reviews/:reviewId",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      if (!ObjectId.isValid(request.params.reviewId))
        return response
          .status(400)
          .json({ ok: false, error: "A valid reviewId is required" });
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(request.params.reviewId),
      });
      if (!result.deletedCount)
        return response
          .status(404)
          .json({ ok: false, error: "Review not found" });
      response.json({ ok: true, message: "Review deleted" });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get(
  "/api/admin/content/:key",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const content = await contentCollection.findOne(
        { key: request.params.key },
        { projection: { _id: 0 } },
      );
      response.json({ ok: true, data: content });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.put(
  "/api/admin/content/:key",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      const content = { ...request.body, key: request.params.key };
      await contentCollection.replaceOne({ key: request.params.key }, content, {
        upsert: true,
      });
      response.json({ ok: true, data: content });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.get(
  "/api/admin/contact-messages",
  requireAuth,
  requireRole("admin"),
  async (_request, response) => {
    try {
      response.json({
        ok: true,
        data: await contactMessagesCollection
          .find({}, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .toArray(),
      });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.patch(
  "/api/admin/contact-messages/:id",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      if (!ObjectId.isValid(request.params.id))
        return response
          .status(400)
          .json({ ok: false, error: "A valid message id is required" });
      const result = await contactMessagesCollection.findOneAndUpdate(
        { _id: new ObjectId(request.params.id) },
        { $set: { read: Boolean(request.body.read) } },
        { returnDocument: "after", projection: { _id: 0 } },
      );
      if (!result)
        return response
          .status(404)
          .json({ ok: false, error: "Message not found" });
      response.json({ ok: true, data: result });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.delete(
  "/api/admin/contact-messages/:id",
  requireAuth,
  requireRole("admin"),
  async (request, response) => {
    try {
      if (!ObjectId.isValid(request.params.id))
        return response
          .status(400)
          .json({ ok: false, error: "A valid message id is required" });
      const result = await contactMessagesCollection.deleteOne({
        _id: new ObjectId(request.params.id),
      });
      if (!result.deletedCount)
        return response
          .status(404)
          .json({ ok: false, error: "Message not found" });
      response.json({ ok: true, message: "Message deleted" });
    } catch (error) {
      sendError(response, error);
    }
  },
);

app.post("/api/orders", async (request, response) => {
  try {
    const { sessionId, customer, items } = request.body;
    const normalizedItems = await normalizeItems(items);
    if (!sessionId || !customer?.email || !normalizedItems?.length)
      return response
        .status(400)
        .json({ error: "sessionId, customer.email, and items are required" });
    const products = await getProducts();
    const lineItems = normalizedItems.map(({ productId, quantity }) => {
      const product = products.find((entry) => entry.id === productId);
      return { productId, name: product.name, price: product.price, quantity };
    });
    const subtotal = lineItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const shipping = subtotal >= 50 ? 0 : shippingRates[customer.country] || 5;
    const total = subtotal + shipping;
    const order = {
      id: `LUMA-${randomUUID().slice(0, 8).toUpperCase()}`,
      sessionId,
      customer,
      items: lineItems,
      subtotal,
      shipping,
      total,
      paymentStatus: "pending",
      createdAt: new Date(),
      status: "received",
    };
    await ordersCollection.insertOne(order);
    await cartsCollection.deleteOne({ _id: sessionId });
    await Promise.all(
      normalizedItems.map(({ productId, quantity }) =>
        productsCollection.updateOne(
          { id: productId },
          { $inc: { inventory: -quantity } },
        ),
      ),
    );
    response.status(201).json({ ...order, _id: undefined });
  } catch (error) {
    sendError(response, error);
  }
});

app.use((_request, response) =>
  response.status(404).json({ error: "Route not found" }),
);

connectDatabase()
  .then(() => {
    app.listen(port, () =>
      console.log(`Luma API running at http://localhost:${port} with MongoDB`),
    );
  })
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });
