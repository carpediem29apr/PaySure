export type TxnStatus = "verifying" | "duplicate" | "refunded" | "received";

export interface Transaction {
  id: string;
  type: "unfinished" | "duplicate";
  amount: number;
  status: TxnStatus;
  time: string;
  customerName?: string;
  upiLast4?: string;
  utr: string;
  utrDuplicate?: string;
  paymentMethod: string;
  refundedAt?: string;
}

export const initialTransactions: Transaction[] = [
  {
    id: "txn_001",
    type: "unfinished",
    amount: 1299,
    status: "verifying",
    time: "2:14 PM",
    customerName: "Rahul S.",
    upiLast4: "4821",
    utr: "UTR4429183920",
    paymentMethod: "UPI — Google Pay",
  },
  {
    id: "txn_002",
    type: "duplicate",
    amount: 450,
    status: "duplicate",
    time: "2:09 PM",
    customerName: "Priya M.",
    upiLast4: "1124",
    utr: "UTR4429183901",
    utrDuplicate: "UTR4429183907",
    paymentMethod: "UPI — PhonePe",
  },
  {
    id: "txn_003",
    type: "unfinished",
    amount: 240,
    status: "verifying",
    time: "2:02 PM",
    customerName: "Walk-in",
    upiLast4: "9023",
    utr: "UTR4429183855",
    paymentMethod: "UPI — Paytm",
  },
  {
    id: "txn_004",
    type: "duplicate",
    amount: 1850,
    status: "duplicate",
    time: "1:48 PM",
    customerName: "Anil K.",
    upiLast4: "7710",
    utr: "UTR4429183790",
    utrDuplicate: "UTR4429183795",
    paymentMethod: "UPI — BHIM",
  },
  {
    id: "txn_005",
    type: "unfinished",
    amount: 99,
    status: "verifying",
    time: "1:31 PM",
    customerName: "Walk-in",
    upiLast4: "3340",
    utr: "UTR4429183702",
    paymentMethod: "UPI — Google Pay",
  },
];

export const merchantProfile = {
  name: "Sharma General Store",
  ownerName: "Vikram Sharma",
  phone: "+91 98102 33421",
  email: "sharma.store@gmail.com",
  upiId: "sharmastore@okhdfc",
  merchantId: "PSR-MX-009823",
  gstin: "07AABCS1234N1Z5",
  address: "Shop 14, Kamla Market, Connaught Place, New Delhi — 110001",
};
