import { useState, useEffect, useRef, Fragment } from "react";
import { 
  FaFileAlt, FaChartBar, FaCalendarAlt, FaSignOutAlt, FaUserCircle 
} from "react-icons/fa";
import { AiOutlineClose, AiOutlineCloudUpload } from "react-icons/ai";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/backend";

// --- HELPER FUNCTIONS ---
function extractDecision(result) {
  if (result.decision && result.decision !== "-") {
    if (result.decision.includes("Shortlist"))
      return <span className="badge badge-success">Shortlisted</span>;
    if (result.decision.includes("Reject"))
      return <span className="badge badge-danger">Rejected</span>;
    return <span className="badge badge-neutral">{result.decision}</span>;
  }
  if (result.result_text) {
    const match = result.result_text.match(/Decision:\s*(Shortlist|Reject)/);
    if (match) {
      return match[1] === "Shortlist" ? (
        <span className="badge badge-success">Shortlisted</span>
      ) : (
        <span className="badge badge-danger">Rejected</span>
      );
    }
  }
  if (result.error) return <span className="badge badge-danger">Error</span>;
  return "-";
}

// --- COMPONENTS ---

// 1. Sidebar Navigation
function Sidebar({ currentPage, setCurrentPage, recruiterName, handleLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">ProHire</div>
      </div>
      
      <nav className="sidebar-nav">
        <button 
          className={`nav-item ${currentPage === "resume-screening" ? "active" : ""}`}
          onClick={() => setCurrentPage("resume-screening")}
        >
          <FaFileAlt style={{ marginRight: 8 }} /> Resume Screening
        </button>
        <button 
          className={`nav-item ${currentPage === "mis-summary" ? "active" : ""}`}
          onClick={() => setCurrentPage("mis-summary")}
        >
          <FaChartBar style={{ marginRight: 8 }} /> MIS Summary
        </button>
        <button 
          className={`nav-item ${currentPage === "daily-reports" ? "active" : ""}`}
          onClick={() => setCurrentPage("daily-reports")}
        >
          <FaCalendarAlt style={{ marginRight: 8 }} /> Daily Reports
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {recruiterName ? recruiterName.charAt(0).toUpperCase() : <FaUserCircle />}
          </div>
          <div className="user-name">{recruiterName}</div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          <FaSignOutAlt style={{ marginRight: 8 }} /> Logout
        </button>
      </div>
    </aside>
  );
}

