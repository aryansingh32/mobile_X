import React, { useEffect, useState } from 'react';
import { getSystemLogs } from '../services/api';

const Logs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
    if (paused) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [paused]);

  const fetchLogs = () => {
    getSystemLogs().then(res => setLogs(res.data.data)).catch(console.error);
  };
  const filteredLogs = logs.filter(log =>
    (level === 'ALL' || String(log.level).toUpperCase() === level) &&
    (!search || String(log.message).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">System Logs (Winston)</h1>
        <p className="page-subtitle">Live backend error and request logs</p>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search log messages" className="bg-[#1A1A1A] border border-[#333] rounded px-3 py-2 text-white flex-1" aria-label="Search log messages" />
        <select value={level} onChange={e => setLevel(e.target.value)} className="bg-[#1A1A1A] border border-[#333] rounded px-3 py-2 text-white" aria-label="Filter log level">
          <option value="ALL">All levels</option><option value="ERROR">Error</option><option value="WARN">Warn</option><option value="INFO">Info</option>
        </select>
        <button onClick={() => setPaused(value => !value)} className="bg-[#222] hover:bg-[#333] border border-[#444] rounded px-4 text-white">{paused ? 'Resume' : 'Pause'}</button>
      </div>
      <div className="terminal-container">
        {filteredLogs.map((log, index) => (
          <div key={index} className={`log-line ${log.level === 'error' ? 'log-error' : 'log-info'}`}>
            <span className="log-timestamp">[{log.timestamp}]</span>
            <span className="log-level">[{log.level?.toUpperCase() || 'INFO'}]</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && <div style={{ color: '#aaa' }}>No matching logs.</div>}
      </div>
    </div>
  );
};

export default Logs;
