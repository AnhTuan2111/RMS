export function fmtPrice(p: number | null | undefined) {
    return (p ?? 0).toLocaleString('vi-VN') + ' ₫'
}

export function toMs(date: string, time: string) {
    return new Date(`${date}T${time}:00`).getTime()
}
