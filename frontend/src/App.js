import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TransactionDetail from './pages/TransactionDetail';
import VerifyPayment from './pages/VerifyPayment';
import VerifyRefund from './pages/VerifyRefund';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/v/:utr" element={<VerifyPayment />} />
        <Route path="/r/:refundId" element={<VerifyRefund />} />

        {/* Protected Merchant Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transaction/:id" element={<TransactionDetail />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
