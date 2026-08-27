/**
 * realtime/stompClient.ts
 *
 * Singleton STOMP client for the RIMS WebSocket layer.
 * - Connects to /ws-rims via SockJS.
 * - Sends Authorization: Bearer <token> on every STOMP CONNECT (including reconnects).
 * - Fans out incoming messages to per-topic callback registries.
 * - Auto-reconnects on disconnect after a fixed delay.
 * - Only one underlying connection is ever opened.
 *
 * Never import stompjs or SockJS anywhere else in the frontend.
 */

import Stomp from 'stompjs'
import SockJS from 'sockjs-client'
import {getAccessToken} from '@/shared/utils/tokenStorage'

type MessageCallback = () => void

/** Per-topic registry: topic -> set of callbacks to notify on any message */
const registry = new Map<string, Set<MessageCallback>>()

/** Active STOMP-level subscriptions: topic -> stomp subscription object */
const stompSubs = new Map<string, {unsubscribe(): void}>()

let stompClient: ReturnType<typeof Stomp.over> | null = null
let isConnecting = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Generation counter. Incremented every time connect() starts a new
 * underlying SockJS/STOMP connection attempt. Callbacks captured by a
 * particular connection attempt (onConnected/onDisconnected) compare
 * against this value before touching shared state, so a stale attempt
 * (e.g. superseded by StrictMode double-invoked effects) can never
 * clobber a newer one — and, importantly, can never null out the
 * reference to a connection that is still alive.
 */
let connectionId = 0

const RECONNECT_DELAY_MS = 5_000
const WS_ENDPOINT = '/ws-rims'

// ── Private helpers ──────────────────────────────────────────────────────────

function clearReconnectTimer() {
    if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
    }
}

function subscribeRegisteredTopics() {
    if (!stompClient) return

    for (const [topic, callbacks] of registry) {
        if (callbacks.size === 0 || stompSubs.has(topic)) {
            continue
        }

        const sub = stompClient.subscribe(topic, () => {
            for (const cb of registry.get(topic) ?? []) {
                cb()
            }
        })

        stompSubs.set(topic, sub)
    }
}

function onConnected(myId: number) {
    // A newer connect() call has already superseded this one; ignore.
    if (myId !== connectionId) return

    isConnecting = false
    clearReconnectTimer()
    subscribeRegisteredTopics()
}

function onDisconnected(myId: number) {
    // This disconnect event belongs to an old/superseded connection attempt.
    // Do NOT touch shared state (stompClient, stompSubs) — a newer
    // connection may already be using them.
    if (myId !== connectionId) return

    isConnecting = false
    stompClient = null
    stompSubs.clear()
    clearReconnectTimer()

    const hasActiveSubscribers = Array.from(registry.values()).some((set) => set.size > 0)

    if (hasActiveSubscribers) {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
    }
}

function connect() {
    if (isConnecting || stompClient?.connected) {
        return
    }

    isConnecting = true
    connectionId += 1
    const myId = connectionId

    const socket = new SockJS(WS_ENDPOINT)
    const client = Stomp.over(socket)

    // Suppress stompjs console output in production
    client.debug = () => {}

    stompClient = client

    const token = getAccessToken()
    const connectHeaders: Record<string, string> = token
        ? {Authorization: `Bearer ${token}`}
        : {}

    client.connect(
        connectHeaders,
        () => onConnected(myId),
        () => onDisconnected(myId),
    )
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a callback to be called whenever any message arrives on `topic`.
 * Returns a cleanup function that unregisters the callback.
 *
 * Usage inside useEffect:
 *   useEffect(() => registerTopicCallback('/topic/kitchen', refresh), [refresh])
 */
export function registerTopicCallback(
    topic: string,
    callback: MessageCallback,
): () => void {
    if (!registry.has(topic)) {
        registry.set(topic, new Set())
    }

    registry.get(topic)!.add(callback)

    if (!stompClient?.connected) {
        // If a connection attempt is already in flight, do NOT start a
        // second one — connect() already guards against that. When that
        // attempt reaches onConnected(), subscribeRegisteredTopics() will
        // pick up this topic since it re-reads the registry at that time.
        connect()
    } else if (!stompSubs.has(topic)) {
        // Already connected but topic not yet subscribed (late registration)
        const sub = stompClient.subscribe(topic, () => {
            for (const cb of registry.get(topic) ?? []) {
                cb()
            }
        })

        stompSubs.set(topic, sub)
    }

    return () => {
        registry.get(topic)?.delete(callback)

        if (registry.get(topic)?.size === 0) {
            stompSubs.get(topic)?.unsubscribe()
            stompSubs.delete(topic)
        }

        const hasAny = Array.from(registry.values()).some((set) => set.size > 0)

        if (!hasAny) {
            clearReconnectTimer()

            if (stompClient?.connected) {
                // Fully connected — safe to disconnect and clear immediately.
                stompClient.disconnect(() => {})
                stompClient = null
            } else if (isConnecting) {
                // A connection attempt is still in flight (e.g. this cleanup
                // fired because of a StrictMode double-invoke, or the very
                // last subscriber unmounted mid-handshake). Do NOT null out
                // stompClient here — that would orphan the in-flight
                // connection so its onConnected() silently no-ops (this was
                // the original bug: CONNECTED frame received, but no
                // SUBSCRIBE ever sent).
                //
                // Instead, just bump connectionId so that when this
                // in-flight attempt's onConnected/onDisconnected eventually
                // fires, it recognizes itself as stale and skips touching
                // shared state — while a fresh registerTopicCallback call
                // (e.g. StrictMode's second mount) is free to start a new
                // connection attempt of its own if still needed.
                connectionId += 1
                stompClient = null
                isConnecting = false
            } else {
                stompClient = null
            }
        }
    }
}
