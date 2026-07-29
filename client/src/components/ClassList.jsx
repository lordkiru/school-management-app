import { useState, useEffect, useCallback } from 'react';

function ClassList({ refreshKey }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/classes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load classes');
      }

      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses, refreshKey]);

  if (loading) return <p className="p-6">Loading classes...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Classes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Level</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls._id} className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-2 pr-4">{cls.name}</td>
                <td className="py-2 pr-4">{cls.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ClassList;