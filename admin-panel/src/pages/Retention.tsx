import React, { useState, useEffect } from 'react';
import { Target, Users } from 'lucide-react';
import { api } from '../services/api';

const Retention = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRetention();
  }, []);

  const fetchRetention = async () => {
    try {
      const res = await api.get('/admin/analytics/retention');
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Loading Retention Lab...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
        <Target className="mr-3 text-purple-500" /> User Retention Lab
      </h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2">Day 1 Retention</div>
          <div className="text-4xl font-bold text-white">{data?.D1}%</div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2">Day 7 Retention</div>
          <div className="text-4xl font-bold text-blue-400">{data?.D7}%</div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#333]">
          <div className="text-gray-400 mb-2">Day 30 Retention</div>
          <div className="text-4xl font-bold text-purple-400">{data?.D30}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-[#333] pb-2">By Country</h3>
          <div className="space-y-4">
            {Object.entries(data?.byCountry || {}).map(([country, rate]: any) => (
              <div key={country}>
                <div className="flex justify-between text-sm text-gray-300 mb-1">
                  <span>{country}</span>
                  <span className="font-bold">{rate}%</span>
                </div>
                <div className="w-full bg-[#333] rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${rate}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl border border-[#333] p-6">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-[#333] pb-2">By Acquisition Source</h3>
          <div className="space-y-4">
            {Object.entries(data?.bySource || {}).map(([source, rate]: any) => (
              <div key={source}>
                <div className="flex justify-between text-sm text-gray-300 mb-1">
                  <span>{source}</span>
                  <span className="font-bold">{rate}%</span>
                </div>
                <div className="w-full bg-[#333] rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${rate}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Retention;
