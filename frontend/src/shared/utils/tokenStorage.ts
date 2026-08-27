const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

function canUseLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStorageValue(key: string) {
    if (!canUseLocalStorage()) {
        return null
    }

    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorageValue(key: string, value: string) {
    if (!canUseLocalStorage()) {
        return
    }

    try {
        localStorage.setItem(key, value)
    } catch {
        // Storage can fail in private mode or blocked environments.
    }
}

function removeStorageValue(key: string) {
    if (!canUseLocalStorage()) {
        return
    }

    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage cleanup failures.
    }
}

export function getAccessToken() {
    return readStorageValue(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
    return readStorageValue(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
    writeStorageValue(ACCESS_TOKEN_KEY, accessToken)

    writeStorageValue(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
    removeStorageValue(ACCESS_TOKEN_KEY)
    removeStorageValue(REFRESH_TOKEN_KEY)
}

export function hasAccessToken() {
    return Boolean(getAccessToken())
}

export function hasRefreshToken() {
    return Boolean(getRefreshToken())
}
