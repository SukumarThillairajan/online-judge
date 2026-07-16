import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import ProblemDescription from '../components/ProblemDescription.jsx';
import CodeEditor from '../components/CodeEditor.jsx';

const Arena = () => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || '';

  // 1. Grab the problem ID from the URL (e.g., /problems/123)
  const { id } = useParams();

  // 2. Editor State Management
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('// Start your code here...');
  const [customInput, setCustomInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [verdict, setVerdict] = useState(null);

  // 3. Fetch the specific problem using React Query!
  const { data: problem, isLoading, error } = useQuery({
    queryKey: ['problem', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/problems/${id}`);
      if (!response.ok) throw new Error('Failed to fetch problem details');
      const data = await response.json();
      return data?.data; // The problem object is nested under the 'data' property
    }
  });

  // Helper function for polling
  const poll = (fn, retries = 20, interval = 1000) => {
    return new Promise((resolve, reject) => {
      const check = async (triesLeft) => {
        if (triesLeft <= 0) {
          return reject(new Error("Evaluation timed out. Please try again."));
        }
        try {
          const result = await fn();
          if (result) {
            resolve(result);
          } else {
            setTimeout(() => check(triesLeft - 1), interval);
          }
        } catch (err) {
          reject(err);
        }
      };
      check(retries);
    });
  };

  const handleRun = async () => {
    setIsEvaluating(true);
    setVerdict({ status: 'Running...', message: 'Executing code against custom input...' });
    try {
      // 1. Start the run job
      const runResponse = await axios.post(`${API_URL}/api/submissions/run`, {
        problemId: id,
        code,
        language,
        customInput,
      }, { withCredentials: true });
      const jobId = runResponse?.data?.jobId;
      if (!jobId) throw new Error("Failed to start the run job.");
      // 2. Poll for the result
      const result = await poll(async () => {
        const response = await axios.get(`${API_URL}/api/submissions/run/${jobId}/status`, { withCredentials: true });
        // When status is pending, backend returns 204 No Content, so response.data is empty.
        // When complete, it returns 200 with a body.
        if (response.status === 200 && response.data) {
          // The API returns { success: bool, data: { status: 'Success', output: '...' } }
          // We return the inner `data` object to stop polling.
          return response?.data?.data;
        }
        return null; // Continue polling
      });

      setVerdict({ status: result?.status, message: result?.output || result?.error });
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to run code. Please try again.';
      setVerdict({ status: 'Error', message: errorMessage });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmit = async () => {
    setIsEvaluating(true);
    setVerdict({ status: 'Evaluating...', message: 'Testing against hidden test cases...' });
    try {
      // 1. Create the submission
      const submitResponse = await axios.post(`${API_URL}/api/submissions/submit`, {
        problemId: id,
        code,
        language,
      }, { withCredentials: true });
      const submissionId = submitResponse?.data?.submissionId;
      if (!submissionId) throw new Error("Failed to create submission.");
      // 2. Poll for the submission status
      const result = await poll(async () => {
        const response = await axios.get(`${API_URL}/api/submissions/${submissionId}/status`, { withCredentials: true });
        // A 204 (No Content) response means the submission is still being processed.
        // A 200 (OK) response means we have a status, but it might still be "Pending".
        if (response.status === 200 && response.data) {
          const resultData = response?.data?.data; // The actual result is nested in `data`
          // Only stop polling if the verdict is no longer "Pending".
          if (resultData && resultData?.verdict !== 'Pending') {
            return resultData;
          }
        }
        // For 204 or a "Pending" 200, we return null to continue polling.
        return null; // Continue polling
      });

      setVerdict({ status: result?.verdict, message: result?.message || `Result: ${result?.verdict}` });
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Submission failed. Please try again.';
      setVerdict({ status: 'Submission Error', message: errorMessage });
    } finally {
      setIsEvaluating(false);
    }
  };

  // UI for Loading and Errors
  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading Arena...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-gray-900 text-red-500">Error: {error.message}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900 font-sans">
      
      {/* Top Navbar */}
      <nav className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <Link to="/problems" className="text-gray-400 hover:text-white transition-colors font-semibold text-sm">
            ← Back to Problems
          </Link>
          <span className="text-gray-500">|</span>
          <span className="text-white font-bold tracking-wide">Arena</span>
        </div>
        
        {/* NEW: The Submissions Button! */}
        <Link 
          to={`/problems/${id}/submissions`}
          className="text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors"
        >
          View Submissions & Leaderboard
        </Link>
      </nav>

      {/* The Split Screen Layout using CSS Grid */}
      <div className="grow grid grid-cols-1 md:grid-cols-2 min-h-0">
        
        {/* Left Pane: Problem Description */}
        <div className="border-r border-gray-700 overflow-hidden relative">
          <ProblemDescription problem={problem} />
        </div>

        {/* Right Pane: Code Editor & Terminal */}
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Top 70%: The Monaco Editor */}
          <div className="grow shrink overflow-hidden">
             <CodeEditor 
                language={language}
                setLanguage={setLanguage}
                code={code}
                setCode={setCode}
                onRun={handleRun}
                onSubmit={handleSubmit}
                isEvaluating={isEvaluating}
             />
          </div>

          {/* Bottom 30%: The Terminal / Output Window */}
          <div className="h-64 shrink-0 bg-gray-900 border-t border-gray-700 flex flex-col">
            <div className="bg-gray-800 px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700 flex items-center">
              <span className="flex-1">Terminal</span>
            </div>
            
            <div className="p-2 grid grid-cols-2 gap-2 grow min-h-0">
              {/* Custom Input Area */}
              <div className="flex flex-col h-full">
                <label htmlFor="custom-input" className="text-xs text-gray-400 mb-1 pl-1">Custom Input</label>
                <textarea
                  id="custom-input"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom input for 'Run'..."
                  className="grow bg-gray-950 text-gray-300 text-sm font-mono p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Output Area */}
              <div className="p-2 overflow-y-auto text-sm font-mono text-gray-300 bg-gray-950 rounded-md">
              {!verdict && <span className="text-gray-600 italic">Run or submit your code to see the result...</span>}

              {verdict && (
                <div className={`p-3 rounded border ${
                  verdict?.status === 'Accepted' || verdict?.status === 'Success' ? 'bg-green-900/20 border-green-800 text-green-400' : 
                  verdict?.status?.includes('ing...') ? 'bg-blue-900/20 border-blue-800 text-blue-400 animate-pulse' : 
                  'bg-red-900/20 border-red-800 text-red-400'
                }`}>
                  <div className="font-bold mb-1">{verdict.status}</div>
                  <div className="whitespace-pre-wrap font-semibold">{verdict.message}</div>
                </div>
              )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Arena;