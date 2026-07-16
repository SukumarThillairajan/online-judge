//import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const Dashboard = () => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || '';

  const { data: problems = [], isLoading, error } = useQuery({
    queryKey: ['problems'], // This is the unique "cache key"
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/problems`);
      if (!response.ok) {
        throw new Error('Failed to fetch problems');
      }
      const data = await response.json();
      return data.data || [];
    },
  });

  // Helper function to color-code difficulty tags
  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Coding Arena</h1>
          <p className="mt-2 text-sm text-gray-600">Select a problem below to begin your evaluation.</p>
        </div>

        {/* State Handling: Loading & Error */}
        {isLoading && <p className="text-blue-600 font-medium animate-pulse">Loading problems...</p>}
        {error && <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">{error}</div>}

        {/* The Problem Table */}
        {!isLoading && !error && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Solve</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {problems?.map((problem) => (
                  <tr key={problem.problemId} className="hover:bg-gray-50 transition-colors">
                    
                    {/* Status Column (Placeholder for V1) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-400 font-bold" title="Not Attempted">−</span>
                    </td>

                    {/* Title Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{problem.problemName}</div>
                    </td>

                    {/* Difficulty Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getDifficultyColor(problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        to={`/problems/${problem.problemId}`} 
                        className="text-blue-600 hover:text-blue-900 font-semibold"
                      >
                        Solve
                      </Link>
                    </td>
                  </tr>
                ))}
                
                {/* Empty State */}
                {problems.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No problems found. Start by adding some in your database!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;