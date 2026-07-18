import React, { useState, useEffect } from 'react';
import { FileCode, Save, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

const EnvConfig = () => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEnv();
  }, []);

  const fetchEnv = async () => {
    try {
      const { data } = await api.get('/admin/env');
      setContent(data.data);
      setOriginalContent(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateEnv = () => {
    const invalidLine = content.split('\n').find((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#') && !/^[A-Za-z_][A-Za-z0-9_]*=.*$/.test(trimmed);
    });
    return invalidLine ? `Invalid .env syntax near: ${invalidLine.slice(0, 80)}` : '';
  };

  const handleSave = async () => {
    const validationError = validateEnv();
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (confirmation !== 'OVERWRITE') {
      setMessage('Type OVERWRITE to confirm this destructive change.');
      return;
    }
    
    try {
      setMessage('');
      setSaving(true);
      const { data } = await api.post('/admin/env', { content });
      setOriginalContent(content);
      setConfirmation('');
      setMessage(`Saved. Backup created: ${data.backup || 'not available'}. Restart backend for restart-only env changes.`);
    } catch (err: any) {
      console.error(err);
      setMessage(err.response?.data?.error || 'Failed to save .env file');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Environment Configuration...</div>;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <FileCode className="mr-3 text-red-500" /> Environment Manager
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || content === originalContent}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg flex items-center transition-colors font-bold"
        >
          <Save size={20} className="mr-2" /> {saving ? 'Saving...' : 'OVERWRITE .ENV'}
        </button>
      </div>

      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-start">
        <AlertTriangle className="text-red-500 mr-3 mt-1 flex-shrink-0" />
        <div>
          <h3 className="text-red-400 font-bold mb-1">DANGER ZONE</h3>
          <p className="text-red-300/80 text-sm">
            You are directly editing the production <code className="bg-black/30 px-1 rounded">.env</code> file. 
            The backend validates basic KEY=value syntax and creates a timestamped backup before overwrite.
            Secrets are still visible here; restrict this page to operators who are allowed to access production credentials.
          </p>
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="block text-sm font-bold text-gray-400 mb-2">Type OVERWRITE to enable saving</label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full bg-[#222] border border-[#333] text-white p-3 rounded-lg focus:outline-none focus:border-red-500"
            placeholder="OVERWRITE"
          />
          {message && <p className="mt-2 text-sm text-yellow-300">{message}</p>}
        </div>
        <div className="text-sm text-gray-400">
          Changed lines: {Math.abs(content.split('\n').length - originalContent.split('\n').length)}
        </div>
      </div>

      <div className="flex-1 bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333] flex flex-col">
        <div className="bg-[#2A2A2A] px-4 py-2 border-b border-[#333] flex items-center">
          <span className="text-gray-400 text-sm font-mono">mobile_X/backend/.env</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 w-full bg-[#1A1A1A] text-green-400 font-mono p-4 resize-none focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default EnvConfig;
