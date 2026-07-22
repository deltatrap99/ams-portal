/**
 * Google Sheets GViz API Integration
 * Fetches data from public Google Sheets via the Visualization API
 * Auto-refreshes cache every 30 minutes
 */

const SheetsAPI = (() => {
  const SPREADSHEET_ID = '1d7eMP2qS_dx61bkqktz7l3e7nUw_1Km6-Zav_R4S9VE';
  const BASE_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

  const SHEET_GIDS = {
    dsdstt: '0',           // DS ĐSTT - Ambassador list
    dashboard: '1885270222', // Dashboard
    orders: '157758769'     // DS đơn hàng
  };

  // Cache with TTL (30 minutes = 1,800,000ms)
  const CACHE_TTL = 30 * 60 * 1000;
  const cache = {};

  /**
   * Check if a cache entry is still valid
   */
  function isCacheValid(key) {
    if (!cache[key]) return false;
    return (Date.now() - cache[key].timestamp) < CACHE_TTL;
  }

  /**
   * Fetch and parse data from a Google Sheet tab via GViz JSON API
   */
  async function fetchSheet(gid) {
    if (isCacheValid(gid)) return cache[gid].data;

    const url = `${BASE_URL}?tqx=out:json&gid=${gid}`;
    const response = await fetch(url);
    const text = await response.text();

    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonStr);

    if (data.status !== 'ok') {
      throw new Error('Google Sheets API returned error status');
    }

    const headers = data.table.cols.map(col => col.label || col.id);
    const rows = data.table.rows.map(row =>
      row.c.map(cell => {
        if (!cell) return null;
        return cell.f || cell.v;
      })
    );

    const result = { headers, rows };
    cache[gid] = { data: result, timestamp: Date.now() };
    return result;
  }

  /**
   * Fetch CSV data from a Google Sheet tab
   */
  async function fetchCSV(gid) {
    const cacheKey = `csv_${gid}`;
    if (isCacheValid(cacheKey)) return cache[cacheKey].data;

    const url = `${BASE_URL}?tqx=out:csv&gid=${gid}`;
    const response = await fetch(url);
    const text = await response.text();

    const rows = parseCSV(text);
    cache[cacheKey] = { data: rows, timestamp: Date.now() };
    return rows;
  }

  /**
   * Simple CSV parser that handles quoted fields
   */
  function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField.trim());
          if (currentRow.some(f => f !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          if (char === '\r') i++;
        } else {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Fetch the ambassador list (DS ĐSTT)
   */
  async function fetchAmbassadors() {
    const rows = await fetchCSV(SHEET_GIDS.dsdstt);
    const headers = rows[0];
    const data = rows.slice(1).filter(row => row[1] && row[1].trim() !== '');
    return { headers, data };
  }

  /**
   * Fetch orders (DS đơn hàng)
   */
  async function fetchOrders() {
    const rows = await fetchCSV(SHEET_GIDS.orders);
    const headers = rows[2] || [];
    const data = rows.slice(3).filter(row => row[0] && row[0].trim() !== '' && row[4] && row[4].trim() !== '');
    return { headers, data };
  }

  /**
   * Force clear all cache (used before a refresh)
   */
  function clearCache() {
    for (const key in cache) {
      delete cache[key];
    }
  }

  /**
   * Get last refresh timestamp (most recent cache entry)
   */
  function getLastRefreshTime() {
    let latest = 0;
    for (const key in cache) {
      if (cache[key].timestamp > latest) {
        latest = cache[key].timestamp;
      }
    }
    return latest || null;
  }

  return {
    SHEET_GIDS,
    CACHE_TTL,
    fetchSheet,
    fetchCSV,
    fetchAmbassadors,
    fetchOrders,
    clearCache,
    getLastRefreshTime
  };
})();
