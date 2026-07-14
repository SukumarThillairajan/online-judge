import { useState } from 'react';

// Reusable Copy Button for Test Cases
const CopyButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy} 
      className="absolute top-2 right-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors font-sans"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const ProblemDescription = ({ problem }) => {
  if (!problem) return <div className="p-6">Loading problem details...</div>;

  return (
    <div className="p-6 h-full overflow-y-auto bg-white">
      {/* Title & Difficulty */}
      <div className="border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{problem.problem_name || problem.problemName || problem.title}</h1>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full 
          ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-800' : 
            problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'}`}>
          {problem.difficulty}
        </span>
      </div>

      {/* Problem Statement */}
      <div className="prose max-w-none mb-8 text-gray-700 whitespace-pre-wrap">
        {problem.statement || problem.description}
      </div>

      {/* Sample Test Cases */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Sample Test Cases</h3>
        
        {/* Safely check for either snake_case or camelCase depending on your DB driver output */}
        {(problem.sample_testcases || problem.sampleTestCases)?.map((tc, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            
            <div className="mb-3">
              <span className="font-semibold text-gray-700">Input:</span>
              <div className="relative mt-1">
                {/* The <pre> tag renders the raw text exactly as it's formatted */}
                <pre className="text-sm font-mono bg-white p-3 rounded border border-gray-300 overflow-x-auto">
                  {tc.input || tc.Input}
                </pre>
                <CopyButton textToCopy={tc.input || tc.Input} />
              </div>
            </div>

            <div>
              <span className="font-semibold text-gray-700">Expected Output:</span>
              <div className="relative mt-1">
                <pre className="text-sm font-mono bg-white p-3 rounded border border-gray-300 overflow-x-auto">
                  {tc.expected_output || tc.output || tc.Output}
                </pre>
                <CopyButton textToCopy={tc.expected_output || tc.output || tc.Output} />
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default ProblemDescription;