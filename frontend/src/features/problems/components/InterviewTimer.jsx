import { useState, useEffect } from 'react';

// 45 minutes = 45 * 60 = 2700 seconds. Matches INTERVIEW_DURATION_MS on the backend.
const SESSION_DURATION_SECONDS = 45 * 60;

// startedAt is the server's authoritative session start time (ISO string/Date). Deriving
// timeLeft from it on every tick (instead of just decrementing a counter) means a page reload
// recovers the true remaining time instead of resetting the clock to a fresh 45 minutes.
const computeTimeLeft = (startedAt) => {
    if (!startedAt) return SESSION_DURATION_SECONDS;
    const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, SESSION_DURATION_SECONDS - elapsedSeconds);
};

const InterviewTimer = ({ isActive, onTimeUp, startedAt }) => {
    const [syncedStartedAt, setSyncedStartedAt] = useState(startedAt);
    const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(startedAt));

    // Re-sync once the real startedAt arrives/changes (e.g. after session hydration resolves
    // just after mount). Adjusted during render, per React's guidance, rather than via a
    // synchronous setState-in-effect (which would trigger an extra cascading render).
    if (startedAt !== syncedStartedAt) {
        setSyncedStartedAt(startedAt);
        setTimeLeft(computeTimeLeft(startedAt));
    }

    useEffect(() => {
        let interval = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(computeTimeLeft(startedAt));
            }, 1000);
        }
        else if (timeLeft === 0) {
            onTimeUp(); // Trigger the end-of-interview grading pipeline
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, [isActive, timeLeft, onTimeUp, startedAt]);

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