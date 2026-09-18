import { describe, expect, it } from "vitest";
import { initDatabase } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
import {
  explainContent,
  generateCodeDocs,
  generateProjectReadme,
  suggestNoteImprovements,
} from "../server/gemini.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(__dirname, "../server/data/collabsphere_test.json");

describe("CollabSphere Database and Core Workspaces", () => {
  it("initializes database with CollabSphere demo users and projects", async () => {
    const { collections, dbType } = await initDatabase({
      databaseName: "collabsphere_test_db",
      storePath,
      adminEmail: "admin@collabsphere.dev",
      adminPassword: "admin123",
      hashPassword,
    });

    expect(["mongodb", "local_json"]).toContain(dbType);
    expect(collections.projectsCollection).toBeDefined();
    expect(collections.notesCollection).toBeDefined();
    expect(collections.filesCollection).toBeDefined();
    expect(collections.activitiesCollection).toBeDefined();
    expect(collections.usersCollection).toBeDefined();

    const projects = await collections.projectsCollection.find({}).toArray();
    expect(projects.length).toBeGreaterThanOrEqual(2);

    const alex = await collections.usersCollection.findOne({
      email: "alex@collabsphere.dev",
    });
    expect(alex).toBeDefined();
    expect(alex.name).toBe("Alex Rivera");
  });

  it("handles project notes creation, update and retrieval", async () => {
    const { collections } = await initDatabase({
      databaseName: "collabsphere_test_db",
      storePath,
      adminEmail: "admin@collabsphere.dev",
      adminPassword: "admin123",
      hashPassword,
    });

    const testNote = {
      projectId: "proj_test_1",
      title: "Unit Test Architecture",
      content: "# Architecture\n\nTesting markdown notes with Gemini AI integration.",
      authorId: "user_test_1",
      authorName: "Test User",
      createdAt: new Date().toISOString(),
    };

    const inserted = await collections.notesCollection.insertOne(testNote);
    expect(inserted.insertedId).toBeDefined();

    const fetched = await collections.notesCollection.findOne({ _id: inserted.insertedId });
    expect(fetched.title).toBe("Unit Test Architecture");

    await collections.notesCollection.updateOne(
      { _id: inserted.insertedId },
      { $set: { title: "Updated Architecture Spec" } },
    );

    const updated = await collections.notesCollection.findOne({ _id: inserted.insertedId });
    expect(updated.title).toBe("Updated Architecture Spec");

    await collections.notesCollection.deleteOne({ _id: inserted.insertedId });
  });

  it("handles code files registration and metadata", async () => {
    const { collections } = await initDatabase({
      databaseName: "collabsphere_test_db",
      storePath,
      adminEmail: "admin@collabsphere.dev",
      adminPassword: "admin123",
      hashPassword,
    });

    const testFile = {
      projectId: "proj_test_1",
      originalName: "testModule.js",
      filename: "testModule.js",
      mimeType: "application/javascript",
      size: 512,
      extension: "js",
      fileType: "code",
      uploadedBy: "user_test_1",
      uploadedByName: "Tester",
      content: "export function multiply(a, b) { return a * b; }",
      createdAt: new Date().toISOString(),
    };

    const inserted = await collections.filesCollection.insertOne(testFile);
    expect(inserted.insertedId).toBeDefined();

    const file = await collections.filesCollection.findOne({ _id: inserted.insertedId });
    expect(file.originalName).toBe("testModule.js");
    expect(file.fileType).toBe("code");

    await collections.filesCollection.deleteOne({ _id: inserted.insertedId });
  });
});

describe("Gemini AI API Endpoints & Analysis Engine", () => {
  it("generates structured explanation for code snippets", async () => {
    const result = await explainContent({
      text: `function processData(records) {
  return records.filter(r => r.active).map(r => r.score * 2);
}`,
      type: "code",
      language: "javascript",
    });

    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe("string");
    expect(result.explanation.length).toBeGreaterThan(50);
  });

  it("suggests improvements for markdown notes", async () => {
    const result = await suggestNoteImprovements({
      title: "API Roadmap",
      content: "# Roadmap\nWe need to build endpoints and tests.",
    });

    expect(result.suggestions).toBeDefined();
    expect(typeof result.suggestions).toBe("string");
    expect(result.suggestions).toContain("Gemini");
  });

  it("generates automated technical documentation for code", async () => {
    const result = await generateCodeDocs({
      code: `export function calculateDiscount(price, percentage) {
  if (percentage < 0 || percentage > 100) throw new Error("Invalid percentage");
  return price * (1 - percentage / 100);
}`,
      language: "javascript",
    });

    expect(result.docs).toBeDefined();
    expect(result.docs).toContain("Technical API Documentation");
  });

  it("generates comprehensive GitHub README.md for project", async () => {
    const result = await generateProjectReadme({
      projectName: "CollabSphere",
      description: "Collaborative project workspace with Gemini AI",
      files: [{ originalName: "server.js", fileType: "code" }],
    });

    expect(result.readme).toBeDefined();
    expect(result.readme).toContain("# CollabSphere");
    expect(result.readme).toContain("Getting Started");
  });
});
