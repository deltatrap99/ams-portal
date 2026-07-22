/**
 * Authentication Module
 * Validates ambassador credentials against Google Sheets data
 */

const Auth = (() => {
  const SESSION_KEY = 'ams_session';

  /**
   * Authenticate user with code and password
   * @param {string} code - Mã AMS
   * @param {string} password - MK cổng tra cứu
   * @returns {Promise<{success: boolean, ambassador?: object, error?: string}>}
   */
  async function login(code, password) {
    try {
      const { headers, data } = await SheetsAPI.fetchAmbassadors();

      // Column indices (0-based from CSV):
      // A(0)=Ngày Đki, B(1)=Mã AMS, C(2)=Ngày tạo, D(3)=Họ tên,
      // E(4)=SĐT, F(5)=Email, G(6)=Email hocmai, H(7)=MK cổng tra cứu,
      // I(8)=Nguồn, J(9)=Mã ĐS kết nối, K(10)=PD, L(11)=CS,
      // M(12)=Link giới thiệu, N(13)=Mã code VACT,
      // O(14)=Tổng doanh thu, P(15)=Doanh thu T7

      const trimmedCode = code.trim();
      const trimmedPassword = password.trim();

      // Find matching ambassador
      const match = data.find(row => {
        const rowCode = (row[1] || '').trim();
        const rowPassword = (row[7] || '').trim();
        return rowCode === trimmedCode && rowPassword === trimmedPassword;
      });

      if (!match) {
        return {
          success: false,
          error: 'Mã Đại sứ hoặc Mật khẩu không đúng. Vui lòng kiểm tra lại.'
        };
      }

      const ambassador = {
        registrationDate: match[0] || '',
        code: match[1] || '',
        createdDate: match[2] || '',
        name: match[3] || '',
        phone: match[4] || '',
        email: match[5] || '',
        emailHocmai: match[6] || '',
        password: match[7] || '',
        source: match[8] || '',
        connectorCode: match[9] || '',
        pd: match[10] || '',
        cs: match[11] || '',
        referralLink: match[12] || '',
        vactCode: match[13] || '',
        totalRevenue: match[14] || '0',
        monthRevenue: match[15] || '0'
      };

      // Save to session
      saveSession(ambassador);

      return { success: true, ambassador };
    } catch (err) {
      console.error('Login error:', err);
      return {
        success: false,
        error: 'Lỗi kết nối. Vui lòng thử lại sau.'
      };
    }
  }

  /**
   * Save session
   */
  function saveSession(ambassador) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ambassador));
  }

  /**
   * Get current session
   */
  function getSession() {
    const data = sessionStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Logout
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    SheetsAPI.clearCache();
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return getSession() !== null;
  }

  return {
    login,
    getSession,
    logout,
    isLoggedIn
  };
})();
