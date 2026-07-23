import { useState, useEffect } from 'react';

const InterviewTimer = ({ isActive, onTimeUp }) => {
    // 45 minutes = 45 * 60 = 2700 seconds
    const [timeLeft, setTimeLeft] = useState(2700);

    useEffect(() => {
        let interval = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } 
        else if (timeLeft === 0) {
            onTimeUp(); // Trigger the end-of-interview grading pipeline
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, [isActive, timeLeft, onTimeUp]);

    // Format MM:SS
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    // Turn red when under 5 minutes
    const isWarning = timeLeft < 300;

    return (
        <div className={`font-mono text-lg font-bold px-3 py-1 rounded bg-gray-900 border ${isWarning ? 'text-red-500 border-red-500 animate-pulse' : 'text-green-400 border-gray-600'}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    );
};

export default InterviewTimer;