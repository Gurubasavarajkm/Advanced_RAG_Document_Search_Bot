import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Upload, Trash2, FileText, Database, AlertCircle } from 'lucide-react';
import { fetchDocuments, uploadDocument, deleteDocument } from '../api';
import '../components/ui.css';

const Admin = () => {
  const { role, token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (role === 'admin') {
      loadDocuments();
    }
  }, [role]);

  const loadDocuments = async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  if (!token || role !== 'admin') {
    return <Navigate to="/chat" />;
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await uploadDocument(file);
      setSuccess(res.message || 'File uploaded successfully!');
      setFile(null);
      // Reset input
      document.getElementById('file-upload').value = '';
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm(`Are you sure you want to delete ${docId}?`)) return;
    
    try {
      await deleteDocument(docId);
      loadDocuments();
    } catch (err) {
      setError(`Failed to delete ${docId}.`);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Database color="var(--primary-color)" /> Knowledge Base Management
        </h2>
        <p>Upload documents to improve the RAG search bot's intelligence.</p>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', borderRadius: 'var(--radius-md)', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success-color)', borderRadius: 'var(--radius-md)', color: 'var(--success-color)' }}>
          {success}
        </div>
      )}

      <div className="glass-card">
        <h3>Upload New Document</h3>
        <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Supported formats: PDF, TXT, DOCX. (Max 2MB)</p>
        
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ 
            border: '2px dashed var(--surface-border)', 
            padding: '2rem', 
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.4)',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
          onClick={() => document.getElementById('file-upload').click()}
          >
            <Upload size={32} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
            <p>{file ? file.name : 'Click to select or drag and drop a file here'}</p>
            <input 
              id="file-upload" 
              type="file" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={!file || isUploading}
            style={{ alignSelf: 'flex-end' }}
          >
            {isUploading ? 'Uploading...' : 'Upload to Knowledge Base'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3>Current Documents</h3>
        <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Manage files currently in the vector database.</p>
        
        {documents.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No documents found in the database.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {documents.map((doc, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <FileText size={20} color="var(--primary-color)" />
                  <span style={{ fontWeight: '500' }}>{doc}</span>
                </div>
                <button 
                  onClick={() => handleDelete(doc)}
                  className="btn btn-danger"
                  style={{ padding: '0.5rem', borderRadius: '8px' }}
                  title="Delete Document"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Admin;
