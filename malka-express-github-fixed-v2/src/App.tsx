
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import {
  FileText,
  Upload,
  LogOut,
  ShieldCheck,
  Package,
  Plus,
  ArrowRight,
  Wallet,
  CheckCircle,
  Clock
} from 'lucide-react';

type Order = {
  id: string;
  driver_id: string;
  document_type: string;
  description: string | null;
  status: string;
  quoted_price: number | null;
  payment_status: string;
  created_at: string;
};

type Profile = {
  full_name: string;
  role: string;
};

const pretty = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState('home');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [docType, setDocType] = useState('Waybill');
  const [copies, setCopies] = useState(1);
  const [pages, setPages] = useState(1);
  const [uploads, setUploads] = useState<File[]>([]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadProfile();
    } else {
      setProfile(null);
      setOrders([]);
      setView('home');
    }
  }, [session]);

  async function loadProfile() {
    if (!supabase || !session) return;

    const uid = session.user.id;

    // Check staff account first.
    const staffResult = await supabase
      .from('staff_profiles')
      .select('full_name, role')
      .eq('id', uid)
      .maybeSingle();

    if (staffResult.error) {
      setMsg(staffResult.error.message);
      return;
    }

    if (staffResult.data) {
      setProfile(staffResult.data);
      setView('shop');
      await loadOrders(true, uid);
      return;
    }

    // If not staff, check driver profile.
    const driverResult = await supabase
      .from('driver_profiles')
      .select('full_name, phone')
      .eq('id', uid)
      .maybeSingle();

    if (driverResult.error) {
      setMsg(driverResult.error.message);
      return;
    }

    setProfile(null);

    if (driverResult.data) {
      setName(driverResult.data.full_name || '');
      setPhone(driverResult.data.phone || '');
      setView('driver');
      await loadOrders(false, uid);
    } else {
      setView('register');
    }
  }

  async function loadOrders(isStaff = false, uid?: string) {
    if (!supabase) return;

    let query = supabase
      .from('orders')
      .select(
        'id, driver_id, document_type, description, status, quoted_price, payment_status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isStaff && uid) {
      query = query.eq('driver_id', uid);
    }

    const result = await query;

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setOrders(result.data || []);
  }

  async function driverStart() {
    if (!supabase) return;

    setLoading(true);
    setMsg('');

    const result = await supabase.auth.signInAnonymously();

    if (result.error) {
      setMsg(
        result.error.message +
          '. Check that Anonymous Sign-ins are enabled in Supabase Authentication.'
      );
    } else {
      setSession(result.data.session);
      setView('register');
    }

    setLoading(false);
  }

  async function saveDriver() {
    if (!supabase || !session) return;

    if (!name.trim() || !phone.trim()) {
      setMsg('Enter your name and phone number.');
      return;
    }

    setLoading(true);
    setMsg('');

    const result = await supabase
      .from('driver_profiles')
      .upsert(
        {
          id: session.user.id,
          full_name: name.trim(),
          phone: phone.trim()
        },
        { onConflict: 'id' }
      );

    if (result.error) {
      setMsg(result.error.message);
    } else {
      setView('driver');
      setMsg('Profile saved. Welcome to Malka Express!');
      await loadOrders(false, session.user.id);
    }

    setLoading(false);
  }

  async function staffLogin() {
    if (!supabase) return;

    setLoading(true);
    setMsg('');

    const result = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (result.error) {
      setMsg(result.error.message);
    } else {
      setSession(result.data.session);
    }

    setLoading(false);
  }

  async function createOrder() {
    if (!supabase || !session) return;

    if (uploads.length === 0) {
      setMsg('Please select your document photos.');
      return;
    }

    if (uploads.length > 100) {
      setMsg('You can upload a maximum of 100 photos.');
      return;
    }

    setLoading(true);
    setMsg('');

    const description = `Pages: ${pages}; Copies: ${copies}`;

    const result = await supabase
      .from('orders')
      .insert({
        driver_id: session.user.id,
        created_by: session.user.id,
        document_type: docType,
        description,
        status: 'pending_review',
        payment_status: 'unpaid'
      })
      .select()
      .single();

    if (result.error) {
      setMsg(result.error.message);
      setLoading(false);
      return;
    }

    const orderId = result.data.id;
    let uploadFailed = false;

    for (let i = 0; i < uploads.length; i++) {
      const file = uploads[i];

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

      const path = `${orderId}/${Date.now()}-${i}-${safeName}`;

      const uploadResult = await supabase.storage
        .from('order-documents')
        .upload(path, file);

      if (uploadResult.error) {
        setMsg(
          'Your order was created, but a photo failed to upload: ' +
            uploadResult.error.message
        );
        uploadFailed = true;
        break;
      }

      const documentResult = await supabase
        .from('order_documents')
        .insert({
          order_id: orderId,
          uploaded_by: session.user.id,
          file_name: file.name,
          storage_path: path
        });

      if (documentResult.error) {
        setMsg(
          'Photo uploaded, but document record failed: ' +
            documentResult.error.message
        );
        uploadFailed = true;
        break;
      }
    }

    if (!uploadFailed) {
      setMsg('Order submitted! The shop will review it and confirm your price.');
      setUploads([]);
      setView('orders');
    }

    await loadOrders(false, session.user.id);
    setLoading(false);
  }

  async function staffUpdate(
    id: string,
    status: string,
    price?: number
  ) {
    if (!supabase) return;

    const update: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (price !== undefined) {
      update.quoted_price = price;
      update.payment_status = 'pending';
    }

    const result = await supabase
      .from('orders')
      .update(update)
      .eq('id', id);

    if (result.error) {
      setMsg(result.error.message);
    } else {
      setMsg('Order updated successfully.');
      await loadOrders(true);
    }
  }

  async function verifyPayment(id: string) {
    if (!supabase) return;

    const result = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (result.error) {
      setMsg(result.error.message);
    } else {
      setMsg('Payment marked as paid.');
      await loadOrders(true);
    }
  }

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();

    setSession(null);
    setProfile(null);
    setOrders([]);
    setView('home');
  }

  if (!supabase) {
    return (
      <div className="center">
        <div className="brand">M<span>✦</span></div>
        <h1>Malka Express</h1>
        <p>Supabase is not connected yet.</p>
        <p className="muted">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
          to your Vercel environment variables, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brand">M<span>✦</span></div>
        <div>
          <b>Malka Express</b>
          <small>Document copying made easier</small>
        </div>

        <button
          className="iconbtn"
          onClick={() => setView(session ? 'home' : 'staff')}
          aria-label="Staff login"
        >
          <ShieldCheck />
        </button>
      </header>

      <main>
        {msg && (
          <div className="notice" onClick={() => setMsg('')}>
            {msg} <span>×</span>
          </div>
        )}

        {view === 'home' && (
          <section className="hero">
            <div className="tag">MALKA JEBDU · DIRE DAWA</div>

            <h1>
              Your documents.
              <br />
              <em>Ready without the wait.</em>
            </h1>

            <p>
              Upload Waybill or T1 documents from your phone.
              We review, confirm your price, print, and prepare
              your copies for collection.
            </p>

            <button
              className="primary wide"
              onClick={driverStart}
              disabled={loading}
            >
              Start an order <ArrowRight size={18} />
            </button>

            <button
              className="secondary wide"
              onClick={() => setView('staff')}
            >
              Shop / Owner login
            </button>

            <div className="steps">
              <div>
                <Upload />
                <b>Upload</b>
                <small>Send pages from phone</small>
              </div>
              <div>
                <Wallet />
                <b>Pay</b>
                <small>Price confirmed first</small>
              </div>
              <div>
                <Package />
                <b>Collect</b>
                <small>Collect at the shop</small>
              </div>
            </div>
          </section>
        )}

        {view === 'register' && (
          <section className="panel">
            <h2>Driver profile</h2>
            <p>Enter your name and phone number to continue.</p>

            <label>Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />

            <label>Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9..."
            />

            <button
              className="primary wide"
              disabled={loading || !name.trim() || !phone.trim()}
              onClick={saveDriver}
            >
              Continue
            </button>
          </section>
        )}

        {view === 'driver' && (
          <>
            <div className="welcome">
              <div>
                <span className="tag">DRIVER PORTAL</span>
                <h1>
                  Hello{name ? `, ${name.split(' ')[0]}` : ''} 👋
                </h1>
                <p>What documents do you need copied?</p>
              </div>

              <button
                className="primary"
                onClick={() => setView('new')}
              >
                <Plus /> New order
              </button>
            </div>

            <div className="metricgrid">
              <div className="metric">
                <span>My orders</span>
                <strong>
                  {orders.filter((o) => o.status !== 'collected').length}
                </strong>
              </div>

              <div className="metric">
                <span>Completed</span>
                <strong>
                  {orders.filter((o) => o.status === 'collected').length}
                </strong>
              </div>
            </div>

            <h3>Recent orders</h3>
            <OrderList orders={orders} driver />
          </>
        )}

        {view === 'new' && (
          <section className="panel">
            <button className="back" onClick={() => setView('driver')}>
              ← Back
            </button>

            <h2>New document order</h2>
            <p>
              Upload clear photos of each page. Shop staff will
              confirm your price.
            </p>

            <label>Document type</label>

            <div className="choice">
              {['Waybill', 'T1'].map((item) => (
                <button
                  key={item}
                  className={docType === item ? 'selected' : ''}
                  onClick={() => setDocType(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="twocol">
              <div>
                <label>Pages</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={pages}
                  onChange={(e) =>
                    setPages(
                      Math.max(1, Math.min(100, +e.target.value || 1))
                    )
                  }
                />
              </div>

              <div>
                <label>Copies per page</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) =>
                    setCopies(
                      Math.max(1, Math.min(100, +e.target.value || 1))
                    )
                  }
                />
              </div>
            </div>

            <label>Document photos</label>

            <label className="upload">
              <Upload />
              <span>Select photos (one per page)</span>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setUploads(Array.from(e.target.files || []))
                }
              />
            </label>

            {uploads.length > 0 && (
              <p className="muted">
                {uploads.length} photo(s) selected
              </p>
            )}

            <div className="hint">
              Price will be set by the shop after review.
              No payment is required yet.
            </div>

            <button
              className="primary wide"
              disabled={
                loading ||
                uploads.length === 0 ||
                uploads.length > 100
              }
              onClick={createOrder}
            >
              Submit order <ArrowRight />
            </button>
          </section>
        )}

        {view === 'orders' && (
          <>
            <button className="back" onClick={() => setView('driver')}>
              ← My dashboard
            </button>
            <h2>My orders</h2>
            <OrderList orders={orders} driver />
          </>
        )}

        {view === 'staff' && (
          <section className="panel login">
            <div className="round">
              <ShieldCheck />
            </div>

            <h2>Shop login</h2>
            <p>Secure access for authorized staff.</p>

            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@malkaexpress.com"
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />

            <button
              className="primary wide"
              disabled={loading}
              onClick={staffLogin}
            >
              Sign in
            </button>

            <button
              className="back centertext"
              onClick={() => setView('home')}
            >
              Back to driver portal
            </button>
          </section>
        )}

        {view === 'shop' && profile && (
          <>
            <div className="welcome">
              <div>
                <span className="tag">
                  {profile.role.toUpperCase()} WORKSPACE
                </span>
                <h1>Shop dashboard</h1>
                <p>Good work, {profile.full_name}.</p>
              </div>

              <button className="secondary" onClick={logout}>
                <LogOut size={17} /> Exit
              </button>
            </div>

            <div className="metricgrid">
              <div className="metric">
                <span>Open orders</span>
                <strong>
                  {
                    orders.filter(
                      (o) =>
                        !['collected', 'cancelled'].includes(o.status)
                    ).length
                  }
                </strong>
              </div>

              <div className="metric">
                <span>Ready to collect</span>
                <strong>
                  {orders.filter((o) => o.status === 'ready').length}
                </strong>
              </div>

              <div className="metric">
                <span>Completed</span>
                <strong>
                  {orders.filter((o) => o.status === 'collected').length}
                </strong>
              </div>
            </div>

            <div className="tabs">
              <button className="selected">Orders</button>

              {profile.role === 'owner' && (
                <button onClick={() => setView('owner')}>
                  Owner overview
                </button>
              )}
            </div>

            <OrderList
              orders={orders}
              staff
              onAction={staffUpdate}
              onVerify={verifyPayment}
            />
          </>
        )}

        {view === 'owner' && profile?.role === 'owner' && (
          <>
            <button className="back" onClick={() => setView('shop')}>
              ← Dashboard
            </button>

            <span className="tag">OWNER REPORT</span>
            <h1>Business overview</h1>

            <div className="metricgrid">
              <div className="metric">
                <span>Total orders</span>
                <strong>{orders.length}</strong>
              </div>

              <div className="metric">
                <span>Quoted revenue</span>
                <strong>
                  {orders
                    .reduce(
                      (total, order) =>
                        total + (Number(order.quoted_price) || 0),
                      0
                    )
                    .toLocaleString()}{' '}
                  <small>ETB</small>
                </strong>
              </div>

              <div className="metric">
                <span>Paid / collected</span>
                <strong>
                  {
                    orders.filter((o) =>
                      ['paid', 'printing', 'ready', 'collected'].includes(
                        o.status
                      )
                    ).length
                  }
                </strong>
              </div>
            </div>

            <h3>Order activity</h3>

            <OrderList
              orders={orders}
              staff
              onAction={staffUpdate}
              onVerify={verifyPayment}
            />
          </>
        )}
      </main>

      <footer>
        <span>✦ MALKA EXPRESS</span>
        <small>Convenient document services · Dire Dawa</small>
      </footer>
    </div>
  );
}

function OrderList({
  orders,
  driver,
  staff,
  onAction,
  onVerify
}: {
  orders: Order[];
  driver?: boolean;
  staff?: boolean;
  onAction?: (id: string, status: string, price?: number) => void;
  onVerify?: (id: string) => void;
}) {
  if (!orders.length) {
    return (
      <div className="empty">
        <FileText />
        <b>No orders yet</b>
        <p>Your order history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="orderlist">
      {orders.map((order) => (
        <article className="order" key={order.id}>
          <div className="orderhead">
            <div className="fileicon">
              <FileText />
            </div>

            <div className="grow">
              <b>{order.document_type} copies</b>
              <small>
                {new Date(order.created_at).toLocaleString()}
              </small>
              <small className="id">
                #{order.id.slice(0, 8).toUpperCase()}
              </small>
            </div>

            <span className={'status s-' + order.status}>
              {pretty(order.status)}
            </span>
          </div>

          <div className="orderdetails">
            <span>{order.description || 'Document order'}</span>

            {order.quoted_price !== null && (
              <b>
                {Number(order.quoted_price).toFixed(2)} ETB
              </b>
            )}
          </div>

          {driver && order.status === 'ready' && (
            <div className="pinbox">
              <span>READY FOR COLLECTION</span>
              <strong>Please collect from the shop.</strong>
              <small>
                Ask shop staff to verify your collection PIN.
              </small>
            </div>
          )}

          {staff && (
            <div className="actions">
              {order.status === 'pending_review' && (
                <button
                  onClick={() => {
                    const entered = prompt(
                      'Enter confirmed order price in ETB'
                    );

                    if (entered === null) return;

                    const price = Number(entered);

                    if (Number.isFinite(price) && price > 0) {
                      onAction?.(
                        order.id,
                        'awaiting_payment',
                        price
                      );
                    } else {
                      alert('Enter a valid price.');
                    }
                  }}
                >
                  Review & quote
                </button>
              )}

              {order.status === 'awaiting_payment' && (
                <button onClick={() => onVerify?.(order.id)}>
                  Verify payment
                </button>
              )}

              {order.status === 'paid' && (
                <button
                  onClick={() =>
                    onAction?.(order.id, 'printing')
                  }
                >
                  Start printing
                </button>
              )}

              {order.status === 'printing' && (
                <button
                  onClick={() => onAction?.(order.id, 'ready')}
                >
                  Mark ready
                </button>
              )}

              {order.status === 'ready' && (
                <small>
                  Collection PIN verification must be completed
                  securely before marking collected.
                </small>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
