import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  Home,
  Upload,
  FolderPlus,
  Download,
  Trash2,
  Edit3,
  RefreshCw,
  ArrowUp,
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  Music,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import api from '../../utils/api';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  permissions?: string;
}

interface FileManagerProps {
  vpsId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return <Folder size={18} style={{ color: '#3b82f6' }} />;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'scss', 'html', 'vue', 'svelte'].includes(ext))
    return <FileCode size={18} style={{ color: '#a78bfa' }} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext))
    return <ImageIcon size={18} style={{ color: '#f472b6' }} />;
  if (['zip', 'gz', 'tar', 'rar', '7z', 'bz2'].includes(ext))
    return <Archive size={18} style={{ color: '#fbbf24' }} />;
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext))
    return <Film size={18} style={{ color: '#34d399' }} />;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext))
    return <Music size={18} style={{ color: '#fb923c' }} />;
  if (['md', 'txt', 'log', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'env'].includes(ext))
    return <FileText size={18} style={{ color: '#94a3b8' }} />;
  return <File size={18} style={{ color: '#64748b' }} />;
}

const FileManager: React.FC<FileManagerProps> = ({ vpsId }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/files`, { params: { path } });
      setFiles(data.files);
      setCurrentPath(data.path);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [vpsId]);

  useEffect(() => {
    fetchFiles('/');
  }, [fetchFiles]);

  const navigateTo = (path: string) => {
    fetchFiles(path);
  };

  const navigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parent);
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);

    setUploadProgress(0);
    try {
      await api.post(`/vps/${vpsId}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setActionLoading('mkdir');
    try {
      const newPath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
      await api.post(`/vps/${vpsId}/files/mkdir`, { path: newPath });
      setShowNewFolder(false);
      setNewFolderName('');
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create directory');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (filePath: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setActionLoading(filePath);
    try {
      await api.delete(`/vps/${vpsId}/files`, { params: { path: filePath } });
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const response = await api.get(`/vps/${vpsId}/files/download`, {
        params: { path: filePath },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Download failed');
    }
  };

  const handleRename = async (oldPath: string) => {
    if (!renameValue.trim()) return;
    setActionLoading(oldPath);
    const parentDir = oldPath.split('/').slice(0, -1).join('/') || '/';
    const newPath = parentDir === '/' ? `/${renameValue}` : `${parentDir}/${renameValue}`;
    try {
      await api.put(`/vps/${vpsId}/files/rename`, { oldPath, newPath });
      setRenamingFile(null);
      setRenameValue('');
      fetchFiles(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Rename failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
        padding: 'var(--space-2) 0',
      }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0,
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-1) var(--space-3)', border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => navigateTo('/')}
            style={{
              background: 'none', border: 'none', color: 'var(--accent-primary)',
              cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}
            title="Root"
          >
            <Home size={14} />
          </button>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <button
                onClick={() => navigateTo('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                style={{
                  background: 'none', border: 'none',
                  color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--accent-primary)',
                  cursor: 'pointer', padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem', fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={navigateUp} title="Go up" style={{ padding: '6px 10px' }}>
            <ArrowUp size={16} />
          </button>
          <button className="btn btn-secondary" onClick={() => fetchFiles(currentPath)} title="Refresh" style={{ padding: '6px 10px' }}>
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-secondary" onClick={() => setShowNewFolder(true)} title="New folder" style={{ padding: '6px 10px' }}>
            <FolderPlus size={16} />
          </button>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px' }}>
            <Upload size={16} /> Upload
          </button>
          <input ref={fileInputRef} type="file" onChange={handleUpload} style={{ display: 'none' }} />
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <div style={{
          height: '4px', borderRadius: '2px', background: 'var(--bg-tertiary)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${uploadProgress}%`, background: 'var(--accent-primary)',
            transition: 'width 0.3s ease', borderRadius: '2px',
          }} />
        </div>
      )}

      {/* New Folder Input */}
      {showNewFolder && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--accent-primary)',
        }}>
          <Folder size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <input
            className="input-field"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
            }}
            autoFocus
            style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
          />
          <button onClick={handleCreateFolder} disabled={actionLoading === 'mkdir'} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', display: 'flex', padding: '4px' }}>
            {actionLoading === 'mkdir' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          </button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--error-bg)', color: 'var(--error)',
          borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* File Table */}
      <div style={{
        flex: 1, overflow: 'auto', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
      }}>
        {loading ? (
          <div className="flex-center" style={{ height: '200px', gap: 'var(--space-2)' }}>
            <Loader2 size={20} className="spin" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-muted">Loading…</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Folder size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <span className="text-muted">This directory is empty</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Size</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>Modified</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.path}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    cursor: file.isDirectory ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onDoubleClick={() => file.isDirectory && navigateTo(file.path)}
                >
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {getFileIcon(file.name, file.isDirectory)}
                      {renamingFile === file.path ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                          <input
                            className="input-field"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(file.path);
                              if (e.key === 'Escape') { setRenamingFile(null); setRenameValue(''); }
                            }}
                            autoFocus
                            style={{ padding: '2px 6px', fontSize: '0.85rem', flex: 1 }}
                          />
                          <button onClick={() => handleRename(file.path)} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
                          <button onClick={() => { setRenamingFile(null); setRenameValue(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <span
                          onClick={() => file.isDirectory && navigateTo(file.path)}
                          style={{
                            fontWeight: file.isDirectory ? 500 : 400,
                            color: file.isDirectory ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: file.isDirectory ? 'pointer' : 'default',
                          }}
                        >
                          {file.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {file.isDirectory ? '—' : formatBytes(file.size)}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {timeAgo(file.modifiedAt)}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2px' }}>
                      {!file.isDirectory && (
                        <button
                          onClick={() => handleDownload(file.path, file.name)}
                          title="Download"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => { setRenamingFile(file.path); setRenameValue(file.name); }}
                        title="Rename"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', transition: 'color 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--warning)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(file.path, file.name)}
                        title="Delete"
                        disabled={actionLoading === file.path}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', transition: 'color 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        {actionLoading === file.path ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 var(--space-1)' }}>
        <span>{files.length} item{files.length !== 1 ? 's' : ''}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{currentPath}</span>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default FileManager;
