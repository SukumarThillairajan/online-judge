import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../../api/apiClient.js';
import CodeEditor from '../components/CodeEditor.jsx';
import AiChatbox from '../components/AiChatbox.jsx';
import InterviewTimer from '../components/InterviewTimer.jsx';
import EvaluationModal from '../components/EvaluationModal.jsx';
import LeaveWarningModal from '../components/LeaveWarningModal.jsx';

const Arena = () => {
  const { id: problemId } = useParams();

  // --- Master Interview State ---
  const [sessionId, setSessionId] = useState(null);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const chatBoxRef = useRef(null); // Ref to shoot Ghost Prompts into the Chatbox
  const idleTimerRef = useRef(null); // Ref to store the inactivity timer
  const [lastActivityTime, setLastActivityTime] = useState(Date.now()); // New state to track any user activity

  // --- Editor & Execution State ---
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('// Start your code here...');
  const [customInput, setCustomInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [verdict, setVerdict] = useState(null);
  // --- Interview Ending States ---
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);

  // --- Grading Modal State ---
  const [evaluationData, setEvaluationData] = useState(null);
  const [isGrading, setIsGrading] = useState(false);
  const [finalSubmissionId, setFinalSubmissionId] = useState(null);

  // --- Leave Warning Modal State ---
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  // Fetch Problem Details
  const { data: problem, isLoading, error } = useQuery({
    queryKey: ['problem', problemId],
    queryFn: async () => {
      // Use the configured apiClient which uses axios
      const response = await apiClient.get(`/api/problems/${problemId}`);
      // Axios responses are already parsed. The data is in `response.data`.
      // We don't need to check `response.ok` because axios throws an error for non-2xx status codes.
      return response.data.data || response.data;
    },
    retry: (failureCount, error) => { // Stops the console from flooding with auth errors
      if (error.response?.status === 401) {
        console.warn("Unauthorized access while fetching problem details.");
        return false; // Stop retrying on 401 Unauthorized
      }
      return failureCount < 3; // Default retry for other network errors
    }
  });

  // Start the interview session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const res = await apiClient.post('/api/interviews/start', { problemId });
        // Account for different backend JSON response wrappers
        setSessionId(res.data.sessionId || res.data.data?.sessionId);
        setIsInterviewActive(true);
      } catch (err) {
        console.error("Failed to start interview session", err);
      }
    };
    if (problemId && !sessionId) {
      initializeSession();
    }
  }, [problemId, sessionId]);

  // Callback for child components to signal user activity
  const handleUserActivity = () => {
    setLastActivityTime(Date.now());
  };

  // Inactivity Ghost Prompt: If the user hasn't typed for 5 minutes, check in.
  useEffect(() => {
    // Only track time if the interview is actively running
    if (!isInterviewActive) return;

    // 1. Clear the previous timer every time the user types a new character
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    // 2. Set a new timer for 5 minutes (5 * 60 * 1000 ms)
    idleTimerRef.current = setTimeout(() => {
      // 3. Trigger the Ghost Prompt via the chatBoxRef
      if (chatBoxRef.current) {
        chatBoxRef.current.sendGhostPrompt(
          "[SYSTEM MESSAGE]: The candidate has been idle (no code or chat) for 5 minutes. Please gently ask them if they are stuck or need a hint."
        );
      }
    }, 300000); // 300,000 milliseconds = 5 minutes

    // Cleanup function when component unmounts or interview ends
    return () => clearTimeout(idleTimerRef.current);
    // This effect now re-runs on code changes OR chat messages (via lastActivityTime)
  }, [code, isInterviewActive, lastActivityTime]);

  // Polling Helper Function
  const poll = (fn, retries = 20, interval = 1000) => {
    return new Promise((resolve, reject) => {
      const check = async (triesLeft) => {
        if (triesLeft <= 0) return reject(new Error("Evaluation timed out."));
        try {
          const result = await fn();
          if (result) resolve(result);
          else setTimeout(() => check(triesLeft - 1), interval);
        } catch (err) {
          reject(err);
        }
      };
      check(retries);
    });
  };

  // --- 2. RUN CUSTOM CODE (No DB Insert, No Ghost Prompt) ---
  const handleRun = async () => {
    if (!isInterviewActive) {
      setVerdict({ status: 'Error', message: 'The interview has ended. You cannot run further code.' });
      return;
    }

    setIsEvaluating(true);
    setVerdict({ status: 'Evaluating...', message: 'Running custom code...' });

    try {
      const runRes = await apiClient.post('/api/submissions/run', {
        language,
        code,
        customInput
      });

      const jobId = runRes.data.jobId || runRes.data.data?.jobId;

      const finalResult = await poll(async () => {
        const statusRes = await apiClient.get(`/api/submissions/run/${jobId}/status`);
        const currentStatus = statusRes.data.status || statusRes.data.data?.status;

        if (currentStatus !== 'Pending' && !currentStatus.includes('ing')) {
          return statusRes.data.data || statusRes.data;
        }
        return null;
      });

      // Update the Terminal UI and conditionally send a ghost prompt
      if (finalResult.status === 'Success' || finalResult.output) {
        setVerdict({ status: 'Success', message: finalResult.output || 'Execution successful.' });

        // --- HYBRID ARCHITECTURE: GHOST PROMPT FOR POTENTIAL WRONG ANSWERS ON CUSTOM RUNS ---
        // Let the AI check if the output for the custom input is correct.
        const ghostPrompt = `SYSTEM OBSERVATION: The user just ran their code with a custom input.
          Custom Input:
          \`\`\`
          ${finalResult.input || '(empty)'}
          \`\`\`
          Their Code's Output:
          \`\`\`
          ${finalResult.output || '(empty)'}
          \`\`\`
          Based on the problem statement, silently check if their output is correct for their input.
          - If the output is correct, DO NOT SAY ANYTHING. Remain silent.
          - If the output is INCORRECT, gently intervene. Explain why their output is wrong for that specific input and nudge them towards the correct logic. Do NOT give them the corrected code.`;

        if (chatBoxRef.current && isInterviewActive) {
          chatBoxRef.current.sendGhostPrompt(ghostPrompt);
        }
      } else {
        const errorMessage = finalResult.details || finalResult.output || 'Execution failed.';
        setVerdict({ status: finalResult.error || 'Error', message: errorMessage });

        // --- HYBRID ARCHITECTURE: THE GHOST PROMPT FOR RUN FAILURES ---
        const ghostPrompt = `SYSTEM OBSERVATION: The user attempted to run their code with custom input, but it crashed with a ${finalResult.error || 'System Error'}. 
          The compiler/system outputted this exact error trace: \n\n${errorMessage}\n\n
          Point out the syntax, memory, or runtime error in their current code conceptually. 
          Be brief and do NOT write the full corrected code for them.`;

        if (chatBoxRef.current && isInterviewActive) {
          chatBoxRef.current.sendGhostPrompt(ghostPrompt);
        }
      }

    } catch (error) {
      console.error("Run Error:", error);
      setVerdict({ status: 'Error', message: error.response?.data?.message || error.message });
    } finally {
      setIsEvaluating(false);
    }
  };

  // --- 3. SUBMIT CODE (DB Insert + AI Ghost Prompt) ---
  const handleSubmit = async () => {
    if (!isInterviewActive) {
      setVerdict({ status: 'Error', message: 'The interview has ended. You cannot submit further code.' });
      return;
    }

    setIsEvaluating(true);
    setVerdict({ status: 'Evaluating...', message: 'Running hidden test cases...' });

    try {
      // Step A: Submit to DB and Docker Queue
      const submitRes = await apiClient.post('/api/submissions/submit', {
        problemId,
        language,
        code,
        sessionId // Pass the active session ID with the submission
      });

      const submissionId = submitRes.data.submissionId || submitRes.data.data?.submissionId;

      // Step B: Wait for execution engine
      const finalResult = await poll(async () => {
        const statusRes = await apiClient.get(`/api/submissions/${submissionId}/status`);
        const currentVerdict = statusRes.data.verdict || statusRes.data.data?.verdict;

        if (currentVerdict !== 'Pending' && !currentVerdict.includes('ing')) {
          return statusRes.data.data || statusRes.data;
        }
        return null;
      });

      // The /submit pipeline persists everything into the 'errorDetails' JSONB column, so the
      // trace lives at errorDetails.details -- NOT at the top level like the /run pipeline,
      // which returns its result straight from the Redis cache.
      const errDetails = finalResult.errorDetails || {};

      // Step C: Display accurate Terminal UI based on evaluation.service.js response
      let terminalMessage = "";
      if (finalResult.verdict === 'Accepted') {
        terminalMessage = 'All hidden test cases passed!';
      }
      else if (finalResult.verdict === 'Compilation Error' || finalResult.verdict === 'Runtime Error') {
        // Show the actual trace (e.g. g++ missing semicolon) in the terminal
        terminalMessage = errDetails.details || "Execution failed due to a system/syntax error.";
      }
      else if (finalResult.verdict === 'Wrong Answer') {
        // Deliberately vague. Revealing the failing input or the expected output here would
        // expose the hidden test cases and rob the AI interviewer of the chance to nudge the
        // candidate towards the edge case themselves. The real values go to the ghost prompt below.
        terminalMessage = 'Your output did not match the expected output on a hidden test case.';
      }
      else {
        terminalMessage = errDetails.details || `Execution failed with verdict: ${finalResult.verdict}`;
      }

      setVerdict({ status: finalResult.verdict, message: terminalMessage });

      // Step D: Construct the HYBRID ARCHITECTURE Ghost Prompt
      let ghostPrompt = "";

      if (finalResult.verdict === 'Accepted') {
        ghostPrompt = `SYSTEM OBSERVATION: The user's code just passed all hidden test cases successfully! 
          Congratulate them briefly, and ask ONE theoretical follow-up question regarding their approach (e.g., 'How would you handle this if the array was 100 times larger?'). 
          Do NOT end the interview.`;
      }
      else if (finalResult.verdict === 'Wrong Answer') {
        // Keys must match exactly what evaluation.service.js writes into errorDetails:
        // failedAtTestCase, input, expectedOutput, actualOutput.
        ghostPrompt = `SYSTEM OBSERVATION: The user submitted their code, but it failed on a hidden test case.
          Input: ${errDetails.input || 'Hidden'},
          Expected Output: ${errDetails.expectedOutput || 'Hidden'},
          User's Output: ${errDetails.actualOutput || 'Hidden'}.
          Nudge them gently towards the edge case they missed based on this input.
          Do NOT give them the direct answer.`;
      }
      else {
        // Send Compilation/Runtime trace to AI
        ghostPrompt = `SYSTEM OBSERVATION: The user's code resulted in a ${finalResult.verdict}.
          The compiler/system outputted this error: \n${errDetails.details || 'Unknown Error'}\n
          Point out the syntax, memory, or runtime error in their current code conceptually without writing the full solution for them.`;
      }

      // Step E: Fire the hidden prompt to the AI!
      if (chatBoxRef.current && isInterviewActive) {
        chatBoxRef.current.sendGhostPrompt(ghostPrompt);
      }

    } catch (error) {
      console.error("Submission Error:", error);
      setVerdict({ status: 'Error', message: error.response?.data?.message || error.message });
    } finally {
      setIsEvaluating(false);
    }
  };

  // --- 1. THE AI GRADING TRIGGER (Ends the Interview) ---
  const handleEndInterview = async () => {
    setIsInterviewActive(false); // Freezes Chat and Code Editor
    setShowEvaluationModal(true); // Pops the modal immediately
    setIsGrading(true);

    try {
      const res = await apiClient.post('/api/interviews/finish', {
        sessionId,
        problemId,
        finalCode: code,
        language: language
      });

      const evaluationResult = res.data.data || res.data;

      // The backend should return the newly created submission ID for the modal button
      if (evaluationResult.submissionId) {
        setFinalSubmissionId(evaluationResult.submissionId);
      }

      setEvaluationData(evaluationResult);
    } catch (err) {
      console.error("Failed to grade interview:", err);
      // The modal will show an error state if evaluationData is null

      if (err.response?.status === 429) {
        alert("The AI is currently analyzing your last code submission! Please wait 5 seconds and try ending the interview again.");
        setShowEvaluationModal(false); // Close modal so they can try again
      }
      else {
        alert("An error occurred while grading. Please try again.");
        setShowEvaluationModal(false);
      }
    } finally {
      setIsGrading(false);
    }
  };

  // UI for Loading and Errors
  if (isLoading || !sessionId) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Initializing AI Interviewer...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-gray-900 text-red-500">Error: {error.message}</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-900 font-sans">

      <EvaluationModal
        isOpen={showEvaluationModal}
        isGrading={isGrading}
        evaluationData={evaluationData}
        problemId={problemId}
        submissionId={finalSubmissionId}
        leaderboardUrl={`/submissions/${problemId}#leaderboard`}
      />

      <LeaveWarningModal
        isOpen={showLeaveWarning}
        onClose={() => setShowLeaveWarning(false)}
        onEndInterview={handleEndInterview}
      />

      {/* Top Navbar */}
      <nav className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowLeaveWarning(true)}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            ← Go back to dashboard
          </button>
          <span className="text-gray-500">|</span>
          <span className="text-white font-bold tracking-wide">Mock Interview Mode</span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-gray-400 text-sm">Time Remaining:</span>
          <InterviewTimer
            isActive={isInterviewActive}
            onTimeUp={handleEndInterview}
          />
          {/* The Manual "End Interview" Button */}
          {isInterviewActive && (
            <button
              onClick={handleEndInterview}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-sm px-4 py-1.5 rounded transition-colors ml-4"
            >
              End Interview
            </button>
          )}
        </div>
      </nav>

      {/* The Split Screen Layout */}
      <div className="grow grid grid-cols-1 md:grid-cols-2 min-h-0">

        {/* Left Pane: AI Chatbox */}
        <div className="border-r border-gray-700 overflow-hidden relative flex flex-col bg-gray-50">
          <AiChatbox
            ref={chatBoxRef}
            sessionId={sessionId}
            problem={problem}
            currentCode={code}
            isInterviewActive={isInterviewActive}
            onUserActivity={handleUserActivity} // Pass down the activity handler
          />
        </div>

        {/* Right Pane: Code Editor & Terminal */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="grow shrink overflow-hidden">
            <CodeEditor
              language={language}
              setLanguage={setLanguage}
              code={code}
              setCode={(newCode) => {
                setCode(newCode);
                handleUserActivity(); // Signal activity on code change
              }}
              onRun={handleRun}
              onSubmit={handleSubmit}
              isEvaluating={isEvaluating}
            />
          </div>

          <div className="h-64 shrink-0 bg-gray-900 border-t border-gray-700 flex flex-col">
            <div className="bg-gray-800 px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700 flex items-center">
              <span className="flex-1">Terminal</span>
            </div>

            <div className="p-2 grid grid-cols-2 gap-2 grow min-h-0">
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

              <div className="p-2 overflow-y-auto text-sm font-mono text-gray-300 bg-gray-950 rounded-md">
                {!verdict && <span className="text-gray-600 italic">Run or submit your code to see the result...</span>}

                {verdict && (
                  <div className={`p-3 rounded border ${verdict.status === 'Accepted' || verdict.status === 'Success' ? 'bg-green-900/20 border-green-800 text-green-400' :
                    verdict.status.includes('ing...') ? 'bg-blue-900/20 border-blue-800 text-blue-400 animate-pulse' :
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