'use client';

import { useEffect, useState } from 'react';

const DEFAULT = {
  name: 'SMLAO Soft Co,Ltd',
  slogan: '',
  tax_id: '',
  business_reg_no: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
  bank_accounts: [],
  vat_enabled: false,
  vat_rate: 0,
  vat_mode: 'exclusive',
  vat_label: 'VAT',
};

let cached = null;
let inFlight = null;

export function useCompanyProfile() {
  const [profile, setProfile] = useState(cached || DEFAULT);

  useEffect(() => {
    if (cached) { setProfile(cached); return; }
    if (!inFlight) {
      inFlight = fetch('/api/company').then(r => r.json()).then(data => {
        cached = data && typeof data === 'object'
          ? { ...DEFAULT, ...data, bank_accounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [] }
          : DEFAULT;
        return cached;
      }).catch(() => { cached = DEFAULT; return DEFAULT; });
    }
    inFlight.then(setProfile);
  }, []);

  return profile;
}

export function clearCompanyProfileCache() {
  cached = null;
  inFlight = null;
}
