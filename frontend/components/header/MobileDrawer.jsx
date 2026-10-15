// Lazy chunk: the mobile menu drawer (React Aria Modal: focus trap, Esc, scroll lock). Loaded when the hamburger is used.
import Link from "next/link"
import { ArrowRight, ChevronDown, LogOut, Settings, X } from "lucide-react"
import { Button, Dialog, Disclosure, DisclosureGroup, DisclosurePanel, Heading, Modal, ModalOverlay } from "react-aria-components"
import { localePath } from "../../lib/route-translations"
import LanguageSwitcher from "../LanguageSwitcher"

const LOCALIZED = ["ja", "de", "fr", "es", "it", "id", "pt"]
const hrefFor = (href, locale) => (LOCALIZED.includes(locale) ? localePath(href, locale) : href)

export default function MobileDrawer({ nav, t, locale, isActive, user, loading, logout, redirect, onClose, logo }) {
  return (
    <ModalOverlay isOpen onOpenChange={(v) => { if (!v) onClose() }} isDismissable className="pointer-events-auto fixed inset-0 z-50 bg-[#14130F]/50 backdrop-blur-sm lg:hidden">
      <Modal className="fixed bottom-0 right-0 top-0 w-[min(88vw,380px)] overflow-y-auto bg-[#F7F5F0] shadow-2xl outline-none">
        <Dialog aria-label="Menu" className="flex min-h-full flex-col outline-none">
          <div className="flex h-[72px] items-center justify-between px-4">
            {logo}
            <Button onPress={onClose} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full outline-none hover:bg-[#14130F]/[0.07] data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#14130F]">
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex-1 px-3 pb-4">
            <ul className="mb-2 space-y-1">
              {nav.filter((n) => n.type === "link").map((n) => (
                <li key={n.id}>
                  <Link href={hrefFor(n.href, locale)} locale={false} onClick={onClose} className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#14130F] ${isActive(n.href) ? "bg-[#14130F] text-white" : "hover:bg-[#14130F]/[0.06]"}`}>
                    {n.Icon && <n.Icon className="h-4 w-4 text-[#B86A00]" aria-hidden="true" />}{n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <DisclosureGroup allowsMultipleExpanded className="divide-y divide-[#14130F]/10 border-y border-[#14130F]/10">
              {nav.filter((n) => n.type === "mega").flatMap((n) => n.groups).map((g) => (
                <Disclosure key={g.heading} id={g.heading}>
                  <Heading className="m-0">
                    <Button slot="trigger" className="group flex w-full items-center justify-between px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wide outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#14130F]">
                      {g.heading}
                      <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-aria-expanded:rotate-180" />
                    </Button>
                  </Heading>
                  <DisclosurePanel>
                    <div className="grid grid-cols-2 gap-1 pb-3">
                      {g.items.map((it) => (
                        <Link key={it.href} href={hrefFor(it.href, locale)} locale={false} onClick={onClose} className={`flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#14130F] ${isActive(it.href) ? "bg-[#14130F] text-white" : "hover:bg-[#14130F]/[0.06]"}`}>
                          <it.Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                          <span className="truncate">{t(it.labelKey)}</span>
                        </Link>
                      ))}
                    </div>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </DisclosureGroup>
          </div>
          <div className="space-y-2 border-t border-[#14130F]/10 p-4">
            {!loading && (user ? (
              <>
                <div className="flex items-center gap-3 px-1 py-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14130F] text-sm font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user.name}</p>
                    <p className="truncate text-xs text-[#14130F]/55">{user.email}</p>
                  </div>
                </div>
                <Link href="/account" onClick={onClose} className="flex items-center gap-2 rounded-2xl border-2 border-[#14130F] bg-white px-4 py-3 text-sm font-bold"><Settings className="h-4 w-4" aria-hidden="true" />{t("layout.myAccount")}</Link>
                <Button onPress={() => { onClose(); logout() }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14130F] px-4 py-3 text-sm font-bold text-white outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#14130F] data-[focus-visible]:ring-offset-2">
                  <LogOut className="h-4 w-4" aria-hidden="true" />{t("layout.logOut")}
                </Button>
              </>
            ) : (
              <>
                <Link href={`/auth/login?redirect=${redirect}`} onClick={onClose} className="block rounded-2xl border-2 border-[#14130F] bg-white px-4 py-3 text-center text-sm font-bold">{t("layout.logIn")}</Link>
                <Link href={`/auth/signup?redirect=${redirect}`} onClick={onClose} className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#14130F] px-4 py-3 text-sm font-bold text-white">{t("layout.signUpFree")}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </>
            ))}
            <div className="pt-1"><LanguageSwitcher /></div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
