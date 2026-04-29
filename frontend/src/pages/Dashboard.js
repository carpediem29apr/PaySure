import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { 
  RefreshCw, Send, RotateCcw, TrendingUp, AlertTriangle, 
  CheckCircle, Clock, XCircle, ArrowRight, MessageSquare,
  Smartphone, Copy, Check
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function Dashboard() {
  const { merchant } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [proofPhone, setProofPhone] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txnsRes, insightsRes] = await Promise.all([
        axios.get(`${API_URL}/transactions?limit=20`),
        axios.get(`${API_URL}/insights/daily`)
      ]);
      setTransactions(txnsRes.data);
      setInsights(insightsRes.data.summary);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.status === filter);

  const stats = {
    total: transactions.length,
    captured: transactions.filter(t => t.status === 'captured').length,
    pending: transactions.filter(t => t.status === 'pending').length,
    refunded: transactions.filter(t => t.status === 'refunded').length,
    revenue: transactions
      .filter(t => t.status === 'captured')
      .reduce((sum, t) => sum + t.amount, 0)
  };

  const handleSendProof = async () => {
    if (!selectedTxn) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/proof/generate`, {
        transaction_id: selectedTxn.id,
        customer_phone: proofPhone || selectedTxn.customer_phone
      });
      setShowProofModal(false);
      setProofPhone('');
      alert('Proof sent successfully!');
    } catch (err) {
      alert('Failed to send proof: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedTxn) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/refund`, {
        transaction_id: selectedTxn.id,
        reason: refundReason
      });
      setShowRefundModal(false);
      setRefundReason('');
      fetchData();
      alert('Refund processed successfully!');
    } catch (err) {
      alert('Refund failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const createPayment = async () => {
    const amountStr = window.prompt("Enter amount to charge (in ₹):", "100");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(`${API_URL}/payments/create-order`, {
        amount: amount,
        customer_phone: '+919876543210'
      });
      
      const resLoaded = await loadRazorpay();
      if (!resLoaded) {
        alert('Razorpay SDK failed to load');
        setActionLoading(false);
        return;
      }

      const options = {
        key: res.data.key_id,
        amount: res.data.transaction.amount * 100,
        currency: 'INR',
        name: merchant?.business_name || 'paysure',
        description: 'Payment for order',
        order_id: res.data.razorpay_order_id,
        handler: function (response) {
          alert(`Payment successful! ID: ${response.razorpay_payment_id}`);
          fetchData();
        },
        prefill: {
          name: 'Customer Name',
          email: 'customer@example.com',
          contact: '+919876543210'
        },
        theme: {
          color: '#3b82f6'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (err) {
      alert('Payment creation failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'captured': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'refunded': return <RotateCcw className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'captured': return 'status-captured';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      case 'refunded': return 'status-refunded';
      default: return 'status-pending';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back, {merchant?.business_name}</p>
        </div>
        <button onClick={createPayment} disabled={actionLoading} className="btn-primary flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          {actionLoading ? 'Processing...' : 'Create Payment'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-slate-400 text-sm">Revenue</span>
          </div>
          <p className="text-2xl font-bold">₹{stats.revenue.toLocaleString()}</p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-brand-400" />
            </div>
            <span className="text-slate-400 text-sm">Successful</span>
          </div>
          <p className="text-2xl font-bold">{stats.captured}</p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold">{stats.pending}</p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-slate-400 text-sm">Refunded</span>
          </div>
          <p className="text-2xl font-bold">{stats.refunded}</p>
        </div>
      </div>

      {/* AI Insights */}
      {insights && (
        <div className="glass-panel p-6 border-l-4 border-brand-500">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-brand-400 mb-1">AI Daily Insights</h3>
              <p className="text-slate-300 whitespace-pre-line text-sm leading-relaxed">{insights}</p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Section */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <div className="flex gap-2">
            {['all', 'captured', 'pending', 'refunded'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filter === f 
                    ? 'bg-brand-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet. Create a payment to get started.</p>
            </div>
          ) : (
            filteredTransactions.map((txn) => (
              <div 
                key={txn.id} 
                className="p-5 hover:bg-slate-800/30 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      txn.status === 'captured' ? 'bg-brand-500/20' :
                      txn.status === 'pending' ? 'bg-amber-500/20' :
                      txn.status === 'refunded' ? 'bg-blue-500/20' :
                      'bg-red-500/20'
                    }`}>
                      {getStatusIcon(txn.status)}
                    </div>
                    <div>
                      <p className="font-semibold">₹{txn.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{txn.utr}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`status-badge ${getStatusClass(txn.status)}`}>
                      {getStatusIcon(txn.status)}
                      {txn.status}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:block">
                      {new Date(txn.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 flex gap-2 pl-14">
                  {txn.status === 'captured' && (
                    <>
                      <button
                        onClick={() => { setSelectedTxn(txn); setShowQR(true); }}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Smartphone className="w-3 h-3" />
                        Show QR
                      </button>
                      <button
                        onClick={() => { setSelectedTxn(txn); setShowProofModal(true); }}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 rounded-lg transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Send Proof
                      </button>
                      <button
                        onClick={() => { setSelectedTxn(txn); setShowRefundModal(true); }}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Refund
                      </button>
                    </>
                  )}
                  <Link 
                    to={`/transaction/${txn.id}`}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white transition-colors ml-auto"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-8 max-w-sm w-full text-center">
            <h3 className="text-lg font-semibold mb-2">Customer Verification</h3>
            <p className="text-sm text-slate-400 mb-6">Scan this QR code to verify payment</p>

            <div className="bg-white p-4 rounded-2xl inline-block mb-4">
              <QRCodeSVG 
                value={`${window.location.origin}/v/${selectedTxn.utr}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-2xl font-bold">₹{selectedTxn.amount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 font-mono">{selectedTxn.utr}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(`${window.location.origin}/v/${selectedTxn.utr}`)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 btn-primary text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Proof Modal */}
      {showProofModal && selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-1">Send Payment Proof</h3>
            <p className="text-sm text-slate-400 mb-6">
              Send verification link to customer for UTR: {selectedTxn.utr}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Customer Phone (with country code)
                </label>
                <input
                  type="tel"
                  value={proofPhone}
                  onChange={(e) => setProofPhone(e.target.value)}
                  placeholder={selectedTxn.customer_phone || '+91 98765 43210'}
                  className="input-field"
                />
                {selectedTxn.customer_phone && !proofPhone && (
                  <p className="text-xs text-slate-500 mt-1">
                    Default: {selectedTxn.customer_phone}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowProofModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendProof}
                  disabled={actionLoading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Proof
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-1">Process Refund</h3>
            <p className="text-sm text-slate-400 mb-6">
              Refund ₹{selectedTxn.amount.toLocaleString()} for UTR: {selectedTxn.utr}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Reason for Refund
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Customer request, duplicate payment, etc."
                  className="input-field min-h-[80px] resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={actionLoading || !refundReason.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Confirm Refund
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
