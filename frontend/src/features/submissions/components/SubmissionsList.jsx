import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// A tiny, reusable button component that handles its own "Copied!" state
const CopyButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation(); // Prevents the row click event from firing when clicking the button
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset back to "Copy" after 2 seconds
  };

  return (
    <button 
      onClick={handleCopy} 
      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy Code'}
    </button>
  );
};

const SubmissionsList = ({ problemId, type }) => {
  // State for our Pop-Up Modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const API_URL = import.meta.env.VITE_API_BASE_URL || '';

  const { data: submissions = [], isLoading, error } = useQuery({
    queryKey: ['submissions', problemId, type],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/submissions/problem/${problemId}/${type}`);
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      return data.data || [];
    }
  });

  if (isLoading) return <div className="p-6 text-gray-400">Loading submissions...</div>;
  if (error) return <div className="p-6 text-red-400">Error: {error.message}</div>;

  // 1. REVERSE CHRONOLOGICAL SORTING
  // We create a shallow copy [...] so we don't mutate React Query's cached data directly
  const sortedSubmissions = [...submissions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="overflow-y-auto h-full bg-white relative">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedSubmissions.map((sub) => (
            <tr 
              key={sub.submissionId} 
              // 2. MAKE ROW CLICKABLE
              onClick={() => setSelectedSubmission(sub)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`font-bold ${
                  sub.verdict === 'Accepted' ? 'text-green-600' : 
                  sub.verdict === 'Pending' ? 'text-blue-500' : 'text-red-600'
                }`}>
                  {sub.verdict}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                {sub.language}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(sub.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
          {sortedSubmissions.length === 0 && (
            <tr>
              <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                No submissions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* THE CODEFORCES-STYLE POP-UP MODAL */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Submission Details</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Submitted on {new Date(selectedSubmission.createdAt).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSubmission(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto grow bg-gray-100">
              
              {/* Verdict & Error Details */}
              <div className={`mb-6 p-4 rounded-md border ${
                selectedSubmission.verdict === 'Accepted' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <h4 className="font-bold text-lg mb-1">{selectedSubmission.verdict}</h4>
                {selectedSubmission.errorDetails && (
                  <pre className="mt-2 text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                    {typeof selectedSubmission.errorDetails === 'object' 
                      ? JSON.stringify(selectedSubmission.errorDetails, null, 2) 
                      : selectedSubmission.errorDetails}
                  </pre>
                )}
              </div>

              {/* Submitted Code Window */}
              <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-inner">
                <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-gray-300 text-xs font-mono uppercase">{selectedSubmission.language} source code</span>
                  <CopyButton textToCopy={selectedSubmission.code} />
                </div>
                <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {selectedSubmission.code}
                </pre>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionsList;