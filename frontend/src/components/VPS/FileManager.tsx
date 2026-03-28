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
  Search
} from 'lucide-react';
import api from '../../utils/api';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../../context/ToastContext';

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
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return (
    <div className="p-2 rounded-xl bg-[#11244c] text-[#137fec] shadow-lg shadow-[#137fec]/5 border border-[#137fec]/10">
      <Folder size={18} />
    </div>
  );
  
  const ext = name.split('.').pop()?.toLowerCase() || '';
  let grad = 'bg-bg-tertiary';
  let icon = <File size={18} />;

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'scss', 'html', 'vue', 'svelte'].includes(ext)) {
    grad = 'icon-grad-indigo';
    icon = <FileCode size={18} />;
  } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    grad = 'icon-grad-rose';
    icon = <ImageIcon size={18} />;
  } else if (['zip', 'gz', 'tar', 'rar', '7z', 'bz2'].includes(ext)) {
    grad = 'icon-grad-amber';
    icon = <Archive size={18} />;
  } else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
    grad = 'icon-grad-emerald';
    icon = <Film size={18} />;
  } else if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
    grad = 'icon-grad-amber'; // reuse amber or add orange
    icon = <Music size={18} />;
  } else if (['md', 'txt', 'log', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'env'].includes(ext)) {
    grad = 'bg-slate-500';
    icon = <FileText size={18} />;
  }

  return (
    <div className={`p-2 rounded-xl ${grad} text-white shadow-md`}>
      {icon}
    </div>
  );
}

