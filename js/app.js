/**
 * AMS Affiliate Portal - Main Application
 * Entry point, routing, auto-refresh, and global event handlers
 */

(function() {
  'use strict';

  const loginPage = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  const logoutBtn = document.getElementById('logoutBtn');

  // Auto-refresh interval (30 minutes)
  const REFRESH_INTERVAL = 30 * 60 * 1000;
  let refreshTimer = null;
  let countdownTimer = null;

  /**
   * Initialize the application
   */
  function init() {
    // Initialize theme
    initTheme();

    if (Auth.isLoggedIn()) {
      const ambassador = Auth.getSession();
      showDashboard(ambassador);
    } else {
      showLogin();
    }

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Manual refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleManualRefresh);
    }

    // Theme toggle buttons
    const themeBtn = document.getElementById('themeBtn');
    const loginThemeBtn = document.getElementById('loginThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (loginThemeBtn) loginThemeBtn.addEventListener('click', toggleTheme);
  }

  /**
   * Initialize theme from localStorage
   */
  function initTheme() {
    const saved = localStorage.getItem('ams_theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    updateThemeIcons();
  }

  /**
   * Toggle between light and dark theme
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';

    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    localStorage.setItem('ams_theme', newTheme);
    updateThemeIcons();
  }

  /**
   * Update all theme toggle button icons
   */
  function updateThemeIcons() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const icon = isLight ? '☀️' : '🌙';
    const btns = document.querySelectorAll('.btn-theme');
    btns.forEach(btn => btn.textContent = icon);
  }

  /**
   * Handle login form submission
   */
  async function handleLogin(e) {
    e.preventDefault();

    const code = document.getElementById('loginCode').value;
    const password = document.getElementById('loginPassword').value;

    if (!code || !password) return;

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    hideError();

    const result = await Auth.login(code, password);

    if (result.success) {
      showDashboard(result.ambassador);
    } else {
      showError(result.error);
    }

    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }

  /**
   * Handle logout
   */
  function handleLogout() {
    Auth.logout();
    stopAutoRefresh();
    showLogin();
    document.getElementById('loginCode').value = '';
    document.getElementById('loginPassword').value = '';
    hideError();
  }

  /**
   * Handle manual refresh button click
   */
  async function handleManualRefresh() {
    if (!Auth.isLoggedIn()) return;

    const btn = document.getElementById('refreshBtn');
    const icon = btn.querySelector('.refresh-icon');
    icon.classList.add('spinning');
    btn.disabled = true;

    // Force clear cache and re-render
    SheetsAPI.clearCache();
    const ambassador = Auth.getSession();

    // Re-login to get fresh ambassador data too
    const freshResult = await Auth.login(ambassador.code, ambassador.password);
    if (freshResult.success) {
      Auth.logout(); // Clear old session
      // Re-save with fresh data
      sessionStorage.setItem('ams_session', JSON.stringify(freshResult.ambassador));
      await Dashboard.render(freshResult.ambassador);
    } else {
      await Dashboard.render(ambassador);
    }

    showToast('✅ Dữ liệu đã được cập nhật');
    resetCountdown();

    icon.classList.remove('spinning');
    btn.disabled = false;
  }

  /**
   * Start auto-refresh timer (30 min interval)
   */
  function startAutoRefresh() {
    stopAutoRefresh();

    // Main refresh every 30 minutes
    refreshTimer = setInterval(async () => {
      if (!Auth.isLoggedIn()) return;

      console.log('[Auto-refresh] Refreshing data...');
      SheetsAPI.clearCache();
      const ambassador = Auth.getSession();

      // Re-login for fresh data
      const freshResult = await Auth.login(ambassador.code, ambassador.password);
      if (freshResult.success) {
        sessionStorage.setItem('ams_session', JSON.stringify(freshResult.ambassador));
        await Dashboard.render(freshResult.ambassador);
      } else {
        await Dashboard.render(ambassador);
      }

      showToast('🔄 Dữ liệu đã tự động cập nhật');
      resetCountdown();
    }, REFRESH_INTERVAL);

    // Countdown timer (updates every minute)
    resetCountdown();
    countdownTimer = setInterval(updateCountdown, 60 * 1000);
  }

  /**
   * Stop auto-refresh timer
   */
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  /**
   * Reset the countdown display
   */
  function resetCountdown() {
    window._lastRefreshTime = Date.now();
    updateCountdown();
  }

  /**
   * Update the countdown text in the refresh bar
   */
  function updateCountdown() {
    const el = document.getElementById('refreshCountdown');
    if (!el) return;

    const lastRefresh = window._lastRefreshTime || Date.now();
    const elapsed = Date.now() - lastRefresh;
    const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
    const minutes = Math.ceil(remaining / 60000);

    if (minutes <= 1) {
      el.textContent = 'Cập nhật sau chưa đầy 1 phút';
    } else {
      el.textContent = `Tự động cập nhật sau ${minutes} phút`;
    }
  }

  /**
   * Show login page
   */
  function showLogin() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.remove('active');
    stopAutoRefresh();
  }

  /**
   * Show dashboard page
   */
  function showDashboard(ambassador) {
    loginPage.classList.add('hidden');
    dashboardPage.classList.add('active');
    Dashboard.render(ambassador);
    startAutoRefresh();
  }

  /**
   * Show a toast notification
   */
  function showToast(message) {
    // Remove any existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showError(message) {
    loginErrorText.textContent = message;
    loginError.classList.add('show');
  }

  function hideError() {
    loginError.classList.remove('show');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
