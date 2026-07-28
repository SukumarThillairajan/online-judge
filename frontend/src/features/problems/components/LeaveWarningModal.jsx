import React from 'react';
import { useNavigate } from 'react-router-dom';

const LeaveWarningModal = ({ isOpen, onClose, onEndInterview }) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-xl max-w-md w-full">
                <h2 className="text-xl font-bold text-gray-100 mb-4">Leave Interview?</h2>
                <p className="text-gray-400 mb-6">
                    You are currently in an active interview. If you leave without ending it, your progress will not be saved or graded.
                </p>
                <div className="flex justify-end space-x-3">
                    {/* Option 1: Stay on the page */}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    {/* Option 2: Leave without saving (Deletes local storage) */}
                    <button
                        onClick={() => {
                            localStorage.removeItem('activeInterviewSession');
                            navigate('/dashboard'); 
                        }}
                        className="px-4 py-2 text-sm font-medium bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50 rounded transition-colors"
                    >
                        Leave Without Saving
                    </button>
                    {/* Option 3: End and Grade */}
                    <button
                        onClick={() => {
                            onClose(); // Close the warning modal
                            onEndInterview(); // Trigger the grading flow
                        }}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 rounded transition-colors"
                    >
                        End & Save Interview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeaveWarningModal;