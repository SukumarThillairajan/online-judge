const Leaderboard = ({ problemId }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h bg-white p-8 text-center">
      
      {/* Cool Trophy/Flask Icon */}
      <div className="bg-blue-50 text-blue-600 p-5 rounded-full mb-6 shadow-sm border border-blue-100">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>

      {/* Copy */}
      <h2 className="text-2xl font-extrabold text-gray-900 mb-3 tracking-tight">
        Leaderboard Compiling...
      </h2>
      <p className="text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
        The global ranking system is currently undergoing complex analytical processing. Check back in Version 2.0 to see how your runtime and memory efficiency stacks up against the best!
      </p>

      {/* V2 Badge */}
      <span className="bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest shadow-md">
        Coming in V2 Roadmap
      </span>
      
    </div>
  );
};

export default Leaderboard;