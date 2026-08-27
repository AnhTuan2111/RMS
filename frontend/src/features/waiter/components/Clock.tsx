import {useEffect, useState} from 'react'

export function Clock() {
    const [nowMs, setNowMs] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 60000)
        return () => clearInterval(t)
    }, [])
    const d = new Date(nowMs)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const mon = d.toLocaleString('en', {month: 'short'})
    return (
        <span className="waiter-clock">
            {h}h{m} {day}-{mon}-{d.getFullYear()}
        </span>
    )
}
