import { useState, useEffect } from 'react';
import { Send, MessageSquare, Users, History, CheckCircle, XCircle, AlertCircle, Bell } from 'lucide-react';

const TYPE_LABELS = {
  absence_alert: 'Absence Alert',
  fee_reminder: 'Fee Reminder',
  result_published: 'Results',
  custom_broadcast: 'Broadcast',
  custom_individual: 'Individual',
};

function NotificationsPanel() {
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'broadcast' | 'history'
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ totalSent: 0, totalFailed: 0 });
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Send individual form
  const [selectedParentId, setSelectedParentId] = useState('');
  const [individualMessage, setIndividualMessage] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [sendError, setSendError] = useState('');

  // Broadcast form
  const [broadcastClassId, setBroadcastClassId] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [broadcastError, setBroadcastError] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [parentsRes, classesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/parents`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/classes`, { headers }),
        ]);
        const parentsData = await parentsRes.json();
        const classesData = await classesRes.json();
        if (parentsRes.ok) setParents(parentsData);
        if (classesRes.ok) setClasses(classesData);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/history?limit=50`, { headers });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.notifications || []);
        setHistoryStats({ totalSent: data.totalSent, totalFailed: data.totalFailed });
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendIndividual = async (e) => {
    e.preventDefault();
    setSendStatus('');
    setSendError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: selectedParentId, message: individualMessage }),
      });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error); return; }
      setSendStatus('✅ Message sent successfully!');
      setIndividualMessage('');
      setSelectedParentId('');
    } catch (err) {
      setSendError(err.message);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setBroadcastStatus('');
    setBroadcastError('');
    const confirmed = window.confirm(
      `Send this message to ${broadcastClassId ? 'all parents in the selected class' : 'ALL parents in the school'}?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const body = { message: broadcastMessage };
      if (broadcastClassId) body.classId = broadcastClassId;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/notifications/broadcast`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setBroadcastError(data.error); return; }
      setBroadcastStatus(`✅ ${data.message}`);
      setBroadcastMessage('');
    } catch (err) {
      setBroadcastError(err.message);
    }
  };

  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      activeTab === tab
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
    }`;

  const inputClass = 'w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Bell size={20} className="text-indigo-500" /> WhatsApp Notifications
        </h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Send messages to parents via WhatsApp. Configure your WhatsApp credentials in Settings first.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button className={tabClass('send')} onClick={() => setActiveTab('send')}>
          <span className="flex items-center gap-1.5"><MessageSquare size={14} /> Send to Parent</span>
        </button>
        <button className={tabClass('broadcast')} onClick={() => setActiveTab('broadcast')}>
          <span className="flex items-center gap-1.5"><Users size={14} /> Broadcast</span>
        </button>
        <button className={tabClass('history')} onClick={() => setActiveTab('history')}>
          <span className="flex items-center gap-1.5"><History size={14} /> History</span>
        </button>
      </div>

      {/* Send to Individual Parent */}
      {activeTab === 'send' && (
        <div className="max-w-lg">
          <form onSubmit={handleSendIndividual} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">Send to a Parent</h3>

            {sendError && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm">
                <AlertCircle size={15} /> {sendError}
              </div>
            )}
            {sendStatus && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg text-sm font-medium">
                {sendStatus}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Select Parent</label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">-- Choose a parent --</option>
                {parents.filter((p) => p.phone && p.whatsappOptIn !== false).map((p) => (
                  <option key={p._id} value={p._id}>{p.name} ({p.phone})</option>
                ))}
              </select>
              {parents.length === 0 && !loading && (
                <p className="text-xs text-slate-400 mt-1">No parents found. Add parents with phone numbers first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Message</label>
              <textarea
                value={individualMessage}
                onChange={(e) => setIndividualMessage(e.target.value)}
                required
                rows={4}
                maxLength={1000}
                placeholder="Type your message here..."
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">{individualMessage.length}/1000 characters</p>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg transition w-full justify-center"
            >
              <Send size={15} /> Send WhatsApp Message
            </button>
          </form>
        </div>
      )}

      {/* Broadcast */}
      {activeTab === 'broadcast' && (
        <div className="max-w-lg">
          <form onSubmit={handleBroadcast} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">Broadcast Message</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Leave class empty to send to all parents in the school. Only parents with phone numbers and WhatsApp opt-in will receive the message.
            </p>

            {broadcastError && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm">
                <AlertCircle size={15} /> {broadcastError}
              </div>
            )}
            {broadcastStatus && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg text-sm font-medium">
                {broadcastStatus}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Target Class <span className="text-slate-400">(optional)</span></label>
              <select
                value={broadcastClassId}
                onChange={(e) => setBroadcastClassId(e.target.value)}
                className={inputClass}
              >
                <option value="">🏫 All classes (school-wide)</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>{cls.name} ({cls.section})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Message</label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                required
                rows={5}
                maxLength={1000}
                placeholder="Type your broadcast message here..."
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">{broadcastMessage.length}/1000 characters</p>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg transition w-full justify-center"
            >
              <Users size={15} /> Send Broadcast
            </button>
          </form>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-5 max-w-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{historyStats.totalSent}</div>
              <div className="text-xs text-slate-500 dark:text-gray-400">Total Sent</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{historyStats.totalFailed}</div>
              <div className="text-xs text-slate-500 dark:text-gray-400">Failed</div>
            </div>
          </div>

          {historyLoading ? (
            <p className="text-slate-500 dark:text-gray-400 text-sm">Loading history...</p>
          ) : history.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 p-6 text-slate-500 dark:text-gray-400 text-sm">
              No messages sent yet. Use the tabs above to send your first WhatsApp message.
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700">
                      <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Recipient</th>
                      <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Type</th>
                      <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Status</th>
                      <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((n) => (
                      <tr key={n._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm text-slate-800 dark:text-white">{n.recipientName || n.parentId?.name || '—'}</div>
                          <div className="text-xs text-slate-400 dark:text-gray-500">{n.recipientPhone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                            {TYPE_LABELS[n.type] || n.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {n.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle size={12} /> Sent
                            </span>
                          ) : n.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium" title={n.errorMessage}>
                              <XCircle size={12} /> Failed
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Queued</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-gray-400">
                          {n.sentAt ? new Date(n.sentAt).toLocaleString('en-NG') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsPanel;
