import { Sun, Moon } from 'lucide-react';

// inline=true → renders as a plain inline button (for use inside a header bar)
// inline=false (default) → renders as absolute-positioned floating button (legacy, login page)
function ThemeToggle({ darkMode, setDarkMode, inline = false }) {
  if (inline) {
    return (
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
        aria-label="Toggle dark mode"
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    );
  }

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      aria-label="Toggle dark mode"
    >
      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

export default ThemeToggle;
