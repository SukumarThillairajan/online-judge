import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient.js';
import { useQuery } from '@tanstack/react-query';

import SubmissionsList from '../components/SubmissionsList';
import Leaderboard from '../components/Leaderboard';

const SubmissionsPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('me'); // Default to 'me'

  // On component mount, check the URL hash to set the active tab
  useEffect(() => {
    const hash = location.hash.substring(1); // remove the '#'
    if (hash === 'leaderboard') setActiveTab('leaderboard');
  }, [location.hash]);

  // React Query Magic: Because we already fetched this problem in the Arena, 
  // React Query will instantly load this from cache without making a new network request!
  const { data: problem } = useQuery({
    queryKey: ['problem', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/problems/${id}`);
      const data = response.data;
      return data.data || data;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <nav className="h-16 bg-gray-900 flex items-center px-6 justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors font-semibold text-sm">
            ← Back to Dashboard
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
          {activeTab === 'leaderboard' && <Leaderboard problemId={id} />}
        </div>

      </div>
    </div>
  );
};

export default SubmissionsPage;