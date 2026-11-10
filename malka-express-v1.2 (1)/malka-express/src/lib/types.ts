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
export type PaymentMethod = 'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'other';

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
  quoted_price: number | null;
  payment_status: 'unpaid' | 'paid';
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  driver: { full_name: string; phone: string } | null;
  documents: OrderDocument[];
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
