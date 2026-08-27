export function isValidPhone(phone: string) {
    return /^0[0-9]{9}$/.test(phone.trim())
}

export function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function sanitizePhoneInput(raw: string) {
    return raw.replace(/\D/g, '').slice(0, 10)
}
