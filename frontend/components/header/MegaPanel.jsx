// Lazy chunk: the mega-menu panel (React Aria Popover). Loaded the first time a menu is hovered/focused/clicked.
import Link from "next/link"
import { Dialog, Popover } from "react-aria-components"
import { localePath } from "../../lib/route-translations"

const LOCALIZED = ["ja", "de", "fr", "es", "it", "id", "pt"]
const hrefFor = (href, locale) => (LOCALIZED.includes(locale) ? localePath(href, locale) : href)

function ToolRow({ item, t, locale, active, onNavigate }) {
  const { Icon } = item
  return (
    <Link
      href={hrefFor(item.href, locale)}
      locale={false}
      onClick={onNavigate}
      className={`group flex items-start gap-3 rounded-2xl px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#14130F] ${active ? "bg-[#14130F] text-white" : "hover:bg-[#F1EEE6]"}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? "bg-white text-[#14130F]" : "bg-[#F1EEE6] text-[#14130F]/70 group-hover:bg-[#14130F] group-hover:text-white"}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold leading-tight">{t(item.labelKey)}</span>
          {item.isNew && <span className="rounded-full bg-[#C6F432] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#14130F]">New</span>}
        </span>
        <span className={`mt-0.5 block text-xs leading-snug ${active ? "text-white/70" : "text-[#14130F]/55"}`}>{t(item.descKey)}</span>
      </span>
    </Link>
  )
}

export default function MegaPanel({ item, triggerRef, onOpenChange, onEnter, onLeave, t, locale, isActive, onNavigate }) {
  return (
    <Popover triggerRef={triggerRef} isOpen onOpenChange={onOpenChange} isNonModal placement="bottom start" offset={14} className="z-50">
      <Dialog aria-label={item.label} className="outline-none">
        <div
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          className={`rounded-[28px] border-2 border-[#14130F] bg-white p-3 shadow-[0_30px_70px_-24px_rgba(20,19,15,0.45)] ${item.cols === 3 ? "w-[780px]" : "w-[580px]"}`}
        >
          <div className={`grid gap-x-2 ${item.cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {item.groups.map((g) => (
              <div key={g.heading}>
                <p className="px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#14130F]/45">{g.heading}</p>
                {g.items.map((it) => (
                  <ToolRow key={it.href} item={it} t={t} locale={locale} active={isActive(it.href)} onNavigate={onNavigate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </Popover>
  )
}
