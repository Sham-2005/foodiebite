import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Plus, Trash2, Calendar, Edit3, CheckCircle, AlertCircle, FileUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGetMedicalReports, apiUploadMedicalReport, apiDeleteMedicalReport } from '../services/api';
import { C, BtnOrange } from '../components/UI';

export default function MedicalReportsScreen() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

  // ── Fetch medical reports ───────────────────────
  async function fetchReports() {
    try {
      setLoading(true);
      const data = await apiGetMedicalReports();
      if (data && data.reports) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Failed to fetch medical reports:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  // ── Handle file selection ────────────────────────
  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  // ── Handle file upload ──────────────────────────
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setToast({ type: 'error', msg: 'Please select a file to upload.' });
      return;
    }

    try {
      setUploading(true);
      setToast(null);
      await apiUploadMedicalReport(file, notes);
      setToast({ type: 'success', msg: 'Medical report uploaded successfully!' });
      setFile(null);
      setNotes('');
      // Reset the file input
      const fileInput = document.getElementById('report-file-input');
      if (fileInput) fileInput.value = '';
      fetchReports();
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  // ── Handle delete report ────────────────────────
  async function handleDelete(reportId) {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await apiDeleteMedicalReport(reportId);
      setToast({ type: 'success', msg: 'Report deleted successfully!' });
      fetchReports();
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to delete report.' });
    }
  }

  return (
    <div style={{  background: C.bg, color: C.text, paddingBottom: 40 }} className="phone-frame">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#1e1e1e', border: `1px solid ${C.border}`,
            borderRadius: '50%', width: 36, height: 36,
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
          Medical Reports
        </h1>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Toast Notification */}
        {toast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10, marginBottom: 20,
            background: toast.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(255,77,109,0.1)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(255,77,109,0.3)'}`,
            color: toast.type === 'success' ? '#4ade80' : '#ff4d6d',
            fontSize: 13, fontWeight: 500,
          }}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        {/* Upload Section */}
        <div style={{
          background: '#1e1e1e', borderRadius: 14, padding: 16,
          border: `1px solid ${C.border}`, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileUp size={16} color={C.orange} /> Upload New Report
          </h3>

          <form onSubmit={handleUpload}>
            <div style={{ marginBottom: 12 }}>
              <input
                id="report-file-input"
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label
                htmlFor="report-file-input"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '24px 16px', borderRadius: 10,
                  border: `2px dashed ${file ? C.orange : C.border}`,
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s'
                }}
              >
                <FileText size={32} color={file ? C.orange : C.muted2} style={{ marginBottom: 8 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: file ? '#fff' : C.muted }}>
                  {file ? file.name : 'Select PDF or Image Report'}
                </span>
                <span style={{ fontSize: 10, color: C.muted2, marginTop: 4 }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Max size 5MB'}
                </span>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Add medical notes (e.g. cholesterol, sugar level...)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', background: C.input,
                  border: `1px solid ${C.inputB}`, borderRadius: 10,
                  color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <BtnOrange type="submit" disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload Report'}
            </BtnOrange>
          </form>
        </div>

        {/* List of Reports */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: C.muted2 }}>
            Your Uploaded Reports ({reports.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>Loading medical reports...</div>
          ) : reports.length === 0 ? (
            <div style={{
              background: '#1e1e1e', borderRadius: 14, padding: '32px 16px',
              border: `1px solid ${C.border}`, textAlign: 'center', color: C.muted
            }}>
              <FileText size={40} color={C.muted2} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 13 }}>No medical reports uploaded yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444' }}>Upload test reports to get personalized diet alerts</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map((report) => (
                <div
                  key={report._id || report.id}
                  style={{
                    background: '#1e1e1e', borderRadius: 14, padding: 14,
                    border: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center'
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, background: 'rgba(255,107,53,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.orange, flexShrink: 0
                  }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.originalName || report.filename}
                    </div>
                    {report.notes && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Edit3 size={10} color={C.muted2} /> {report.notes}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: C.muted2, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> {new Date(report.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(report._id || report.id)}
                    style={{
                      background: 'none', border: 'none', padding: 8, color: '#ff4d6d',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
