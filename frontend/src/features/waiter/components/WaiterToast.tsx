export function WaiterToast({toast}: {toast: {msg: string; type: string} | null}) {
    if (!toast) return null
    return <div className={`waiter-toast waiter-toast-${toast.type}`}>{toast.msg}</div>
}
