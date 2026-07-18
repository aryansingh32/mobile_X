import React from 'react';

const Monitoring = () => {
  const grafanaUrl = import.meta.env.VITE_GRAFANA_URL;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Network & Performance Monitoring</h1>
        <p className="page-subtitle">Real-time metrics provided by Grafana and Prometheus</p>
      </div>
      <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
        {grafanaUrl ? <iframe 
          src={grafanaUrl}
          width="100%" 
          height="100%" 
          frameBorder="0"
          style={{ display: 'block', border: 'none' }}
          title="Grafana Dashboard"
        ></iframe> : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', padding: 32, textAlign: 'center' }}>
            Monitoring is not configured. Set <code>VITE_GRAFANA_URL</code> in the admin panel environment.
          </div>
        )}
      </div>
    </div>
  );
};

export default Monitoring;
