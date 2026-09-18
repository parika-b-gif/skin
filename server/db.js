import { MongoClient, ObjectId } from "mongodb";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

class JSONCollection {
  constructor(name, getDocs, saveFn) {
    this.name = name;
    this.getDocs = getDocs;
    this.saveFn = saveFn;
  }

  _match(doc, query) {
    if (!query || Object.keys(query).length === 0) return true;
    for (const [key, val] of Object.entries(query)) {
      if (key === "$or" && Array.isArray(val)) {
        if (!val.some((subQuery) => this._match(doc, subQuery))) return false;
        continue;
      }
      if (key === "$and" && Array.isArray(val)) {
        if (!val.every((subQuery) => this._match(doc, subQuery))) return false;
        continue;
      }

      // Dot-notation access (e.g. "members.userId")
      let docVal;
      if (key.includes(".")) {
        const parts = key.split(".");
        let current = doc;
        for (const p of parts) {
          if (Array.isArray(current)) {
            current = current.map((item) => item?.[p]);
          } else {
            current = current?.[p];
          }
        }
        docVal = current;
      } else {
        docVal = doc[key];
      }

      if (key === "_id" || key.endsWith("Id")) {
        const strVal = val?.toString ? val.toString() : val;
        const strDocVal = docVal?.toString ? docVal.toString() : docVal;
        if (strDocVal !== strVal) return false;
        continue;
      }

      if (val && typeof val === "object") {
        if ("$in" in val && Array.isArray(val.$in)) {
          if (Array.isArray(docVal)) {
            if (!docVal.some((item) => val.$in.includes(item))) return false;
          } else if (!val.$in.includes(docVal)) {
            return false;
          }
          continue;
        }
        if ("$regex" in val) {
          const re = new RegExp(val.$regex, val.$options || "i");
          if (!re.test(String(docVal || ""))) return false;
          continue;
        }
        if ("$lte" in val && docVal > val.$lte) return false;
        if ("$lt" in val && docVal >= val.$lt) return false;
        if ("$gte" in val && docVal < val.$gte) return false;
        if ("$gt" in val && docVal <= val.$gt) return false;
        if ("$ne" in val && docVal === val.$ne) return false;
        continue;
      }

      if (Array.isArray(docVal)) {
        if (!docVal.includes(val)) return false;
      } else if (docVal !== val) {
        return false;
      }
    }
    return true;
  }

  find(query = {}) {
    const docs = this.getDocs();
    let matches = docs.filter((d) => this._match(d, query));

    const cursor = {
      sort: (sortObj) => {
        const [field, order] = Object.entries(sortObj)[0] || [];
        if (field) {
          matches.sort((a, b) => {
            if (a[field] < b[field]) return order === 1 ? -1 : 1;
            if (a[field] > b[field]) return order === 1 ? 1 : -1;
            return 0;
          });
        }
        return cursor;
      },
      limit: (num) => {
        matches = matches.slice(0, num);
        return cursor;
      },
      toArray: async () => matches.map((m) => ({ ...m })),
    };
    return cursor;
  }

  async findOne(query = {}) {
    const docs = this.getDocs();
    const found = docs.find((d) => this._match(d, query));
    return found ? { ...found } : null;
  }

  async insertOne(doc) {
    const docs = this.getDocs();
    const toInsert = {
      ...doc,
      _id: doc._id || new ObjectId().toString(),
    };
    docs.push(toInsert);
    await this.saveFn();
    return { insertedId: toInsert._id, acknowledged: true };
  }

  async insertMany(docArray) {
    const docs = this.getDocs();
    for (const doc of docArray) {
      docs.push({
        ...doc,
        _id: doc._id || new ObjectId().toString(),
      });
    }
    await this.saveFn();
    return { acknowledged: true, insertedCount: docArray.length };
  }

  async updateOne(query, update, options = {}) {
    const docs = this.getDocs();
    const index = docs.findIndex((d) => this._match(d, query));
    if (index === -1) {
      if (options.upsert) {
        const newDoc = {
          _id: new ObjectId().toString(),
          ...query,
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
        };
        docs.push(newDoc);
        await this.saveFn();
        return { modifiedCount: 0, upsertedCount: 1, upsertedId: newDoc._id };
      }
      return { modifiedCount: 0 };
    }

    const doc = docs[index];
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    if (update.$inc) {
      for (const [key, amt] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + amt;
      }
    }
    if (update.$push) {
      for (const [key, item] of Object.entries(update.$push)) {
        if (!Array.isArray(doc[key])) doc[key] = [];
        doc[key].push(item);
      }
    }
    if (update.$pull) {
      for (const [key, cond] of Object.entries(update.$pull)) {
        if (Array.isArray(doc[key])) {
          doc[key] = doc[key].filter((entry) => !this._match(entry, cond));
        }
      }
    }
    await this.saveFn();
    return { modifiedCount: 1 };
  }

