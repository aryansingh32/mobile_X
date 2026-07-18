import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle } from 'lucide-react';
import { getSuggestions, updateSuggestionStatus } from '../services/api';

const SuggestionsPage = () => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const { data } = await getSuggestions();
      setSuggestions(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateSuggestionStatus(Number(id), newStatus);
      setSuggestions(suggestions.map(s => s.id === id ? { ...s, status: newStatus } : s));
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading suggestions...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <MessageSquare className="mr-3 text-blue-400" /> User Suggestions & Feedback
      </h1>

      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333]">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#2A2A2A] text-gray-400">
            <tr>
              <th className="px-6 py-4 font-semibold">User ID</th>
              <th className="px-6 py-4 font-semibold">Feedback</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {suggestions.map((suggestion) => (
              <tr key={suggestion.id} className="hover:bg-[#222] transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{suggestion.userId}</td>
                <td className="px-6 py-4 max-w-xl" title={suggestion.message}>
                  {suggestion.message}
                </td>
                <td className="px-6 py-4">{new Date(suggestion.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${suggestion.status === 'REVIEWED' ? 'bg-gray-800 text-gray-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {suggestion.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-3">
                    {suggestion.status === 'PENDING' && (
                      <button onClick={() => handleStatusUpdate(suggestion.id, 'REVIEWED')} className="text-green-400 hover:text-green-300" title="Mark as Reviewed">
                        <CheckCircle size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuggestionsPage;
