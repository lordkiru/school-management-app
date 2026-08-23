import { useState, useEffect } from 'react';
import { Copy, Check, Link2 } from 'lucide-react';

function SchoolSettings() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [ca1Max, setCa1Max] = useState(20);
  const [ca2Max, setCa2Max] = useState(20);
  const [examMax, setExamMax] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    // Fetch the school's tenantId so admins can view/share the Parent Portal link.
    // This is the "School ID" parents need to sign in at /portal.
    const fetchTenant = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/tenants/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTenantId(data.tenantId || '');
        }
      } catch {
        // Non-critical — leave blank if unavailable
      }
    };
    fetchTenant();

    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        setName(data.name || '');
        setAddress(data.address || '');
        setLogoUrl(data.logoUrl || '');
        setCa1Max(data.ca1Max ?? 20);
        setCa2Max(data.ca2Max ?? 20);
        setExamMax(data.examMax ?? 60);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, address, logoUrl, ca1Max, ca2Max, examMax }),
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

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // Clipboard unavailable (e.g., insecure context) — user can select manually
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/school/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload logo');

      setLogoUrl(data.logoUrl);
      setSuccess('Logo uploaded successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
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

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">School Logo</label>

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Current logo"
            className="h-20 object-contain mb-3 rounded-lg border border-slate-100 dark:border-gray-700 p-2"
          />
        )}

        <input
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          disabled={uploading}
          className="w-full mb-1 text-sm text-slate-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-sm file:font-medium hover:file:bg-indigo-700 file:cursor-pointer disabled:opacity-50"
        />
        <p className="text-xs text-slate-400 mb-4">
          {uploading ? 'Uploading...' : 'Upload a PNG or JPG. It will be resized automatically.'}
        </p>

        <div className="border-t border-slate-100 dark:border-gray-700 pt-4 mt-2 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-1">
            Continuous Assessment Weighting
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Set the maximum score for each component. These should add up to your school's total (usually 100).
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">CA1 Max</label>
              <input
                type="number"
                value={ca1Max}
                onChange={(e) => setCa1Max(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">CA2 Max</label>
              <input
                type="number"
                value={ca2Max}
                onChange={(e) => setCa2Max(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Exam Max</label>
              <input
                type="number"
                value={examMax}
                onChange={(e) => setExamMax(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs mt-2 text-slate-400">
            Total: {ca1Max + ca2Max + examMax}
            {ca1Max + ca2Max + examMax !== 100 && (
              <span className="text-amber-600"> (doesn't add up to 100 — grades will still be calculated proportionally)</span>
            )}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Parent Portal access — shows the School ID and a shareable sign-in link */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 max-w-md mt-6">
        <h2 className="text-lg font-bold mb-1 text-slate-800 dark:text-white flex items-center gap-2">
          <Link2 size={18} /> Parent Portal Access
        </h2>
        <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
          Share these with parents so they can sign in at the Parent Portal.
        </p>

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">School ID</label>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={tenantId}
            readOnly
            className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => copyToClipboard(tenantId, 'schoolId')}
            disabled={!tenantId}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 transition flex items-center gap-1 text-sm"
          >
            {copiedField === 'schoolId' ? <Check size={14} /> : <Copy size={14} />}
            {copiedField === 'schoolId' ? 'Copied' : 'Copy'}
          </button>
        </div>

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Portal Sign-in Link</label>
        <p className="text-xs text-slate-400 mb-2">
          Parents who open this link won't need to type the School ID — it's filled in automatically.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={tenantId ? `${window.location.origin}/portal?tenantId=${tenantId}` : ''}
            readOnly
            className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white text-xs font-mono break-all"
          />
          <button
            type="button"
            onClick={() =>
              copyToClipboard(`${window.location.origin}/portal?tenantId=${tenantId}`, 'portalLink')
            }
            disabled={!tenantId}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1 text-sm whitespace-nowrap"
          >
            {copiedField === 'portalLink' ? <Check size={14} /> : <Copy size={14} />}
            {copiedField === 'portalLink' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SchoolSettings;