import "dotenv/config";
import cors from "cors";
import express from "express";
import { ObjectId } from "mongodb";
import formidable from "formidable";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  createToken,
  hashPassword,
  readToken,
  verifyPassword,
} from "./auth.js";
import { initDatabase } from "./db.js";
import {
  explainContent,
  generateCodeDocs,
  generateProjectReadme,
  suggestNoteImprovements,
} from "./gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3001;
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "collabsphere_db";
const storePath = path.join(__dirname, "data", "collabsphere.json");
const uploadsDir = path.join(__dirname, "uploads");
const jwtSecret =
  process.env.JWT_SECRET || "collabsphere-jwt-secret-key-production-dev";

let currentDbType = "unknown";
let usersCollection;
let projectsCollection;
let notesCollection;
let filesCollection;
let activitiesCollection;

// Permissive CORS for dev frontend
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  }),
);

// Standard JSON body parsing
app.use(express.json({ limit: "25mb" }));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "CollabSphere API",
    dbType: currentDbType,
    port,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Middleware: Authentication with Bearer JWT
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const token = authHeader.slice(7).trim();
  const claims = readToken(token, jwtSecret);
  if (!claims?.sub) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }

  const query = ObjectId.isValid(claims.sub)
    ? { _id: new ObjectId(claims.sub) }
    : { _id: claims.sub };

  const user = await usersCollection.findOne(query);
  if (!user) {
    return res.status(401).json({ ok: false, error: "User not found" });
  }

  req.user = {
    _id: user._id.toString(),
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role || "member",
    avatar: user.avatar,
  };
  next();
}

// Middleware: Optional Authentication (for public shareable pages)
async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const claims = readToken(token, jwtSecret);
    if (claims?.sub) {
      const query = ObjectId.isValid(claims.sub)
        ? { _id: new ObjectId(claims.sub) }
        : { _id: claims.sub };
      const user = await usersCollection.findOne(query);
      if (user) {
        req.user = {
          _id: user._id.toString(),
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role || "member",
          avatar: user.avatar,
        };
      }
    }
  }
  next();
}

