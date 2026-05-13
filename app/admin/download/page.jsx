'use client';

import { useEffect, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const APK_PATH = '/downloads/owner-app.apk';

export default function DownloadAppPage() {
  const [apkInfo, setApkInfo] = useState({ available: null, size: null });
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch(APK_PATH, { method: 'HEAD' })
      .then(res => {
        if (res.ok) {
          const size = Number(res.headers.get('content-length') || 0);
          setApkInfo({ available: true, size });
        } else {
          setApkInfo({ available: false, size: null });
        }
      })
      .catch(() => setApkInfo({ available: false, size: null }));
  }, []);

  const fullUrl = origin + APK_PATH;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fullUrl)}&bgcolor=ffffff&color=020617&margin=0`;
  const sizeMb = apkInfo.size ? (apkInfo.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div className="space-y-4 pb-6 max-w-5xl">
      <AdminHero
        tag="Mobile app"
        title="📱 ດາວໂຫຼດແອັບສຳລັບເຈົ້າຂອງ"
        subtitle="ຕິດຕັ້ງເທິງມືຖືເພື່ອເບິ່ງສະຫຼຸບການຂາຍ, ສະຕັອກ, ໜີ້ສິນ ແບບປະຈຳວັນ"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Android */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">🤖</div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Android</h2>
                <p className="text-xs text-slate-500">APK direct install</p>
              </div>
            </div>
            {sizeMb && (
              <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold text-slate-600 font-mono">
                {sizeMb} MB
              </span>
            )}
          </div>

          {apkInfo.available === false ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-bold">
              ⚠ ຍັງບໍ່ມີ APK ໃນເຊີເວີ. ໃຫ້ build ຈາກ <span className="font-mono">flutter/</span> ກ່ອນ:
              <pre className="mt-2 bg-slate-900 text-emerald-300 text-[11px] p-2 rounded overflow-x-auto">cd flutter
flutter build apk --release
cp build/app/outputs/flutter-apk/app-release.apk \\
   ../nextjs/public/downloads/owner-app.apk</pre>
            </div>
          ) : (
            <>
              <a
                href={APK_PATH}
                download="owner-app.apk"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-red-950/20 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                ດາວໂຫຼດ APK
              </a>

              <div className="mt-4 grid grid-cols-[auto_1fr] gap-4 items-center">
                <a
                  href={APK_PATH}
                  download="owner-app.apk"
                  className="w-32 h-32 rounded-xl bg-white border border-slate-200 p-2 hover:border-red-400 transition-colors"
                  title="ສະແກນດ້ວຍມືຖືເພື່ອດາວໂຫຼດ"
                >
                  <img src={qrSrc} alt="QR code" className="w-full h-full no-theme-flip" />
                </a>
                <div className="text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-900 mb-1">ສະແກນ QR ດ້ວຍມືຖື</div>
                  <p>1. ເປີດກ້ອງມືຖື ສະແກນ QR</p>
                  <p>2. ດາວໂຫຼດແລ້ວແຕະຖະນັດໄຟລ໌</p>
                  <p>3. ອະນຸຍາດ &quot;Install from unknown source&quot;</p>
                </div>
              </div>

              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">URL ດາວໂຫຼດ</div>
                <code className="text-[11px] text-slate-700 font-mono break-all">{fullUrl}</code>
              </div>
            </>
          )}
        </section>

        {/* iOS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">🍎</div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">iPhone / iPad</h2>
              <p className="text-xs text-slate-500">iOS</p>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <div className="font-extrabold mb-2">📦 ຍັງບໍ່ມີໃຫ້ດາວໂຫຼດ</div>
            <p className="text-xs font-semibold leading-relaxed">
              ການແຈກຢາຍ iOS ຕ້ອງມີ Apple Developer Account ($99/ປີ) ແລະ ໃຊ້ TestFlight ຫຼື App Store.
            </p>
          </div>

          <div className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            ຖ້າຕ້ອງການແອັບ iOS ໃຫ້ສ້າງ Apple Developer Account ກ່ອນ, ແລ້ວ build ດ້ວຍ:
            <pre className="mt-2 bg-slate-900 text-emerald-300 text-[10px] p-2 rounded overflow-x-auto no-theme-flip">cd flutter
flutter build ipa --release</pre>
          </div>
        </section>
      </div>

      {/* Install guide */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900 mb-3">📖 ວິທີຕິດຕັ້ງ Android APK</h2>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
          <li>ດາວໂຫຼດໄຟລ໌ <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">owner-app.apk</code></li>
          <li>ເປີດໄຟລ໌ APK ໃນ File Manager ຂອງມືຖື</li>
          <li>ຖ້າ Android ເຕືອນ &quot;Install unknown apps&quot; → ໃຫ້ໄປ <span className="font-bold">Settings → Apps → ບຣາວເຊີ</span> → ເປີດ &quot;Allow from this source&quot;</li>
          <li>ກັບມາແຕະ APK → ກົດ <span className="font-bold">Install</span></li>
          <li>ເປີດແອັບ → ກົດປຸ່ມ &quot;ເຊີເວີ&quot; ຢູ່ລຸ່ມໜ້າ login → ປ້ອນ URL: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{origin}</code></li>
          <li>Login ດ້ວຍ user/password ດຽວກັນກັບ POS</li>
        </ol>
      </section>

      {/* Features */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900 mb-3">✨ ສິ່ງທີ່ແອັບເຮັດໄດ້</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: '📊', label: 'ສະຫຼຸບການຂາຍ', desc: 'ມື້ນີ້/ອາທິດ/ເດືອນ' },
            { icon: '💰', label: 'ກະແສເງິນສົດ', desc: 'ລາຍຮັບ ລາຍຈ່າຍ' },
            { icon: '📦', label: 'ສະຕັອກ', desc: 'ມູນຄ່າ + ສະຖານະ' },
            { icon: '⚠️', label: 'ສັ່ງຊື້', desc: 'ສິນຄ້າຮອດຈຸດສັ່ງ' },
            { icon: '🧾', label: 'ໜີ້ສິນ', desc: 'ຮັບ ແລະ ຈ່າຍ' },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-xs font-extrabold text-slate-900">{f.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
