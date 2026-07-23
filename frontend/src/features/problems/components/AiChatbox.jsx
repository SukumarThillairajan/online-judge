import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Wrapping the AiChatBox component with forwardRef to allow parent components to call its methods
const AiChatbox = forwardRef(({ sessionId, problem, currentCode, isInterviewActive, onUserActivity }, ref) => {
    const API_URL = import.meta.env.VITE_API_BASE_URL || "";

    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const isStreamingRef = useRef(false); // Use a ref to manage the streaming lock
    const chatBottomRef = useRef(null);
    const initialMessageSent = useRef(false); // Ref to prevent double-sending in StrictMode

    // Auto-scroll to bottom as new tokens/chunks arrive
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initial prompt trigger: Ask the AI to introduce the problem when the session starts
    useEffect(() => {
        if (sessionId && messages.length === 0 && !initialMessageSent.current) {
            handleSendMessage("Hi! I'm ready to begin the interview. Please present the problem.", true);
            initialMessageSent.current = true; // Set flag to prevent re-triggering
        }
    }, [sessionId, isInterviewActive]);

    // Expose the sendGhostPrompt function to the parent component (Arena.jsx)
    useImperativeHandle(ref, () => ({
        sendGhostPrompt: (systemObservation) => {
            handleSendMessage(systemObservation, true);
        }
    }));

    const handleSendMessage = async (textToSend, isGhostPrompt = false) => {
        const messageText = textToSend || inputMessage.trim();
        // Use the ref for an immediate, non-stale check
        if (!messageText.trim() || isStreamingRef.current) return;

        isStreamingRef.current = true; // Lock immediately
        setIsStreaming(true); // Update state for UI changes

        // 1. Append User Message immediately to local UI (unless it's a hidden system prompt)
        if (!isGhostPrompt) {
            const userMsg = { role: 'user', content: messageText };
            setMessages((prev) => [...prev, userMsg]);
            if (onUserActivity) onUserActivity(); // Signal to parent that user was active
            setInputMessage('');
        }

        // 2. Prepare empty AI message slot in the UI for streaming text into
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        try {
            // 3. Use native Fetch for SSE Stream
            const response = await fetch(`${API_URL}/api/interviews/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId,
                    problemId: problem?.problemId || problem?.id,
                    message: messageText,
                    currentCode,
                    systemObservation: isGhostPrompt ? messageText : undefined,
                }),
                credentials: 'include' // Ensures cookies (auth token) are sent with the request
            });

            if (!response.ok) throw new Error("Failed to connect to AI stream");

            // 4. Connect to the HTTP Body Reader Stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            let streamDone = false;

            while (!streamDone) {
                const { value, done } = await reader.read() || {};
                if (done) break;

                const chunk = decoder.decode(value || new Uint8Array(), { stream: true });

                // SSE chunks come formatted as lines starting with "data: "
                const lines = chunk.split("\n\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.replace("data: ", "").trim();

                        if (dataStr === "[DONE]") { // Backend signals end of stream
                            streamDone = true;
                            break;
                        }

                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            if (parsed.text !== undefined) {
                                // Append chunk text directly to the latest assistant message
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastIndex = updated.length - 1;
                                    // This check ensures we don't crash if the last message isn't an assistant message
                                    if (lastIndex >= 0 && updated[lastIndex]?.role === 'assistant') {
                                        // Create a BRAND NEW object for the last message to ensure a pure state update
                                        updated[lastIndex] = {
                                            ...updated[lastIndex], // Copy all existing properties (role, etc.)
                                            content: updated[lastIndex].content + parsed.text // Append the new chunk securely
                                        };
                                    }
                                    return updated;
                                });
                            }
                        } catch (err) {
                            console.error("Partial JSON parse error in stream:", err);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Streaming error:", err);
            // Update the last message to show an error
            setMessages((prev) => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;
                if (updated[lastIndex]?.role === 'assistant') {
                    updated[lastIndex].content = '*(The interviewer encountered a connection issue. Please try sending your message again.)*';
                }
                return updated;
            });
        } finally {
            isStreamingRef.current = false; // Unlock
            setIsStreaming(false); // Update state for UI
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-100">

            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-semibold text-sm">AI Technical Interviewer</span>
                </div>
            </div>

            {/* Chat History Log */}
            <div className="grow p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
                                }`}
                        >
                            {msg.role === 'assistant' ? (
                                // Markdown rendering handles equations, code blocks, bold text, lists!
                                // The className is moved to a wrapper div to fix the breaking change in react-markdown
                                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {msg.content || '...'}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}
                <div ref={chatBottomRef} />
            </div>

            {/* User Input Area */}
            <div className="p-3 bg-gray-800 border-t border-gray-700 shrink-0">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex space-x-2"
                >
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        disabled={isStreaming || !isInterviewActive}
                        placeholder={isInterviewActive ? "Ask a question or explain your approach..." : "Interview completed."}
                        className="grow bg-gray-950 text-gray-200 text-sm px-4 py-2.5 rounded-md border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isStreaming || !inputMessage.trim() || !isInterviewActive}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
                    >
                        {isStreaming ? "Thinking..." : "Send"}
                    </button>
                </form>
            </div>

        </div>
    );
});

export default AiChatbox;