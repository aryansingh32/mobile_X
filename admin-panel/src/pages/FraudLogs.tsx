import React, { useEffect, useState } from 'react';
import { getFraudLogs, resolveFraud, banUser } from '../services/api';

const FraudLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = () => {
    getFraudLogs().then(res => setLogs(res.data.data)).catch(console.error);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResolve = async (logId: number) => {
    try {
      await resolveFraud(logId);
      fetchLogs();
    } catch (err) {
      console.error(err);
      alert('Failed to resolve log');
    }
  };

  const handleBan = async (userId: number, logId: number) => {
    if (!window.confirm(`Are you sure you want to ban user ${userId}?`)) return;
    try {
      await banUser(userId);
      await resolveFraud(logId);
      fetchLogs();
    } catch (err) {
      console.error(err);
      alert('Failed to ban user');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Fraud Detection System</h1>
        <p className="page-subtitle">Monitor suspicious activity and auto-tappers</p>
      </div>
      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User ID</th>
              <th>Reason</th>
              <th>Severity</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>User #{log.userId}</td>
                <td>{log.reason}</td>
                <td>
                  <span className={`badge ${log.severity?.toLowerCase() || 'low'}`}>{log.severity}</span>
                </td>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>
                  <span className={`badge ${log.resolved ? 'success' : 'warning'}`}>
                    {log.resolved ? 'Resolved' : 'Pending'}
                  </span>
                </td>
                <td>
                  {!log.resolved && (
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleResolve(log.id)}
                        className="btn-primary" 
                        style={{backgroundColor: 'var(--success)'}}
                      >
                        Resolve
                      </button>
                      <button 
                        onClick={() => handleBan(log.userId, log.id)}
                        className="btn-danger"
                      >
                        Ban User
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={7} style={{textAlign: 'center'}}>No fraud logs detected.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FraudLogs;
