import axios from 'axios';

// In production, this will be your AWS URL. 
// Locally, it can be blank to let the Vite proxy work.
const API_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true // Crucial for your HTTP-Only cookies!
});

// Now you can use this instance throughout your app, for example:
//
// apiClient.post('/api/auth/login', { email, password });
// apiClient.get(`/api/problems/${problemId}`);