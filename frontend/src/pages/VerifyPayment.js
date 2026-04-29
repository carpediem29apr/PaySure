import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, CheckCircle, AlertTriangle, Clock, 
  IndianRupee, Hash, Calendar, Store, ArrowRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function VerifyPayment() {
  const { utr } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVerification();
  }, [utr]);

  const fetchVerification = async () => {
    try {
      const res = await axios.get(`${API_URL}/verify/${utr}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="glass-panel p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2">Payment Not Found</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <p className="text-sm text-slate-500">Please check the UTR number with the merchant.</p>
        </div>
      </div>
    );
  }

  const isSuccess = data.status === 'captured' || data.status === 'refunded';
  const isRefunded = data.status === 'refunded';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isSuccess ? 'bg-brand-500' : 'bg-amber-500'
          }`}>
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold">paysure</h1>
          <p className="text-slate-400 mt-1">Payment Verification</p>
        </div>

        {/* Status Card */}
        <div className={`glass-panel p-6 mb-6 border-l-4 ${
          isSuccess ? 'border-l-brand-500' : 'border-l-amber-500'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            {isSuccess ? (
              <CheckCircle className="w-8 h-8 text-brand-400" />
            ) : (
              <Clock className="w-8 h-8 text-amber-400" />
            )}
            <div>
              <p className="text-lg font-semibold">
                {isRefunded ? 'Payment Refunded' : isSuccess ? 'Payment Verified' : 'Payment Pending'}
              </p>
              <p className="text-sm text-slate-400">
                {data.valid ? 'Cryptographically verified' : 'Verification pending'}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="text-center py-6 border-y border-slate-800/50 my-4">
            <p className="text-sm text-slate-400 mb-1">Amount</p>
            <p className="text-4xl font-bold flex items-center justify-center gap-1">
              <IndianRupee className="w-8 h-8" />
              {data.amount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.currency}</p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Store className="w-4 h-4" />
                <span className="text-sm">Merchant</span>
              </div>
              <span className="font-medium">{data.merchant_name}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Hash className="w-4 h-4" />
                <span className="text-sm">UTR</span>
              </div>
              <span className="font-mono text-sm">{data.utr}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Time</span>
              </div>
              <span className="text-sm">{new Date(data.timestamp).toLocaleString()}</span>
            </div>

            {data.description && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-400">Description</span>
                <span className="text-sm">{data.description}</span>
              </div>
            )}

            {isRefunded && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-400">Refund Amount</span>
                <span className="text-sm text-blue-400 font-medium">₹{data.refund_amount?.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Show to Merchant Button */}
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full btn-primary flex items-center justify-center gap-2 text-lg py-4"
        >
          <Shield className="w-5 h-5" />
          Show to Merchant
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Verified by paysure • Secure payment proof
        </p>
      </div>
    </div>
  );
}
