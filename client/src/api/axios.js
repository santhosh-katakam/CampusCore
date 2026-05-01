import axios from 'axios';

// Create an Axios instance with a base URL
const api = axios.create({
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:4000/api' 
        : 'https://campuscore-5thv.onrender.com/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor (optional, good for debugging or auth tokens)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }

        // Check if Company Admin is "viewing" a specific college
        const viewingId = localStorage.getItem('viewingInstitutionId');
        if (viewingId) {
            config.headers['x-institution-id'] = viewingId;
        } else {
            // Get institution from logged-in user details
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user.institutionId) {
                        config.headers['x-institution-id'] = user.institutionId;
                    }
                } catch (e) {
                    console.error('Error parsing user from localStorage', e);
                }
            } else {
                const envId = import.meta.env.VITE_INSTITUTION_ID;
                if (envId) {
                    config.headers['x-institution-id'] = envId;
                }
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle common errors (401, 403, 500) centrally if needed
        if (error.response && error.response.status === 401) {
            console.error('Unauthorized - Token expired or invalid. Logging out.');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('viewingInstitutionId');
            localStorage.removeItem('viewingInstitutionName');
            window.location.reload();
        } else if (error.code === 'ERR_NETWORK') {
            console.error('Network Error: Server might be down or CORS issue.');
        }
        return Promise.reject(error);
    }
);

export default api;
