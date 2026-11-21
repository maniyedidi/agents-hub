export const TOKEN_KEY = "agents-hub-token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers
    }
  });
  const result = await response.json();

  if (response.status === 401 && path !== "/api/auth/login") {
    clearToken();
    window.dispatchEvent(new Event("auth-expired"));
  }

  if (!response.ok) {
    throw new Error(result.error || "The request could not be completed.");
  }

  return result;
}

export const setToken = token => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
