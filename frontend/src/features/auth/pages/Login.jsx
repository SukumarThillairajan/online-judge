import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
    const navigate = useNavigate();
    const [apiError, setApiError] = useState(null);

    const onSubmit = async (data) => {
        setApiError(null); // Clear previous errors on a new submission
        try {
            // The backend expects `emailId` instead of `email`.
            const payload = {
                emailId: data.email,
                password: data.password,
            };

            await axios.post('/api/auth/login', payload);

            // If successful, navigate to the home/dashboard page
            navigate('/');
        }
        catch (error) {
            console.error("Login failed: ", error);
            // Set a general API error message to display in the UI
            const message = error.response?.data?.message || "Login failed. Please check your credentials and try again.";
            setApiError(message);
            // Optionally, you can also set a specific field error using react-hook-form's setError
            if (message.toLowerCase().includes('email')) {
                setError('email', { type: 'server', message });
            }
        }
    };

    return (
        < div className = "min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8" >
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                Sign in
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {/* API Error Message Box */}
                    {apiError && (
                        <div className="mb-4 bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-md relative" role="alert">
                            <span className="block sm:inline">{apiError}</span>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300">
                                Email address
                            </label>
                        <div className="mt-1">
                            <input
                                {...register("email", { required: "Email is required" })}
                                type="email"
                                className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                            />
                            {errors.email && <span className="text-red-500 text-xs mt-1">{errors.email.message}</span>}
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300">
                            Password
                        </label>
                        <div className="mt-1">
                            <input
                                {...register("password", { required: "Password is required" })}
                                type="password"
                                className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-700 text-white"
                            />
                            {errors.password && <span className="text-red-500 text-xs mt-1">{errors.password.message}</span>}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {isSubmitting ? "Signing in..." : "Sign in"}
                        </button>
                    </div>
                    
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-400">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-medium text-blue-500 hover:text-blue-400">
                            Sign up here
                        </Link>
                    </p>
                </div>

                </div>
            </div>
        </div >
    );
};