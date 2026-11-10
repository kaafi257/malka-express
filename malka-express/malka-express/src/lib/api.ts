import { DOCUMENTS_BUCKET, DRIVER_EMAIL_DOMAIN, supabase } from './supabase';
import { AppError, toAppError } from './errors';
import type { CollectResult, DocumentType, Order, PaymentMethod, Profile } from './types';

/* -------------------------------------------------------------------------- */
/* File rules (mirrored by the storage bucket settings in the SQL migration)  */
/* -------------------------------------------------------------------------- */
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Returns an i18n error code, or null when all files are acceptable. */
export function validateFiles(files: File[]): string | null {
  if (files.length === 0) return 'file_required';
  if (files.length > MAX_FILES) return 'file_too_many';
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type)) return 'file_bad_type';
    if (f.size > MAX_FILE_BYTES) return 'file_too_large';
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

/** Drivers sign in with phone + password. The phone is mapped to a private, never-mailed id. */
export function driverLoginEmail(normalizedPhone: string): string {
  return `${normalizedPhone}@${DRIVER_EMAIL_DOMAIN}`;
}

export async function signInStaff(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAppError(error);
}

export async function signInDriver(normalizedPhone: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: driverLoginEmail(normalizedPhone), password });
  if (error) throw toAppError(error);
}

export async function registerDriver(fullName: string, normalizedPhone: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: driverLoginEmail(normalizedPhone),
    password,
    options: { data: { account_type: 'driver', full_name: fullName.trim(), phone: normalizedPhone } },
  });
  if (error) throw toAppError(error);
  // With "Confirm email" disabled a session is returned immediately. If it is not, the project is misconfigured.
  if (!data.session) throw new AppError('email_not_confirmed');
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Resolves the signed-in user's profile (staff first, then driver). */
export async function loadProfile(
  userId: string,
): Promise<{ profile: Profile } | { problem: 'inactive' | 'no_profile' }> {
  const { data: staff, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, full_name, phone, role, active')
    .eq('id', userId)
    .maybeSingle();
  if (staffError) throw toAppError(staffError);

  if (staff) {
    if (!staff.active) return { problem: 'inactive' };
    return { profile: { kind: 'staff', id: staff.id, full_name: staff.full_name, phone: staff.phone, role: staff.role } };
  }

  const { data: driver, error: driverError } = await supabase
    .from('driver_profiles')
    .select('id, full_name, phone')
    .eq('id', userId)
    .maybeSingle();
  if (driverError) throw toAppError(driverError);

  if (driver) return { profile: { kind: 'driver', id: driver.id, full_name: driver.full_name, phone: driver.phone } };
  return { problem: 'no_profile' };
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

const ORDER_SELECT = `
  id, reference, driver_id, document_type, description, status, quoted_price, payment_status,
  created_at, paid_at, ready_at, collected_at,
  driver:driver_profiles ( full_name, phone ),
  documents:order_documents ( id, file_name, storage_path, mime_type, file_size, created_at ),
  pin:order_pins ( pin )
`;

/** Row Level Security decides what the caller sees: drivers get their own orders, staff get all. */
export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as Order[];
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Creates the order, uploads every file and records it.
 * If anything fails after the order exists, the upload is rolled back and the order is cancelled,
 * so no empty requests are left for staff to review.
 */
export async function submitRequest(
  input: { type: DocumentType; description: string; files: File[] },
  userId: string,
): Promise<void> {
  const invalid = validateFiles(input.files);
  if (invalid) throw new AppError(invalid);

  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_document_type: input.type,
    p_description: input.description,
  });
  if (error) throw toAppError(error);

  const id = orderId as string;
  const uploaded: string[] = [];
  try {
    for (const file of input.files) {
      const path = `${id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new AppError('upload_failed');
      uploaded.push(path);

      const { error: metaError } = await supabase.from('order_documents').insert({
        order_id: id,
        uploaded_by: userId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
      });
      if (metaError) throw new AppError('upload_failed');
    }
  } catch (e) {
    if (uploaded.length) await supabase.storage.from(DOCUMENTS_BUCKET).remove(uploaded);
    await supabase.rpc('cancel_order', { p_order_id: id });
    throw toAppError(e);
  }
}

/** Short-lived private link to a stored document (5 minutes). */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, 300);
  if (error || !data) throw toAppError(error);
  return data.signedUrl;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toAppError(error);
  return data;
}

export const setPrice = (orderId: string, price: number) => rpc('set_price', { p_order_id: orderId, p_price: price });

export const recordPayment = (orderId: string, method: PaymentMethod, reference: string) =>
  rpc('record_payment', { p_order_id: orderId, p_method: method, p_reference: reference });

export const startPrinting = (orderId: string) => rpc('advance_order', { p_order_id: orderId, p_to: 'printing' });

export const markReady = (orderId: string) => rpc('advance_order', { p_order_id: orderId, p_to: 'ready' });

export const cancelOrder = (orderId: string) => rpc('cancel_order', { p_order_id: orderId });

export const regeneratePin = (orderId: string) => rpc('regenerate_pin', { p_order_id: orderId });

export async function collectOrder(orderId: string, pin: string): Promise<CollectResult> {
  return (await rpc('collect_order', { p_order_id: orderId, p_pin: pin })) as CollectResult;
}