const FileManager: React.FC<FileManagerProps> = ({ vpsId }) => {
  const { showToast } = useToast();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeletePath, setConfirmDeletePath] = useState<{ path: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/vps/${vpsId}/files`, { params: { path } });
      setFiles(data.files);
      setCurrentPath(data.path);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load files');
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

  const handleUpload = async (filesToUpload: FileList | File[]) => {
    const fileArray = Array.from(filesToUpload);
    if (fileArray.length === 0) return;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
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
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } }; message: string };
        setError(`Upload failed for "${file.name}": ${error.response?.data?.error || error.message}`);
      }
    }
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast(fileArray.length === 1 ? `"${fileArray[0].name}" uploaded` : `${fileArray.length} files uploaded`, 'success');
    fetchFiles(currentPath);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleUpload(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create directory');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (filePath: string, fileName: string) => {
    setConfirmDeletePath({ path: filePath, name: fileName });
  };

  const confirmDelete = async () => {
    if (!confirmDeletePath) return;
    setActionLoading(confirmDeletePath.path);
    try {
      await api.delete(`/vps/${vpsId}/files`, { params: { path: confirmDeletePath.path } });
      showToast(`"${confirmDeletePath.name}" deleted`, 'success');
      fetchFiles(currentPath);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Delete failed');
    } finally {
      setActionLoading(null);
      setConfirmDeletePath(null);
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
    } catch {
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Rename failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
    <div
      className={`flex flex-col h-full space-y-4 relative transition-all ${isDragging ? 'ring-4 ring-blue-500/20 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[32px] bg-[#137fec]/10 border-4 border-dashed border-[#137fec]/30 backdrop-blur-md pointer-events-none animate-in fade-in duration-300">
          <div className="text-center p-12 bg-[#0a1836] rounded-[40px] shadow-2xl border border-[#137fec]/20">
            <div className="p-6 bg-[#137fec] rounded-full text-white shadow-xl shadow-[#137fec]/30 w-fit mx-auto mb-6">
              <Upload size={48} className="animate-bounce" />
            </div>
            <p className="text-xl font-black text-[#dee5ff] tracking-tight mb-2">Release files to ingest</p>
            <p className="text-[10px] font-black text-[#6475a1] uppercase tracking-[0.2em]">Protocol Upload Mode</p>
          </div>
        </div>
      )}

      {/* Navigation and Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 px-4 lg:px-6">
        {/* Modern Breadcrumb */}
        <div className="flex items-center flex-1 min-w-0 bg-[#0a1836]/40 border border-[#6475a1]/10 rounded-2xl p-1 shadow-sm overflow-hidden min-h-[44px]">
          <button
            onClick={() => navigateTo('/')}
            className="p-2 text-[#137fec] hover:bg-[#137fec]/10 rounded-xl transition-all flex-shrink-0"
          >
            <Home size={16} />
          </button>
          
          <div className="flex items-center overflow-x-auto no-scrollbar px-1 space-x-1">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={12} className="text-[#6475a1]/30 flex-shrink-0" />
                <button
                  onClick={() => navigateTo('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                  className={`px-2 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap transition-all uppercase tracking-widest ${
                    i === breadcrumbs.length - 1 
                    ? 'text-[#dee5ff] bg-[#11244c]/60 border border-[#6475a1]/10' 
                    : 'text-[#6475a1] hover:text-[#137fec] hover:bg-[#137fec]/10'
                  }`}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Unified Search & Actions */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 lg:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6475a1]" />
            <input 
              type="text" 
              placeholder="FILTER..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full lg:w-40 bg-[#0a1836]/40 border border-[#6475a1]/10 rounded-2xl pl-9 pr-3 py-2.5 text-[9px] text-[#dee5ff] outline-none focus:border-[#137fec]/30 transition-all font-black placeholder:text-[#6475a1]/50 uppercase tracking-widest"
            />
          </div>

          <div className="flex items-center bg-[#0a1836]/40 border border-[#6475a1]/10 rounded-2xl p-0.5 shadow-sm">
            <button onClick={navigateUp} className="p-2 text-[#6475a1] hover:text-[#137fec] rounded-lg" title="Go Up">
              <ArrowUp size={16} />
            </button>
            <button onClick={() => fetchFiles(currentPath)} className="p-2 text-[#6475a1] hover:text-[#137fec] rounded-lg" title="Refresh">
              <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            </button>
            <button onClick={() => setShowNewFolder(true)} className="p-2 text-[#6475a1] hover:text-[#137fec] rounded-lg" title="New Folder">
              <FolderPlus size={16} />
            </button>
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="flex items-center bg-[#137fec] hover:bg-[#1d6fee] text-white p-2.5 rounded-2xl transition-all shadow-lg active:scale-95"
            title="Upload"
          >
            <Upload size={16} />
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleInputChange} className="hidden" />
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
           <div className="h-full icon-grad-blue transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl flex items-center justify-between text-[11px] font-black uppercase tracking-widest animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
             <X className="text-red-500" size={16} />
             <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded-lg transition-all"><X size={14} /></button>
        </div>
      )}

      {showNewFolder && (
        <div className="p-4 bg-[#0a1836] border border-[#137fec]/20 rounded-[24px] flex items-center space-x-4 animate-in zoom-in-95 duration-200 shadow-2xl premium-card">
           <div className="p-2 bg-[#137fec] rounded-xl text-white">
             <Folder size={18} />
           </div>
           <input 
              autoFocus
              className="flex-1 bg-transparent border-none text-[#dee5ff] outline-none text-[10px] font-black uppercase tracking-widest placeholder:text-[#6475a1]/50"
              placeholder="Cluster identifier..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolder(false);
              }}
           />
           <div className="flex space-x-2">
              <button 
                onClick={handleCreateFolder}
                className="p-2.5 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981] hover:text-white rounded-xl transition-all border border-[#10b981]/20"
              >
                {actionLoading === 'mkdir' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              </button>
              <button 
                onClick={() => setShowNewFolder(false)}
                className="p-2.5 bg-[#11244c] text-[#6475a1] hover:bg-[#f97386]/10 hover:text-[#f97386] rounded-xl transition-all"
              >
                <X size={18} />
              </button>
           </div>
        </div>
      )}

      {/* Main File Table */}
      <div className="flex-1 bg-[#0a1836]/30 backdrop-blur-md border-y border-[#6475a1]/10 overflow-hidden flex flex-col shadow-2xl">
        <div className="overflow-x-auto flex-1 no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0a1836] backdrop-blur-sm text-[8px] font-black uppercase tracking-[0.2em] text-[#6475a1] sticky top-0 z-10 border-b border-[#6475a1]/10 shadow-sm">
                <th className="px-4 lg:px-6 py-3">Object Name</th>
                <th className="px-4 lg:px-6 py-3 w-20 lg:w-32 text-right">Size</th>
                <th className="px-4 lg:px-6 py-3 w-32 text-right hidden lg:table-cell">Perms</th>
                <th className="px-4 lg:px-6 py-3 w-24 lg:w-40 text-right">Sync</th>
                <th className="px-4 lg:px-6 py-3 w-24 lg:w-32 text-right">Methods</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#6475a1]/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center">
                      <Loader2 size={48} className="text-[#137fec] animate-spin mb-6 opacity-30" />
                      <span className="uppercase tracking-[0.3em] font-black text-[#6475a1] text-[9px]">Scanning Buffer Clusters...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center text-[#6475a1]">
                     <div className="p-6 bg-[#11244c] rounded-full w-fit mx-auto mb-4 border border-[#6475a1]/10">
                       <Folder size={48} className="text-[#6475a1]/20" />
                     </div>
                     <span className="uppercase tracking-[0.2em] font-black text-[9px]">Directory contains no active objects</span>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => (
                  <tr 
                    key={file.path}
                    className="group hover:bg-[#137fec]/5 transition-all cursor-pointer relative"
                  >
                    <td className="px-4 lg:px-6 py-2.5">
                      <div className="flex items-center space-x-4">
                        <div className="transition-all duration-300 group-hover:scale-110">
                          {getFileIcon(file.name, file.isDirectory)}
                        </div>
                        {renamingFile === file.path ? (
                          <div className="flex-1 flex items-center space-x-2 animate-in slide-in-from-left-2 duration-300">
                             <input 
                                autoFocus
                                className="bg-[#0a1836] border-2 border-[#137fec]/50 rounded-xl px-4 py-2 text-[10px] text-[#dee5ff] outline-none font-black uppercase tracking-widest shadow-lg"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRename(file.path);
                                  if (e.key === 'Escape') setRenamingFile(null);
                                }}
                             />
                             <button onClick={() => handleRename(file.path)} className="text-[#10b981] p-2 bg-[#10b981]/10 hover:bg-[#10b981] hover:text-white rounded-xl transition-all"><Check size={20} /></button>
                             <button onClick={() => setRenamingFile(null)} className="text-[#f97386] p-2 bg-[#f97386]/10 hover:bg-[#f97386] hover:text-white rounded-xl transition-all"><X size={20} /></button>
                          </div>
                        ) : (
                          <span 
                            onClick={() => file.isDirectory && navigateTo(file.path)}
                            className={`text-[12px] font-black uppercase tracking-tight truncate max-w-[300px] xl:max-w-md ${file.isDirectory ? 'text-[#dee5ff] group-hover:text-[#137fec]' : 'text-[#dee5ff]/80'} transition-colors`}
                          >
                            {file.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-2.5 text-right font-mono text-[9px] text-[#6475a1] font-black uppercase">
                      {file.isDirectory ? '—' : formatBytes(file.size)}
                    </td>
                    <td className="px-4 lg:px-6 py-2.5 text-right font-mono text-[8px] text-[#6475a1]/60 tracking-widest uppercase hidden lg:table-cell">
                      {file.permissions || '—'}
                    </td>
                    <td className="px-4 lg:px-6 py-2.5 text-right text-[8px] text-[#6475a1] font-black tracking-widest uppercase">
                      {timeAgo(file.modifiedAt)}
                    </td>
                    <td className="px-4 lg:px-6 py-2.5 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        {!file.isDirectory && (
                          <button onClick={() => handleDownload(file.path, file.name)} className="p-2.5 bg-[#11244c] text-[#6475a1] hover:text-[#137fec] hover:bg-[#137fec]/10 rounded-xl transition-all shadow-sm" title="Download">
                            <Download size={16} />
                          </button>
                        )}
                        <button onClick={() => { setRenamingFile(file.path); setRenameValue(file.name); }} className="p-2.5 bg-[#11244c] text-[#6475a1] hover:text-[#137fec] hover:bg-[#137fec]/10 rounded-xl transition-all shadow-sm" title="Rename">
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(file.path, file.name)} 
                          className="p-2.5 bg-[#11244c] text-[#6475a1] hover:bg-[#f97386]/10 hover:text-[#f97386] transition-all rounded-xl shadow-sm" 
                          disabled={actionLoading === file.path}
                        >
                          {actionLoading === file.path ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Minimalist Footer */}
        <div className="px-6 py-3 bg-[#0a1836] backdrop-blur-sm border-t border-[#6475a1]/10 flex items-center justify-between text-[8px] font-black text-[#6475a1]/60 uppercase tracking-[0.2em]">
           <div className="flex items-center space-x-4">
              <span className="text-[#137fec]">{filteredFiles.length} OBJECTS</span>
              <span className="h-1 w-1 bg-[#6475a1]/20 rounded-full" />
              <span className="font-mono text-[#6475a1]/40 truncate max-w-[200px]">{currentPath}</span>
           </div>
           <div className="flex items-center space-x-2">
              <div className="w-1 h-1 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[7px]">CLUSTER ACTIVE</span>
           </div>
        </div>
      </div>
    </div>

    {confirmDeletePath && (
      <ConfirmModal
        title="Purge Object"
        message={`Authorize permanent deletion of "${confirmDeletePath.name}" from storage array?`}
        confirmLabel="Purge"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeletePath(null)}
      />
    )}
    </>
  );
};

export default FileManager;
