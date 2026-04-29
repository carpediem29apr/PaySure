import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, CheckCircle, AlertTriangle, RotateCcw,
  IndianRupee, Hash, Calendar, Store
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function VerifyRefund() {
  const { refundId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRefund();
  }, [refundId]);

  const fetchRefund = async () => {
    try {
      const res = await axios.get(`${API_URL}/refund/${refundId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Refund not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="glass-panel p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2">Refund Not Found</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold">paysure</h1>
          <p className="text-slate-400 mt-1">Refund Verification</p>
        </div>

        <div className="glass-panel p-6 mb-6 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-lg font-semibold">Refund Verified</p>
              <p className="text-sm text-slate-400">Your refund has been processed</p>
            </div>
          </div>

          <div className="text-center py-6 border-y border-slate-800/50 my-4">
            <p className="text-sm text-slate-400 mb-1">Refund Amount</p>
            <p className="text-4xl font-bold flex items-center justify-center gap-1 text-blue-400">
              <IndianRupee className="w-8 h-8" />
              {data.amount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Original: ₹{data.original_amount.toLocaleString()}
            </p>
          </div>

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
                <span className="text-sm">Refund ID</span>
              </div>
              <span className="font-mono text-sm">{data.refund_id}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Hash className="w-4 h-4" />
                <span className="text-sm">Original UTR</span>
              </div>
              <span className="font-mono text-sm">{data.original_utr}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Processed</span>
              </div>
              <span className="text-sm">{new Date(data.timestamp).toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Reason</span>
              <span className="text-sm">{data.reason}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Verified by paysure • Secure refund proof
        </p>
      </div>
    </div>
  );
}
