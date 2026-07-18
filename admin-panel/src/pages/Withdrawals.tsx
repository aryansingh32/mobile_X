import React, { useEffect, useState } from 'react';
import { getWithdrawals, processWithdrawal } from '../services/api';

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [voucherCodes, setVoucherCodes] = useState<Record<number, string>>({});
  const [trackingIds, setTrackingIds] = useState<Record<number, string>>({});
  const [trackingStatuses, setTrackingStatuses] = useState<Record<number, string>>({});
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, id: number, status: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    getWithdrawals().then(res => setWithdrawals(res.data.data)).catch(console.error);
  };

  const handleProcess = async (id: number, status: string) => {
    setConfirmModal({ isOpen: true, id, status });
  };

  const confirmProcess = async () => {
    if (!confirmModal) return;
    const { id, status } = confirmModal;
    setConfirmModal(null);
    try {
      await processWithdrawal(id, status, {
        voucherCode: voucherCodes[id],
        trackingId: trackingIds[id],
        trackingStatus: trackingStatuses[id] || (status === 'SHIPPED' ? 'SHIPPED' : status === 'DELIVERED' ? 'DELIVERED' : undefined),
      });
      fetchData();
    } catch(e) {
      console.error(e);
      alert('Error processing withdrawal');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Withdrawal Requests</h1>
        <p className="page-subtitle">Review and process user payouts</p>
      </div>
      <div className="card table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Reward</th>
              <th>Details</th>
              <th>Status</th>
              <th>Requested At</th>
              <th>Fulfillment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map(w => (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td>{w.user?.name} (#{w.userId})</td>
                <td>
                   <div><strong>{w.catalogItem?.name || w.payoutMethod}</strong></div>
                   <div>{w.amountCoins} Coins / ₹{w.amountInr}</div>
                </td>
                <td className="font-mono text-sm" style={{maxWidth: '250px'}}>
                  {w.catalogItem?.type === 'PHYSICAL' ? (
                     <div>
                       {w.size && <div>Size: {w.size}</div>}
                       {w.color && <div>Color: {w.color}</div>}
                       {w.mobileNumber && <div>Phone: {w.mobileNumber}</div>}
                       {w.deliveryAddress && <div>Address: {w.deliveryAddress}</div>}
                     </div>
                  ) : (
                     <div>{w.destinationId || 'Missing'}</div>
                  )}
                </td>
                <td>
                  <span className={`badge ${w.status === 'APPROVED' || w.status === 'SHIPPED' || w.status === 'DELIVERED' ? 'low' : w.status === 'REJECTED' ? 'high' : 'medium'}`}>
                    {w.status}
                  </span>
                </td>
                <td>{new Date(w.requestedAt).toLocaleString()}</td>
                <td>
                  {w.catalogItem?.type === 'VOUCHER' && w.status === 'PENDING' && !w.catalogCode && (
                    <input type="text" placeholder="Enter Voucher Code" value={voucherCodes[w.id] || ''} onChange={e => setVoucherCodes({...voucherCodes, [w.id]: e.target.value})} className="form-input" style={{width: '150px'}} />
                  )}
                  {w.catalogItem?.type === 'VOUCHER' && w.catalogCode && (
                    <div style={{color: 'var(--success)'}}><strong>{w.catalogCode.code}</strong></div>
                  )}
                  {w.catalogItem?.type === 'PHYSICAL' && w.status === 'APPROVED' && (
                    <input type="text" placeholder="Tracking ID" value={trackingIds[w.id] || ''} onChange={e => setTrackingIds({...trackingIds, [w.id]: e.target.value})} className="form-input" style={{width: '150px'}} />
                  )}
                  {w.catalogItem?.type === 'PHYSICAL' && (w.status === 'SHIPPED' || w.status === 'DELIVERED') && (
                    <div style={{color: 'var(--success)'}}>Track: {w.trackingId || 'N/A'}</div>
                  )}
                </td>
                <td>
                  {w.status === 'PENDING' && (
                    <div className="action-buttons">
                      <button className="btn-primary" style={{backgroundColor: 'var(--success)'}} onClick={() => handleProcess(w.id, 'APPROVED')}>Approve</button>
                      <button className="btn-danger" onClick={() => handleProcess(w.id, 'REJECTED')}>Reject</button>
                    </div>
                  )}
                  {w.status === 'APPROVED' && w.catalogItem?.type === 'PHYSICAL' && (
                    <div className="action-buttons">
                      <button className="btn-primary" style={{backgroundColor: 'var(--info)'}} onClick={() => handleProcess(w.id, 'SHIPPED')}>Mark Shipped</button>
                    </div>
                  )}
                  {w.status === 'SHIPPED' && w.catalogItem?.type === 'PHYSICAL' && (
                    <div className="action-buttons">
                      <button className="btn-primary" style={{backgroundColor: 'var(--success)'}} onClick={() => handleProcess(w.id, 'DELIVERED')}>Mark Delivered</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && <tr><td colSpan={8} style={{textAlign: 'center'}}>No withdrawals yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmModal?.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#1E1E1E', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#FFF' }}>Confirm Action</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px' }}>
              Are you sure you want to <strong>{confirmModal.status === 'APPROVED' ? 'Approve' : confirmModal.status === 'SHIPPED' ? 'Mark as Shipped' : confirmModal.status === 'DELIVERED' ? 'Mark as Delivered' : 'Reject'}</strong> withdrawal #{confirmModal.id}?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn-primary" style={{ backgroundColor: confirmModal.status === 'REJECTED' ? 'var(--danger)' : 'var(--success)' }} onClick={confirmProcess}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdrawals;