// 2. Resume Screening Page
function ResumeScreening({ token }) {
  const [jd, setJd] = useState("");
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [hiringType, setHiringType] = useState("1");
  const [level, setLevel] = useState("1");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index) => {
    const nextFiles = files.filter((_, i) => i !== index);
    setFiles(nextFiles);
    if (nextFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!jd.trim()) return alert("Please enter a job description");
    if (files.length === 0) return alert("Please select at least one resume");

    setLoading(true);
    const formData = new FormData();
    formData.append("job_description", jd);
    formData.append("hiring_type", hiringType);
    formData.append("level", level);
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_URL}/analyze-resumes/`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analysis failed");
      setResults(data.results || []);
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Resume Screening</h1>
        <p className="page-subtitle">Upload resumes and evaluate them against the job description.</p>
      </div>

      <div className="grid-2">
        {/* Left Column: Inputs */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Job Details</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label">Hiring Type</label>
            <select 
              className="form-select"
              value={hiringType}
              onChange={(e) => setHiringType(e.target.value)}
            >
              <option value="1">Sales</option>
              <option value="2">IT</option>
              <option value="3">Non-Sales</option>
              <option value="4">Sales Support</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Level</label>
            <select 
              className="form-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="1">Fresher</option>
              <option value="2">Experienced</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Job Description</label>
            <textarea
              className="form-textarea"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the job description here..."
            />
          </div>
        </div>

        {/* Right Column: Upload & Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upload Resumes</h3>
          </div>

          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <AiOutlineCloudUpload size={48} color="#2563EB" />
            <p style={{ marginTop: '1rem', color: '#6B7280' }}>Click to upload resumes (PDF, DOCX, Image)</p>
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, idx) => (
                <div className="file-item" key={idx}>
                  <span>{file.name}</span>
                  <button className="btn-danger-ghost" onClick={() => removeFile(idx)}>
                    <AiOutlineClose />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Evaluating..." : "Evaluate Resumes"}
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title">Evaluation Results</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Resume</th>
                  <th>Match %</th>
                  <th>Decision</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, idx) => (
                  <tr key={idx}>
                    <td>{res.filename}</td>
                    <td>{res.match_percent ? `${res.match_percent}%` : "-"}</td>
                    <td>{extractDecision(res)}</td>
                    <td>
                      <details>
                        <summary style={{ color: 'var(--primary)', cursor: 'pointer' }}>View Analysis</summary>
                        <pre className="analysis-pre">
                          {(res.result_text || res.error)?.replace(/\*\*(.*?)\*\*/g, "$1")}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. MIS Summary Page
function MISSummary({ setViewingFile, setViewingFilename }) {
  const [mis, setMis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDetails, setOpenDetails] = useState({});
  const [openHistory, setOpenHistory] = useState({});

  const fetchMIS = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/mis-summary`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setMis(data.summary || []);
      setOpenDetails({});
      setOpenHistory({});
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMIS(); }, []);
  
  const toggleDetails = (key) => {
    setOpenDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  
  const toggleHistory = (key) => {
    setOpenHistory((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">MIS Summary</h1>
            <p className="page-subtitle">Overview of recruitment activities.</p>
          </div>
          <button className="btn btn-outline" onClick={fetchMIS} disabled={loading}>
            Refresh Data
          </button>
        </div>
      </div>

      <div className="mis-grid">
        {mis.map((row, idx) => {
          const historyOpen = openHistory[idx];
          return (
            <div className="mis-card" key={row.recruiter_name || idx}>
              <div className="mis-card-header">
                <div>
                  <div className="mis-name">{row.recruiter_name}</div>
                  <div className="mis-meta">
                    {row.uploads} uploads · {row.resumes} resumes
                  </div>
                </div>
                {row.history?.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => toggleHistory(idx)}
                  >
                    {historyOpen ? "Hide History" : "View History"}
                  </button>
                ) : (
                  <span className="mis-empty">No history</span>
                )}
              </div>

              <div className="mis-stats">
                <div className="mis-stat">
                  <div className="mis-stat-label">Shortlisted</div>
                  <div className="mis-stat-value success">{row.shortlisted}</div>
                </div>
                <div className="mis-stat">
                  <div className="mis-stat-label">Rejected</div>
                  <div className="mis-stat-value danger">{row.rejected}</div>
                </div>
                <div className="mis-stat">
                  <div className="mis-stat-label">Total Resumes</div>
                  <div className="mis-stat-value">{row.resumes}</div>
                </div>
              </div>

              {historyOpen && row.history?.length > 0 && (
                <div className="history-panel">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Resume</th>
                        <th>Hiring Type</th>
                        <th>Level</th>
                        <th>Match %</th>
                        <th>Decision</th>
                        <th>Upload Date</th>
                        <th>Counts/Day</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.history.map((h, hidx) => {
                        const detailKey = `${idx}-${hidx}`;
                        return (
                          <Fragment key={detailKey}>
                            <tr className="history-row">
                              <td>
                                {h.file_id ? (
                                  <button
                                    type="button"
                                    className="history-link"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setViewingFile(h.file_id);
                                      setViewingFilename(h.resume_name);
                                    }}
                                  >
                                    {h.resume_name}
                                  </button>
                                ) : (
                                  <span className="history-link disabled">{h.resume_name}</span>
                                )}
                              </td>
                              <td>{h.hiring_type || "-"}</td>
                              <td>{h.level || "-"}</td>
                              <td>{h.match_percent !== null && h.match_percent !== undefined ? `${h.match_percent}%` : "-"}</td>
                              <td>{h.decision}</td>
                              <td>{h.upload_date || "-"}</td>
                              <td>{h.counts_per_day ?? 0}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleDetails(detailKey);
                                  }}
                                >
                                  {openDetails[detailKey] ? "Hide" : "Show"}
                                </button>
                              </td>
                            </tr>
                            <tr className={`history-details-row ${openDetails[detailKey] ? "is-open" : ""}`}>
                              <td colSpan={8}>
                                <div className="history-details">
                                  <pre className="analysis-pre">
                                    {(h.details || "").replace(/\*\*(.*?)\*\*/g, "$1")}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 4. Daily Reports Page
function DailyReports() {
  const [reportData, setReportData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const fetchReports = async (date) => {
    setLoading(true);
    setSelectedDate(date);
    try {
      const formattedDate = date.toISOString().split("T")[0];
      const response = await fetch(`${API_URL}/reports/${formattedDate}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setReportData(data);
    } catch (err) {
      setReportData(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(selectedDate); }, []);

  const downloadCSV = () => {
    if (!reportData) return;
    let csv = "Recruiter,Total,Shortlisted,Rejected\n";
    reportData.reports.forEach(r => {
      csv += `${r.recruiter_name},${r.total_resumes},${r.shortlisted},${r.rejected}\n`;
    });
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `report_${selectedDate.toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Daily Reports</h1>
        <p className="page-subtitle">Performance metrics for {selectedDate.toLocaleDateString()}.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input 
          type="date" 
          className="form-input" 
          style={{ width: 'auto' }}
          value={selectedDate.toISOString().split("T")[0]}
          onChange={(e) => fetchReports(new Date(e.target.value))}
        />
        <button className="btn btn-primary" onClick={downloadCSV} disabled={!reportData}>
          Download CSV
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : reportData?.reports?.length > 0 ? (
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {reportData.reports.map((row, idx) => (
            <div className="card" key={idx}>
              <div className="card-header">
                <h3 className="card-title">{row.recruiter_name}</h3>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{row.total_resumes}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Total</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>{row.shortlisted}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Shortlisted</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--danger)' }}>{row.rejected}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Rejected</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No data available for this date.</p>
      )}
    </div>
  );
}

// 5. Resume Viewer Modal
// Resume Viewer Component
function ResumeViewer({ fileId, filename, onClose, token }) {
  const [fileData, setFileData] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = null;
    const fetchFile = async () => {
      try {
        const response = await fetch(`${API_URL}/view-resume/${fileId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Failed to load file");
        }
        setFileData(data);
        
        // Convert base64 to blob URL for better PDF rendering
        if (data.content_type?.includes("pdf")) {
          const byteCharacters = atob(data.content);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        } else {
          setBlobUrl(null);
        }
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    };

    if (fileId) {
      fetchFile();
    }
    
    // Cleanup blob URL on unmount or when file changes
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, token]);

  const handleDownload = async () => {
    try {
      const response = await fetch(`${API_URL}/download-resume/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      >
        <div style={{ color: "white", fontSize: "1.2rem" }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "8px",
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          width: "90%",
          maxWidth: "900px",
          height: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f9fafb",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#232946" }}>
            {filename}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleDownload}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              Download
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", backgroundColor: "#f3f4f6" }}>
          {fileData && (
            <>
              {fileData.content_type?.includes("pdf") ? (
                blobUrl ? (
                  <iframe
                    src={blobUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                    }}
                    title={filename}
                  />
                ) : (
                  <div style={{ padding: "2rem", textAlign: "center" }}>
                    Loading PDF...
                  </div>
                )
              ) : fileData.content_type?.includes("image") ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1rem",
                  }}
                >
                  <img
                    src={`data:${fileData.content_type};base64,${fileData.content}`}
                    alt={filename}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              ) : (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <h3>{filename}</h3>
                  <p>File type: {fileData.content_type}</p>
                  <p>Size: {(fileData.size / 1024).toFixed(2)} KB</p>
                  <p>
                    Preview not available for this file type. Use the download
                    button to view the file.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// --- MAIN APP COMPONENT ---
function App() {
  const [authMode, setAuthMode] = useState("login");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [recruiterName, setRecruiterName] = useState(localStorage.getItem("recruiterName") || "");
  const [currentPage, setCurrentPage] = useState("resume-screening");
  const [viewingFile, setViewingFile] = useState(null);
  const [viewingFilename, setViewingFilename] = useState("");

  // Auth States
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  // Check for reset token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setResetToken(tokenParam);
      setAuthMode("reset-password");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", username);
      form.append("password", password);
      const res = await fetch(`${API_URL}/login`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      
      setToken(data.access_token);
      setRecruiterName(data.recruiter_name);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("recruiterName", data.recruiter_name);
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };



  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      alert(data.msg || "If the email exists, a reset link has been sent.");
      setAuthMode("login");
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      alert("Password reset successfully! Please login with your new password.");
      setAuthMode("login");
      setPassword("");
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) throw new Error("Registration failed");
      alert("Registration successful! Please login.");
      setAuthMode("login");
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setToken("");
    setRecruiterName("");
    localStorage.clear();
  };

  if (!token) {
    return (
      <div className="login-layout">
        <div className="login-card">
          <h1 className="login-title">ProHire</h1>
          <p className="login-subtitle">Apply karo chahe kahin se, shortlisting hoga yahin se.</p>
          
          {authMode === "login" ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <input 
                  className="form-input" 
                  placeholder="Username" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <input 
                  className="form-input" 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
              <div className="auth-actions">
                <button type="button" className="auth-link" onClick={() => setAuthMode("register")}>
                  Need an account? Register
                </button>
                <button type="button" className="auth-link" onClick={() => setAuthMode("forgot-password")}>
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : authMode === "register" ? (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <input 
                  className="form-input" 
                  placeholder="Username" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <input 
                  className="form-input" 
                  type="email" 
                  placeholder="Email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <input 
                  className="form-input" 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? "Registering..." : "Register"}
              </button>
              <button type="button" className="auth-link auth-switch" onClick={() => setAuthMode("login")}>
                Already have an account? Login
              </button>
            </form>
          ) : authMode === "forgot-password" ? (
            <form onSubmit={handleForgotPassword}>
              <div className="form-group">
                <input 
                  className="form-input" 
                  type="email" 
                  placeholder="Enter your registered email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? "Sending Link..." : "Send Reset Link"}
              </button>
              <button type="button" className="auth-back-link" onClick={() => setAuthMode("login")}>
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <input 
                  className="form-input" 
                  type="password" 
                  placeholder="Enter new password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
              <button type="button" className="auth-back-link" onClick={() => setAuthMode("login")}>
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        recruiterName={recruiterName} 
        handleLogout={handleLogout} 
      />
      
      <main className="main-content">
        {currentPage === "resume-screening" && <ResumeScreening token={token} />}
        {currentPage === "mis-summary" && <MISSummary setViewingFile={setViewingFile} setViewingFilename={setViewingFilename} />}
        {currentPage === "daily-reports" && <DailyReports />}
      </main>

      {viewingFile && (
        <ResumeViewer 
          fileId={viewingFile} 
          filename={viewingFilename} 
          onClose={() => setViewingFile(null)} 
          token={token} 
        />
      )}
    </div>
  );
}

export default App;
