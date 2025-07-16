import { useState } from 'react';
import './App.css';

function extractDecision(result) {
  // Prefer explicit decision field
  if (result.decision && result.decision !== '-') {
    if (result.decision.includes('Shortlist')) return 'Shortlisted';
    if (result.decision.includes('Reject')) return 'Rejected';
    return result.decision;
  }
  // Fallback: extract from result_text
  if (result.result_text) {
    const match = result.result_text.match(/Decision:\s*(✅ Shortlist|❌ Reject)/);
    if (match) {
      return match[1].includes('Shortlist') ? 'Shortlisted' : 'Rejected';
    }
  }
  // Fallback: error or unknown
  if (result.error) return 'Error';
  return '-';
}

function App() {
  const [jd, setJd] = useState('');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [hiringType, setHiringType] = useState('1');
  const [level, setLevel] = useState('1');
  const [loading, setLoading] = useState(false);

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
      const response = await fetch('http://127.0.0.1:8000/analyze-resumes/', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setResults([]);
      alert('Error connecting to backend.');
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>Resume Screening</h1>
      <div className="columns">
        <div className="left-column">
          <h2>Job Description</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Hiring Type:
              <select value={hiringType} onChange={e => setHiringType(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="1">Sales</option>
                <option value="2">IT</option>
                <option value="3">Non-Sales</option>
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
          <input
            type="file"
            accept=".pdf,.docx"
            multiple
            onChange={handleFileChange}
          />
          <button onClick={handleSubmit} style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Evaluating...' : 'Evaluate'}
          </button>
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
    </div>
  );
}

export default App;
