import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, Copy, Check, Send, RotateCcw, Shield, 
  Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [txn, setTxn] = useState(null);
  const [verifyData, setVerifyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [proofPhone, setProofPhone] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchTransaction();
  }, [id]);

  const fetchTransaction = async () => {
    try {
      const [txnRes, verifyRes] = await Promise.all([
        axios.get(`${API_URL}/transactions/${id}`),
        axios.get(`${API_URL}/verify/${id}`).catch(() => null)
      ]);
      setTxn(txnRes.data);
      if (verifyRes) setVerifyData(verifyRes.data);
    } catch (err) {
      console.error('Failed to fetch transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendProof = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/proof/generate`, {
        transaction_id: txn.id,
        customer_phone: proofPhone || txn.customer_phone
      });
      setShowProofModal(false);
      alert('Proof sent successfully!');
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/refund`, {
        transaction_id: txn.id,
        reason: refundReason
      });
      setShowRefundModal(false);
      fetchTransaction();
      alert('Refund processed!');
    } catch (err) {
      alert('Refund failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'captured': return <CheckCircle className="w-6 h-6 text-brand-400" />;
      case 'pending': return <Clock className="w-6 h-6 text-amber-400" />;
      case 'failed': return <XCircle className="w-6 h-6 text-red-400" />;
      case 'refunded': return <RotateCcw className="w-6 h-6 text-blue-400" />;
      default: return <Clock className="w-6 h-6 text-amber-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'captured': return 'text-brand-400';
      case 'pending': return 'text-amber-400';
      case 'failed': return 'text-red-400';
      case 'refunded': return 'text-blue-400';
      default: return 'text-amber-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-slate-600" />
        <p className="text-slate-400">Transaction not found</p>
        <button onClick={() => navigate('/')} className="mt-4 btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/v/${txn.utr}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Main Card */}
      <div className="glass-panel p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            {getStatusIcon(txn.status)}
            <div>
              <p className={`text-lg font-semibold capitalize ${getStatusColor(txn.status)}`}>
                {txn.status}
              </p>
              <p className="text-sm text-slate-500">{txn.utr}</p>
            </div>
          </div>
          <p className="text-3xl font-bold">₹{txn.amount.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Payment ID</p>
              <p className="font-mono text-sm">{txn.razorpay_payment_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Order ID</p>
              <p className="font-mono text-sm">{txn.razorpay_order_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Created</p>
              <p className="text-sm">{new Date(txn.created_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Phone</p>
              <p className="text-sm">{txn.customer_phone || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm">{txn.description || 'UPI Payment'}</p>
            </div>
            {txn.refund_id && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Refund ID</p>
                <p className="font-mono text-sm text-blue-400">{txn.refund_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Proof Hash Verification */}
        {txn.proof_hash && (
          <div className="mt-6 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium text-brand-400">Proof Hash Verified</span>
            </div>
            <p className="font-mono text-xs text-slate-400 break-all">{txn.proof_hash}</p>
          </div>
        )}

        {/* Actions */}
        {txn.status === 'captured' && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setShowProofModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Proof
            </button>
            <button
              onClick={() => setShowRefundModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Refund
            </button>
          </div>
        )}
      </div>

      {/* QR Code Section */}
      {txn.status === 'captured' && (
        <div className="glass-panel p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Customer Verification QR</h3>
          <p className="text-sm text-slate-400 mb-6">Customer scans this to verify the payment</p>

          <div className="bg-white p-4 rounded-2xl inline-block mb-4">
            <QRCodeSVG 
              value={verifyUrl}
              size={220}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <code className="text-xs text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg">
              {verifyUrl}
            </code>
            <button
              onClick={() => copyToClipboard(verifyUrl)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-brand-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-1">Send Payment Proof</h3>
            <p className="text-sm text-slate-400 mb-6">Send verification link via SMS</p>
            <div className="space-y-4">
              <input
                type="tel"
                value={proofPhone}
                onChange={(e) => setProofPhone(e.target.value)}
                placeholder={txn.customer_phone || '+91 98765 43210'}
                className="input-field"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowProofModal(false)} className="flex-1 btn-secondary">Cancel</button>
                <button 
                  onClick={handleSendProof} 
                  disabled={actionLoading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-1">Process Refund</h3>
            <p className="text-sm text-slate-400 mb-6">Refund ₹{txn.amount.toLocaleString()}</p>
            <div className="space-y-4">
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund..."
                className="input-field min-h-[80px] resize-none"
                required
              />
              <div className="flex gap-3">
                <button onClick={() => setShowRefundModal(false)} className="flex-1 btn-secondary">Cancel</button>
                <button 
                  onClick={handleRefund} 
                  disabled={actionLoading || !refundReason.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><RotateCcw className="w-4 h-4" /> Confirm</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
