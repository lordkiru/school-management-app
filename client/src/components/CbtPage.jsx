import { useState } from 'react';
import CbtBuilder from './CbtBuilder';
import CbtResults from './CbtResults';

// The CBT Tests page: the test builder beside the list of tests. "Edit" on a draft test in the list loads it
// into the builder; saving (or cancelling) puts the builder back to creating a new test.
function CbtPage({ refreshKey, onChanged }) {
  const [editingTest, setEditingTest] = useState(null);
  const [flash, setFlash] = useState('');

  const startEdit = (test) => {
    setFlash('');
    setEditingTest(test);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // on a phone the builder sits above the list
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
      <CbtBuilder
        key={editingTest ? editingTest._id : 'new'} // a fresh builder for each test (or for a new one)
        editTest={editingTest}
        flash={flash}
        onTestCreated={onChanged}
        onTestSaved={(saved) => {
          setEditingTest(null);
          setFlash(`Changes saved to "${saved.title}". It is still a draft; publish it when ready.`);
          onChanged();
        }}
        onCancelEdit={() => setEditingTest(null)}
      />
      <CbtResults refreshKey={refreshKey} onEdit={startEdit} editingId={editingTest ? editingTest._id : null} />
    </div>
  );
}

export default CbtPage;
