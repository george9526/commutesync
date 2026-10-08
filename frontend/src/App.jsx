import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API = 'http://localhost:5001/api';
const SOCKET = 'http://localhost:5001';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [page, setPage] = useState('dashboard');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const showMsg = (text, type = 'error') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000); };

  const [isLogin, setIsLogin] = useState(true);
  const [af, setAf] = useState({ username: '', email: '', password: '', role: 'both', homeLocation: '', workLocation: '' });

  // Data
  const [rides, setRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [searchForm, setSearchForm] = useState({ origin: '', destination: '', date: '' });
  const [createForm, setCreateForm] = useState({ origin: '', destination: '', departureTime: '', vehicleCapacity: 4, notes: '' });
  const [filterTab, setFilterTab] = useState('all');
  const [myTripTab, setMyTripTab] = useState('all');

  // Chat
  const [chatRideId, setChatRideId] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEnd = useRef(null);
  const [chatRides, setChatRides] = useState([]);

  // Admin
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminRides, setAdminRides] = useState([]);
  const [adminReports, setAdminReports] = useState([]);
  const [adminTab, setAdminTab] = useState('stats');

  const socket = useRef(null);

  useEffect(() => {
    if (!token) return;
    const s = io(SOCKET, { auth: { token } });
    socket.current = s;
    s.on('rides_changed', () => { fetchRides(); fetchMyRides(); fetchMyBookings(); });
    s.on('new_message', (m) => { if (String(m.ride) === chatRideId) setChatMsgs(prev => [...prev, m]); });
    s.on('notification', (n) => showMsg(n.message, 'success'));
    return () => s.disconnect();
  }, [token]);

  useEffect(() => { if (chatEnd.current) chatEnd.current.scrollIntoView(); }, [chatMsgs]);

  const authFetch = async (url, opts = {}) => {
    const res = await fetch(API + url, { ...opts, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, ...opts.headers } });
    return res;
  };

  const fetchRides = async () => {
    try {
      const params = new URLSearchParams();
      if (searchForm.origin) params.set('origin', searchForm.origin);
      if (searchForm.destination) params.set('destination', searchForm.destination);
      if (searchForm.date) params.set('date', searchForm.date);
      const res = await authFetch('/rides?' + params.toString());
      if (res.ok) setRides(await res.json());
    } catch {}
  };

  const fetchMyRides = async () => {
    try { const res = await authFetch('/rides/my'); if (res.ok) setMyRides(await res.json()); } catch {}
  };

  const fetchMyBookings = async () => {
    try { const res = await authFetch('/bookings/my'); if (res.ok) setMyBookings(await res.json()); } catch {}
  };

  const fetchPendingBookings = async () => {
    try { const res = await authFetch('/bookings/pending'); if (res.ok) setPendingBookings(await res.json()); } catch {}
  };

  const fetchChatRides = async () => {
    try { const res = await authFetch('/messages/rides/available'); if (res.ok) setChatRides(await res.json()); } catch {}
  };

  const fetchAdminStats = async () => {
    try { const res = await authFetch('/admin/stats'); if (res.ok) setAdminStats(await res.json()); } catch {}
  };
  const fetchAdminRides = async () => {
    try { const res = await authFetch('/admin/rides'); if (res.ok) setAdminRides(await res.json()); } catch {}
  };
  const fetchAdminUsers = async () => {
    try { const res = await authFetch('/admin/users'); if (res.ok) setAdminUsers(await res.json()); } catch {}
  };
  const fetchAdminReports = async () => {
    try { const res = await authFetch('/admin/reports'); if (res.ok) setAdminReports(await res.json()); } catch {}
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const ep = isLogin ? '/users/login' : '/users/register';
    const body = isLogin ? { email: af.email, password: af.password } : af;
    try {
      const res = await fetch(API + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok) {
        if (isLogin) {
          setToken(d.token); setUser(d.user);
          localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
        } else { showMsg('Registered! Please login.', 'success'); setIsLogin(true); }
      } else showMsg(d.error || 'Auth failed');
    } catch { showMsg('Server error'); }
  };

  const logout = () => {
    setToken(''); setUser(null); localStorage.clear();
    if (socket.current) socket.current.disconnect();
  };

  const handleCreateRide = async (e) => {
    e.preventDefault();
    const body = {
      origin: { address: createForm.origin },
      destination: { address: createForm.destination },
      departureTime: createForm.departureTime,
      vehicleCapacity: Number(createForm.vehicleCapacity),
      notes: createForm.notes
    };
    const res = await authFetch('/rides', { method: 'POST', body: JSON.stringify(body) });
    const d = await res.json();
    if (res.ok) { showMsg('Ride created!', 'success'); setCreateForm({ origin: '', destination: '', departureTime: '', vehicleCapacity: 4, notes: '' }); fetchMyRides(); }
    else showMsg(d.error);
  };

  const requestBooking = async (rideId) => {
    const res = await authFetch('/bookings/request', { method: 'POST', body: JSON.stringify({ rideId, seatsRequested: 1 }) });
    const d = await res.json();
    if (res.ok) { showMsg('Booking requested!', 'success'); fetchMyBookings(); }
    else showMsg(d.error);
  };

  const acceptBooking = async (id) => {
    const res = await authFetch('/bookings/' + id + '/accept', { method: 'POST' });
    if (res.ok) { showMsg('Booking accepted!', 'success'); fetchPendingBookings(); fetchMyRides(); }
    else { const d = await res.json(); showMsg(d.error); }
  };

  const rejectBooking = async (id) => {
    const res = await authFetch('/bookings/' + id + '/reject', { method: 'POST' });
    if (res.ok) { showMsg('Booking rejected'); fetchPendingBookings(); }
  };

  const cancelBooking = async (id) => {
    const res = await authFetch('/bookings/' + id + '/cancel', { method: 'POST' });
    if (res.ok) { showMsg('Booking cancelled'); fetchMyBookings(); fetchRides(); }
  };

  const updateRideStatus = async (id, status) => {
    const res = await authFetch('/rides/' + id + '/' + status, { method: 'POST' });
    if (res.ok) { showMsg('Ride ' + status + '!', 'success'); fetchMyRides(); }
  };

  const cancelRide = async (id) => {
    const res = await authFetch('/rides/' + id + '/cancel', { method: 'POST' });
    if (res.ok) { showMsg('Ride cancelled'); fetchMyRides(); }
  };

  const openChat = async (rideId) => {
    setChatRideId(rideId);
    try {
      const res = await authFetch('/messages/' + rideId);
      if (res.ok) setChatMsgs(await res.json());
      if (socket.current) socket.current.emit('join_ride', rideId);
    } catch {}
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !chatRideId) return;
    const res = await authFetch('/messages/' + chatRideId, { method: 'POST', body: JSON.stringify({ content: chatInput }) });
    if (res.ok) setChatInput('');
    else { const d = await res.json(); showMsg(d.error); }
  };

  const loadAdmin = () => { fetchAdminStats(); fetchAdminRides(); fetchAdminUsers(); fetchAdminReports(); };
  const resolveReport = async (id, status) => {
    const res = await authFetch('/admin/reports/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) { showMsg('Report updated'); fetchAdminReports(); }
  };

  const goTo = (p) => { setPage(p); window.scrollTo(0, 0); if (p === 'dashboard') { fetchRides(); } if (p === 'myrides') fetchMyRides(); if (p === 'mybookings') fetchMyBookings(); if (p === 'driver') { fetchMyRides(); fetchPendingBookings(); } if (p === 'chat') fetchChatRides(); if (p === 'admin') loadAdmin(); };

  useEffect(() => { if (token) goTo('dashboard'); }, [token]);

  const statusIcon = (s) => {
    switch(s) {
      case 'scheduled': return '\u23F0';
      case 'in_progress': return '\uD83D\uDE98';
      case 'completed': return '\u2705';
      case 'cancelled': return '\u274C';
      case 'pending': return '\u23F3';
      case 'confirmed': return '\u2705';
      case 'rejected': return '\u274C';
      default: return '\uD83D\uDD35';
    }
  };

  const timeUntil = (d) => {
    const diff = new Date(d) - new Date();
    if (diff < 0) return 'Past';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 48) return Math.floor(h / 24) + 'd away';
    if (h > 0) return h + 'h ' + m + 'm away';
    return m + 'm away';
  };

  const filteredRides = rides.filter(r => filterTab === 'all' || r.status === filterTab);
  const allTrips = [
    ...myBookings.map(b => ({ ...b, _type: 'booking', _label: 'Passenger trip' })),
    ...myRides.map(r => ({ ...r, _type: 'ride', _label: 'My ride offer' })),
  ].filter(t => myTripTab === 'all' || t.status === myTripTab);

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-logo">
            <svg className="logo-svg" viewBox="0 0 40 40" width="40" height="40">
              <rect x="4" y="10" width="32" height="20" rx="4" fill="#0ea5e9" />
              <rect x="10" y="12" width="20" height="12" rx="2" fill="#0c4a6e" />
              <circle cx="12" cy="32" r="3" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1.5" />
              <circle cx="28" cy="32" r="3" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1.5" />
              <line x1="16" y1="16" x2="24" y2="16" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="20" x2="22" y2="20" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h1>CommuteSync</h1>
          </div>
          <p className="auth-tagline">Corporate carpool coordination &mdash; real-time ride matching for your daily commute</p>
          <div className="auth-stats">
            <div className="auth-stat"><span className="auth-stat-num">15+</span><span className="auth-stat-label">Active Routes</span></div>
            <div className="auth-stat"><span className="auth-stat-num">Live</span><span className="auth-stat-label">Chat</span></div>
            <div className="auth-stat"><span className="auth-stat-num">5.0</span><span className="auth-stat-label">Avg Rating</span></div>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{isLogin ? 'Welcome Back' : 'Join CommuteSync'}</h2>
            <p>{isLogin ? 'Sign in to coordinate your commute' : 'Create your carpool account'}</p>
          </div>
          <form onSubmit={handleAuth} className="auth-form">
            <div className="auth-toggle">
              <span className={'auth-toggle-btn' + (isLogin ? ' active' : '')} onClick={() => setIsLogin(true)}>Login</span>
              <span className={'auth-toggle-btn' + (!isLogin ? ' active' : '')} onClick={() => setIsLogin(false)}>Register</span>
            </div>
            {!isLogin && (
              <div className="input-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <input type="text" placeholder="Choose a username" value={af.username} onChange={e => setAf({...af, username: e.target.value})} required />
                </div>
              </div>
            )}
            <div className="input-group">
              <label>Email</label>
              <div className="input-wrapper">
                <input type="email" placeholder="you@company.com" value={af.email} onChange={e => setAf({...af, email: e.target.value})} required />
              </div>
            </div>
            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <input type="password" placeholder={isLogin ? 'Your password' : 'Create password (min 6)'} value={af.password} onChange={e => setAf({...af, password: e.target.value})} required minLength={6} />
              </div>
            </div>
            {!isLogin && (
              <>
                <div className="input-group">
                  <label>I want to be a</label>
                  <div className="input-wrapper">
                    <select value={af.role} onChange={e => setAf({...af, role: e.target.value})}>
                      <option value="both">Driver & Passenger</option>
                      <option value="driver">Driver</option>
                      <option value="passenger">Passenger</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Home Location</label>
                  <div className="input-wrapper">
                    <input type="text" placeholder="e.g. Downtown Apt 4B" value={af.homeLocation} onChange={e => setAf({...af, homeLocation: e.target.value})} />
                  </div>
                </div>
                <div className="input-group">
                  <label>Work Location</label>
                  <div className="input-wrapper">
                    <input type="text" placeholder="e.g. Corporate HQ Tower" value={af.workLocation} onChange={e => setAf({...af, workLocation: e.target.value})} />
                  </div>
                </div>
              </>
            )}
            <div className="auth-demo-box">
              <strong>Demo accounts:</strong><br />
              alice@company.com / demo1234 (driver)<br />
              bob@company.com / demo1234 (passenger)<br />
              carol@company.com / demo1234 (both)
            </div>
            <button type="submit" className="auth-submit">{isLogin ? 'Sign In' : 'Create Account'}</button>
            {msg && <p className={'auth-message ' + (msgType === 'success' ? 'success' : 'error')}>{msg}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <svg viewBox="0 0 40 40" width="24" height="24" className="nav-brand-icon">
            <rect x="4" y="10" width="32" height="20" rx="4" fill="#0ea5e9" />
            <rect x="10" y="12" width="20" height="12" rx="2" fill="#0c4a6e" />
            <circle cx="12" cy="32" r="3" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1.5" />
            <circle cx="28" cy="32" r="3" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1.5" />
          </svg>
          CommuteSync
        </div>
        <div className="nav-links">
          <button className={'nav-btn' + (page === 'dashboard' ? ' active' : '')} onClick={() => goTo('dashboard')}>Search</button>
          <button className={'nav-btn' + (page === 'driver' ? ' active' : '')} onClick={() => goTo('driver')}>Driver</button>
          <button className={'nav-btn' + (page === 'mybookings' ? ' active' : '')} onClick={() => goTo('mybookings')}>My Trips</button>
          <button className={'nav-btn' + (page === 'chat' ? ' active' : '')} onClick={() => goTo('chat')}>Chat</button>
          {user?.isAdmin && <button className={'nav-btn' + (page === 'admin' ? ' active' : '')} onClick={() => goTo('admin')}>Admin</button>}
        </div>
        <div className="nav-user">
          <div className="nav-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <div>
            <div className="nav-username">{user?.username}</div>
            <div className="nav-subtext">{user?.role} &middot; {'\u2605'} {user?.rating || 5.0}</div>
          </div>
          <button className="nav-logout" onClick={logout}>Logout</button>
        </div>
      </nav>

      {msg && <div className={'toast ' + msgType}>{msg}</div>}

      <div className="page-content">

        {/* === DASHBOARD / SEARCH === */}
        {page === 'dashboard' && (
          <>
            <section className="card search-card">
              <div className="search-icon-wrap">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0ea5e9" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
              </div>
              <div className="search-fields">
                <input type="text" placeholder="From (address or area)" value={searchForm.origin} onChange={e => setSearchForm({...searchForm, origin: e.target.value})} />
                <input type="text" placeholder="To (address or area)" value={searchForm.destination} onChange={e => setSearchForm({...searchForm, destination: e.target.value})} />
                <input type="date" value={searchForm.date} onChange={e => setSearchForm({...searchForm, date: e.target.value})} />
                <button className="btn-primary" onClick={fetchRides}>Search</button>
              </div>
            </section>

            <section className="card">
              <div className="card-header-wrap">
                <h2>Available Rides</h2>
                <span className="card-badge">{rides.length} rides</span>
              </div>
              <div className="filter-tabs">
                {['all', 'scheduled', 'in_progress', 'completed'].map(t => (
                  <span key={t} className={'filter-tab' + (filterTab === t ? ' active' : '')} onClick={() => setFilterTab(t)}>
                    {statusIcon(t)} {t.replace('_', ' ')}
                  </span>
                ))}
              </div>
              {filteredRides.length === 0 && <p className="empty">No rides found. Try different search terms or date.</p>}
              <div className="ride-grid">
                {filteredRides.map(r => (
                  <div key={r._id} className={'ride-card status-' + r.status} onClick={() => setSelectedRide(selectedRide?._id === r._id ? null : r)}>
                    <div className="ride-card-header">
                      <div className="ride-route-wrap">
                        <span className="ride-dot origin-dot"></span>
                        <span className="ride-route-address">{r.origin?.address}</span>
                      </div>
                      <div className="ride-route-wrap">
                        <span className="ride-dot dest-dot"></span>
                        <span className="ride-route-address">{r.destination?.address}</span>
                      </div>
                    </div>
                    <div className="ride-card-body">
                      <span className="ride-info-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        {new Date(r.departureTime).toLocaleDateString()} {new Date(r.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="ride-info-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
                        {r.availableSeats}/{r.vehicleCapacity} seats
                      </span>
                      <span className="ride-info-item">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {r.driver?.username}
                      </span>
                      <span className={'ride-status status-' + r.status}>{statusIcon(r.status)} {r.status.replace('_', ' ')}</span>
                      {r.status === 'scheduled' && <span className="ride-time-until">{timeUntil(r.departureTime)}</span>}
                    </div>
                    {selectedRide?._id === r._id && (
                      <div className="ride-detail">
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">Driver</span>
                            <span className="detail-value">{r.driver?.username} {'\u2605'} {r.driver?.rating || 5.0}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Departure</span>
                            <span className="detail-value">{new Date(r.departureTime).toLocaleString()}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Available</span>
                            <span className="detail-value">{r.availableSeats}/{r.vehicleCapacity} seats</span>
                          </div>
                          {r.notes && (
                            <div className="detail-item detail-full">
                              <span className="detail-label">Notes</span>
                              <span className="detail-value">{r.notes}</span>
                            </div>
                          )}
                        </div>
                        <div className="ride-detail-actions">
                          {r.status === 'scheduled' && r.driver?._id !== user?.id && (
                            <button className="btn-book-now" onClick={(e) => { e.stopPropagation(); requestBooking(r._id); }}>
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                              Request Booking
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* === DRIVER PAGE === */}
        {page === 'driver' && (
          <>
            <div className="driver-stats-row">
              <div className="driver-stat-card">
                <span className="driver-stat-num">{myRides.filter(r => r.status === 'scheduled').length}</span>
                <span className="driver-stat-label">Upcoming</span>
              </div>
              <div className="driver-stat-card">
                <span className="driver-stat-num">{myRides.filter(r => r.status === 'in_progress').length}</span>
                <span className="driver-stat-label">Active</span>
              </div>
              <div className="driver-stat-card">
                <span className="driver-stat-num">{myRides.filter(r => r.status === 'completed').length}</span>
                <span className="driver-stat-label">Completed</span>
              </div>
              <div className="driver-stat-card">
                <span className="driver-stat-num">{pendingBookings.length}</span>
                <span className="driver-stat-label">Pending Req</span>
              </div>
            </div>

            <section className="card create-ride-card">
              <h2>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0ea5e9" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Ride Offer
              </h2>
              <form onSubmit={handleCreateRide}>
                <div className="form-row">
                  <input type="text" placeholder="From (address)" value={createForm.origin} onChange={e => setCreateForm({...createForm, origin: e.target.value})} required />
                  <input type="text" placeholder="To (address)" value={createForm.destination} onChange={e => setCreateForm({...createForm, destination: e.target.value})} required />
                </div>
                <div className="form-row">
                  <input type="datetime-local" value={createForm.departureTime} onChange={e => setCreateForm({...createForm, departureTime: e.target.value})} required />
                  <div className="input-with-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
                    <input type="number" placeholder="Capacity" value={createForm.vehicleCapacity} min={1} max={10} onChange={e => setCreateForm({...createForm, vehicleCapacity: e.target.value})} required />
                  </div>
                </div>
                <input type="text" placeholder="Notes — e.g. AC on, music optional, detour possible" value={createForm.notes} onChange={e => setCreateForm({...createForm, notes: e.target.value})} />
                <button type="submit" className="btn-primary">Publish Ride</button>
              </form>
            </section>

            <section className="card">
              <div className="card-header-wrap">
                <h2>Pending Booking Requests</h2>
                {pendingBookings.length > 0 && <span className="card-badge warning">{pendingBookings.length} new</span>}
              </div>
              {pendingBookings.length === 0 && <p className="empty">No pending requests</p>}
              {pendingBookings.map(b => (
                <div key={b._id} className="request-card">
                  <div className="request-info">
                    <div className="request-avatar">{b.passenger?.username?.[0]?.toUpperCase()}</div>
                    <div>
                      <strong>{b.passenger?.username}</strong> wants {b.seatsRequested} seat(s)<br />
                      <small>Ride: {b.ride?.origin?.address} &rarr; {b.ride?.destination?.address}</small>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button className="btn-accept" onClick={() => acceptBooking(b._id)}>Accept</button>
                    <button className="btn-reject" onClick={() => rejectBooking(b._id)}>Reject</button>
                  </div>
                </div>
              ))}
            </section>

            <section className="card">
              <h2>My Ride Offers</h2>
              {myRides.length === 0 && <p className="empty">No rides created yet</p>}
              {myRides.map(r => (
                <div key={r._id} className={'ride-card status-' + r.status}>
                  <div className="ride-card-header">
                    <div className="ride-route-wrap">
                      <span className="ride-dot origin-dot"></span>
                      <span className="ride-route-address">{r.origin?.address}</span>
                    </div>
                    <div className="ride-route-wrap">
                      <span className="ride-dot dest-dot"></span>
                      <span className="ride-route-address">{r.destination?.address}</span>
                    </div>
                  </div>
                  <div className="ride-card-body">
                    <span className="ride-info-item">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      {new Date(r.departureTime).toLocaleString()}
                    </span>
                    <span className="ride-info-item">{'\uD83D\uDE97'} {r.availableSeats}/{r.vehicleCapacity} seats</span>
                    <span className="ride-info-item">{'\uD83D\uDC65'} {r.confirmedPassengers?.length || 0} confirmed</span>
                    <span className={'ride-status status-' + r.status}>{statusIcon(r.status)} {r.status.replace('_', ' ')}</span>
                  </div>
                  <div className="ride-actions">
                    {r.status === 'scheduled' && <button className="btn-start-ride" onClick={() => updateRideStatus(r._id, 'start')}>Start Ride</button>}
                    {r.status === 'in_progress' && <button className="btn-start-ride" onClick={() => updateRideStatus(r._id, 'complete')}>Complete Ride</button>}
                    {(r.status === 'scheduled' || r.status === 'in_progress') && <button className="btn-danger" onClick={() => cancelRide(r._id)}>Cancel</button>}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* === MY TRIPS === */}
        {page === 'mybookings' && (
          <section className="card">
            <div className="card-header-wrap">
              <h2>My Trips</h2>
              <span className="card-badge">{allTrips.length} trips</span>
            </div>
            <div className="filter-tabs">
              {['all', 'scheduled', 'in_progress', 'completed', 'confirmed', 'pending', 'cancelled', 'rejected'].map(t => (
                <span key={t} className={'filter-tab' + (myTripTab === t ? ' active' : '')} onClick={() => setMyTripTab(t)}>
                  {statusIcon(t)} {t.replace('_', ' ')}
                </span>
              ))}
            </div>
            {allTrips.length === 0 && <p className="empty">No trips yet. Search rides to book, or create a ride offer!</p>}
            {allTrips.map((t, i) => (
              <div key={t._id || i} className={'ride-card status-' + t.status}>
                <div className="ride-card-header">
                  <div className="ride-route-wrap">
                    <span className="ride-dot origin-dot"></span>
                    <span className="ride-route-address">{(t.ride || t).origin?.address}</span>
                  </div>
                  <div className="ride-route-wrap">
                    <span className="ride-dot dest-dot"></span>
                    <span className="ride-route-address">{(t.ride || t).destination?.address}</span>
                  </div>
                </div>
                <div className="ride-card-body">
                  <span className="ride-info-item">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {new Date((t.ride || t).departureTime).toLocaleString()}
                  </span>
                  {t._type === 'booking' ? (
                    <>
                      <span className="ride-info-item">{'\uD83D\uDC64'} Driver: {(t.ride)?.driver?.username}</span>
                      <span className="ride-info-item">{t.seatsRequested} seat(s)</span>
                    </>
                  ) : (
                    <>
                      <span className="ride-info-item">{'\uD83D\uDE97'} {t.availableSeats}/{t.vehicleCapacity} seats</span>
                      <span className="ride-info-item">{'\uD83D\uDC65'} {t.confirmedPassengers?.length || 0} confirmed</span>
                    </>
                  )}
                  <span className={'ride-status status-' + t.status}>{statusIcon(t.status)} {t.status.replace('_', ' ')}</span>
                  <span className="trip-type-badge">{t._type === 'booking' ? 'Passenger' : 'Driver'}</span>
                </div>
                <div className="ride-actions">
                  {t._type === 'booking' && (t.status === 'pending' || t.status === 'confirmed') && (
                    <button className="btn-danger" onClick={() => cancelBooking(t._id)}>Cancel Booking</button>
                  )}
                  {t._type === 'ride' && t.status === 'scheduled' && (
                    <button className="btn-start-ride" onClick={() => updateRideStatus(t._id, 'start')}>Start Ride</button>
                  )}
                  {t._type === 'ride' && t.status === 'in_progress' && (
                    <button className="btn-start-ride" onClick={() => updateRideStatus(t._id, 'complete')}>Complete Ride</button>
                  )}
                  {t._type === 'ride' && (t.status === 'scheduled' || t.status === 'in_progress') && (
                    <button className="btn-danger" onClick={() => cancelRide(t._id)}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* === CHAT === */}
        {page === 'chat' && (
          <div className="chat-layout">
            <section className="card chat-sidebar">
              <h2>Your Rides</h2>
              {chatRides.map(r => (
                <div key={r._id} className={'chat-ride-item' + (chatRideId === r._id ? ' active' : '')} onClick={() => openChat(r._id)}>
                  <div className="chat-ride-item-header">
                    <span className={'ride-status-small status-' + r.status}></span>
                    <strong>{r.origin?.address} &rarr; {r.destination?.address}</strong>
                  </div>
                  <small>{new Date(r.departureTime).toLocaleDateString()} &mdash; {r.status.replace('_', ' ')}</small>
                  {r._lastMessage && <div className="chat-ride-preview">{r._lastMessage}</div>}
                </div>
              ))}
              {chatRides.length === 0 && <p className="empty">No active rides with chat</p>}
            </section>
            <section className="card chat-main">
              {chatRideId ? (
                <>
                  <div className="chat-header">
                    <h2>Chat</h2>
                    {(() => { const cr = chatRides.find(r => r._id === chatRideId); return cr ? <span className="chat-ride-subtitle">{cr.origin?.address} &rarr; {cr.destination?.address}</span> : null; })()}
                  </div>
                  <div className="chat-msgs">
                    {chatMsgs.length === 0 && <p className="empty">No messages yet. Say hello!</p>}
                    {chatMsgs.map((m, i) => (
                      <div key={i} className={'chat-msg' + (String(m.sender?._id || m.sender) === user?.id ? ' mine' : '')}>
                        <div className="chat-msg-sender">{m.sender?.username || 'Unknown'}</div>
                        <div className="chat-msg-content">{m.content}</div>
                        <div className="chat-msg-time">{m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </div>
                    ))}
                    <div ref={chatEnd} />
                  </div>
                  <div className="chat-input">
                    <input type="text" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
                    <button className="btn-primary" onClick={sendChat}>Send</button>
                  </div>
                </>
              ) : <div className="chat-placeholder"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#334155" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Select a ride to start chatting</p></div>}
            </section>
          </div>
        )}

        {/* === ADMIN === */}
        {page === 'admin' && (
          <>
            <div className="admin-tabs">
              <span className={'admin-tab' + (adminTab === 'stats' ? ' active' : '')} onClick={() => setAdminTab('stats')}>Overview</span>
              <span className={'admin-tab' + (adminTab === 'users' ? ' active' : '')} onClick={() => setAdminTab('users')}>Users</span>
              <span className={'admin-tab' + (adminTab === 'rides' ? ' active' : '')} onClick={() => setAdminTab('rides')}>Rides</span>
              <span className={'admin-tab' + (adminTab === 'reports' ? ' active' : '')} onClick={() => setAdminTab('reports')}>Reports</span>
            </div>

            {adminTab === 'stats' && (
              <section className="card">
                <h2>Admin Overview</h2>
                {adminStats && (
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span className="admin-stat-num">{adminStats.userCount}</span>
                      <span className="admin-stat-label">Total Users</span>
                    </div>
                    <div className="admin-stat-card">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      <span className="admin-stat-num">{adminStats.activeRides}</span>
                      <span className="admin-stat-label">Active Rides</span>
                    </div>
                    <div className="admin-stat-card">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="admin-stat-num">{adminStats.completedRides}</span>
                      <span className="admin-stat-label">Completed</span>
                    </div>
                    <div className="admin-stat-card">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span className="admin-stat-num">{adminStats.openReports}</span>
                      <span className="admin-stat-label">Open Reports</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {adminTab === 'users' && (
              <section className="card">
                <h2>All Users</h2>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Rating</th><th>Rides</th><th>Admin</th></tr></thead>
                    <tbody>
                      {adminUsers.map(u => (
                        <tr key={u._id}>
                          <td>
                            <div className="table-user">
                              <div className="table-avatar">{u.username?.[0]?.toUpperCase()}</div>
                              {u.username}
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td><span className={'role-badge role-' + u.role}>{u.role}</span></td>
                          <td>{'\u2605'} {u.rating || 5.0}</td>
                          <td>{u.completedRides || 0}</td>
                          <td>{u.isAdmin ? '\u2713' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminTab === 'rides' && (
              <section className="card">
                <h2>All Rides</h2>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Driver</th><th>Route</th><th>Departure</th><th>Status</th><th>Seats</th></tr></thead>
                    <tbody>
                      {adminRides.map(r => (
                        <tr key={r._id}>
                          <td>{r.driver?.username}</td>
                          <td>{r.origin?.address} &rarr; {r.destination?.address}</td>
                          <td>{new Date(r.departureTime).toLocaleString()}</td>
                          <td><span className={'ride-status status-' + r.status}>{r.status.replace('_', ' ')}</span></td>
                          <td>{r.availableSeats}/{r.vehicleCapacity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {adminTab === 'reports' && (
              <section className="card">
                <h2>Reports</h2>
                {adminReports.length === 0 && <p className="empty">No reports</p>}
                {adminReports.map(r => (
                  <div key={r._id} className="report-card">
                    <div className="report-header">
                      <span className="report-reason">{r.reason}</span>
                      <span className={'ride-status status-' + r.status}>{r.status}</span>
                    </div>
                    <div className="report-body">
                      <span>By: <strong>{r.reporter?.username}</strong></span>
                      <span>On: <strong>{r.reportedUser?.username}</strong></span>
                    </div>
                    {r.description && <p className="report-desc">{r.description}</p>}
                    {r.status === 'open' && (
                      <div className="request-actions">
                        <button className="btn-accept" onClick={() => resolveReport(r._id, 'resolved')}>Resolve</button>
                        <button className="btn-reject" onClick={() => resolveReport(r._id, 'dismissed')}>Dismiss</button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default App;
