import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  File,
  FileCode,
  FileImage,
  FileText,
  FolderGit2,
  Moon,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname
    ? `http://${window.location.hostname}:3001/api`
    : "http://localhost:3001/api");

const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

// Simple safe markdown parser & renderer
function renderMarkdown(content = "") {
  if (!content) return null;
  const lines = content.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = "";

  lines.forEach((line, idx) => {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className={`code-pre ${codeBlockLang ? `lang-${codeBlockLang}` : ""}`}>
            <code>{codeBlockContent.join("\n")}</code>
          </pre>,
        );
        codeBlockContent = [];
        inCodeBlock = false;
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={idx}>{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={idx}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={idx}>{line.slice(4)}</h3>);
    } else if (line.startsWith("- [ ] ")) {
      elements.push(
        <div key={idx} className="task-item">
          <input type="checkbox" readOnly checked={false} />
          <span>{line.slice(6)}</span>
        </div>,
      );
    } else if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      elements.push(
        <div key={idx} className="task-item checked">
          <input type="checkbox" readOnly checked={true} />
          <span>{line.slice(6)}</span>
        </div>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={idx} style={{ marginLeft: "20px" }}>
          {formatInline(line.slice(2))}
        </li>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={idx} style={{ marginLeft: "20px", listStyleType: "decimal" }}>
          {formatInline(text)}
        </li>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={idx}>{formatInline(line.slice(2))}</blockquote>,
      );
    } else if (line.trim() === "---") {
      elements.push(
        <hr key={idx} style={{ margin: "16px 0", borderColor: "var(--border)" }} />,
      );
    } else if (line.trim()) {
      elements.push(<p key={idx}>{formatInline(line)}</p>);
    }
  });

  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key="code-end" className="code-pre">
        <code>{codeBlockContent.join("\n")}</code>
      </pre>,
    );
  }

  return <div className="markdown-body">{elements}</div>;
}

