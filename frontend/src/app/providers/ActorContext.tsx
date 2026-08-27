import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import {RoleType} from '@/shared/types/auth'

type ActorContextType = {
    actor: RoleType
    setActor: (actor: RoleType) => void
}

const ActorContext = createContext<ActorContextType | null>(null)

const DEFAULT_ACTOR: RoleType = RoleType.ADMIN

const SELECTED_ACTOR_KEY = 'selectedActor'

const ALL_ROLES = Object.values(RoleType)

function isActorRole(value: unknown): value is RoleType {
    return typeof value === 'string' && ALL_ROLES.includes(value as RoleType)
}

function canUseLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readSavedActor(): RoleType {
    if (!canUseLocalStorage()) {
        return DEFAULT_ACTOR
    }

    try {
        const savedActor = localStorage.getItem(SELECTED_ACTOR_KEY)

        return isActorRole(savedActor) ? savedActor : DEFAULT_ACTOR
    } catch {
        return DEFAULT_ACTOR
    }
}

function saveActor(nextActor: RoleType) {
    if (!canUseLocalStorage()) {
        return
    }

    try {
        localStorage.setItem(SELECTED_ACTOR_KEY, nextActor)
    } catch {
        // Ignore storage failures.
    }
}

export function ActorProvider({children}: {children: ReactNode}) {
    const [actor, setActorState] = useState<RoleType>(readSavedActor)

    const setActor = useCallback((nextActor: RoleType) => {
        saveActor(nextActor)
        setActorState(nextActor)
    }, [])

    useEffect(() => {
        function handleStorageChange(event: StorageEvent) {
            if (event.key !== SELECTED_ACTOR_KEY) {
                return
            }

            if (isActorRole(event.newValue)) {
                setActorState(event.newValue)
                return
            }

            setActorState(DEFAULT_ACTOR)
        }

        window.addEventListener('storage', handleStorageChange)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
        }
    }, [])

    const value = useMemo<ActorContextType>(
        () => ({
            actor,
            setActor,
        }),
        [actor, setActor],
    )

    return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
}

/* eslint-disable react-refresh/only-export-components */
export function useActor() {
    const context = useContext(ActorContext)

    if (!context) {
        throw new Error('useActor phải được sử dụng bên trong ActorProvider')
    }

    return context
}
