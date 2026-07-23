import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Using react-syntax-highlighter for a better code viewing experience.
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const Leaderboard = ({ problemId }) => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || '';

  // State for the code-viewing modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const { data: leaderboard = [], isLoading, error } = useQuery({
    queryKey: ['leaderboard', problemId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/submissions/leaderboard/problem/${problemId}`, { withCredentials: true });
      return response.data.data || [];
    },
    // Keep data fresh but don't refetch too aggressively
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading leaderboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error fetching leaderboard: {error.message}</div>;
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-600">Rank</th>
            <th className="px-4 py-3 font-medium text-gray-600">User</th>
            <th className="px-4 py-3 font-medium text-gray-600">Language</th>
            <th className="px-4 py-3 font-medium text-gray-600 text-center">Score</th>
            <th className="px-4 py-3 font-medium text-gray-600">Submitted</th>
            <th className="px-4 py-3 font-medium text-gray-600 text-center">Code</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {leaderboard.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-10 text-gray-500">
                No accepted submissions yet. Be the first!
              </td>
            </tr>
          ) : (
            leaderboard.map((entry, index) => (
              <tr key={entry.submissionId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-700">#{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{entry.username}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded">
                    {entry.language}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                      entry.gamifiedRank === 'S-Rank' ? 'bg-purple-100 text-purple-800' :
                      entry.gamifiedRank === 'A-Rank' ? 'bg-blue-100 text-blue-800' :
                      entry.gamifiedRank === 'B-Rank' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {entry.gamifiedRank}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setSelectedSubmission(entry)}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Code Viewing Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4" onClick={() => setSelectedSubmission(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-white font-bold">
                {selectedSubmission.username}'s Submission
              </h3>
              <button onClick={() => setSelectedSubmission(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="overflow-auto">
              <SyntaxHighlighter language={selectedSubmission.language} style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '0 0 0.75rem 0.75rem' }}>
                {selectedSubmission.code}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
      </div>
  );
};

export default Leaderboard;