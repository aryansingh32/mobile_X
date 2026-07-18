import React, { useState, useEffect } from 'react';
import { FlaskConical, Plus, Activity, X, Check } from 'lucide-react';
import { api, createABTest } from '../services/api';

const ABTesting = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    variants: ['A', 'B']
  });

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const { data } = await api.get('/admin/ab-tests');
      setTests(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      variants: ['A', 'B']
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedVariants = formData.variants.map(variant => variant.trim()).filter(Boolean);
      if (parsedVariants.length < 2 || new Set(parsedVariants).size !== parsedVariants.length) {
        alert('Add at least two unique variants.');
        return;
      }

      await createABTest({
        name: formData.name,
        description: formData.description,
        variants: parsedVariants,
        isActive: true
      });
      setIsModalOpen(false);
      fetchTests();
    } catch (err) {
      console.error('Failed to create A/B test', err);
      alert('Failed to create A/B test');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading A/B Tests...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <FlaskConical className="mr-3 text-cyan-400" /> A/B Testing System
        </h1>
        <button 
          onClick={handleCreate}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
        >
          <Plus size={20} className="mr-2" /> Create Experiment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tests.length > 0 ? tests.map((test) => {
          let variants = [];
          try {
            variants = JSON.parse(test.variants || '[]');
            if (!Array.isArray(variants)) variants = [];
          } catch(e) {
            variants = [];
          }

          return (
            <div key={test.id} className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{test.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{test.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${test.isActive ? 'bg-green-900/30 text-green-400 border border-green-500/50' : 'bg-gray-800 text-gray-500'}`}>
                  {test.isActive ? 'ACTIVE RUNNING' : 'CONCLUDED'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                {variants.map((v: string, idx: number) => (
                  <div key={idx} className={`p-4 rounded-lg border ${idx === 0 ? 'bg-blue-900/10 border-blue-900/50' : 'bg-purple-900/10 border-purple-900/50'}`}>
                    <div className="text-gray-300 font-bold mb-2">Variant {String.fromCharCode(65 + idx)}</div>
                    <div className="text-white font-mono bg-black/30 p-2 rounded text-sm mb-4">
                      {typeof v === 'object' ? JSON.stringify(v) : v}
                    </div>
                    <div className="flex justify-between text-xs">
                      <div className="text-gray-400">Allocated Users:</div>
                      <div className="font-bold text-white">{Math.floor((test._count?.allocations || 0) / (variants.length || 1))}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-[#333] flex justify-end">
                <button className="text-cyan-400 hover:text-cyan-300 flex items-center text-sm font-bold">
                  <Activity size={16} className="mr-1"/> View Full Analytics Report (WIP)
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="bg-[#1A1A1A] border border-[#333] rounded-xl p-12 flex flex-col items-center justify-center text-gray-500">
            <FlaskConical size={48} className="mb-4 opacity-20" />
            <p className="text-lg">No A/B tests currently running.</p>
            <p className="text-sm mt-2">Used by Google, Meta, Netflix to optimize revenue without app updates.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-xl border border-[#333] w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">Create A/B Test</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Experiment Name *</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. signup_flow_v2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Variants *</label>
                  <div className="space-y-2">
                    {formData.variants.map((variant, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          required
                          aria-label={`Variant ${index + 1}`}
                          className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                          value={variant}
                          onChange={e => setFormData({ ...formData, variants: formData.variants.map((item, itemIndex) => itemIndex === index ? e.target.value : item) })}
                        />
                        {formData.variants.length > 2 && <button type="button" onClick={() => setFormData({ ...formData, variants: formData.variants.filter((_, itemIndex) => itemIndex !== index) })} className="text-red-400 hover:text-red-300 px-2" aria-label={`Remove variant ${index + 1}`}><X size={18} /></button>}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setFormData({ ...formData, variants: [...formData.variants, `Variant ${formData.variants.length + 1}`] })} className="mt-2 text-cyan-400 hover:text-cyan-300 text-sm flex items-center"><Plus size={15} className="mr-1" /> Add variant</button>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button 
                  type="button" 
                  className="px-4 py-2 text-gray-400 hover:text-white"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded flex items-center"
                >
                  <Check size={16} className="mr-2" /> Start Experiment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ABTesting;
