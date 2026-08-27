export const RESERVATION_OPEN_HOUR = 8
export const RESERVATION_CLOSE_HOUR = 20
export const RESERVATION_SLOT_STEP_MINUTES = 30

export interface BlockedRange {
    start: string
    end: string
}

export function generateAllTimeSlots(): string[] {
    const slots: string[] = []
    const startMinutes = RESERVATION_OPEN_HOUR * 60
    const endMinutes = RESERVATION_CLOSE_HOUR * 60

    for (
        let minutes = startMinutes;
        minutes <= endMinutes;
        minutes += RESERVATION_SLOT_STEP_MINUTES
    ) {
        const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
        const minute = String(minutes % 60).padStart(2, '0')
        slots.push(`${hour}:${minute}`)
    }

    return slots
}

function isSlotBlocked(
    date: string,
    time: string,
    blockedRanges: BlockedRange[],
): boolean {
    const candidate = new Date(`${date}T${time}:00`)

    return blockedRanges.some((range) => {
        const start = new Date(range.start)
        const end = new Date(range.end)
        // Cả 2 phía đều strict (không bao gồm bằng), khớp với
        // ReservationConflictValidator.hasConflict ở backend (isAfter/isBefore
        // không kèm bằng) — đúng biên 150 phút (2.5 tiếng) thì được phép đặt.
        return candidate > start && candidate < end
    })
}

function isSlotInPast(date: string, time: string): boolean {
    const candidate = new Date(`${date}T${time}:00`)
    return candidate.getTime() <= Date.now()
}

export function getAvailableTimeSlots(
    date: string,
    blockedRanges: BlockedRange[],
): string[] {
    return generateAllTimeSlots().filter((time) => {
        if (isSlotInPast(date, time)) {
            return false
        }

        if (isSlotBlocked(date, time, blockedRanges)) {
            return false
        }

        return true
    })
}
