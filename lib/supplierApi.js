export function buildSupplierUrl(supplier, custCode, subPath = '') {
  const base = String(supplier.api_url || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Supplier API URL is empty');
  if (!custCode) throw new Error('cust_code is empty');
  const encoded = encodeURIComponent(String(custCode).trim());
  const hashkey = supplier.api_hashkey ? `?hashkey=${encodeURIComponent(String(supplier.api_hashkey).trim())}` : '';
  const suffix = subPath ? `/${String(subPath).replace(/^\/+/, '')}` : '';
  return `${base}/${encoded}${suffix}${hashkey}`;
}

export function resolveCustCodes(supplier) {
  const raw = supplier.api_cust_codes;
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []);
  const cleaned = (arr || []).map((c) => String(c).trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  if (supplier.api_cust_code && String(supplier.api_cust_code).trim()) {
    return [String(supplier.api_cust_code).trim()];
  }
  return [];
}

export async function fetchSupplierJson(supplier, custCode, subPath = '', basePath = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    let url;
    if (basePath) {
      const root = String(supplier.api_url || '').trim().replace(/\/+$/, '');
      const base = root.replace(/\/(product|products)$/, '');
      const tmpSupplier = { ...supplier, api_url: `${base}/${basePath}` };
      url = buildSupplierUrl(tmpSupplier, custCode, subPath);
    } else {
      url = buildSupplierUrl(supplier, custCode, subPath);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Supplier API responded with ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Supplier API request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
