import { useState, useEffect } from 'react';

function SchoolSettings() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('https://school-saas-backend-v8i3.onrender.com/school', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        setName(data.name || '');
        setAddress(data.address || '');
        setLogoUrl(data.logoUrl || '');
      } catch (err) {
        setError('Failed to load school settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSchool();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://school-saas-backend-v8i3.onrender.com/school', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, address, logoUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSuccess('School settings updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading settings...</p>;

  const inputClass =
    'w-full mb-3 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <div className="p-6">
      <form
        onSubmit={handleSubmit}
        className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 max-w-md"
      >
        <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">School Settings</h2>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-green-900 text-emerald-600 dark:text-green-200 text-sm p-2 rounded-lg mb-3">
            {success}
          </div>
        )}

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">School Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="School address, city, state"
          className={inputClass}
        />

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Logo URL</label>
        <input
          type="text"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://... or /logo.png"
          className={inputClass}
        />
        <p className="text-xs text-slate-400 mb-4">
          Paste a link to your logo image, or a path like /logo.png if you've added the file to the
          client's public folder.
        </p>

        {logoUrl && (
          <img src={logoUrl} alt="Logo preview" className="h-16 object-contain mb-4" />
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

export default SchoolSettings;