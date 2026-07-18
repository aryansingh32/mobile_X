import React, { useState, useEffect } from 'react';
import { getScreenSections, updateScreenSections } from '../services/api';
import { Layout, Save, ChevronUp, ChevronDown, Monitor, RefreshCw } from 'lucide-react';

interface ScreenSection {
  sectionKey: string;
  enabled: boolean;
  sortOrder: number;
  layoutVariant: string;
}

const SCREENS = ['HOME', 'EARN', 'WALLET'];

const ScreenLayout: React.FC = () => {
  const [sections, setSections] = useState<Record<string, ScreenSection[]>>({});
  const [activeScreen, setActiveScreen] = useState('HOME');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSections = async () => {
    try {
      const results: Record<string, ScreenSection[]> = {};
      for (const screen of SCREENS) {
        const { data } = await getScreenSections(screen);
        results[screen] = data.data || [];
      }
      setSections(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateScreenSections(activeScreen, sections[activeScreen]);
      alert('Layout saved successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to save layout');
    }
    setSaving(false);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const list = [...sections[activeScreen]];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    
    // Update sortOrders
    list.forEach((item, idx) => {
      item.sortOrder = idx;
    });

    setSections({ ...sections, [activeScreen]: list });
  };

  const toggleEnabled = (index: number) => {
    const list = [...sections[activeScreen]];
    list[index].enabled = !list[index].enabled;
    setSections({ ...sections, [activeScreen]: list });
  };

  if (loading) return <div className="p-6 text-gray-400">Loading screen layouts…</div>;

  const currentList = sections[activeScreen] || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layout className="text-pink-400" size={28} /> Screen Layout Manager
          </h1>
          <p className="text-gray-400 text-sm mt-1">Reorder, enable, or disable UI sections per screen dynamically.</p>
        </div>
        <button onClick={fetchSections} className="flex items-center gap-2 px-4 py-2 bg-[#252525] border border-[#333] text-white rounded-lg hover:bg-[#333] transition-colors">
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 shrink-0 flex flex-col gap-2">
          {SCREENS.map(screen => (
            <button
              key={screen}
              onClick={() => setActiveScreen(screen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-colors ${
                activeScreen === screen 
                  ? 'bg-pink-500 text-black shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                  : 'bg-[#161616] text-gray-400 hover:text-white hover:bg-[#1A1A1A] border border-[#333]'
              }`}
            >
              <Monitor size={16} /> {screen}
            </button>
          ))}
        </div>

        {/* Layout Editor */}
        <div className="flex-1 bg-[#161616] border border-[#333] rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">{activeScreen} Layout Order</h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-black font-bold rounded-lg hover:bg-pink-400 disabled:opacity-50 transition-colors"
            >
              <Save size={18} /> {saving ? 'Saving…' : 'Save Layout'}
            </button>
          </div>

          <div className="space-y-3">
            {currentList.map((section, idx) => (
              <div 
                key={section.sectionKey} 
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  section.enabled 
                    ? 'bg-[#1A1A1A] border-[#444]' 
                    : 'bg-[#111] border-[#222] opacity-50'
                }`}
              >
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="text-gray-500 hover:text-white disabled:opacity-30"><ChevronUp size={20}/></button>
                  <button onClick={() => moveItem(idx, 'down')} disabled={idx === currentList.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30"><ChevronDown size={20}/></button>
                </div>

                <div className="flex-1">
                  <code className="text-pink-300 font-mono text-lg">{section.sectionKey}</code>
                  <div className="text-xs text-gray-500 mt-1">Order: {idx}</div>
                </div>

                {/* Enable Toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={section.enabled}
                    onChange={() => toggleEnabled(idx)}
                    className="accent-pink-500 w-5 h-5"
                  />
                  {section.enabled ? 'Visible' : 'Hidden'}
                </label>
              </div>
            ))}
            {currentList.length === 0 && (
              <p className="text-gray-500 text-center py-8">No sections defined for this screen.</p>
            )}
          </div>
          
          {/* Visual Phone Mockup */}
          <div className="mt-8 border-t border-[#333] pt-8">
            <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase">Live Preview (Structural)</h3>
            <div className="w-[300px] mx-auto bg-black border-[8px] border-[#333] rounded-[40px] h-[600px] flex flex-col p-4 gap-3 overflow-hidden shadow-2xl">
               <div className="w-1/2 h-6 bg-[#333] rounded-b-xl mx-auto -mt-4 mb-2"></div>
               {currentList.filter(s => s.enabled).map(s => (
                 <div key={`preview-${s.sectionKey}`} className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl min-h-[60px] flex items-center justify-center p-2">
                   <span className="text-xs font-mono text-gray-500">{s.sectionKey}</span>
                 </div>
               ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ScreenLayout;
