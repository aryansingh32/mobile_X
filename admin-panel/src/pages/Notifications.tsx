import React, { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { sendNotification } from '../services/api';

const Notifications = () => {
  const [target, setTarget] = useState('ALL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSending(true);
      await sendNotification({ target, title, body });
      alert('Notification campaign queued successfully!');
      setTitle('');
      setBody('');
    } catch (err) {
      console.error(err);
      alert('Failed to send notifications');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Bell className="mr-3 text-yellow-500" /> Notification Warfare Center
      </h1>

      <div className="flex gap-6">
        <div className="w-1/2 bg-[#1A1A1A] rounded-xl border border-[#333] p-6">
          <form onSubmit={handleSend}>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-400 mb-2">Target Audience Cohort</label>
              <select 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-[#222] border border-[#333] text-white p-3 rounded-lg focus:outline-none focus:border-yellow-500"
              >
                <option value="ALL">All Users</option>
                <option value="INACTIVE_3_DAYS">Inactive &gt; 3 Days</option>
                <option value="INACTIVE_7_DAYS">Inactive &gt; 7 Days</option>
                <option value="LEVEL_5_PLUS">Level 5+ Users</option>
                <option value="HIGH_BALANCE">Balance &gt; 50,000 Coins</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-400 mb-2">Notification Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Your 9-day streak is about to break!"
                className="w-full bg-[#222] border border-[#333] text-white p-3 rounded-lg focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-400 mb-2">Notification Body</label>
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                placeholder="Open the app now to claim your 50 bonus coins."
                className="w-full bg-[#222] border border-[#333] text-white p-3 rounded-lg h-32 resize-none focus:outline-none focus:border-yellow-500"
              />
            </div>

            <button 
              type="submit"
              disabled={sending}
              className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors"
            >
              <Send size={18} className="mr-2" /> {sending ? 'Deploying...' : 'Deploy Push Notification'}
            </button>
          </form>
        </div>

        <div className="w-1/2">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6 h-full flex flex-col justify-center items-center">
            <div className="w-[300px] h-[600px] border-[8px] border-[#333] rounded-[40px] bg-black relative overflow-hidden">
              {/* Phone notch */}
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                <div className="w-32 h-6 bg-[#333] rounded-b-xl"></div>
              </div>

              {/* Notification preview */}
              {(title || body) ? (
                <div className="absolute top-16 left-4 right-4 bg-[#2A2A2A] rounded-2xl p-4 shadow-xl border border-white/10">
                  <div className="flex items-center mb-2">
                    <div className="w-5 h-5 bg-[var(--accent)] rounded mr-2"></div>
                    <span className="text-gray-400 text-xs">ReelFlow • now</span>
                  </div>
                  <div className="text-white font-bold text-sm mb-1">{title || 'Notification Title'}</div>
                  <div className="text-gray-300 text-sm line-clamp-2">{body || 'Notification body text will appear here...'}</div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 px-8 text-center">
                  Type a title and body to see preview
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
