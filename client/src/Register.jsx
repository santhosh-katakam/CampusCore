import React, { useState, useEffect } from 'react';
import axios from './api/axios';

const Register = ({ onBack }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'STUDENT',
        institutionId: ''
    });
    const [institutions, setInstitutions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchInstitutions = async () => {
            try {
                const res = await axios.get('/auth/institutions-public');
                setInstitutions(res.data);
                if (res.data.length > 0) {
                    setFormData(prev => ({ ...prev, institutionId: res.data[0]._id }));
                }
            } catch (err) {
                console.error('Failed to fetch institutions', err);
            }
        };
        fetchInstitutions();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await axios.post('/auth/register', formData);
            setSuccess('Registration successful! You can now log in.');
            setTimeout(() => {
                onBack();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-4">
            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">Create Account</h1>
                    <p className="text-gray-500 font-medium">Join your institution's portal</p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-lg animate-pulse" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-r-lg" role="alert">
                        <p className="font-bold">Success</p>
                        <p>{success}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="name">Full Name</label>
                            <input
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                id="name" name="name" type="text" placeholder="John Doe" required
                                value={formData.name} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="email">Email Address</label>
                        <input
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                            id="email" name="email" type="email" placeholder="john@example.com" required
                            value={formData.email} onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="username">Username</label>
                            <input
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                id="username" name="username" type="text" placeholder="johndoe123" required
                                value={formData.username} onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="password">Password</label>
                            <input
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                id="password" name="password" type="password" placeholder="••••••••" required
                                value={formData.password} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="role">I am a...</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                id="role" name="role" required
                                value={formData.role} onChange={handleChange}
                            >
                                <option value="STUDENT">Student</option>
                                <option value="FACULTY">Faculty</option>
                                <option value="HOD">HOD / Head of Dept</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="institutionId">Institution</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                id="institutionId" name="institutionId" required
                                value={formData.institutionId} onChange={handleChange}
                            >
                                {institutions.map(inst => (
                                    <option key={inst._id} value={inst._id}>{inst.name}</option>
                                ))}
                                {institutions.length === 0 && <option value="">No institutions available</option>}
                            </select>
                        </div>
                    </div>

                    {(formData.role === 'STUDENT' || formData.role === 'FACULTY' || formData.role === 'HOD') && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="department">Department</label>
                                <input
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                    id="department" name="department" type="text" placeholder="e.g. CSE" required
                                    value={formData.department} onChange={handleChange}
                                />
                            </div>
                            {formData.role === 'STUDENT' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1" htmlFor="batch">Batch / Year</label>
                                    <input
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-purple-500 focus:ring-0 transition-all outline-none bg-gray-50/50"
                                        id="batch" name="batch" type="text" placeholder="e.g. 2025-29" required
                                        value={formData.batch} onChange={handleChange}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        type="submit" disabled={loading || institutions.length === 0}
                    >
                        {loading ? 'Processing...' : 'Register Now'}
                    </button>

                    <p className="text-center text-gray-500 text-sm mt-6">
                        Already have an account?{' '}
                        <button type="button" onClick={onBack} className="text-purple-600 font-bold hover:underline">
                            Log In
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
