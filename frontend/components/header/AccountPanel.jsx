// Lazy chunk: the logged-in account menu (React Aria Popover + Menu). Loaded when the account button is used.
import { useRouter } from "next/router"
import { LogOut, Settings } from "lucide-react"
import { Menu, MenuItem, Popover } from "react-aria-components"

export default function AccountPanel({ user, logout, t, triggerRef, onOpenChange }) {
  const router = useRouter()
  const plan = user?.plan === "pro" ? "⭐ Pro" : user?.plan === "enterprise" ? "🏢 Enterprise" : t("account.planBadgeFree")
  const planColor = user?.plan === "pro" ? "bg-[#D6293E]" : user?.plan === "enterprise" ? "bg-[#6D3BFF]" : "bg-[#14130F]/60"
  const close = () => onOpenChange(false)
  return (
    <Popover triggerRef={triggerRef} isOpen onOpenChange={onOpenChange} placement="bottom end" offset={12} className="z-50">
      <div className="w-60 overflow-hidden rounded-3xl border-2 border-[#14130F] bg-white shadow-[0_30px_70px_-24px_rgba(20,19,15,0.45)]">
        <div className="border-b border-[#14130F]/10 px-4 py-3">
          <p className="truncate text-sm font-bold text-[#14130F]">{user?.name}</p>
          <p className="mt-0.5 truncate text-xs text-[#14130F]/55">{user?.email}</p>
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white ${planColor}`}>{plan}</span>
        </div>
        <Menu
          autoFocus="first"
          aria-label={t("layout.myAccount")}
          onAction={(key) => {
            close()
            if (key === "account") router.push("/account")
            if (key === "logout") logout()
          }}
          className="p-1.5 outline-none"
        >
          <MenuItem id="account" textValue={t("layout.myAccount")} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[#14130F] outline-none data-[focused]:bg-[#F1EEE6]">
            <Settings className="h-4 w-4" aria-hidden="true" />{t("layout.myAccount")}
          </MenuItem>
          <MenuItem id="logout" textValue={t("layout.logOut")} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[#14130F] outline-none data-[focused]:bg-[#F1EEE6]">
            <LogOut className="h-4 w-4" aria-hidden="true" />{t("layout.logOut")}
          </MenuItem>
        </Menu>
      </div>
    </Popover>
  )
}
