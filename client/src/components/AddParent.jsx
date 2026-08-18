import { useState } from 'react';
import { Search } from 'lucide-react';

function AddParent({ onParentAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const searchStudents = async (query) => {
    if (!query || query.length < 2) {
      setStudents([]);
      return;
    }

    setSearchingStudents(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/students?search=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search students');

      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const toggleChild = (studentId) => {
    setSelectedChildren((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add parent');
      }

      // Link selected children to the parent
      const parentId = data._id;
      for (const childId of selectedChildren) {
        try {
          await fetch(`${import.meta.env.VITE_API_URL}/parents/${parentId}/link-child`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ studentId: childId }),
          });
        } catch (err) {
          console.error('Failed to link child:', err);
        }
      }

      setSuccess(`Parent added successfully with ${selectedChildren.length} child(ren) linked!`);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setSelectedChildren([]);
      setStudentSearch('');
      setStudents([]);
      onParentAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-6">
      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Add Parent</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Parent Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="parent@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="+234 800 000 0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Password *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Minimum 6 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Link Children (Optional)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                searchStudents(e.target.value);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          
          {searchingStudents && (
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">Searching...</p>
          )}

          {students.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
              {students.map((student) => (
                <label
                  key={student._id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedChildren.includes(student._id)}
                    onChange={() => toggleChild(student._id)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-800 dark:text-white">
                    {student.name} ({student.admissionNumber}) - {student.classId?.name || 'No class'}
                  </span>
                </label>
              ))}
            </div>
          )}

          {selectedChildren.length > 0 && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
              {selectedChildren.length} child(ren) selected
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Adding...' : 'Add Parent'}
        </button>
      </form>
    </div>
  );
}

export default AddParent;
