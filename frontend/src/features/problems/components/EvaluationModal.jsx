import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EvaluationModal = ({ isOpen, evaluationData, isGrading, problemId, submissionId }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gray-800 p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        🤖 AI Interview Feedback
                    </h2>
                    {evaluationData?.rank && (
                        <div className="flex items-center gap-4">
                            <div className="text-3xl font-black text-purple-400 tracking-tighter pr-2">
                                {evaluationData.rank}
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto grow custom-scrollbar">
                    {isGrading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-400 font-medium animate-pulse">
                                AI is analyzing your chat history, code efficiency, and problem-solving approach...
                            </p>
                        </div>
                    ) : evaluationData ? (
                        <div className="space-y-6">
                            
                            {/* Summary Text */}
                            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                                <p className="text-gray-300 leading-relaxed text-sm">
                                    {evaluationData.summary}
                                </p>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MetricCard 
                                    title="Constraint Clarification" 
                                    icon="🎯"
                                    score={evaluationData.metrics.askedConstraints} 
                                    desc="Did you clarify constraints before coding?" 
                                />
                                <MetricCard 
                                    title="First Approach Quality" 
                                    icon="💡"
                                    score={evaluationData.metrics.firstApproach} 
                                    desc="Was your initial idea optimal?" 
                                />
                                <MetricCard 
                                    title="Edge Cases" 
                                    icon="🛡️"
                                    score={evaluationData.metrics.edgeCases} 
                                    desc="Did you independently handle edge cases?" 
                                />
                                <MetricCard 
                                    title="Hint Dependency" 
                                    icon="🧩"
                                    score={evaluationData.metrics.hintUsage} 
                                    desc="How many hints were needed?" 
                                />
                                <MetricCard 
                                    title="Follow-ups Answered" 
                                    icon="🗣️"
                                    score={evaluationData.metrics.followUps} 
                                    desc="How well did you handle complex follow-ups?" 
                                />
                                <MetricCard 
                                    title="Code Creativity & Speed" 
                                    icon="⚡"
                                    score={evaluationData.metrics.creativityAndSpeed} 
                                    desc="Time to AC and code elegance." 
                                />
                            </div>

                        </div>
                    ) : (
                        <div className="text-center text-red-400 py-10">
                            Failed to load evaluation data.
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-800 p-4 border-t border-gray-700 flex justify-end space-x-3">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="px-5 py-2 rounded-md font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                    >
                        Return to Dashboard
                    </button>
                    {!isGrading && evaluationData && (
                        <>
                            <button onClick={() => navigate(`/problems/${problemId}/submissions`, { state: { highlightedSubmission: submissionId } })} className="px-5 py-2 rounded-md font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-500/20">
                                Review My Submission
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper Component for the Grid
const MetricCard = ({ title, icon, score, desc }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex items-start space-x-3">
        <div className="text-2xl">{icon}</div>
        <div>
            <h4 className="text-gray-200 font-semibold text-sm">{title}</h4>
            <p className="text-gray-400 text-xs mt-1 mb-2">{desc}</p>
            {/* Displaying a visual badge based on the score (e.g., 1-5, or Excellent/Good/Poor) */}
            <span className={`text-xs font-bold px-2 py-1 rounded ${!score ? 'bg-gray-700 text-gray-300' :
                score.includes('Excellent') || score.includes('Yes') ? 'bg-green-900/50 text-green-400' :
                score.includes('Good') || score.includes('Partial') ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
            }`}>
                {score || 'N/A'}
            </span>
        </div>
    </div>
);

export default EvaluationModal;