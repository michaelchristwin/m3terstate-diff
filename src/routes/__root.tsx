import { Outlet, createRootRoute } from '@tanstack/react-router'
import '../style.css'

export const Route = createRootRoute({ component: () => <Outlet /> })
