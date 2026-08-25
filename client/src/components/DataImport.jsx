import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, XCircle, Loader, FileSpreadsheet, ArrowRight } from 'lucide-react';

const IMPORT_TYPES = [
  {
    key: 'students',
    label: 'Students',
    icon: '🎓',
    description: 'Import student records with class assignments',
    columns: ['Name', 'Admission Number', 'Class Name', 'Gender', 'Date of Birth', 'Status'],
    previewCols: ['name', 'admissionNumber', 'className', 'gender', 'dob', 'status'],
  },
  {
    key: 'parents',
    label: 'Parents',
    icon: '👨‍👩‍👧',
    description: 'Import parent accounts and link them to students',
    columns: ['Parent Name', 'Email', 'Phone', 'Password', 'Student Adm. No.'],
    previewCols: ['name', 'email', 'phone', 'admissionNumber'],
  },
  {
    key: 'scores',
    label: 'Scores',
    icon: '📊',
    description: 'Import historical exam and CA scores',
    columns: ['Adm. No.', 'Subject', 'Term', 'Session', 'CA1', 'CA2', 'Exam'],
    previewCols: ['admissionNumber', 'subjectName', 'term', 'session', 'ca1', 'ca2', 'exam'],
  },
  {
    key: 'staff',
    label: 'Staff',
    icon: '👨‍🏫',
    description: 'Import teacher and staff accounts',
    columns: ['Name', 'Email', 'Role', 'Phone', 'Password'],
    previewCols: ['name', 'email', 'role', 'phone'],
  },
];

function DataImport({ userRole }) {
  const [activeType, setActiveType] = useState('students');
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'done'
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { total, errors, rows }
  const [result, setResult] = useState(null); // { imported, skipped, errors }
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const apiUrl = import.meta.env.VITE_API_URL;

  const currentType = IMPORT_TYPES.find((t) => t.key === activeType);

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTypeChange = (key) => {
    setActiveType(key);
    reset();
  };

  const downloadTemplate = async () => {
    const res = await fetch(`${apiUrl}/import/template/${activeType}`, { headers });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeType}-template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowed.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
      setError('Please upload an Excel (.xlsx) or CSV file');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiUrl}/import/preview/${activeType}`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/import/confirm/${activeType}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview.rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm outline-none transition';

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Bulk Data Import</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Upload Excel files to import historical data into your school account.
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {IMPORT_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTypeChange(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeType === t.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:border-indigo-400'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white text-lg">
              {currentType.icon} Import {currentType.label}
            </h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">{currentType.description}</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Download size={15} /> Download Template
          </button>
        </div>

        {/* Expected columns */}
        <div className="flex flex-wrap gap-2 mb-5">
          {currentType.columns.map((col) => (
            <span key={col} className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-2 py-1 rounded-md font-mono">
              {col}
            </span>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm mb-4">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
              dragging
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-slate-200 dark:border-gray-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-gray-700/50'
            }`}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-gray-400">
                <Loader size={32} className="animate-spin" />
                <p className="text-sm">Parsing file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet size={36} className="text-indigo-400" />
                <div>
                  <p className="font-semibold text-slate-700 dark:text-white text-sm">
                    Drag & drop your Excel file here
                  </p>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                    or click to browse — .xlsx or .csv, max 5MB
                  </p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && preview && (
          <div>
            {/* Summary bar */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="bg-slate-50 dark:bg-gray-700 rounded-lg px-4 py-2 text-sm">
                <span className="text-slate-500 dark:text-gray-400">Total rows: </span>
                <span className="font-bold text-slate-800 dark:text-white">{preview.total}</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg px-4 py-2 text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">✓ Valid: </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{preview.total - preview.errors}</span>
              </div>
              {preview.errors > 0 && (
                <div className="bg-rose-50 dark:bg-rose-900/30 rounded-lg px-4 py-2 text-sm">
                  <span className="text-rose-600 dark:text-rose-400">✗ Errors: </span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">{preview.errors}</span>
                </div>
              )}
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-700 mb-5 max-h-80">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-slate-500 dark:text-gray-400">Row</th>
                    {currentType.previewCols.map((col) => (
                      <th key={col} className="px-3 py-2 text-slate-500 dark:text-gray-400 capitalize">{col}</th>
                    ))}
                    <th className="px-3 py-2 text-slate-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.row}
                      className={`border-t border-slate-50 dark:border-gray-700 ${
                        row.errors?.length ? 'bg-rose-50 dark:bg-rose-900/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-400">{row.row}</td>
                      {currentType.previewCols.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-700 dark:text-gray-200 max-w-[120px] truncate">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {row.errors?.length ? (
                          <div className="flex items-start gap-1">
                            <XCircle size={13} className="text-rose-500 mt-0.5 flex-shrink-0" />
                            <span className="text-rose-600 dark:text-rose-400">{row.errors.join('; ')}</span>
                          </div>
                        ) : (
                          <CheckCircle size={13} className="text-emerald-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.errors > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                ⚠️ Rows with errors will be skipped. {preview.total - preview.errors} valid rows will be imported.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || preview.total - preview.errors === 0}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                {loading ? <><Loader size={14} className="animate-spin" /> Importing...</> : <><ArrowRight size={14} /> Confirm Import ({preview.total - preview.errors} rows)</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 'done' && result && (
          <div className="text-center py-8">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Import Complete!</h3>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{result.imported}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400">Imported</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-400">{result.skipped}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400">Skipped (duplicates/errors)</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 mb-5 text-left max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-600 dark:text-rose-400">{e}</p>
                ))}
              </div>
            )}
            <button
              onClick={reset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataImport;
