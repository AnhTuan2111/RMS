/**
 * realtime/useAdminSocket.ts
 *
 * React hook for ADMIN role.
 * Subscribes to /topic/admin.
 * Backend broadcasts to this topic whenever revenue/statistics-affecting
 * data changes (e.g. a new invoice is created via cash or VNPay payment).
 * Role authorization enforced by StompAuthChannelInterceptor.
 *
 * /topic/admin -> ADMIN only
 */

import {useEffect, useRef} from 'react'
import {registerTopicCallback} from './stompClient'

const ADMIN_TOPIC = '/topic/admin'

/**
 * Subscribes to /topic/admin.
 * `onMessage` is called whenever the backend broadcasts a stats update.
 * Always calls the latest version of `onMessage` — no stable reference required from caller.
 */
export function useAdminSocket(onMessage: () => void): void {
    const callbackRef = useRef(onMessage)

    useEffect(() => {
        callbackRef.current = onMessage
    })

    useEffect(() => {
        const handler = () => callbackRef.current()
        return registerTopicCallback(ADMIN_TOPIC, handler)
    }, [])
}
