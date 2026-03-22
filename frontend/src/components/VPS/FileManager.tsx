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
    <div className="p-2 rounded-xl icon-grad-blue shadow-lg shadow-blue-500/20 text-white">
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
      className={`flex flex-col h-full space-y-5 relative transition-all ${isDragging ? 'ring-4 ring-blue-500/20 ring-inset rounded-[32px]' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[32px] bg-blue-600/10 border-4 border-dashed border-blue-500/50 backdrop-blur-md pointer-events-none animate-in fade-in duration-300">
          <div className="text-center p-12 bg-white/90 rounded-[40px] shadow-2xl border border-blue-500/20">
            <div className="p-6 icon-grad-blue rounded-full text-white shadow-xl shadow-blue-500/30 w-fit mx-auto mb-6">
              <Upload size={48} className="animate-bounce" />
            </div>
            <p className="text-xl font-black text-slate-900 tracking-tight mb-2">Release files to ingest</p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Protocol Upload Mode</p>
          </div>
        </div>
      )}

      {/* Navigation and Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
        {/* Modern Breadcrumb */}
        <div className="flex items-center flex-1 min-w-0 bg-white border border-slate-200 rounded-[20px] p-1.5 shadow-sm group">
          <button
            onClick={() => navigateTo('/')}
            className="p-3 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all flex-shrink-0"
          >
            <Home size={18} />
          </button>
          
          <div className="flex items-center overflow-x-auto no-scrollbar px-2 space-x-1">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mx-1" />
                <button
                  onClick={() => navigateTo('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase tracking-tight ${
                    i === breadcrumbs.length - 1 
                    ? 'text-slate-900 bg-slate-50 cursor-default shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Unified Search & Actions */}
        <div className="flex items-center space-x-3">
          <div className="relative group flex-1 xl:flex-none">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search directory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full xl:w-64 bg-white border border-slate-200 rounded-[20px] pl-11 pr-5 py-3 text-xs text-slate-900 outline-none focus:border-blue-500/30 transition-all font-bold placeholder:text-slate-400 shadow-sm"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-[20px] p-1 shadow-sm">
            <button onClick={navigateUp} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Go Up">
              <ArrowUp size={18} />
            </button>
            <button onClick={() => fetchFiles(currentPath)} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Refresh">
              <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button onClick={() => setShowNewFolder(true)} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="New Directory">
              <FolderPlus size={18} />
            </button>
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="flex items-center space-x-2 px-6 py-3 icon-grad-blue hover:opacity-90 text-white font-black text-xs rounded-[20px] transition-all shadow-xl shadow-blue-600/20 active:scale-95 border border-blue-400/20 uppercase tracking-widest"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">Upload</span>
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
        <div className="p-4 bg-white border border-blue-500/20 rounded-[24px] flex items-center space-x-4 animate-in zoom-in-95 duration-200 shadow-2xl premium-card">
           <div className="p-2 icon-grad-blue rounded-xl text-white">
             <Folder size={18} />
           </div>
           <input 
              autoFocus
              className="flex-1 bg-transparent border-none text-slate-900 outline-none text-sm placeholder:text-slate-400 font-bold tracking-tight"
              placeholder="System will initialize folder name..."
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
                className="p-2.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-emerald-500/20"
              >
                {actionLoading === 'mkdir' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              </button>
              <button 
                onClick={() => setShowNewFolder(false)}
                className="p-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
           </div>
        </div>
      )}

      {/* Main File Table */}
      <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden flex flex-col shadow-xl">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 z-10 border-b border-slate-200">
                <th className="px-8 py-5">Name</th>
                <th className="px-8 py-5 w-32 text-right">Size</th>
                <th className="px-8 py-5 w-40 text-right">Permissions</th>
                <th className="px-8 py-5 w-40 text-right">Modified</th>
                <th className="px-8 py-5 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center">
                      <Loader2 size={48} className="text-blue-500 animate-spin mb-6 opacity-30" />
                      <span className="uppercase tracking-widest font-black text-slate-300 text-[10px]">Scanning File Clusters...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                     <div className="p-6 bg-slate-50 rounded-full w-fit mx-auto mb-4 border border-slate-100">
                       <Folder size={48} className="text-slate-200" />
                     </div>
                     <span className="uppercase tracking-widest font-black text-slate-300 text-[10px]">Directory contains no active buffers</span>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => (
                  <tr 
                    key={file.path}
                    className="group hover:bg-slate-50/80 transition-all cursor-pointer relative premium-card"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="transition-all duration-300 group-hover:scale-110">
                          {getFileIcon(file.name, file.isDirectory)}
                        </div>
                        {renamingFile === file.path ? (
                          <div className="flex-1 flex items-center space-x-2 animate-in slide-in-from-left-2 duration-300">
                             <input 
                                autoFocus
                                className="bg-white border-2 border-blue-500/50 rounded-xl px-4 py-2 text-xs text-slate-900 outline-none font-bold shadow-lg"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRename(file.path);
                                  if (e.key === 'Escape') setRenamingFile(null);
                                }}
                             />
                             <button onClick={() => handleRename(file.path)} className="text-emerald-500 p-2 bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"><Check size={20} /></button>
                             <button onClick={() => setRenamingFile(null)} className="text-red-500 p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><X size={20} /></button>
                          </div>
                        ) : (
                          <span 
                            onClick={() => file.isDirectory && navigateTo(file.path)}
                            className={`text-[13px] font-bold truncate max-w-[300px] xl:max-w-md tracking-tight ${file.isDirectory ? 'text-slate-900 group-hover:text-blue-600' : 'text-slate-600'} transition-colors`}
                          >
                            {file.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-400 font-bold">
                      {file.isDirectory ? '—' : formatBytes(file.size)}
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-400 tracking-widest opacity-60">
                      {file.permissions || '—'}
                    </td>
                    <td className="px-8 py-5 text-right text-[10px] text-slate-500 font-black tracking-tight uppercase">
                      {timeAgo(file.modifiedAt)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        {!file.isDirectory && (
                          <button onClick={() => handleDownload(file.path, file.name)} className="p-2.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm" title="Download">
                            <Download size={16} />
                          </button>
                        )}
                        <button onClick={() => { setRenamingFile(file.path); setRenameValue(file.name); }} className="p-2.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm" title="Rename">
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(file.path, file.name)} 
                          className="p-2.5 bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white transition-all rounded-xl shadow-sm" 
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
        
        {/* Modern Footer Status Bar */}
        <div className="px-10 py-4 bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
           <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                 <span className="text-slate-900">{filteredFiles.length}</span>
                 <span>Buffers Detected</span>
              </div>
              <span className="h-1 w-1 bg-slate-300 rounded-full" />
              <div className="flex items-center space-x-2">
                 <span className="text-slate-900">{files.filter(f => f.isDirectory).length}</span>
                 <span>Clusters</span>
              </div>
           </div>
           <div className="flex items-center space-x-3 group cursor-help">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="font-mono text-blue-600/80 transition-all group-hover:text-blue-600">{currentPath}</span>
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
