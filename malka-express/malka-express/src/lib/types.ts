export type StaffRole = 'owner' | 'manager' | 'employee';
export type DocumentType = 'waybill' | 't1';
export type OrderStatus =
  | 'pending_review'
  | 'awaiting_payment'
  | 'paid'
  | 'printing'
  | 'ready'
  | 'collected'
  | 'cancelled';
export type PaymentMethod = 'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'other' | 'ebirr' | 'cbe_bank' | 'awash_bank';
/** Methods a driver can pay with (configured by managers in the Payments tab). */
export type DriverPayMethod = 'ebirr' | 'cbe_bank' | 'telebirr' | 'awash_bank' | 'cbe_birr';
export type SubmissionStatus = 'pending_verification' | 'verified' | 'rejected';
/** What the driver sees: Unpaid / Pending Verification / Verified / Rejected ('none' = not payable, e.g. cancelled). */
export type PaymentState = 'unpaid' | 'pending_verification' | 'verified' | 'rejected' | 'none';

export interface StaffProfile {
  kind: 'staff';
  id: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
}

export interface DriverProfile {
  kind: 'driver';
  id: string;
  full_name: string;
  phone: string;
}

export type Profile = StaffProfile | DriverProfile;

export interface OrderDocument {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface Order {
  id: string;
  reference: string;
  driver_id: string;
  document_type: DocumentType;
  description: string | null;
  status: OrderStatus;
  copies: number;
  quoted_price: number | null;
  payment_status: 'unpaid' | 'paid';
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  driver: { full_name: string; phone: string } | null;
  documents: OrderDocument[];
  submissions: OrderSubmission[];
  /** Only returned to the driver who owns the order. Staff never receive it. */
  pin: { pin: string } | null;
}

export type CollectResult = 'collected' | 'wrong_pin' | 'locked';

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  created_at: string;
  order: { reference: string; document_type: DocumentType } | null;
}

export interface StaffMember {
  id: string;
  full_name: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  created_at: string;
}

export interface OrderEvent {
  id: number;
  event: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  note: string | null;
  created_at: string;
}

export interface OrderSubmission {
  id: string;
  method: DriverPayMethod;
  reference: string;
  status: SubmissionStatus;
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface PaymentMethodConfig {
  method: DriverPayMethod;
  sort_order: number;
  enabled: boolean;
  provider_name: string;
  account_holder: string;
  account_number: string;
  instructions: string;
}

/** A submission with the context staff need to review it. */
export interface SubmissionDetail extends OrderSubmission {
  order_id: string;
  amount: number;
  receipt_path: string;
  driver: { full_name: string; phone: string } | null;
  order: { reference: string; document_type: DocumentType; copies: number; description: string | null } | null;
}
