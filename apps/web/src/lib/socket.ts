import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const socket = io(API_URL, {
    autoConnect: false,
    auth: (cb) => {
        const token = localStorage.getItem('accessToken');
        cb({ token: `Bearer ${token}` });
    },
});
