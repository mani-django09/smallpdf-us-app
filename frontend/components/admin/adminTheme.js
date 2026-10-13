// Dark-mode for the admin panel. The panels are written with light Tailwind classes;
// rather than doubling every class with `dark:` variants (and touching ~1500 lines of
// existing tables/modals), everything inside `.admin-dark` is re-coloured here.
export const ADMIN_DARK_CSS = `
.admin-dark{color-scheme:dark;background:#0b1120}
.admin-dark .bg-white{background-color:#111a2e}
.admin-dark .bg-white\\/95,.admin-dark .bg-white\\/90{background-color:rgba(17,26,46,.95)}
.admin-dark .bg-slate-50{background-color:#0b1120}
.admin-dark .bg-slate-100{background-color:#1a2540}
.admin-dark .bg-slate-200{background-color:#243050}
.admin-dark .hover\\:bg-slate-50:hover{background-color:#16213a}
.admin-dark .hover\\:bg-slate-100:hover{background-color:#1f2b48}
.admin-dark .hover\\:bg-slate-200:hover{background-color:#2a3760}
.admin-dark .border-slate-100,.admin-dark .border-slate-200,.admin-dark .border-slate-300{border-color:#243050}
.admin-dark .divide-slate-100>:not([hidden])~:not([hidden]),.admin-dark .divide-slate-200>:not([hidden])~:not([hidden]){border-color:#1d2945}
.admin-dark .text-slate-900,.admin-dark .text-slate-800{color:#f1f5f9}
.admin-dark .text-slate-700{color:#cbd5e1}
.admin-dark .text-slate-600{color:#b6c2d6}
.admin-dark .text-slate-500{color:#94a3b8}
.admin-dark .text-slate-400{color:#7688a4}
.admin-dark .text-slate-300{color:#4b5b78}
.admin-dark .fill-slate-400{fill:#7688a4}
.admin-dark .bg-blue-50,.admin-dark .bg-indigo-50{background-color:rgba(59,130,246,.14)}
.admin-dark .bg-emerald-50,.admin-dark .bg-green-50{background-color:rgba(16,185,129,.14)}
.admin-dark .bg-amber-50,.admin-dark .bg-yellow-50,.admin-dark .bg-orange-50{background-color:rgba(245,158,11,.14)}
.admin-dark .bg-red-50,.admin-dark .bg-rose-50{background-color:rgba(244,63,94,.14)}
.admin-dark .bg-violet-50,.admin-dark .bg-purple-50{background-color:rgba(139,92,246,.16)}
.admin-dark .bg-cyan-50{background-color:rgba(6,182,212,.14)}
.admin-dark .bg-blue-100,.admin-dark .bg-emerald-100,.admin-dark .bg-green-100,.admin-dark .bg-amber-100,.admin-dark .bg-red-100,.admin-dark .bg-violet-100,.admin-dark .bg-purple-100,.admin-dark .bg-yellow-100{background-color:rgba(148,163,184,.16)}
.admin-dark .border-red-200,.admin-dark .border-amber-200,.admin-dark .border-blue-200,.admin-dark .border-emerald-200,.admin-dark .border-green-200{border-color:rgba(148,163,184,.25)}
.admin-dark .text-blue-600,.admin-dark .text-blue-700,.admin-dark .text-blue-800{color:#7ab0ff}
.admin-dark .text-emerald-600,.admin-dark .text-emerald-700,.admin-dark .text-green-600,.admin-dark .text-green-700,.admin-dark .text-green-800{color:#4ade80}
.admin-dark .text-red-600,.admin-dark .text-red-700,.admin-dark .text-red-800,.admin-dark .text-rose-600{color:#fb7185}
.admin-dark .text-amber-600,.admin-dark .text-amber-700,.admin-dark .text-amber-800,.admin-dark .text-yellow-800{color:#fbbf24}
.admin-dark .text-violet-600,.admin-dark .text-violet-700,.admin-dark .text-purple-700{color:#b69cff}
.admin-dark .text-cyan-600{color:#22d3ee}
.admin-dark input,.admin-dark select,.admin-dark textarea{background-color:#0b1120;color:#e2e8f0;border-color:#2b3a5e}
.admin-dark input::placeholder{color:#64748b}
.admin-dark ::-webkit-scrollbar{width:10px;height:10px}
.admin-dark ::-webkit-scrollbar-thumb{background:#243050;border-radius:8px}
.admin-dark .shadow-sm,.admin-dark .shadow-md,.admin-dark .shadow-xl{box-shadow:0 1px 3px rgba(0,0,0,.4)}
`
