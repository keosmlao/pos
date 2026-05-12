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
    const preventZoomKeys = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (['+', '=', '-', '_', '0'].includes(event.key)) {
        event.preventDefault();
      }
    };
    const preventZoomWheel = (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const preventGesture = (event) => event.preventDefault();

    window.addEventListener('keydown', preventZoomKeys, { passive: false });
    window.addEventListener('wheel', preventZoomWheel, { passive: false });
    window.addEventListener('gesturestart', preventGesture, { passive: false });
    window.addEventListener('gesturechange', preventGesture, { passive: false });
    window.addEventListener('gestureend', preventGesture, { passive: false });

    return () => {
      window.removeEventListener('keydown', preventZoomKeys);
      window.removeEventListener('wheel', preventZoomWheel);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('gestureend', preventGesture);
    };
  }, []);

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
