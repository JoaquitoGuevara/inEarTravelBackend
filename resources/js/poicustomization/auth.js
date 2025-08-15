import { AUTH_TOKEN_KEY } from './constants.js';

export function getAuthToken() {
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? t : null;
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function apiFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getAuthToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

export async function ensureAuthPermission(showLoginModal) {
  try {
    const res = await apiFetch(
      '/api/userdata',
      {
        credentials: 'same-origin'
      }
    );

    if (!res.ok) {
      // Not logged in
      showLoginModal();
      return false;
    }

    const data = await res.json();
    const user = data && data.user ? data.user : data;

    if (!user || user.hasPoiCustomizationPermission !== true) {
      // Logged in but no permission
      showLoginModal('You do not have POI customization permission.');
      return false;
    }

    return true;
  } catch (_) {
    showLoginModal();
    return false;
  }
}

export function attachLogoutHandler(setAuthToken) {
  const btn = document.getElementById('logout-btn');
  if (!btn) {
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      await apiFetch(
        '/api/logout',
        { method: 'POST' }
      );
    } catch (_) {
      // ignore
    }

    setAuthToken(null);
    window.location.reload();
  });
}

export function showLoginModal(message) {
  const overlay = document.getElementById('login-modal');
  const err = document.getElementById('login-error');
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');

  if (!overlay) return;

  err.style.display = message ? 'block' : 'none';
  err.textContent = message || '';

  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');

  const onCancel = () => {
    cleanup();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const onSubmit = async () => {
    err.style.display = 'none';
    err.textContent = '';

    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      err.textContent = 'Email and password are required.';
      err.style.display = 'block';
      return;
    }

    try {
      const res = await fetch(
        '/api/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Login failed');
      }

      const data = await res.json();
      const token = (data && (data.token || data.access_token || data.plainTextToken)) || null;
      const user = data && data.user ? data.user : null;

      if (user && user.hasPoiCustomizationPermission !== true) {
        throw new Error('You do not have POI customization permission.');
      }

      if (token) {
        setAuthToken(token);
      }

      cleanup();
      window.location.reload();
    } catch (e) {
      err.textContent = e.message || 'Login failed';
      err.style.display = 'block';
    }
  };

  const cleanup = () => {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');

    const cancelBtn = document.getElementById('login-cancel');
    const submitBtn = document.getElementById('login-submit');

    if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
    if (submitBtn) submitBtn.removeEventListener('click', onSubmit);
    document.removeEventListener('keydown', onKey);
  };

  const cancelBtn = document.getElementById('login-cancel');
  const submitBtn = document.getElementById('login-submit');

  if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
  if (submitBtn) submitBtn.addEventListener('click', onSubmit);
  document.addEventListener('keydown', onKey);
}
