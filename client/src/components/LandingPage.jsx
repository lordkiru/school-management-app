import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

function LandingPage({ darkMode, setDarkMode }) {
  return (
    <div className="min-h-screen bg-[#faf8f3] dark:bg-[#0b1120] text-slate-900 dark:text-slate-200 antialiased selection:bg-indigo-500 selection:text-white">

      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 bg-[#faf8f3]/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">

            {/* BRAND LOGO */}
            <Link to="/" className="flex items-center group">
              <img
                src="/assets/logo.png"
                alt="Lemida SchoolManager"
                className="h-10 sm:h-12 w-auto transition-transform group-hover:scale-105"
              />
            </Link>

            {/* Theme Toggle + Login Button CTA */}
            <div className="flex items-center gap-3">
              <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} inline />
              <Link to="/login" className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section
        className="relative pt-10 pb-24 md:pt-20 md:pb-32 overflow-hidden min-h-[70vh] flex items-center"
        style={{
          backgroundImage: darkMode
            ? 'radial-gradient(circle at 50% -20%, rgba(79, 57, 246, 0.18) 0%, rgba(11, 17, 32, 0) 70%)'
            : 'radial-gradient(circle at 50% -20%, rgba(79, 57, 246, 0.12) 0%, rgba(250, 251, 252, 0) 70%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* Hero Content */}
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-pulse"></span>
              Built Specifically for Nigerian Private Schools
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-indigo-500 dark:from-indigo-400 dark:to-indigo-300">Lemida SchoolManager</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
              Manage your school, all in one place.
            </p>

            <div className="pt-4 flex items-center justify-center">
              <Link to="/login" className="w-full sm:w-auto inline-flex items-center justify-center px-10 py-4 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all">
                Log In
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#faf8f3] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/assets/logo.png" alt="Lemida SchoolManager" className="h-8 w-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; 2026 Lemida Technologies. All rights reserved. Built for Nigerian Education.
          </p>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
