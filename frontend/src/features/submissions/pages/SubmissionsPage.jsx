import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import SubmissionsList from '../components/SubmissionsList';
import Leaderboard from '../components/Leaderboard';

const SubmissionsPage = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('me');
  const API_URL = import.meta.env.VITE_API_BASE_URL || '';

  // React Query Magic: Because we already fetched this problem in the Arena, 
  // React Query will instantly load this from cache without making a new network request!
  const { data: problem } = useQuery({
    queryKey: ['problem', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/problems/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch problem');
      const data = await response.json();
      return data?.data || data;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <nav className="h-16 bg-gray-900 flex items-center px-6 justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <Link to={`/problems/${id}`} className="text-gray-400 hover:text-white transition-colors font-semibold text-sm">
            ← Back to Arena
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-white font-bold text-lg">{problem?.problemName || problem?.problem_name || problem?.title || 'Loading...'}</span>
        </div>
      </nav>

      {/* Main Content Container */}
      <div className="grow max-w-6xl w-full mx-auto p-6 flex flex-col">
        
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 mb-6 shrink-0">
          {[
            { id: 'me', label: 'My Submissions' },
            { id: 'all', label: 'All Submissions' },
            { id: 'leaderboard', label: 'Leaderboard' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="grow bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {activeTab === 'me' && <SubmissionsList problemId={id} type="me" />}
          {activeTab === 'all' && <SubmissionsList problemId={id} type="all" />}
          {activeTab === 'leaderboard' && <Leaderboard problemId={id} />}
        </div>

      </div>
    </div>
  );
};

export default SubmissionsPage;