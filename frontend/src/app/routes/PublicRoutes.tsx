import {Route} from 'react-router-dom'

import HomePage from '../../features/home/HomePage'

export function renderPublicRoutes() {
    return (
        <>
            <Route path="/" element={<HomePage />} />
        </>
    )
}
