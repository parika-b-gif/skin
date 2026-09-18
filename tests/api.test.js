import { describe, expect, it } from "vitest";
import { initDatabase } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, "../server/data/store.json");

describe("Database and API models", () => {
  it("initializes database with products, users and demo data", async () => {
    const { collections, dbType } = await initDatabase({
      databaseName: "luma_store_test",
      storePath,
      adminEmail: "admin@luma.skin",
      adminPassword: "admin123",
      hashPassword,
    });

    expect(["mongodb", "local_json"]).toContain(dbType);
    expect(collections.productsCollection).toBeDefined();
    expect(collections.usersCollection).toBeDefined();

    const products = await collections.productsCollection.find({}).toArray();
    expect(products.length).toBeGreaterThanOrEqual(30);

    const admin = await collections.usersCollection.findOne({
      email: "admin@luma.skin",
    });
    expect(admin).toBeDefined();
    expect(admin.role).toBe("admin");
  });

  it("handles cart and wishlist queries safely", async () => {
    const { collections } = await initDatabase({
      databaseName: "luma_store_test",
      storePath,
      adminEmail: "admin@luma.skin",
      adminPassword: "admin123",
      hashPassword,
    });

    const testSession = "test-session-cart-" + Date.now();
    await collections.cartsCollection.insertOne({
      _id: testSession,
      items: [{ productId: 1, quantity: 2 }],
      updatedAt: new Date(),
    });

    const cart = await collections.cartsCollection.findOne({ _id: testSession });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(1);

    await collections.cartsCollection.deleteOne({ _id: testSession });
  });

  it("handles review creation and deletion", async () => {
    const { collections } = await initDatabase({
      databaseName: "luma_store_test",
      storePath,
      adminEmail: "admin@luma.skin",
      adminPassword: "admin123",
      hashPassword,
    });

    const inserted = await collections.reviewsCollection.insertOne({
      productId: 1,
      userId: "guest",
      name: "Elise",
      rating: 5,
      text: "Wonderful gentle cleanser.",
      createdAt: new Date(),
    });

    expect(inserted.insertedId).toBeDefined();

    const found = await collections.reviewsCollection.findOne({
      _id: inserted.insertedId,
    });
    expect(found.name).toBe("Elise");
    expect(found.rating).toBe(5);

    await collections.reviewsCollection.deleteOne({ _id: inserted.insertedId });
  });
});
