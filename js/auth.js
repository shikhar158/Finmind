// ============================================================
// auth.js — Registration, Login, Session Management
// ============================================================

const Auth = (() => {
  const API_URL = '/api';
  const TOKEN_KEY = 'finmind_token';

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function register(name, email, password) {
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', name, email, password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  async function login(email, password) {
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  async function forgotPassword(email, name, newPassword) {
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot_password', email, name, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  // Returns Promise<User|null>
  async function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_URL}/auth`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return data.success ? data.user : null;
    } catch {
      return null;
    }
  }

  async function updateUser(updateData) {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/auth`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });
    } catch (err) {
      console.error('Update failed:', err);
    }
  }

  function logout() {
    setToken(null);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  return { register, login, logout, getCurrentUser, updateUser, isLoggedIn, forgotPassword };
})();