// Helper: Log project activity
async function logActivity(projectId, userId, userName, action, targetType, targetName) {
  try {
    await activitiesCollection.insertOne({
      projectId: projectId.toString(),
      userId: userId.toString(),
      userName: userName || "Team Member",
      action,
      targetType,
      targetName: targetName || "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[Activity] Failed logging activity: ${err.message}`);
  }
}

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, bio } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ ok: false, error: "Name, email, and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await usersCollection.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ ok: false, error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "member",
      bio: (bio || "").trim().slice(0, 300),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      createdAt: new Date().toISOString(),
    };

    const result = await usersCollection.insertOne(newUser);
    const userId = result.insertedId.toString();
    const token = createToken({ _id: userId, email: normalizedEmail, role: newUser.role }, jwtSecret);

    res.status(201).json({
      ok: true,
      data: {
        token,
        user: {
          id: userId,
          _id: userId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          bio: newUser.bio,
          avatar: newUser.avatar,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const userId = user._id.toString();
    const token = createToken({ _id: userId, email: user.email, role: user.role || "member" }, jwtSecret);

    res.json({
      ok: true,
      data: {
        token,
        user: {
          id: userId,
          _id: userId,
          name: user.name,
          email: user.email,
          role: user.role || "member",
          bio: user.bio || "",
          avatar: user.avatar,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Current user profile
app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ ok: true, data: { user: req.user } });
});

// Search registered users to add as project members
app.get("/api/users/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    if (!q || q.length < 2) {
      return res.json({ ok: true, users: [] });
    }

    const allUsers = await usersCollection.find({}).toArray();
    const matches = allUsers
      .filter((u) => u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q))
      .slice(0, 10)
      .map((u) => ({
        id: u._id.toString(),
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatar: u.avatar,
      }));

    res.json({ ok: true, users: matches });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 2. PROJECT COLLABORATION
// ==========================================

// Helper: Check project membership
function isMemberOrOwner(project, userId) {
  if (!project || !userId) return false;
  if (project.ownerId?.toString() === userId.toString()) return true;
  return Array.isArray(project.members) && project.members.some(
    (m) => (m.userId?.toString() || m.id?.toString()) === userId.toString(),
  );
}

// List user's projects (owned or collaborating)
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const allProjects = await projectsCollection.find({}).toArray();
    const userProjects = allProjects.filter((p) => isMemberOrOwner(p, req.user.id));

    // Enrich with note and file counts
    const enriched = await Promise.all(
      userProjects.map(async (project) => {
        const pId = project._id.toString();
        const [notesCount, filesCount] = await Promise.all([
          notesCollection.countDocuments({ projectId: pId }),
          filesCollection.countDocuments({ projectId: pId }),
        ]);
        return {
          ...project,
          notesCount,
          filesCount,
          membersCount: project.members?.length || 1,
        };
      }),
    );

    res.json({ ok: true, projects: enriched });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create project
app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const { name, description, tags, isPublic } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "Project name is required" });
    }

    const shareToken = `collab_${randomUUID().slice(0, 12)}`;
    const newProject = {
      name: name.trim(),
      description: (description || "").trim(),
      tags: Array.isArray(tags) ? tags : (tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      ownerId: req.user.id,
      ownerName: req.user.name,
      ownerEmail: req.user.email,
      members: [
        {
          userId: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: "owner",
        },
      ],
      isPublic: Boolean(isPublic),
      shareToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await projectsCollection.insertOne(newProject);
    const projectId = result.insertedId.toString();

    await logActivity(projectId, req.user.id, req.user.name, "created_project", "project", newProject.name);

    res.status(201).json({
      ok: true,
      data: {
        ...newProject,
        _id: projectId,
        id: projectId,
        notesCount: 0,
        filesCount: 0,
        membersCount: 1,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get single project
app.get("/api/projects/:id", optionalAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    const hasAccess = project.isPublic || (req.user && isMemberOrOwner(project, req.user.id));
    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: "Access denied. Private project." });
    }

    const [notesCount, filesCount] = await Promise.all([
      notesCollection.countDocuments({ projectId: project._id.toString() }),
      filesCollection.countDocuments({ projectId: project._id.toString() }),
    ]);

    res.json({
      ok: true,
      project: {
        ...project,
        id: project._id.toString(),
        notesCount,
        filesCount,
        membersCount: project.members?.length || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update project
app.put("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    if (!isMemberOrOwner(project, req.user.id)) {
      return res.status(403).json({ ok: false, error: "Only project members can edit details" });
    }

    const { name, description, tags, isPublic } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);

    await projectsCollection.updateOne(query, { $set: updates });
    const updated = await projectsCollection.findOne(query);

    res.json({ ok: true, project: { ...updated, id: updated._id.toString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete project
app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    if (project.ownerId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ ok: false, error: "Only the project creator can delete it" });
    }

    await Promise.all([
      projectsCollection.deleteOne(query),
      notesCollection.deleteMany({ projectId: pId }),
      filesCollection.deleteMany({ projectId: pId }),
      activitiesCollection.deleteMany({ projectId: pId }),
    ]);

    res.json({ ok: true, message: "Project and all assets deleted" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Add member to project
app.post("/api/projects/:id/members", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    if (!isMemberOrOwner(project, req.user.id)) {
      return res.status(403).json({ ok: false, error: "Permission denied" });
    }

    const { email, role = "collaborator" } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ ok: false, error: "User email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetUser = await usersCollection.findOne({ email: normalizedEmail });
    if (!targetUser) {
      return res.status(404).json({
        ok: false,
        error: `No registered user found with email "${normalizedEmail}". Ask them to register first.`,
      });
    }

    const targetUserId = targetUser._id.toString();
    const alreadyMember = project.members?.some(
      (m) => m.userId?.toString() === targetUserId || m.email?.toLowerCase() === normalizedEmail,
    );

    if (alreadyMember) {
      return res.status(400).json({ ok: false, error: "User is already a member of this project" });
    }

    const newMember = {
      userId: targetUserId,
      name: targetUser.name,
      email: targetUser.email,
      role,
      avatar: targetUser.avatar,
    };

    const updatedMembers = [...(project.members || []), newMember];
    await projectsCollection.updateOne(query, {
      $set: { members: updatedMembers, updatedAt: new Date().toISOString() },
    });

    await logActivity(pId, req.user.id, req.user.name, "added_member", "member", targetUser.name);

    res.status(201).json({ ok: true, member: newMember, members: updatedMembers });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Remove member from project
app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const targetUserId = req.params.userId;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) {
      return res.status(404).json({ ok: false, error: "Project not found" });
    }

    if (project.ownerId?.toString() !== req.user.id && req.user.id !== targetUserId) {
      return res.status(403).json({ ok: false, error: "Only project owner can remove members" });
    }

    if (project.ownerId?.toString() === targetUserId) {
      return res.status(400).json({ ok: false, error: "Project owner cannot be removed" });
    }

    const updatedMembers = (project.members || []).filter(
      (m) => m.userId?.toString() !== targetUserId,
    );
    await projectsCollection.updateOne(query, {
      $set: { members: updatedMembers, updatedAt: new Date().toISOString() },
    });

    res.json({ ok: true, members: updatedMembers });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Public shareable project page (Read-Only)
app.get("/api/projects/public/:shareToken", async (req, res) => {
  try {
    const shareToken = req.params.shareToken;
    const project = await projectsCollection.findOne({ shareToken });

    if (!project) {
      return res.status(404).json({ ok: false, error: "Shared project not found or invalid link" });
    }

    if (!project.isPublic) {
      return res.status(403).json({ ok: false, error: "This project has been set to private by its owner" });
    }

    const pId = project._id.toString();
    const [notes, files, analytics] = await Promise.all([
      notesCollection.find({ projectId: pId }).sort({ updatedAt: -1 }).toArray(),
      filesCollection.find({ projectId: pId }).sort({ createdAt: -1 }).toArray(),
      activitiesCollection.find({ projectId: pId }).sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    res.json({
      ok: true,
      project: {
        ...project,
        id: pId,
        notes,
        files: files.map((f) => ({
          id: f._id.toString(),
          _id: f._id.toString(),
          originalName: f.originalName,
          fileType: f.fileType,
          size: f.size,
          extension: f.extension,
          uploadedByName: f.uploadedByName,
          content: f.content,
          createdAt: f.createdAt,
        })),
        recentActivity: analytics,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 3. MARKDOWN NOTES WITH GEMINI AI
// ==========================================

// List project notes
app.get("/api/projects/:id/notes", optionalAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    if (!project.isPublic && (!req.user || !isMemberOrOwner(project, req.user.id))) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    const notes = await notesCollection.find({ projectId: pId }).sort({ updatedAt: -1 }).toArray();
    res.json({
      ok: true,
      notes: notes.map((n) => ({ ...n, id: n._id.toString() })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create note
app.post("/api/projects/:id/notes", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    if (!isMemberOrOwner(project, req.user.id)) {
      return res.status(403).json({ ok: false, error: "Only project members can create notes" });
    }

    const { title, content, tags } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ ok: false, error: "Note title is required" });
    }

    const newNote = {
      projectId: pId,
      title: title.trim(),
      content: content || "",
      tags: Array.isArray(tags) ? tags : (tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      authorId: req.user.id,
      authorName: req.user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await notesCollection.insertOne(newNote);
    const noteId = result.insertedId.toString();

    await logActivity(pId, req.user.id, req.user.name, "created_note", "note", newNote.title);

    res.status(201).json({
      ok: true,
      note: { ...newNote, _id: noteId, id: noteId },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update note
app.put("/api/projects/:id/notes/:noteId", requireAuth, async (req, res) => {
  try {
    const { id: pId, noteId } = req.params;
    const noteQuery = ObjectId.isValid(noteId) ? { _id: new ObjectId(noteId) } : { _id: noteId };
    const note = await notesCollection.findOne(noteQuery);

    if (!note || note.projectId !== pId) {
      return res.status(404).json({ ok: false, error: "Note not found in this project" });
    }

    const { title, content, tags } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (title) updates.title = title.trim();
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim()).filter(Boolean);

    await notesCollection.updateOne(noteQuery, { $set: updates });
    const updated = await notesCollection.findOne(noteQuery);

    await logActivity(pId, req.user.id, req.user.name, "updated_note", "note", updated.title);

    res.json({ ok: true, note: { ...updated, id: updated._id.toString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete note
app.delete("/api/projects/:id/notes/:noteId", requireAuth, async (req, res) => {
  try {
    const { id: pId, noteId } = req.params;
    const noteQuery = ObjectId.isValid(noteId) ? { _id: new ObjectId(noteId) } : { _id: noteId };
    const note = await notesCollection.findOne(noteQuery);

    if (!note || note.projectId !== pId) {
      return res.status(404).json({ ok: false, error: "Note not found" });
    }

    await notesCollection.deleteOne(noteQuery);
    await logActivity(pId, req.user.id, req.user.name, "deleted_note", "note", note.title);

    res.json({ ok: true, message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 4. FILE UPLOAD & PREVIEW
// ==========================================

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "html", "css", "json", "md", "sql", "sh", "yaml", "yml", "xml", "csv", "env", "txt"
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "svg", "gif", "webp"]);

function categorizeFile(filename, mimeType = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (CODE_EXTENSIONS.has(ext) || mimeType.startsWith("text/") || mimeType.includes("javascript") || mimeType.includes("json")) {
    return { fileType: "code", extension: ext };
  }
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) {
    return { fileType: "image", extension: ext };
  }
  return { fileType: "document", extension: ext };
}

// Upload file to project (supports multipart/form-data and direct JSON text upload)
app.post("/api/projects/:id/files", requireAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    if (!isMemberOrOwner(project, req.user.id)) {
      return res.status(403).json({ ok: false, error: "Only project members can upload files" });
    }

    const contentType = req.headers["content-type"] || "";

    // 1. Direct JSON code/text upload
    if (contentType.includes("application/json")) {
      const { filename, content, mimeType } = req.body;
      if (!filename?.trim() || content === undefined) {
        return res.status(400).json({ ok: false, error: "filename and content are required" });
      }

      const { fileType, extension } = categorizeFile(filename, mimeType);
      const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join(uploadsDir, safeFilename);

      await writeFile(filePath, content, "utf-8");

      const fileRecord = {
        projectId: pId,
        originalName: filename.trim(),
        filename: safeFilename,
        mimeType: mimeType || "text/plain",
        size: Buffer.byteLength(content, "utf-8"),
        extension,
        fileType,
        uploadedBy: req.user.id,
        uploadedByName: req.user.name,
        content: content.length < 100000 ? content : undefined,
        createdAt: new Date().toISOString(),
      };

      const result = await filesCollection.insertOne(fileRecord);
      const fileId = result.insertedId.toString();

      await logActivity(pId, req.user.id, req.user.name, "uploaded_file", "file", fileRecord.originalName);

      return res.status(201).json({
        ok: true,
        file: { ...fileRecord, _id: fileId, id: fileId },
      });
    }

    // 2. Multipart file upload using formidable
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
    });

    form.parse(req, async (err, _fields, formFiles) => {
      if (err) {
        return res.status(400).json({ ok: false, error: `Upload error: ${err.message}` });
      }

      const uploaded = formFiles.file;
      const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      if (!fileObj) {
        return res.status(400).json({ ok: false, error: "No file provided in form" });
      }

      const originalName = fileObj.originalFilename || path.basename(fileObj.filepath);
      const safeFilename = path.basename(fileObj.filepath);
      const { fileType, extension } = categorizeFile(originalName, fileObj.mimetype);

      let textContent;
      if (fileType === "code") {
        try {
          textContent = await readFile(fileObj.filepath, "utf-8");
          if (textContent.length > 100000) textContent = textContent.slice(0, 100000);
        } catch {}
      }

      const fileRecord = {
        projectId: pId,
        originalName,
        filename: safeFilename,
        mimeType: fileObj.mimetype || "application/octet-stream",
        size: fileObj.size,
        extension,
        fileType,
        uploadedBy: req.user.id,
        uploadedByName: req.user.name,
        content: textContent,
        createdAt: new Date().toISOString(),
      };

      const result = await filesCollection.insertOne(fileRecord);
      const fileId = result.insertedId.toString();

      await logActivity(pId, req.user.id, req.user.name, "uploaded_file", "file", originalName);

      res.status(201).json({
        ok: true,
        file: { ...fileRecord, _id: fileId, id: fileId },
      });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List project files
app.get("/api/projects/:id/files", optionalAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });
    if (!project.isPublic && (!req.user || !isMemberOrOwner(project, req.user.id))) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }

    const files = await filesCollection.find({ projectId: pId }).sort({ createdAt: -1 }).toArray();
    res.json({
      ok: true,
      files: files.map((f) => ({ ...f, id: f._id.toString() })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get raw file content for preview
app.get("/api/files/:fileId/raw", optionalAuth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const query = ObjectId.isValid(fileId) ? { _id: new ObjectId(fileId) } : { _id: fileId };
    const file = await filesCollection.findOne(query);

    if (!file) return res.status(404).json({ ok: false, error: "File not found" });

    // If cached in record
    if (file.content !== undefined) {
      res.setHeader("Content-Type", file.mimeType || "text/plain");
      return res.send(file.content);
    }

    const diskPath = path.join(uploadsDir, file.filename);
    if (existsSync(diskPath)) {
      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      return res.sendFile(diskPath);
    }

    res.status(404).json({ ok: false, error: "Physical file not found on disk" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Download file
app.get("/api/files/:fileId/download", optionalAuth, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const query = ObjectId.isValid(fileId) ? { _id: new ObjectId(fileId) } : { _id: fileId };
    const file = await filesCollection.findOne(query);

    if (!file) return res.status(404).json({ ok: false, error: "File not found" });

    const diskPath = path.join(uploadsDir, file.filename);
    if (existsSync(diskPath)) {
      return res.download(diskPath, file.originalName);
    }

    if (file.content) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader("Content-Type", file.mimeType || "text/plain");
      return res.send(file.content);
    }

    res.status(404).json({ ok: false, error: "File data not found" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete file
app.delete("/api/projects/:id/files/:fileId", requireAuth, async (req, res) => {
  try {
    const { id: pId, fileId } = req.params;
    const fileQuery = ObjectId.isValid(fileId) ? { _id: new ObjectId(fileId) } : { _id: fileId };
    const file = await filesCollection.findOne(fileQuery);

    if (!file || file.projectId !== pId) {
      return res.status(404).json({ ok: false, error: "File not found" });
    }

    const diskPath = path.join(uploadsDir, file.filename);
    if (existsSync(diskPath)) {
      await unlink(diskPath).catch(() => {});
    }

    await filesCollection.deleteOne(fileQuery);
    await logActivity(pId, req.user.id, req.user.name, "deleted_file", "file", file.originalName);

    res.json({ ok: true, message: "File deleted" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 5. CONTRIBUTION ANALYTICS
// ==========================================

app.get("/api/projects/:id/analytics", optionalAuth, async (req, res) => {
  try {
    const pId = req.params.id;
    const query = ObjectId.isValid(pId) ? { _id: new ObjectId(pId) } : { _id: pId };
    const project = await projectsCollection.findOne(query);

    if (!project) return res.status(404).json({ ok: false, error: "Project not found" });

    const [notes, files, activities] = await Promise.all([
      notesCollection.find({ projectId: pId }).toArray(),
      filesCollection.find({ projectId: pId }).toArray(),
      activitiesCollection.find({ projectId: pId }).sort({ createdAt: -1 }).limit(25).toArray(),
    ]);

    // Aggregate contributions per member
    const memberStats = {};
    for (const member of project.members || []) {
      const mId = member.userId?.toString() || member.id?.toString();
      memberStats[mId] = {
        userId: mId,
        name: member.name,
        email: member.email,
        role: member.role,
        notesCount: 0,
        filesCount: 0,
        totalActions: 0,
      };
    }

    for (const note of notes) {
      const aId = note.authorId?.toString();
      if (memberStats[aId]) {
        memberStats[aId].notesCount++;
        memberStats[aId].totalActions++;
      }
    }

    for (const file of files) {
      const uId = file.uploadedBy?.toString();
      if (memberStats[uId]) {
        memberStats[uId].filesCount++;
        memberStats[uId].totalActions++;
      }
    }

    const contributions = Object.values(memberStats);
    const totalActivityCount = contributions.reduce((acc, c) => acc + c.totalActions, 0);

    res.json({
      ok: true,
      analytics: {
        totalNotes: notes.length,
        totalFiles: files.length,
        totalMembers: project.members?.length || 1,
        totalActions: totalActivityCount,
        memberContributions: contributions,
        recentActivity: activities.map((a) => ({ ...a, id: a._id.toString() })),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 6. GEMINI AI API ENDPOINTS
// ==========================================

// /api/gemini/explain: Accepts text (code or notes) and returns an explanation
app.post("/api/gemini/explain", async (req, res) => {
  try {
    const { text, type = "code", language = "auto" } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ ok: false, error: "text parameter is required" });
    }

    const result = await explainContent({ text, type, language });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// /api/gemini/docs: Accepts code text and returns auto-generated documentation
app.post("/api/gemini/docs", async (req, res) => {
  try {
    const { code, language = "javascript", context = "" } = req.body;
    if (!code?.trim()) {
      return res.status(400).json({ ok: false, error: "code parameter is required" });
    }

    const result = await generateCodeDocs({ code, language, context });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// /api/gemini/readme: Accepts project description/code overview and helps generate a README file
app.post("/api/gemini/readme", async (req, res) => {
  try {
    const { projectName, description, codeOverview, files } = req.body;
    if (!projectName?.trim()) {
      return res.status(400).json({ ok: false, error: "projectName is required" });
    }

    const result = await generateProjectReadme({
      projectName: projectName.trim(),
      description: description?.trim(),
      codeOverview: codeOverview?.trim(),
      files: Array.isArray(files) ? files : [],
    });

    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// /api/gemini/improve-note: Suggest improvements for note
app.post("/api/gemini/improve-note", async (req, res) => {
  try {
    const { title = "Untitled Note", content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ ok: false, error: "content is required" });
    }

    const result = await suggestNoteImprovements({ title, content });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 404 Route Catch-All
app.use((_req, res) => res.status(404).json({ ok: false, error: "API route not found" }));

// Server bootstrap
async function startServer() {
  try {
    const dbInit = await initDatabase({
      mongoUri,
      databaseName,
      storePath,
      adminEmail: process.env.ADMIN_EMAIL || "admin@collabsphere.dev",
      adminPassword: process.env.ADMIN_PASSWORD || "admin123",
      hashPassword,
    });

    currentDbType = dbInit.dbType;
    usersCollection = dbInit.collections.usersCollection;
    projectsCollection = dbInit.collections.projectsCollection;
    notesCollection = dbInit.collections.notesCollection;
    filesCollection = dbInit.collections.filesCollection;
    activitiesCollection = dbInit.collections.activitiesCollection;

    app.listen(port, () => {
      console.log(`CollabSphere API running on http://localhost:${port} [DB: ${currentDbType}]`);
    });
  } catch (err) {
    console.error("[Startup] Fatal server error:", err);
    process.exit(1);
  }
}

startServer();