function formatInline(str) {
  // Bold **text**
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Top Navbar
function Navbar({ darkMode, setDarkMode, backendStatus }) {
  const { user, logout, quickLogin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="collab-header">
      <div className="header-container">
        <div className="brand-section">
          <Link to="/" className="brand-link">
            <div className="brand-icon">
              <BrainCircuit size={20} />
            </div>
            <span>CollabSphere</span>
            <span className="brand-badge">Platform</span>
          </Link>
        </div>

        <div className="header-controls">
          <div className="status-pill" title={`Backend status: ${backendStatus}`}>
            <span
              className={`status-dot ${
                backendStatus === "online" ? "online" : "fallback"
              }`}
            />
            <span>{backendStatus === "online" ? "API Online" : "Connecting..."}</span>
          </div>

          <button
            className="icon-btn"
            onClick={() => setDarkMode((prev) => !prev)}
            title="Toggle theme"
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                className="user-profile-badge"
                onClick={() => navigate("/dashboard")}
                title={`Signed in as ${user.name} (${user.email})`}
              >
                <img
                  src={
                    user.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`
                  }
                  alt={user.name}
                  className="user-avatar"
                />
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  {user.name}
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Sign out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => quickLogin("alex")}
              >
                Demo: Alex
              </button>
              <Link to="/login" className="btn btn-primary btn-sm">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Auth Page (Login & Registration with 1-Click Demo Accounts)
function AuthPage() {
  const { login, register, quickLogin, user } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password, bio);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "460px",
        margin: "60px auto",
        padding: "32px",
        background: "var(--bg-surface)",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        boxShadow: "var(--modal-shadow)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "var(--ai-gradient)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            marginBottom: "12px",
          }}
        >
          <BrainCircuit size={26} />
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          {isRegister ? "Join CollabSphere" : "Welcome Back"}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          {isRegister
            ? "Create an account to collaborate on projects & AI notes"
            : "Sign in to access your projects, notes, and Gemini AI tools"}
        </p>
      </div>

      {/* 1-Click Quick Demo Accounts */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          Instant 1-Click Demo Accounts:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <button
            type="button"
            className="demo-pill active"
            onClick={() => quickLogin("alex").then(() => navigate("/dashboard"))}
          >
            👤 Alex (Lead Dev)
          </button>
          <button
            type="button"
            className="demo-pill"
            onClick={() => quickLogin("sarah").then(() => navigate("/dashboard"))}
          >
            🔬 Sarah (Data Scientist)
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "18px 0",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          OR USE EMAIL
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--danger)",
            borderRadius: "8px",
            color: "var(--danger)",
            fontSize: "0.85rem",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {isRegister && (
          <>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-app)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Headline / Role (Optional)
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Full Stack Developer"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-app)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@collabsphere.dev"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-app)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-app)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: "6px" }}
        >
          {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "0.85rem" }}>
          <span style={{ color: "var(--text-secondary)" }}>
            {isRegister ? "Already have an account? " : "Don't have an account? "}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isRegister ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Dashboard View
function DashboardPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newProjectPublic, setNewProjectPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!ignore && data.ok && Array.isArray(data.projects)) {
          setProjects(data.projects);
        }
      } catch (err) {
        console.warn("Failed fetching projects:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [token]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          tags: newProjectTags,
          isPublic: newProjectPublic,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setProjects((prev) => [data.data, ...prev]);
        setShowNewModal(false);
        setNewProjectName("");
        setNewProjectDesc("");
        setNewProjectTags("");
        navigate(`/project/${data.data._id || data.data.id}`);
      }
    } catch (err) {
      alert(`Failed to create project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery]);

  const totalNotes = projects.reduce((acc, p) => acc + (p.notesCount || 0), 0);
  const totalFiles = projects.reduce((acc, p) => acc + (p.filesCount || 0), 0);

  return (
    <div className="dashboard-container">
      {/* Hero Section */}
      <div className="dashboard-hero">
        <div>
          <h1 className="hero-title">Welcome back, {user?.name || "Developer"} 👋</h1>
          <p className="hero-subtitle">
            Manage projects, write AI-augmented Markdown notes, and share code assets with your team.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> New Project
        </button>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FolderGit2 size={24} />
          </div>
          <div>
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Collaborative Projects</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }}>
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{totalNotes}</div>
            <div className="stat-label">Markdown Notes with AI</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
            <Code2 size={24} />
          </div>
          <div>
            <div className="stat-value">{totalFiles}</div>
            <div className="stat-label">Code & Design Assets</div>
          </div>
        </div>
      </div>

      {/* Projects List Header */}
      <div className="projects-header">
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Your Active Workspaces</h2>
        <div className="search-box">
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search projects by name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading your projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--bg-surface)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
          }}
        >
          <FolderGit2 size={40} color="var(--text-muted)" style={{ marginBottom: "12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "6px" }}>
            No projects found
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "16px" }}>
            Get started by creating your first collaborative project.
          </p>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={16} /> Create Project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((project) => {
            const isOwner = project.ownerId === user?.id;
            return (
              <div key={project._id || project.id} className="project-card">
                <div>
                  <div className="project-card-header">
                    <Link
                      to={`/project/${project._id || project.id}`}
                      className="project-title"
                    >
                      {project.name}
                    </Link>
                    <span className={`badge-role ${isOwner ? "owner" : "collaborator"}`}>
                      {isOwner ? "Owner" : "Member"}
                    </span>
                  </div>

                  <p className="project-desc">{project.description || "No description provided."}</p>

                  <div className="project-tags">
                    {(project.tags || []).map((t, idx) => (
                      <span key={idx} className="tag-pill">
                        #{t}
                      </span>
                    ))}
                    {project.isPublic && (
                      <span className="tag-pill" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.2)" }}>
                        🌐 Public
                      </span>
                    )}
                  </div>
                </div>

                <div className="project-card-footer">
                  <div className="project-metrics">
                    <span className="metric-item" title="Team members">
                      <Users size={14} /> {project.membersCount || project.members?.length || 1}
                    </span>
                    <span className="metric-item" title="Notes">
                      <FileText size={14} /> {project.notesCount || 0}
                    </span>
                    <span className="metric-item" title="Files">
                      <Code2 size={14} /> {project.filesCount || 0}
                    </span>
                  </div>

                  <Link
                    to={`/project/${project._id || project.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    Open <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700 }}>Create New Project</h3>
              <button className="icon-btn" onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MyWebApp or DataAnalysisScript"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-app)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What does this project do?"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-app)",
                      color: "var(--text-primary)",
                      resize: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="react, node, python, machine-learning"
                    value={newProjectTags}
                    onChange={(e) => setNewProjectTags(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-app)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={newProjectPublic}
                    onChange={(e) => setNewProjectPublic(e.target.checked)}
                  />
                  <label htmlFor="isPublic" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                    Make this project publicly viewable with a shareable link
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Project Workspace View
function ProjectWorkspacePage() {
  const { id: projectId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState("notes"); // 'overview', 'notes', 'files', 'ai', 'settings'
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editorMode, setEditorMode] = useState("split"); // 'write', 'preview', 'split'
  const [noteSaving, setNoteSaving] = useState(false);

  // Files state
  const [files, setFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newCodeModal, setNewCodeModal] = useState(false);
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodeContent, setNewCodeContent] = useState("");

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // Team state
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("collaborator");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Gemini AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiModalContent, setAiModalContent] = useState("");
  const [aiModalLoading, setAiModalLoading] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadWorkspace() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [projRes, notesRes, filesRes, analyticsRes] = await Promise.all([
          fetch(`${API_URL}/projects/${projectId}`, { headers }).then((r) => r.json()),
          fetch(`${API_URL}/projects/${projectId}/notes`, { headers }).then((r) => r.json()),
          fetch(`${API_URL}/projects/${projectId}/files`, { headers }).then((r) => r.json()),
          fetch(`${API_URL}/projects/${projectId}/analytics`, { headers }).then((r) => r.json()),
        ]);

        if (ignore) return;
        if (projRes.ok && projRes.project) {
          setProject(projRes.project);
        }
        if (notesRes.ok && Array.isArray(notesRes.notes)) {
          setNotes(notesRes.notes);
          if (notesRes.notes.length > 0) {
            setActiveNote((prev) => prev || notesRes.notes[0]);
            setNoteTitle((prev) => prev || notesRes.notes[0].title);
            setNoteContent((prev) => prev || notesRes.notes[0].content);
          }
        }
        if (filesRes.ok && Array.isArray(filesRes.files)) {
          setFiles(filesRes.files);
        }
        if (analyticsRes.ok && analyticsRes.analytics) {
          setAnalytics(analyticsRes.analytics);
        }
      } catch (err) {
        console.warn("Failed loading workspace:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadWorkspace();
    return () => {
      ignore = true;
    };
  }, [projectId, token]);

  // Select note
  const selectNote = (note) => {
    setActiveNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  // Create new note
  const handleCreateNote = async () => {
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: "Untitled Note",
          content: "# New Note\n\nWrite your thoughts or specifications here in Markdown...",
        }),
      });
      const data = await res.json();
      if (data.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        selectNote(data.note);
      }
    } catch (err) {
      alert(`Error creating note: ${err.message}`);
    }
  };

  // Save active note
  const handleSaveNote = async () => {
    if (!activeNote) return;
    setNoteSaving(true);
    try {
      const noteId = activeNote._id || activeNote.id;
      const res = await fetch(`${API_URL}/projects/${projectId}/notes/${noteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent,
        }),
      });
      const data = await res.json();
      if (data.ok && data.note) {
        setNotes((prev) =>
          prev.map((n) => ((n._id || n.id) === noteId ? data.note : n)),
        );
        setActiveNote(data.note);
      }
    } catch (err) {
      alert(`Failed to save note: ${err.message}`);
    } finally {
      setNoteSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await fetch(`${API_URL}/projects/${projectId}/notes/${noteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const remaining = notes.filter((n) => (n._id || n.id) !== noteId);
      setNotes(remaining);
      if (remaining.length > 0) {
        selectNote(remaining[0]);
      } else {
        setActiveNote(null);
        setNoteTitle("");
        setNoteContent("");
      }
    } catch (err) {
      alert(`Failed to delete note: ${err.message}`);
    }
  };

  // Explain note using Gemini AI
  const handleExplainNote = async () => {
    if (!noteContent) return;
    setAiModalOpen(true);
    setAiModalTitle("🤖 Gemini AI: Note Explanation");
    setAiModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/gemini/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `# ${noteTitle}\n\n${noteContent}`,
          type: "note",
          language: "markdown",
        }),
      });
      const data = await res.json();
      setAiModalContent(data.data?.explanation || "No explanation generated.");
    } catch (err) {
      setAiModalContent(`Error calling Gemini AI: ${err.message}`);
    } finally {
      setAiModalLoading(false);
    }
  };

  // Suggest improvements for note using Gemini AI
  const handleImproveNote = async () => {
    if (!noteContent) return;
    setAiModalOpen(true);
    setAiModalTitle("💡 Gemini AI: Note Improvement Suggestions");
    setAiModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/gemini/improve-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent,
        }),
      });
      const data = await res.json();
      setAiModalContent(data.data?.suggestions || "No suggestions generated.");
    } catch (err) {
      setAiModalContent(`Error calling Gemini AI: ${err.message}`);
    } finally {
      setAiModalLoading(false);
    }
  };

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/projects/${projectId}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.file) {
        setFiles((prev) => [data.file, ...prev]);
        setPreviewFile(data.file);
      }
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Direct Code Creation
  const handleCreateCodeFile = async (e) => {
    e.preventDefault();
    if (!newCodeName.trim() || !newCodeContent.trim()) return;
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: newCodeName.trim(),
          content: newCodeContent,
          mimeType: "text/plain",
        }),
      });
      const data = await res.json();
      if (data.ok && data.file) {
        setFiles((prev) => [data.file, ...prev]);
        setPreviewFile(data.file);
        setNewCodeModal(false);
        setNewCodeName("");
        setNewCodeContent("");
      }
    } catch (err) {
      alert(`Failed creating code file: ${err.message}`);
    }
  };

  // Explain Code using Gemini AI
  const handleExplainCode = async (file) => {
    setAiModalOpen(true);
    setAiModalTitle(`⚡ Gemini AI: Code Breakdown for ${file.originalName}`);
    setAiModalLoading(true);
    try {
      const codeText = file.content || `// Code file: ${file.originalName}`;
      const res = await fetch(`${API_URL}/gemini/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: codeText,
          type: "code",
          language: file.extension || "javascript",
        }),
      });
      const data = await res.json();
      setAiModalContent(data.data?.explanation || "No explanation generated.");
    } catch (err) {
      setAiModalContent(`Error calling Gemini AI: ${err.message}`);
    } finally {
      setAiModalLoading(false);
    }
  };

  // Generate Docs using Gemini AI
  const handleGenerateDocs = async (file) => {
    setAiModalOpen(true);
    setAiModalTitle(`📚 Gemini AI: Auto-Generated Docs for ${file.originalName}`);
    setAiModalLoading(true);
    try {
      const codeText = file.content || `// Code file: ${file.originalName}`;
      const res = await fetch(`${API_URL}/gemini/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeText,
          language: file.extension || "javascript",
        }),
      });
      const data = await res.json();
      setAiModalContent(data.data?.docs || "No documentation generated.");
    } catch (err) {
      setAiModalContent(`Error: ${err.message}`);
    } finally {
      setAiModalLoading(false);
    }
  };

  // Generate Project README using Gemini AI
  const handleGenerateReadme = async () => {
    setAiModalOpen(true);
    setAiModalTitle(`📄 Gemini AI: Project README.md for ${project?.name}`);
    setAiModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/gemini/readme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project?.name,
          description: project?.description,
          codeOverview: notes.map((n) => n.title).join(", "),
          files: files,
        }),
      });
      const data = await res.json();
      setAiModalContent(data.data?.readme || "No README generated.");
    } catch (err) {
      setAiModalContent(`Error: ${err.message}`);
    } finally {
      setAiModalLoading(false);
    }
  };

  // Invite member
  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setInviteError("");
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: memberEmail.trim(),
          role: memberRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to invite member");
      }
      setProject((prev) => ({ ...prev, members: data.members }));
      setMemberEmail("");
      alert("Member added successfully!");
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  // Copy shareable public link
  const copyShareLink = () => {
    const link = `${window.location.origin}/shared/${project?.shareToken}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading project workspace...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <h2>Project not found</h2>
        <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: "16px" }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isOwner = project.ownerId === user?.id;

  return (
    <div className="workspace-page">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div className="workspace-header-top">
          <div className="workspace-meta">
            <h1>
              <FolderGit2 size={28} color="var(--primary)" />
              {project.name}
              {project.isPublic && (
                <span className="tag-pill" style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
                  🌐 Public
                </span>
              )}
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
              {project.description || "Collaborative project workspace"}
            </p>
          </div>

          <div className="workspace-actions">
            {project.isPublic && (
              <button className="btn btn-secondary btn-sm" onClick={copyShareLink}>
                {copiedLink ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
                {copiedLink ? "Link Copied!" : "Share Link"}
              </button>
            )}
            <button className="btn btn-ai btn-sm" onClick={handleGenerateReadme}>
              <Sparkles size={14} /> AI README
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="workspace-tabs">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <BarChart3 size={16} /> Overview & Analytics
          </button>
          <button
            className={`tab-btn ${activeTab === "notes" ? "active" : ""}`}
            onClick={() => setActiveTab("notes")}
          >
            <FileText size={16} /> Markdown Notes ({notes.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <Code2 size={16} /> Code & Assets ({files.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            <BrainCircuit size={16} /> Gemini AI Studio
          </button>
          <button
            className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <Settings size={16} /> Team & Settings
          </button>
        </div>
      </div>

      {/* TAB 1: Overview & Contribution Analytics */}
      {activeTab === "overview" && (
        <div>
          {/* Public Share Banner */}
          {project.isPublic && (
            <div className="share-link-banner">
              <div>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  🌐 Public Shareable URL:
                </span>
                <div className="share-link-text">
                  {window.location.origin}/shared/{project.shareToken}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyShareLink}>
                {copiedLink ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedLink ? "Copied" : "Copy URL"}
              </button>
            </div>
          )}

          <div className="analytics-grid">
            {/* Member Contributions Breakdown */}
            <div className="analytics-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={18} color="var(--primary)" /> Member Contribution Analytics
              </h3>

              {analytics?.memberContributions?.length > 0 ? (
                <div>
                  {analytics.memberContributions.map((member) => {
                    const totalActs = analytics.totalActions || 1;
                    const percent = Math.round(((member.totalActions || 0) / totalActs) * 100);
                    return (
                      <div key={member.userId} className="member-contribution-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "180px" }}>
                          <img
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`}
                            alt={member.name}
                            style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                          />
                          <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{member.name}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{member.role}</div>
                          </div>
                        </div>

                        <div className="contribution-progress-bg">
                          <div
                            className="contribution-progress-fill"
                            style={{ width: `${Math.max(percent, 8)}%` }}
                          />
                        </div>

                        <div style={{ textAlign: "right", minWidth: "120px" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                            {percent}%
                          </span>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                            {member.notesCount} notes • {member.filesCount} files
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  No activity recorded yet. Create notes or upload files to track contributions.
                </p>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="analytics-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>
                Recent Activity
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(analytics?.recentActivity || []).slice(0, 8).map((act, i) => (
                  <div
                    key={act._id || i}
                    style={{
                      display: "flex",
                      gap: "10px",
                      fontSize: "0.85rem",
                      paddingBottom: "10px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <Sparkles size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <span style={{ fontWeight: 600 }}>{act.userName}</span>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {act.action.replace("_", " ")}
                      </span>{" "}
                      <span style={{ fontStyle: "italic" }}>"{act.targetName}"</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Markdown Notes with Gemini AI */}
      {activeTab === "notes" && (
        <div className="notes-container">
          {/* Notes Sidebar */}
          <div className="notes-sidebar">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                Notes ({notes.length})
              </span>
              <button className="btn btn-primary btn-sm" onClick={handleCreateNote}>
                <Plus size={14} /> New
              </button>
            </div>

            <div className="notes-list">
              {notes.map((note) => {
                const isActive = (note._id || note.id) === (activeNote?._id || activeNote?.id);
                return (
                  <div
                    key={note._id || note.id}
                    className={`note-sidebar-item ${isActive ? "active" : ""}`}
                    onClick={() => selectNote(note)}
                  >
                    <div className="note-sidebar-title">{note.title || "Untitled"}</div>
                    <div className="note-sidebar-meta">
                      By {note.authorName || "Member"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Markdown Editor */}
          {activeNote ? (
            <div className="note-editor-panel">
              {/* Header */}
              <div className="editor-header">
                <input
                  type="text"
                  className="note-title-input"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note Title..."
                />

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {/* Gemini AI Action Buttons */}
                  <button
                    className="btn btn-ai btn-sm"
                    onClick={handleExplainNote}
                    title="Ask Gemini to explain this note's architecture and logic"
                  >
                    <Sparkles size={14} /> Explain Note
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleImproveNote}
                    title="Ask Gemini for structural recommendations and improvements"
                  >
                    💡 Suggest Improvements
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNote}
                    disabled={noteSaving}
                  >
                    {noteSaving ? "Saving..." : "Save Note"}
                  </button>

                  <button
                    className="icon-btn"
                    onClick={() => handleDeleteNote(activeNote._id || activeNote.id)}
                    title="Delete Note"
                  >
                    <Trash2 size={16} color="var(--danger)" />
                  </button>
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div className="editor-toolbar">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}\n# `)}
                  title="Heading 1"
                >
                  H1
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}\n## `)}
                  title="Heading 2"
                >
                  H2
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}**Bold Text**`)}
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}*Italic Text*`)}
                  title="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}\n\`\`\`javascript\n// code here\n\`\`\`\n`)}
                  title="Code Block"
                >
                  &lt;/&gt;
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}\n- `)}
                  title="Bullet List"
                >
                  List
                </button>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setNoteContent((prev) => `${prev}\n> `)}
                  title="Quote"
                >
                  Quote
                </button>

                <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    className={`toolbar-btn ${editorMode === "write" ? "active" : ""}`}
                    onClick={() => setEditorMode("write")}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    className={`toolbar-btn ${editorMode === "split" ? "active" : ""}`}
                    onClick={() => setEditorMode("split")}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    className={`toolbar-btn ${editorMode === "preview" ? "active" : ""}`}
                    onClick={() => setEditorMode("preview")}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Split Editor / Preview */}
              <div
                className={`editor-split-container ${
                  editorMode === "write"
                    ? "write-only"
                    : editorMode === "preview"
                    ? "preview-only"
                    : ""
                }`}
              >
                {editorMode !== "preview" && (
                  <textarea
                    className="editor-textarea"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your markdown here..."
                  />
                )}
                {editorMode !== "write" && (
                  <div className="editor-preview">
                    {renderMarkdown(noteContent)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
              Select a note or create one to begin writing.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: File Upload & Code Assets */}
      {activeTab === "files" && (
        <div>
          {/* Upload Dropzone */}
          <div className="files-upload-zone">
            <input
              type="file"
              id="project-file-input"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <label htmlFor="project-file-input" style={{ cursor: "pointer", display: "block" }}>
              <UploadCloud size={36} color="var(--primary)" style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {uploading ? "Uploading asset..." : "Upload Project Files & Code Assets"}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Supports JavaScript (.js), Python (.py), HTML, CSS, JSON, Markdown (.md), images (.png, .jpg, .svg)
              </p>
            </label>
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setNewCodeModal(true)}
              >
                <FileCode size={14} /> + Create Code Snippet Directly
              </button>
            </div>
          </div>

          {/* Files Grid */}
          <div className="files-grid">
            {files.map((file) => {
              const isCode = file.fileType === "code";
              const isImage = file.fileType === "image";
              return (
                <div key={file._id || file.id} className="file-card">
                  <div className="file-info">
                    <div className={`file-icon ${file.fileType || "document"}`}>
                      {isCode ? <FileCode size={20} /> : isImage ? <FileImage size={20} /> : <File size={20} />}
                    </div>
                    <div>
                      <div className="file-name" title={file.originalName}>
                        {file.originalName}
                      </div>
                      <div className="file-meta">
                        {Math.round((file.size || 0) / 1024)} KB • By {file.uploadedByName || "Member"}
                      </div>
                    </div>
                  </div>

                  <div className="file-actions">
                    <button
                      className="icon-btn"
                      onClick={() => setPreviewFile(file)}
                      title="Preview File"
                    >
                      <Eye size={16} />
                    </button>

                    {/* Gemini AI: Explain Code */}
                    {isCode && (
                      <button
                        className="icon-btn"
                        style={{ color: "#a855f7" }}
                        onClick={() => handleExplainCode(file)}
                        title="Explain Code with Gemini"
                      >
                        <Sparkles size={16} />
                      </button>
                    )}

                    <a
                      href={`${API_URL}/files/${file._id || file.id}/download`}
                      className="icon-btn"
                      title="Download"
                      download
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* File Preview Modal */}
          {previewFile && (
            <div className="modal-backdrop" onClick={() => setPreviewFile(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <FileCode size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>{previewFile.originalName}</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {previewFile.fileType === "code" && (
                      <button
                        className="btn btn-ai btn-sm"
                        onClick={() => handleExplainCode(previewFile)}
                      >
                        <Sparkles size={14} /> Explain Code
                      </button>
                    )}
                    <button className="icon-btn" onClick={() => setPreviewFile(null)}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="modal-body">
                  {previewFile.fileType === "image" ? (
                    <div style={{ textAlign: "center" }}>
                      <img
                        src={`${API_URL}/files/${previewFile._id || previewFile.id}/raw`}
                        alt={previewFile.originalName}
                        style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: "8px" }}
                      />
                    </div>
                  ) : (
                    <div className="code-viewer-container">
                      <div className="code-viewer-header">
                        <span>Language: {previewFile.extension || "text"}</span>
                        <span>Size: {Math.round((previewFile.size || 0) / 1024)} KB</span>
                      </div>
                      <div className="code-viewer-content">
                        {previewFile.content || "// Code content is available in downloaded file"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Direct Code Snippet Modal */}
          {newCodeModal && (
            <div className="modal-backdrop" onClick={() => setNewCodeModal(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Create Code Snippet</h3>
                  <button className="icon-btn" onClick={() => setNewCodeModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleCreateCodeFile}>
                  <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Filename
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. authMiddleware.js or train_model.py"
                        value={newCodeName}
                        onChange={(e) => setNewCodeName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-app)",
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Code Content
                      </label>
                      <textarea
                        rows={10}
                        required
                        value={newCodeContent}
                        onChange={(e) => setNewCodeContent(e.target.value)}
                        placeholder="// Write or paste source code here..."
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-app)",
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.85rem",
                          lineHeight: "1.5",
                        }}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setNewCodeModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Asset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Gemini AI Studio */}
      {activeTab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="analytics-card">
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={20} color="#a855f7" /> Dedicated Gemini AI Endpoints & Studio
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "20px" }}>
              Generate comprehensive GitHub README files, auto-document code modules, or ask custom architectural questions using the Gemini AI API.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <div style={{ padding: "20px", background: "var(--bg-surface-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "6px" }}>
                  📄 Auto-Generate README.md
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Invokes <code>/api/gemini/readme</code> to analyze notes and files, generating an end-to-end production README.
                </p>
                <button className="btn btn-ai btn-sm" onClick={handleGenerateReadme}>
                  <Sparkles size={14} /> Generate Project README
                </button>
              </div>

              <div style={{ padding: "20px", background: "var(--bg-surface-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "6px" }}>
                  📚 Code Documentation Generator
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Invokes <code>/api/gemini/docs</code> to create developer reference documentation for code assets.
                </p>
                {files.length > 0 ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleGenerateDocs(files[0])}>
                    <Code2 size={14} /> Document {files[0].originalName}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Upload a code file first
                  </span>
                )}
              </div>

              <div style={{ padding: "20px", background: "var(--bg-surface-elevated)", borderRadius: "10px", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <BrainCircuit size={16} color="var(--primary)" /> Ask Gemini About Project Architecture
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Ask any question about architecture patterns, security, refactoring, or edge cases.
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="e.g. How should we implement WebSocket cursor synchronization?"
                    value={aiPromptInput}
                    onChange={(e) => setAiPromptInput(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: "260px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-app)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ai btn-sm"
                    onClick={async () => {
                      if (!aiPromptInput.trim()) return;
                      setAiModalOpen(true);
                      setAiModalTitle("🤖 Gemini AI Architectural Advisory");
                      setAiModalLoading(true);
                      try {
                        const res = await fetch(`${API_URL}/gemini/explain`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            text: `Project: ${project?.name}\nDescription: ${project?.description}\nQuestion: ${aiPromptInput}`,
                            type: "architecture",
                            language: "general",
                          }),
                        });
                        const data = await res.json();
                        setAiModalContent(data.data?.explanation || "No response generated.");
                      } catch (err) {
                        setAiModalContent(`Error: ${err.message}`);
                      } finally {
                        setAiModalLoading(false);
                      }
                    }}
                  >
                    Ask Gemini
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Team & Settings */}
      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
          {/* Member Invitation */}
          <div className="analytics-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>
              Project Members ({project.members?.length || 1})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {(project.members || []).map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${m.name}`}
                      alt={m.name}
                      style={{ width: "28px", height: "28px", borderRadius: "50%" }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{m.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{m.email}</div>
                    </div>
                  </div>
                  <span className={`badge-role ${m.role}`}>{m.role}</span>
                </div>
              ))}
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInviteMember} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="email"
                required
                placeholder="Collaborator's email (e.g. sarah@collabsphere.dev)"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-app)",
                  color: "var(--text-primary)",
                  minWidth: "220px",
                }}
              />
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-app)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="collaborator">Collaborator</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" disabled={inviting} className="btn btn-primary btn-sm">
                <Users size={14} /> {inviting ? "Adding..." : "Add Member"}
              </button>
            </form>
            {inviteError && (
              <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "8px" }}>
                {inviteError}
              </p>
            )}
          </div>

          {/* Delete Project (Owner Only) */}
          {isOwner && (
            <div className="analytics-card" style={{ borderColor: "rgba(239, 68, 68, 0.4)" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)", marginBottom: "6px" }}>
                Danger Zone: Delete Project
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                Permanently removes this project along with all associated Markdown notes, files, and activity logs.
              </p>
              <button
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete ${project.name}? This action cannot be undone.`)) {
                    await fetch(`${API_URL}/projects/${projectId}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    navigate("/dashboard");
                  }
                }}
              >
                <Trash2 size={14} /> Delete Project Forever
              </button>
            </div>
          )}
        </div>
      )}

      {/* GEMINI AI OUTPUT MODAL */}
      {aiModalOpen && (
        <div className="modal-backdrop" onClick={() => setAiModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "850px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles size={20} color="#a855f7" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{aiModalTitle}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(aiModalContent);
                    alert("AI output copied to clipboard!");
                  }}
                >
                  <Copy size={14} /> Copy
                </button>
                <button className="icon-btn" onClick={() => setAiModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {aiModalLoading ? (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <Sparkles size={32} color="#a855f7" style={{ animation: "spin 2s linear infinite" }} />
                  <p style={{ marginTop: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
                    Gemini AI is analyzing content and generating response...
                  </p>
                </div>
              ) : (
                renderMarkdown(aiModalContent)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Public Shareable Project Page (Read-Only)
function PublicProjectPage() {
  const { shareToken } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeNote, setActiveNote] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/projects/public/${shareToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.project) {
          setProject(data.project);
          if (data.project.notes?.length > 0) {
            setActiveNote(data.project.notes[0]);
          }
        } else {
          setError(data.error || "Shared project not found");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading shared workspace...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <h2>{error || "Project Not Found"}</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop: "16px" }}>
          Go to CollabSphere Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "40px auto", padding: "0 24px" }}>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "24px",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
              🌐 Public Read-Only View
            </span>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "8px 0" }}>{project.name}</h1>
            <p style={{ color: "var(--text-secondary)", maxWidth: "700px" }}>{project.description}</p>
          </div>
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign In to Collaborate
          </Link>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
          {(project.tags || []).map((t, idx) => (
            <span key={idx} className="tag-pill">
              #{t}
            </span>
          ))}
        </div>
      </div>

      {/* Public Notes & Files */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            Public Notes ({project.notes?.length || 0})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(project.notes || []).map((n) => (
              <div
                key={n._id || n.id}
                onClick={() => setActiveNote(n)}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: (activeNote?._id || activeNote?.id) === (n._id || n.id) ? "var(--primary-light)" : "var(--bg-surface-elevated)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{n.title}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>By {n.authorName}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px" }}>
          {activeNote ? (
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                {activeNote.title}
              </h2>
              {renderMarkdown(activeNote.content)}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No note selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Main App Router & State Provider
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("collab-token") || "");
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("collab-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("collab-theme") === "dark",
  );
  const [backendStatus, setBackendStatus] = useState("checking");

  // Ping backend health
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "ok") setBackendStatus("online");
        else setBackendStatus("fallback");
      })
      .catch(() => setBackendStatus("fallback"));
  }, []);

  // Theme attribute
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light",
    );
    localStorage.setItem("collab-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Auth methods
  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Login failed");
    setToken(data.data.token);
    setUser(data.data.user);
    localStorage.setItem("collab-token", data.data.token);
    localStorage.setItem("collab-user", JSON.stringify(data.data.user));
    return data.data.user;
  };

  const register = async (name, email, password, bio) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, bio }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Registration failed");
    setToken(data.data.token);
    setUser(data.data.user);
    localStorage.setItem("collab-token", data.data.token);
    localStorage.setItem("collab-user", JSON.stringify(data.data.user));
    return data.data.user;
  };

  const quickLogin = async (type = "alex") => {
    const email =
      type === "sarah" ? "sarah@collabsphere.dev" : "alex@collabsphere.dev";
    return login(email, "collab123");
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("collab-token");
    localStorage.removeItem("collab-user");
  };

  const authValue = useMemo(
    () => ({ user, token, login, register, quickLogin, logout }),
    [user, token],
  );

  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>
        <Navbar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          backendStatus={backendStatus}
        />
        <main>
          <Routes>
            <Route path="/" element={user ? <DashboardPage /> : <AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route
              path="/dashboard"
              element={user ? <DashboardPage /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/project/:id"
              element={user ? <ProjectWorkspacePage /> : <Navigate to="/login" replace />}
            />
            <Route path="/shared/:shareToken" element={<PublicProjectPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
