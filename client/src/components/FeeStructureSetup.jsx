import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function FeeStructureSetup() {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [items, setItems] = useState([{ name: '', amount: '' }]);
  const [existing, setExisting] = useState(null); // existing structure for this class/term/session
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition';

  useEffect(() => {
    const token = localStorage.getItem('token');

    const fetchClasses = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClasses(await res.json());
      } catch (err) { console.error(err); }
    };

    const fetchSessions = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSessions(data);
        const current = data.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) { console.error(err); }
    };

    fetchClasses();
    fetchSessions();
  }, []);

  // When class/term/session change, check if a structure already exists for them
  useEffect(() => {
    if (!classId || !term || !session) {
      setExisting(null);
      setItems([{ name: '', amount: '' }]);
      return;
    }

    const fetchExisting = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({ term, session });
        const res = await fetch(`${import.meta.env.VITE_API_URL}/fee-structure?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const match = data.find((s) => s.classId?._id === classId);
        if (match) {
          setExisting(match);
          setItems(match.items.length > 0 ? match.items.map(i => ({ name: i.name, amount: i.amount })) : [{ name: '', amount: '' }]);
        } else {
          setExisting(null);
          setItems([{ name: '', amount: '' }]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExisting();
  }, [classId, term, session]);

  const addItem = () => setItems([...items, { name: '', amount: '' }]);

  const updateItem = (index, field, value) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index) => {
    if (items.length === 1) return; // keep at least one row
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validItems = items.filter((i) => i.name.trim() && i.amount !== '');
    if (validItems.length === 0) {
      setError('Please add at least one fee item with a name and amount.');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      let res;
      if (existing) {
        // Update existing
        res = await fetch(`${import.meta.env.VITE_API_URL}/fee-structure/${existing._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: validItems.map(i => ({ name: i.name.trim(), amount: Number(i.amount) })) }),
        });
      } else {
        // Create new
        res = await fetch(`${import.meta.env.VITE_API_URL}/fee-structure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            classId,
            term,
            session,
            items: validItems.map(i => ({ name: i.name.trim(), amount: Number(i.amount) })),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setExisting(data);
      setItems(data.items.map(i => ({ name: i.name, amount: i.amount })));
      setSuccess('Fee structure saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!window.confirm('Delete this fee structure? This cannot be undone.')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fee-structure/${existing._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setExisting(null);
      setItems([{ name: '', amount: '' }]);
      setSuccess('Fee structure deleted.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Fee Structure Setup</h2>
        <p className="text-xs text-slate-400 mb-5">
          Define the fee breakdown for each class per term. This is for reference and printing — it does not automatically create student fee records.
        </p>

        {/* Class / Term / Session selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${inputClass} w-full`}>
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={`${inputClass} w-full`}>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} className={`${inputClass} w-full`}>
              <option value="">Select a session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>{s.name} {s.isCurrent ? '(current)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-400 mb-4">Loading existing structure...</p>}

        {existing && (
          <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            ✏️ Editing existing structure for <strong>{existing.classId?.name}</strong> — {term}, {session}
          </div>
        )}

        {/* Fee items */}
        {classId && term && session && (
          <form onSubmit={handleSave}>
            {error && (
              <div className="mb-3 p-2 bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm rounded-lg">{error}</div>
            )}
            {success && (
              <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-200 text-sm rounded-lg">{success}</div>
            )}

            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-[1fr_140px_36px] gap-2 text-xs text-slate-500 dark:text-gray-400 px-1">
                <span>Fee Item Name</span>
                <span>Amount (₦)</span>
                <span></span>
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="e.g. Tuition Fee, PTA Levy..."
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateItem(index, 'amount', e.target.value)}
                    placeholder="0"
                    min="0"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 mb-5 transition"
            >
              <Plus size={15} /> Add another item
            </button>

            <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-gray-700 mb-5">
              <span className="text-sm font-semibold text-slate-700 dark:text-gray-300">Total</span>
              <span className="text-base font-bold text-slate-800 dark:text-white">₦{total.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                <Save size={15} /> {saving ? 'Saving...' : existing ? 'Update Structure' : 'Save Structure'}
              </button>

              {existing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 text-rose-600 hover:text-rose-800 dark:text-rose-400 text-sm font-medium transition"
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </div>
          </form>
        )}

        {!classId && (
          <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-6">
            Select a class, term, and session above to set up the fee structure.
          </p>
        )}
      </div>
    </div>
  );
}

export default FeeStructureSetup;
