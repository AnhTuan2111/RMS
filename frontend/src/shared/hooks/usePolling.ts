import {useEffect, useRef} from 'react'

import {DEFAULT_POLL_INTERVAL_MS} from '@/app/config/realtime'

export type PollingCallback = (signal: AbortSignal) => void | Promise<void>

export interface UsePollingOptions {
    /**
     * Thời gian giữa hai lần chạy.
     * Mặc định là 5 giây.
     */
    intervalMs?: number

    /**
     * Cho phép bật hoặc tắt polling.
     */
    enabled?: boolean

    /**
     * Chạy ngay khi component mount.
     */
    runImmediately?: boolean

    /**
     * Tạm dừng polling khi tab trình duyệt bị ẩn.
     */
    pauseWhenHidden?: boolean

    /**
     * Hàm xử lý lỗi tùy chọn.
     */
    onError?: (error: unknown) => void
}

export function usePolling(
    callback: PollingCallback,
    options: UsePollingOptions = {},
): void {
    const {
        intervalMs = DEFAULT_POLL_INTERVAL_MS,
        enabled = true,
        runImmediately = true,
        pauseWhenHidden = true,
        onError,
    } = options

    const callbackRef = useRef(callback)
    const errorHandlerRef = useRef(onError)

    const timeoutRef = useRef<number | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const isRunningRef = useRef(false)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        errorHandlerRef.current = onError
    }, [onError])

    useEffect(() => {
        if (!enabled) {
            return
        }

        let active = true

        const clearTimer = () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }

        const abortCurrentRequest = () => {
            abortControllerRef.current?.abort()
            abortControllerRef.current = null
        }

        const canRun = () => {
            if (!active) {
                return false
            }

            if (pauseWhenHidden && document.visibilityState === 'hidden') {
                return false
            }

            return true
        }

        const scheduleNextRun = () => {
            clearTimer()

            if (!active) {
                return
            }

            timeoutRef.current = window.setTimeout(() => {
                void runPolling()
            }, intervalMs)
        }

        const runPolling = async () => {
            if (!canRun()) {
                scheduleNextRun()
                return
            }

            /*
             * Không chạy request mới nếu request trước
             * vẫn chưa hoàn thành.
             */
            if (isRunningRef.current) {
                scheduleNextRun()
                return
            }

            isRunningRef.current = true

            const controller = new AbortController()
            abortControllerRef.current = controller

            try {
                await callbackRef.current(controller.signal)
            } catch (error) {
                /*
                 * AbortError xuất hiện khi component unmount
                 * hoặc tab bị ẩn. Đây không phải lỗi nghiệp vụ.
                 */
                if (error instanceof DOMException && error.name === 'AbortError') {
                    return
                }

                errorHandlerRef.current?.(error)
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null
                }

                isRunningRef.current = false

                if (active) {
                    scheduleNextRun()
                }
            }
        }

        const handleVisibilityChange = () => {
            if (!pauseWhenHidden) {
                return
            }

            if (document.visibilityState === 'hidden') {
                clearTimer()
                abortCurrentRequest()
                return
            }

            /*
             * Khi người dùng quay lại tab,
             * cập nhật dữ liệu ngay lập tức.
             */
            clearTimer()
            void runPolling()
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        if (runImmediately) {
            void runPolling()
        } else {
            scheduleNextRun()
        }

        return () => {
            active = false

            document.removeEventListener('visibilitychange', handleVisibilityChange)

            clearTimer()
            abortCurrentRequest()
            isRunningRef.current = false
        }
    }, [enabled, intervalMs, pauseWhenHidden, runImmediately])
}
