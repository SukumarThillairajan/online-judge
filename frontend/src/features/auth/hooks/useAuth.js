import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/apiClient';

export const useAuth = () => {
    return useQuery({
        queryKey: ['authUser'],
        queryFn: async () => {
            // Use the configured apiClient which handles the base URL and credentials
            const response = await apiClient.get("/api/auth/verify");
            return response.data.user;
        },
        retry: false, // If it fails (401 Unauthorized), don't keep retrying. Just fail.
        staleTime: 5 * 60 * 1000 // Cache the user data for 5 minutes so it feels instant
    });
};