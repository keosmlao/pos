'use client';

import { useEffect } from 'react';
import { useCompanyProfile } from '@/utils/useCompanyProfile';

function setIcon(rel, href) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function AppHeadBrand() {
  const company = useCompanyProfile();

  useEffect(() => {
    if (company.name) document.title = company.name;
    if (!company.logo_url) return;

    const href = `${company.logo_url}${company.logo_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
    setIcon('icon', href);
    setIcon('shortcut icon', href);
    setIcon('apple-touch-icon', href);
  }, [company.name, company.logo_url]);

  return null;
}
