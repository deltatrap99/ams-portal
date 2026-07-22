/**
 * Dashboard Rendering Module
 * Builds all dashboard sections from sheet data
 */

const Dashboard = (() => {

  /**
   * Render the complete dashboard for the logged-in ambassador
   * @param {object} ambassador - Ambassador data from Auth
   */
  async function render(ambassador) {
    showLoading(true);

    try {
      // Update header
      renderHeader(ambassador);

      // Render profile
      renderProfile(ambassador);

      // Fetch and render orders
      const orders = await getOrdersForAmbassador(ambassador.code);
      renderOrders(orders);

      // Render commission
      renderCommission(ambassador, orders);

      // Fetch and render connected ambassadors
      const connected = await getConnectedAmbassadors(ambassador.code);
      renderConnected(connected);

      // Update stats
      renderStats(ambassador, orders, connected);

    } catch (err) {
      console.error('Dashboard render error:', err);
    } finally {
      showLoading(false);
    }
  }

  /**
   * Update header with user info
   */
  function renderHeader(amb) {
    const initials = getInitials(amb.name);
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('headerUserName').textContent = amb.name;
    document.getElementById('headerUserCode').textContent = `Mã AMS: ${amb.code}`;
    document.getElementById('welcomeName').textContent = amb.name;
  }

  /**
   * Render profile info grid
   */
  function renderProfile(amb) {
    const grid = document.getElementById('profileGrid');
    
    // Find PD name from the connected ambassadors lookup
    const pdName = amb.pd || '--';

    const items = [
      { label: 'Mã Đại sứ Tiếp thị', value: amb.code, icon: '🏷️' },
      { label: 'Họ và tên', value: amb.name, icon: '👤' },
      { label: 'Số điện thoại', value: amb.phone, icon: '📱' },
      { label: 'Email cá nhân', value: amb.email, icon: '📧' },
      { label: 'Email Hocmai', value: amb.emailHocmai, icon: '🎓' },
      { label: 'Ngày đăng ký', value: amb.registrationDate, icon: '📅' },
      { label: 'Ngày tạo mã', value: amb.createdDate, icon: '📆' },
      { label: 'Nguồn', value: amb.source || '--', icon: '🔗' },
      { label: 'Mã Đại sứ kết nối', value: amb.connectorCode || '--', icon: '🤝' },
      { label: 'PD hỗ trợ', value: pdName, icon: '👨‍💼' },
      { label: 'Mã code V-ACT', value: amb.vactCode || '--', icon: '🎫', copyable: true },
      { label: 'Link giới thiệu ĐSTT mới', value: amb.referralLink || '--', icon: '🔗', isLink: true, copyable: true },
    ];

    grid.innerHTML = items.map(item => {
      let valueHtml;
      if (item.isLink && item.value !== '--') {
        const shortLink = item.value.length > 50 ? item.value.substring(0, 50) + '...' : item.value;
        valueHtml = `
          <a href="${item.value}" target="_blank" rel="noopener">${shortLink}</a>
          <button class="btn-copy" onclick="Dashboard.copyToClipboard(this, '${item.value}')" title="Sao chép link">
            <span class="btn-copy-icon">📋</span>
            <span class="btn-copy-text">Copy</span>
            <span class="btn-copy-done">✅ Đã copy</span>
          </button>
        `;
      } else if (item.copyable && item.value !== '--') {
        valueHtml = `
          <span class="copy-value">${item.value}</span>
          <button class="btn-copy" onclick="Dashboard.copyToClipboard(this, '${item.value}')" title="Sao chép mã">
            <span class="btn-copy-icon">📋</span>
            <span class="btn-copy-text">Copy</span>
            <span class="btn-copy-done">✅ Đã copy</span>
          </button>
        `;
      } else {
        valueHtml = item.value;
      }

      return `
        <div class="profile-item">
          <div class="label">${item.icon} ${item.label}</div>
          <div class="value">${valueHtml}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Get orders matching the ambassador's code
   */
  async function getOrdersForAmbassador(ambCode) {
    try {
      const { data } = await SheetsAPI.fetchOrders();
      // Column J (index 9) = Mã ĐSTT (number)
      return data.filter(row => {
        const orderAmbCode = (row[9] || '').trim();
        return orderAmbCode === ambCode.trim();
      });
    } catch (err) {
      console.error('Error fetching orders:', err);
      return [];
    }
  }

  /**
   * Render orders table
   */
  function renderOrders(orders) {
    const container = document.getElementById('ordersContent');
    const badge = document.getElementById('ordersBadge');
    badge.textContent = `${orders.length} đơn`;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Chưa có đơn hàng nào</p>
        </div>
      `;
      return;
    }

    // Order columns: A(0)=Mã đơn, B(1)=Học phí, C(2)=Ngày tạo, D(3)=Ngày xác nhận,
    // E(4)=Họ tên HV, F(5)=SĐT, G(6)=Email HV, H(7)=Mã code ĐSTT,
    // I(8)=landing_page_code, J(9)=Mã ĐSTT, K(10)=Họ tên ĐSTT, L(11)=Tháng, M(12)=Khóa học
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Họ tên Học viên</th>
            <th>SĐT</th>
            <th>Khóa học</th>
            <th>Học phí</th>
            <th>Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(row => `
            <tr>
              <td>${row[0] || '--'}</td>
              <td>${row[4] || '--'}</td>
              <td>${row[5] || '--'}</td>
              <td>${row[12] || '--'}</td>
              <td class="amount">${formatCurrency(row[1])}</td>
              <td>${formatDate(row[2])}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Render commission section
   */
  function renderCommission(ambassador, orders) {
    const container = document.getElementById('commissionContent');

    // Calculate total from orders
    const totalFromOrders = orders.reduce((sum, row) => {
      return sum + parseCurrencyValue(row[1]);
    }, 0);

    const totalRevenue = parseCurrencyValue(ambassador.totalRevenue);
    const monthRevenue = parseCurrencyValue(ambassador.monthRevenue);

    container.innerHTML = `
      <div class="profile-grid">
        <div class="profile-item">
          <div class="label">💰 Tổng doanh thu (theo DS ĐSTT)</div>
          <div class="value" style="font-size:1.15rem;font-weight:700;color:var(--accent-emerald)">${formatCurrency(ambassador.totalRevenue)}</div>
        </div>
        <div class="profile-item">
          <div class="label">📅 Doanh thu tháng hiện tại</div>
          <div class="value" style="font-size:1.15rem;font-weight:700;color:var(--accent-amber)">${formatCurrency(ambassador.monthRevenue)}</div>
        </div>
        <div class="profile-item">
          <div class="label">🛒 Tổng học phí từ đơn hàng</div>
          <div class="value" style="font-size:1.15rem;font-weight:700;color:var(--accent-blue)">${totalFromOrders > 0 ? totalFromOrders.toLocaleString('vi-VN') + ' đ' : '0 đ'}</div>
        </div>
      </div>
    `;
  }

  /**
   * Get ambassadors connected to this ambassador
   */
  async function getConnectedAmbassadors(ambCode) {
    try {
      const { data } = await SheetsAPI.fetchAmbassadors();
      // Column J (index 9) = Mã ĐS kết nối
      return data.filter(row => {
        const connCode = (row[9] || '').trim();
        return connCode === ambCode.trim();
      });
    } catch (err) {
      console.error('Error fetching connected ambassadors:', err);
      return [];
    }
  }

  /**
   * Render connected ambassadors table
   */
  function renderConnected(connected) {
    const container = document.getElementById('connectedContent');
    const badge = document.getElementById('connectedBadge');
    badge.textContent = `${connected.length} người`;

    if (connected.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <p>Chưa có Đại sứ Tiếp thị nào kết nối</p>
        </div>
      `;
      return;
    }

    // Columns: A(0)=Ngày ĐK, B(1)=Mã AMS, C(2)=Ngày tạo mã, D(3)=Họ tên,
    // O(14)=Tổng DT, P(15)=DT tháng
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Mã AMS</th>
            <th>Họ tên</th>
            <th>Ngày tạo mã</th>
            <th>Tổng doanh thu</th>
            <th>DT tháng</th>
          </tr>
        </thead>
        <tbody>
          ${connected.map(row => `
            <tr>
              <td>${row[1] || '--'}</td>
              <td>${row[3] || '--'}</td>
              <td>${row[2] || '--'}</td>
              <td class="amount">${formatCurrency(row[14])}</td>
              <td class="amount">${formatCurrency(row[15])}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Update stats cards
   */
  function renderStats(ambassador, orders, connected) {
    document.getElementById('statRevenue').textContent = formatCurrency(ambassador.totalRevenue);
    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statConnected').textContent = connected.length;
    document.getElementById('statMonthRevenue').textContent = formatCurrency(ambassador.monthRevenue);
  }

  // ---- Utility Functions ---- //

  function getInitials(name) {
    if (!name) return 'DS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  function formatCurrency(value) {
    if (!value || value === '0' || value === '--') return '0 đ';
    // Handle values like "6,960,000" or "0"
    const num = parseCurrencyValue(value);
    if (num === 0) return '0 đ';
    return num.toLocaleString('vi-VN') + ' đ';
  }

  function parseCurrencyValue(value) {
    if (!value || value === '--') return 0;
    // Remove commas and parse
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    // Handle "7/15/2026 15:59:05" format
    try {
      const parts = dateStr.split(' ');
      return parts[0] || dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  function copyToClipboard(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    });
  }

  function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }

  return {
    render,
    copyToClipboard,
    showLoading
  };
})();
