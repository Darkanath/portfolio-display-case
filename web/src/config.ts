export const API = {
  experience: import.meta.env.VITE_EXPERIENCE_API ?? "http://localhost:5001",
  persona: import.meta.env.VITE_PERSONA_API ?? "http://localhost:5002",
  agent: import.meta.env.VITE_AGENT_API ?? "http://localhost:5003",
} as const;
