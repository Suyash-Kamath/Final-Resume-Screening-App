import { useState, useEffect } from 'react';
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
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'forgot-password', 'reset-password'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [recruiterName, setRecruiterName] = useState(localStorage.getItem('recruiterName') || '');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
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

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);



  // Check for reset token in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setAuthMode('reset-password');
      // Verify token validity
      verifyResetToken(tokenFromUrl);
    }
  }, []);

  // Verify reset token
  const verifyResetToken = async (token) => {
    try {
      const res = await fetch(`${API_URL}/verify-reset-token/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setAuthError('Invalid or expired reset link. Please request a new one.');
        setAuthMode('forgot-password');
      } else {
        setEmail(data.email);
        setAuthSuccess('Reset link verified. Please enter your new password.');
      }
    } catch (err) {
      setAuthError('Invalid or expired reset link. Please request a new one.');
      setAuthMode('forgot-password');
    }
  };

  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'login') {
        const form = new FormData();
        form.append('username', username);
        form.append('password', password);
        const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');

        setToken(data.access_token);
        setRecruiterName(data.recruiter_name);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('recruiterName', data.recruiter_name);
      }
      else if (authMode === 'register') {
        const res = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            email: email,
            password: password,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');

        setAuthMode('login');
        setAuthSuccess('Registration successful! Please login with your credentials.');
        setUsername('');
        setEmail('');
        setPassword('');
      }
      else if (authMode === 'forgot-password') {
        const res = await fetch(`${API_URL}/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to send reset email');

        setAuthSuccess('If the email exists in our system, you will receive a password reset link shortly. Please check your inbox and spam folder.');
        setEmail('');
      }
      else if (authMode === 'reset-password') {
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        const res = await fetch(`${API_URL}/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: resetToken,
            new_password: newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to reset password');

        setAuthSuccess('Password reset successful! You can now login with your new password.');
        setAuthMode('login');
        setNewPassword('');
        setConfirmPassword('');
        setResetToken('');
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
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

  const resetAuthState = () => {
    setAuthError('');
    setAuthSuccess('');
    setUsername('');
    setEmail('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
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

  const renderAuthForm = () => {
    switch (authMode) {
      case 'login':
        return (
          <>
            <h2>Recruiter Login</h2>
            <form onSubmit={handleAuth} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Recruiter Username"
                required
              />
              <div className="password-wrapper">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowLoginPassword(prev => !prev)}
                  title={showLoginPassword ? "Hide Password" : "Show Password"}
                >
                  {showLoginPassword ? "🙈" : "👁️"}
                </span>
              </div>

              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  setAuthMode('register');
                  resetAuthState();
                }}
                style={{ fontSize: 12 }}
              >
                Need an account? Register
              </button>
              <button
                onClick={() => {
                  setAuthMode('forgot-password');
                  resetAuthState();
                }}
                style={{ fontSize: 12, color: '#007bff', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Forgot Password?
              </button>
            </div>
          </>
        );

      case 'register':
        return (
          <>
            <h2>Recruiter Registration</h2>
            <form onSubmit={handleAuth} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Recruiter Username"
                required
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                required
              />
              <div className="password-wrapper">
                <input
                  type={showRegisterPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowRegisterPassword(prev => !prev)}
                  title={showRegisterPassword ? "Hide Password" : "Show Password"}
                >
                  {showRegisterPassword ? "🙈" : "👁️"}
                </span>
              </div>


              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Registering...' : 'Register'}
              </button>
            </form>
            <button
              onClick={() => {
                setAuthMode('login');
                resetAuthState();
              }}
              style={{ fontSize: 12 }}
            >
              Already have an account? Login
            </button>
          </>
        );

      case 'forgot-password':
        return (
          <>
            <h2>Forgot Password</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleAuth} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <button
              onClick={() => {
                setAuthMode('login');
                resetAuthState();
              }}
              style={{ fontSize: 12 }}
            >
              Back to Login
            </button>
          </>
        );

      case 'reset-password':
        return (
          <>
            <h2>Reset Password</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              Enter your new password for: <strong>{email}</strong>
            </p>
            <form onSubmit={handleAuth} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="password-wrapper">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  required
                  minLength={6}
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowResetPassword(prev => !prev)}
                  title={showResetPassword ? "Hide Password" : "Show Password"}
                >
                  {showResetPassword ? "🙈" : "👁️"}
                </span>
              </div>

              <div className="password-wrapper">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  required
                  minLength={6}
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowResetPassword(prev => !prev)}
                  title={showResetPassword ? "Hide Password" : "Show Password"}
                >
                  {showResetPassword ? "🙈" : "👁️"}
                </span>
              </div>


              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
            <button
              onClick={() => {
                setAuthMode('login');
                resetAuthState();
                setResetToken('');
                window.history.replaceState({}, document.title, window.location.pathname);
              }}
              style={{ fontSize: 12 }}
            >
              Back to Login
            </button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {!token ? (
        <div className="login-container">
          <h1>ProHire</h1>
          <p className='tagline'>
            Apply karo chahe kahin se, shortlisting hoga yahin se.
          </p>
          <div className="auth-box">
            {renderAuthForm()}
            {authError && (
              <div style={{ color: 'red', marginTop: 16, padding: 12, backgroundColor: '#ffeaea', border: '1px solid #ffcdd2', borderRadius: 4 }}>
                {authError}
              </div>
            )}
            {authSuccess && (
              <div style={{ color: 'green', marginTop: 16, padding: 12, backgroundColor: '#eafaf1', border: '1px solid #c8e6c9', borderRadius: 4 }}>
                {authSuccess}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="main-container">
          <h1>ProHire</h1>
          <p className='tagline'>
            Apply karo chahe kahin se, shortlisting hoga yahin se.
          </p>
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
                    accept=".pdf,.docx,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
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
                              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}> {(res.result_text || res.error)?.replace(/\*\*(.*?)\*\*/g, '$1')}</pre>
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
                                  <th>Upload Date</th> {/* New column */}
                                  <th>Counts/Day</th> {/* New column */}
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
                                    <td>{h.upload_date || '-'}</td>
                                    <td>{h.counts_per_day || '-'}</td>
                                    <td>
                                      <details>
                                        <summary>Show</summary>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{(h.details || '').replace(/\*\*(.*?)\*\*/g, '$1')}</pre>
                                      </details>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        ) : (
                          'No history'
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