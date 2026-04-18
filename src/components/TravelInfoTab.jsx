import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Phone, AlertCircle, Wallet, Train } from 'lucide-react';

function mapsUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function TravelInfoTab({ travelInfo }) {
  const { transport, apps, tips, emergency, budget } = travelInfo;
  const [openTransport, setOpenTransport] = useState(null);

  return (
    <div className="tab-content p-4 space-y-5">
      {/* Transport */}
      <section>
        <SectionHeader icon={<Train size={16} />} title="交通指南" color="text-tokyoBlue-600" />
        <div className="space-y-2">
          {transport.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpenTransport(openTransport === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="flex-1 font-semibold text-slate-700 text-sm">{t.name}</span>
                {openTransport === t.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {openTransport === t.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-50">
                  <p className="text-sm text-slate-500 leading-relaxed pt-3">{t.desc}</p>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 leading-relaxed">
                    💡 {t.tip}
                  </div>
                  <a
                    href={mapsUrl(t.mapQuery)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-tokyoBlue-500 text-white px-3 py-1.5 rounded-lg hover:bg-tokyoBlue-600 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Google Maps 查詢
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Apps */}
      <section>
        <SectionHeader icon={<span className="text-base">📱</span>} title="實用 App" color="text-purple-600" />
        <div className="grid grid-cols-2 gap-2">
          {apps.map((app) => (
            <div key={app.name} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
              <div className="text-2xl mb-1">{app.icon}</div>
              <p className="text-sm font-semibold text-slate-700 mb-1">{app.name}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{app.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section>
        <SectionHeader icon={<span className="text-base">🎌</span>} title="文化禮儀小提示" color="text-green-600" />
        <div className="space-y-2">
          {tips.map((tip) => (
            <div key={tip.title} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-3 items-start">
              <span className="text-xl shrink-0">{tip.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-0.5">{tip.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section>
        <SectionHeader icon={<Wallet size={16} />} title="預算參考" color="text-amber-600" />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
          {Object.entries(budget).map(([key, value]) => {
            const labels = { accommodation: '住宿', meal: '餐飲', transport: '交通', attraction: '門票', daily: '每日總計' };
            const isDaily = key === 'daily';
            return (
              <div key={key} className={`flex justify-between items-center text-sm ${isDaily ? 'pt-3 border-t border-slate-100 font-semibold' : ''}`}>
                <span className={isDaily ? 'text-slate-700' : 'text-slate-500'}>{labels[key]}</span>
                <span className={isDaily ? 'text-amber-600' : 'text-slate-700'}>{value}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Emergency */}
      <section>
        <SectionHeader icon={<AlertCircle size={16} />} title="緊急聯絡" color="text-red-600" />
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 space-y-3">
          <EmergencyRow icon="🚔" label="報警" value={emergency.police} />
          <EmergencyRow icon="🚑" label="救護車 / 消防" value={emergency.ambulance} />
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-start gap-3">
              <Phone size={14} className="text-tokyoBlue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">{emergency.touristHotlineNote}</p>
                <p className="text-sm font-bold text-tokyoBlue-600">{emergency.touristHotline}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-600 mb-1">台灣辦事處</p>
            <p>{emergency.embassy.tw}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon, title, color }) {
  return (
    <div className={`flex items-center gap-2 mb-2 font-bold text-sm ${color}`}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

function EmergencyRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <span>{icon}</span>
        {label}
      </span>
      <a href={`tel:${value}`} className="text-lg font-bold text-red-500 tabular-nums">
        {value}
      </a>
    </div>
  );
}
