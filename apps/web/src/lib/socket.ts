import { io } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Create socket instance but don't access localStorage during module load
// Use a function to get token dynamically to avoid SSR hydration issues
export const socket = io(API_URL, {
  autoConnect: false,
  auth: (cb) => {
    // Get token dynamically when auth callback is invoked (client-side only)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      cb({ token: `Bearer ${token}` });
    } else {
      cb({ token: "" });
    }
  },
});