  async deleteOne(query) {
    const docs = this.getDocs();
    const index = docs.findIndex((d) => this._match(d, query));
    if (index === -1) return { deletedCount: 0 };
    docs.splice(index, 1);
    await this.saveFn();
    return { deletedCount: 1 };
  }

  async deleteMany(query) {
    const docs = this.getDocs();
    let count = 0;
    for (let i = docs.length - 1; i >= 0; i--) {
      if (this._match(docs[i], query)) {
        docs.splice(i, 1);
        count++;
      }
    }
    if (count > 0) await this.saveFn();
    return { deletedCount: count };
  }

  async countDocuments(query = {}) {
    const docs = this.getDocs();
    return docs.filter((d) => this._match(d, query)).length;
  }

  async createIndex() {
    return "ok";
  }
}

export const initialCollabSphereSeed = {
  users: [
    {
      _id: "user_alex_1",
      name: "Alex Rivera",
      email: "alex@collabsphere.dev",
      role: "member",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      bio: "Full Stack Architect & Cloud Engineer",
      createdAt: new Date().toISOString(),
    },
    {
      _id: "user_sarah_2",
      name: "Sarah Chen",
      email: "sarah@collabsphere.dev",
      role: "member",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
      bio: "Data Scientist & ML Researcher",
      createdAt: new Date().toISOString(),
    },
    {
      _id: "user_david_3",
      name: "David Kim",
      email: "david@collabsphere.dev",
      role: "member",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      bio: "Frontend Developer & UI/UX Specialist",
      createdAt: new Date().toISOString(),
    },
    {
      _id: "user_admin_0",
      name: "CollabSphere Admin",
      email: "admin@collabsphere.dev",
      role: "admin",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
      bio: "System Administrator",
      createdAt: new Date().toISOString(),
    },
  ],
  projects: [
    {
      _id: "proj_mywebapp_1",
      name: "MyWebApp",
      description:
        "Modern real-time collaborative web application with responsive dashboard, authentication, and live state synchronization.",
      tags: ["react", "node", "jwt", "collaboration", "fullstack"],
      ownerId: "user_alex_1",
      ownerName: "Alex Rivera",
      ownerEmail: "alex@collabsphere.dev",
      members: [
        {
          userId: "user_alex_1",
          name: "Alex Rivera",
          email: "alex@collabsphere.dev",
          role: "owner",
        },
        {
          userId: "user_sarah_2",
          name: "Sarah Chen",
          email: "sarah@collabsphere.dev",
          role: "collaborator",
        },
        {
          userId: "user_david_3",
          name: "David Kim",
          email: "david@collabsphere.dev",
          role: "collaborator",
        },
      ],
      isPublic: true,
      shareToken: "mywebapp-public-share-token",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "proj_dataanalysis_2",
      name: "DataAnalysisScript",
      description:
        "Automated Python data processing pipeline, feature engineering, and statistical modeling for high-throughput metrics.",
      tags: ["python", "pandas", "machine-learning", "analytics"],
      ownerId: "user_sarah_2",
      ownerName: "Sarah Chen",
      ownerEmail: "sarah@collabsphere.dev",
      members: [
        {
          userId: "user_sarah_2",
          name: "Sarah Chen",
          email: "sarah@collabsphere.dev",
          role: "owner",
        },
        {
          userId: "user_alex_1",
          name: "Alex Rivera",
          email: "alex@collabsphere.dev",
          role: "collaborator",
        },
      ],
      isPublic: true,
      shareToken: "data-script-analysis-share",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: [
    {
      _id: "note_arch_1",
      projectId: "proj_mywebapp_1",
      title: "Architecture Decisions & Core Tech Stack",
      content: `# MyWebApp Architecture Decisions

## Overview
MyWebApp is designed as a distributed, modular full-stack application prioritizing responsiveness, offline-first reliability, and seamless developer collaboration.

### Core Stack
- **Frontend**: React 19, Vite, React Router 7, Lucide Icons
- **State Management**: Context API + optimistic updates with LocalStorage sync
- **Backend API**: Express.js REST endpoints with JWT Bearer authentication
- **Database Engine**: Dual-mode MongoDB Atlas with resilient local JSON fallback
- **AI Acceleration**: Google Gemini 1.5 Flash for code explanation and documentation generation

## Security & Authentication Flow
1. Passwords hashed using bcrypt with salt rounds of 10.
2. Signed JWTs with 7-day expiration containing user ID and role.
3. Protected routes verify \`Authorization: Bearer <token>\` headers.
4. Input sanitization prevents cross-site scripting and injection vectors.

## Roadmap & Milestones
- [x] JWT Authentication & session management
- [x] Markdown notes with Gemini AI assistant
- [x] Secure file uploads and syntax previews
- [ ] WebSocket real-time cursor presence`,
      authorId: "user_alex_1",
      authorName: "Alex Rivera",
      tags: ["architecture", "tech-stack"],
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "note_api_2",
      projectId: "proj_mywebapp_1",
      title: "API Design & Route Specifications",
      content: `# API Route Specifications

All API endpoints reside beneath the \`/api\` path prefix.

### Authentication
- \`POST /api/auth/register\` - Create account, returns token and user
- \`POST /api/auth/login\` - Authenticate, returns token and user
- \`GET /api/auth/me\` - Verify session and get current profile

### Projects & Collaboration
- \`GET /api/projects\` - List user's active projects
- \`POST /api/projects\` - Create new project
- \`POST /api/projects/:id/members\` - Invite collaborator by email
- \`GET /api/projects/public/:shareToken\` - Public read-only view

### Gemini AI Endpoints
- \`POST /api/gemini/explain\` - Explain note content or code snippets
- \`POST /api/gemini/docs\` - Generate comprehensive function documentation
- \`POST /api/gemini/readme\` - Auto-generate GitHub-ready README.md`,
      authorId: "user_sarah_2",
      authorName: "Sarah Chen",
      tags: ["api", "specs"],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "note_etl_3",
      projectId: "proj_dataanalysis_2",
      title: "ETL Pipeline & Statistical Insights",
      content: `# ETL Pipeline & Model Insights

## Pipeline Stages
1. **Extraction**: Ingestion of multi-source tabular telemetry logs.
2. **Transform**: Missing value imputation, IQR outlier trimming, standard scaling.
3. **Load**: Fast Parquet serialization with column-level metadata.

## Performance Benchmark
- Ingestion time reduced by **43%** via vectorized Pandas transforms.
- R² score on baseline validation set: **0.912**.`,
      authorId: "user_sarah_2",
      authorName: "Sarah Chen",
      tags: ["python", "data-science"],
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  files: [
    {
      _id: "file_server_1",
      projectId: "proj_mywebapp_1",
      originalName: "server.js",
      filename: "server.js",
      mimeType: "application/javascript",
      size: 1420,
      extension: "js",
      fileType: "code",
      uploadedBy: "user_alex_1",
      uploadedByName: "Alex Rivera",
      content: `import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    service: "CollabSphere API"
  });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      _id: "file_pipeline_2",
      projectId: "proj_dataanalysis_2",
      originalName: "pipeline.py",
      filename: "pipeline.py",
      mimeType: "text/x-python",
      size: 1840,
      extension: "py",
      fileType: "code",
      uploadedBy: "user_sarah_2",
      uploadedByName: "Sarah Chen",
      content: `import pandas as pd
import numpy as np

def clean_dataset(dataframe: pd.DataFrame) -> pd.DataFrame:
    """Cleans raw telemetry dataset by removing nulls and standardizing columns."""
    df = dataframe.copy()
    df.columns = [c.lower().strip().replace(" ", "_") for c in df.columns]
    
    # Fill numerical nulls with median
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        df[col] = df[col].fillna(df[col].median())
        
    return df

if __name__ == "__main__":
    print("ETL Pipeline initialized successfully.")`,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
  activities: [
    {
      _id: "act_1",
      projectId: "proj_mywebapp_1",
      userId: "user_alex_1",
      userName: "Alex Rivera",
      action: "created_project",
      targetType: "project",
      targetName: "MyWebApp",
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      _id: "act_2",
      projectId: "proj_mywebapp_1",
      userId: "user_alex_1",
      userName: "Alex Rivera",
      action: "created_note",
      targetType: "note",
      targetName: "Architecture Decisions & Core Tech Stack",
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      _id: "act_3",
      projectId: "proj_mywebapp_1",
      userId: "user_alex_1",
      userName: "Alex Rivera",
      action: "uploaded_file",
      targetType: "file",
      targetName: "server.js",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      _id: "act_4",
      projectId: "proj_mywebapp_1",
      userId: "user_sarah_2",
      userName: "Sarah Chen",
      action: "created_note",
      targetType: "note",
      targetName: "API Design & Route Specifications",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      _id: "act_5",
      projectId: "proj_dataanalysis_2",
      userId: "user_sarah_2",
      userName: "Sarah Chen",
      action: "created_project",
      targetType: "project",
      targetName: "DataAnalysisScript",
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      _id: "act_6",
      projectId: "proj_dataanalysis_2",
      userId: "user_sarah_2",
      userName: "Sarah Chen",
      action: "uploaded_file",
      targetType: "file",
      targetName: "pipeline.py",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
};

export async function initDatabase({
  mongoUri,
  databaseName = "collabsphere_db",
  storePath,
  adminEmail = "admin@collabsphere.dev",
  adminPassword,
  hashPassword,
}) {
  let collections = {};
  const normalizedAdminEmail = adminEmail.toLowerCase();

  // Try MongoDB Atlas / Native connection if URI provided
  if (mongoUri) {
    try {
      const client = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS: 2500,
        connectTimeoutMS: 2500,
      });
      await client.connect();
      const database = client.db(databaseName);
      console.log(`[DB] Connected to MongoDB Atlas: ${databaseName}`);

      collections = {
        usersCollection: database.collection("users"),
        projectsCollection: database.collection("projects"),
        notesCollection: database.collection("notes"),
        filesCollection: database.collection("files"),
        activitiesCollection: database.collection("activities"),
      };

      // Ensure CollabSphere demo users and projects exist
      const existingDemo = await collections.usersCollection.findOne({ email: "alex@collabsphere.dev" });
      if (!existingDemo) {
        for (const user of initialCollabSphereSeed.users) {
          const pass =
            user.role === "admin"
              ? adminPassword || "admin123"
              : "collab123";
          const exists = await collections.usersCollection.findOne({ email: user.email });
          if (!exists) {
            await collections.usersCollection.insertOne({
              ...user,
              email: user.role === "admin" ? normalizedAdminEmail : user.email,
              passwordHash: await hashPassword(pass),
            });
          }
        }
        for (const proj of initialCollabSphereSeed.projects) {
          const exists = await collections.projectsCollection.findOne({ name: proj.name });
          if (!exists) {
            await collections.projectsCollection.insertOne(proj);
          }
        }
        for (const note of initialCollabSphereSeed.notes) {
          const exists = await collections.notesCollection.findOne({ title: note.title });
          if (!exists) {
            await collections.notesCollection.insertOne(note);
          }
        }
        for (const file of initialCollabSphereSeed.files) {
          const exists = await collections.filesCollection.findOne({ filename: file.filename });
          if (!exists) {
            await collections.filesCollection.insertOne(file);
          }
        }
        for (const act of initialCollabSphereSeed.activities) {
          await collections.activitiesCollection.insertOne(act);
        }
        console.log("[DB] Seeded initial CollabSphere demo projects & users into database");
      }

      return { collections, dbType: "mongodb" };
    } catch (err) {
      console.warn(
        `[DB] MongoDB Atlas connection unreachable (${err.message}). Using local JSON storage fallback.`,
      );
    }
  }

  // Fallback: Local JSON Store
  let store = {
    users: [],
    projects: [],
    notes: [],
    files: [],
    activities: [],
  };

  if (storePath && existsSync(storePath)) {
    try {
      const raw = await readFile(storePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.projects || parsed.users) {
        store = { ...store, ...parsed };
      }
    } catch (err) {
      console.warn(`[DB] Failed reading local store: ${err.message}`);
    }
  }

  // Seed default CollabSphere data if empty
  if (!store.projects || store.projects.length === 0) {
    store.projects = JSON.parse(
      JSON.stringify(initialCollabSphereSeed.projects),
    );
  }
  if (!store.notes || store.notes.length === 0) {
    store.notes = JSON.parse(JSON.stringify(initialCollabSphereSeed.notes));
  }
  if (!store.files || store.files.length === 0) {
    store.files = JSON.parse(JSON.stringify(initialCollabSphereSeed.files));
  }
  if (!store.activities || store.activities.length === 0) {
    store.activities = JSON.parse(
      JSON.stringify(initialCollabSphereSeed.activities),
    );
  }
  if (!store.users || store.users.length === 0) {
    store.users = [];
    for (const u of initialCollabSphereSeed.users) {
      const pass =
        u.role === "admin" ? adminPassword || "admin123" : "collab123";
      store.users.push({
        ...u,
        email: u.role === "admin" ? normalizedAdminEmail : u.email,
        passwordHash: await hashPassword(pass),
      });
    }
  }

  const saveLocalStore = async () => {
    if (!storePath) return;
    try {
      await mkdir(path.dirname(storePath), { recursive: true });
      await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      console.error(`[DB] Error persisting store to ${storePath}:`, err);
    }
  };

  collections = {
    usersCollection: new JSONCollection(
      "users",
      () => store.users,
      saveLocalStore,
    ),
    projectsCollection: new JSONCollection(
      "projects",
      () => store.projects,
      saveLocalStore,
    ),
    notesCollection: new JSONCollection(
      "notes",
      () => store.notes,
      saveLocalStore,
    ),
    filesCollection: new JSONCollection(
      "files",
      () => store.files,
      saveLocalStore,
    ),
    activitiesCollection: new JSONCollection(
      "activities",
      () => store.activities,
      saveLocalStore,
    ),
  };

  await saveLocalStore();
  console.log(`[DB] Local JSON database initialized from ${storePath}`);
  return { collections, dbType: "local_json" };
}
