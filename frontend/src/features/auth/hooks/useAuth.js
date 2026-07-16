import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Ensuring that the axios always attaches the HTTP-Only cookie to the request
axios.defaults.withCredentials = true;

export const useAuth = () => {
    return useQuery({
        queryKey: ['authUser'],
        queryFn: async () => {
            const response = await axios.get("/api/auth/verify");
            return response.data.user;
        },
        retry: false, // If it fails (401 Unauthorized), don't keep retrying. Just fail.
        staleTime: 5 * 60 * 1000 // Cache the user data for 5 minutes so it feels instant
    });
};