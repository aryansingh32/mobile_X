import React, { useState, useEffect } from 'react';
import { Filter, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { api, getCategories, getRssSources, updateCategory, updateRssSource } from '../services/api';

const DiscoverFiltersPage = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'sources'>('categories');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsRes, srcsRes] = await Promise.all([
        getCategories(),
        getRssSources()
      ]);
      setCategories((catsRes.data.data || []).filter((c: any) => c.isDiscoverFilter).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)));
      setSources((srcsRes.data.data || []).filter((s: any) => s.isDiscoverFilter).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const list = activeTab === 'categories' ? [...categories] : [...sources];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Update sort orders
    const updatedList = list.map((item, idx) => ({ ...item, sortOrder: idx }));

    if (activeTab === 'categories') setCategories(updatedList);
    else setSources(updatedList);

    // Save to backend
    try {
      const updateFn = activeTab === 'categories' ? updateCategory : updateRssSource;
      await Promise.all([
        updateFn(list[index].id, { sortOrder: list[index].sortOrder }),
        updateFn(list[targetIndex].id, { sortOrder: list[targetIndex].sortOrder })
      ]);
    } catch (err) {
      console.error('Failed to update sort order', err);
      fetchData(); // Revert on failure
    }
  };

  return (
    <div className="p-6 relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Filter className="mr-3 text-purple-400" /> Discover Filters
        </h1>
        <div className="text-sm text-gray-400 flex items-center">
          <Settings size={14} className="mr-2" /> Note: To add/remove filters, edit them in Categories or RSS Sources.
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded font-medium ${activeTab === 'categories' ? 'bg-purple-600 text-white' : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories ({categories.length})
        </button>
        <button
          className={`px-4 py-2 rounded font-medium ${activeTab === 'sources' ? 'bg-purple-600 text-white' : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'}`}
          onClick={() => setActiveTab('sources')}
        >
          Sources ({sources.length})
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-[#333] flex-1 p-4">
        {loading ? (
          <div className="text-gray-400">Loading filters...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {(activeTab === 'categories' ? categories : sources).length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed border-[#333] rounded">
                No discover filters configured. Go to the {activeTab} page and check "Is Discover Filter" on an item.
              </div>
            ) : null}
            
            {(activeTab === 'categories' ? categories : sources).map((item, index, arr) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-[#222] rounded-lg border border-[#333]">
                <div className="flex items-center gap-4">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover bg-[#111]" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center text-lg">
                      {item.icon || '📰'}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-gray-400">Sort Order: {item.sortOrder}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button 
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className={`p-1 rounded ${index === 0 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
                  >
                    <ArrowUp size={18} />
                  </button>
                  <button 
                    disabled={index === arr.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className={`p-1 rounded ${index === arr.length - 1 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
                  >
                    <ArrowDown size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverFiltersPage;
