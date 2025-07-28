import { useState } from 'react';
import './App.css';

function extractDecision(result) {
  if (result.decision && result.decision !== '-') {
    if (result.decision.includes('Shortlist')) return 'Shortlisted';
    if (result.decision.includes('Reject')) return 'Rejected';
    return result.decision;
  }
  if (result.result_text) {
    const match = result.result_text.match(/Decision:\s*(✅ Shortlist|❌ Reject)/);
    if (match) {
      return match[1].includes('Shortlist') ? 'Shortlisted' : 'Rejected';
    }
  }
  if (result.error) return 'Error';
  return '-';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function App() {
  // Auth state
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [recruiterName, setRecruiterName] = useState(localStorage.getItem('recruiterName') || '');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App state
  const [jd, setJd] = useState('');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [hiringType, setHiringType] = useState('1');
  const [level, setLevel] = useState('1');
  const [loading, setLoading] = useState(false);
  const [mis, setMis] = useState([]);
  const [misLoading, setMisLoading] = useState(false);

  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const form = new FormData();
      form.append('username', username);
      form.append('password', password);
      const endpoint = authMode === 'register' ? '/register' : '/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Auth failed');
      if (authMode === 'login') {
        setToken(data.access_token);
        setRecruiterName(data.recruiter_name);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('recruiterName', data.recruiter_name);
      } else {
        setAuthMode('login');
        setAuthError('Registration successful! Please login.');
      }
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setToken('');
    setRecruiterName('');
    localStorage.removeItem('token');
    localStorage.removeItem('recruiterName');
    setResults([]);
    setMis([]);
  };

  // Resume upload handlers
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.append('job_description', jd);
    formData.append('hiring_type', hiringType);
    formData.append('level', level);
    files.forEach((file) => {
      formData.append('files', file);
    });
    try {
      const response = await fetch(`${API_URL}/analyze-resumes/`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setResults(data.results || []);
      setFiles([]);
    } catch (err) {
      setResults([]);
      alert('Error connecting to backend.');
    }
    setLoading(false);
  };

  // MIS summary
  const fetchMIS = async () => {
    setMisLoading(true);
    try {
      const response = await fetch(`${API_URL}/mis-summary`);
      const data = await response.json();
      setMis(data.summary || []);
    } catch (err) {
      setMis([]);
      alert('Error fetching MIS summary.');
    }
    setMisLoading(false);
  };

  const hiringTypeLabel = (val) => {
    if (!val) return '-';
    if (val === '1' || val === 1) return 'Sales';
    if (val === '2' || val === 2) return 'IT';
    if (val === '3' || val === 3) return 'Non-Sales';
    if (val === '4' || val === 4) return 'Sales Support';
    return val;
  };
  const levelLabel = (val) => {
    if (!val) return '-';
    if (val === '1' || val === 1) return 'Fresher';
    if (val === '2' || val === 2) return 'Experienced';
    return val;
  };

  return (
    <>
      {!token ? (
        <div className="login-container">
          <h1>ProHire</h1>
          <div className="auth-box">
            <h2>{authMode === 'login' ? 'Recruiter Login' : 'Recruiter Registration'}</h2>
            <form onSubmit={handleAuth} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Recruiter Username"
                required
                style={{ marginBottom: 8 }}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                style={{ marginBottom: 8 }}
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? (authMode === 'login' ? 'Logging in...' : 'Registering...') : (authMode === 'login' ? 'Login' : 'Register')}
              </button>
            </form>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ fontSize: 12 }}>
              {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
            {authError && <div style={{ color: authError.includes('successful') ? 'green' : 'red', marginTop: 8 }}>{authError}</div>}
          </div>
        </div>
      ) : (
        <div className="main-container">
          <h1>ProHire</h1>
          <div className="auth-box" style={{ marginBottom: 16 }}>
            <span>Logged in as <b>{recruiterName}</b></span>
            <button onClick={handleLogout} style={{ marginLeft: 16 }}>Logout</button>
          </div>
          <div className="columns">
            <div className="left-column">
              <h2>Job Description</h2>
              <div style={{ marginBottom: '1rem' }} className="field-row" >
                <label>
                  Hiring Type:
                  <select value={hiringType} onChange={e => setHiringType(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="1">Sales</option>
                    <option value="2">IT</option>
                    <option value="3">Non-Sales</option>
                    <option value="4">Sales Support</option>
                  </select>
                </label>
                <label style={{ marginLeft: 16 }}>
                  Level:
                  <select value={level} onChange={e => setLevel(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="1">Fresher</option>
                    <option value="2">Experienced</option>
                  </select>
                </label>
              </div>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste Job Description here..."
                rows={20}
                style={{ width: '100%' }}
              />
            </div>
            <div className="right-column">
              <h2>Upload Resumes</h2>
              <div className="upload-row">
  <label className="custom-file-upload">
    <input
      type="file"
      accept=".pdf,.docx"
      multiple
      onChange={handleFileChange}
      style={{ display: 'none' }}
    />
    Choose Files
  </label>
  <button onClick={handleSubmit} disabled={loading}>
    {loading ? 'Evaluating...' : 'Evaluate'}
  </button>
  {/* Show selected file names or count */}
  {files.length > 0 && (
  <div className="file-list">
    {files.map((file, idx) => (
      <span className="file-item" key={idx}>
        {file.name}
        <button
          type="button"
          className="remove-file"
          onClick={() => setFiles(files.filter((_, i) => i !== idx))}
          title="Remove"
        >
          &times;
        </button>
      </span>
    ))}
  </div>
)}
</div>
              <div style={{ marginTop: '2rem' }}>
                {results.length > 0 && (
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
                          <td>{res.match_percent !== undefined ? res.match_percent + '%' : '-'}</td>
                          <td>{extractDecision(res)}</td>
                          <td>
                            <details>
                              <summary>Show</summary>
                              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{res.result_text || res.error}</pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: '3rem' }} className="mis-summary-section">
            <h2>MIS Summary</h2>
            <button onClick={fetchMIS} disabled={misLoading} style={{ marginBottom: '1rem' }}>
              {misLoading ? 'Loading...' : 'Show MIS Summary'}
            </button>
            {mis.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Recruiter Name</th>
                    <th>Uploads</th>
                    <th>Total Resumes</th>
                    <th>Shortlisted</th>
                    <th>Rejected</th>
                    <th>History</th>
                  </tr>
                </thead>
                <tbody>
                  {mis.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.recruiter_name}</td>
                      <td>{row.uploads}</td>
                      <td>{row.resumes}</td>
                      <td>{row.shortlisted}</td>
                      <td>{row.rejected}</td>
                      <td>
                        {row.history && row.history.length > 0 ? (
                          <details>
                            <summary>Show</summary>
                            <table style={{ fontSize: 12, marginTop: 8 }}>
                              <thead>
                                <tr>
                                  <th>Resume Name</th>
                                  <th>Hiring Type</th>
                                  <th>Level</th>
                                  <th>Match %</th>
                                  <th>Decision</th>
                                  <th>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.history.map((h, hidx) => (
                                  <tr key={hidx}>
                                    <td>{h.resume_name || 'Unknown'}</td>
                                    <td>{hiringTypeLabel(h.hiring_type)}</td>
                                    <td>{levelLabel(h.level)}</td>
                                    <td>{h.match_percent !== undefined && h.match_percent !== null ? h.match_percent + '%' : '-'}</td>
                                    <td>{h.decision || '-'}</td>
                                    <td>
                                      <details>
                                        <summary>Show</summary>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{h.details || '-'}</pre>
                                      </details>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}


export default App;
