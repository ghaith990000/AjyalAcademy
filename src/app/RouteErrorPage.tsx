import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { ErrorScreen } from './ErrorScreen'

/** Shown by the router when a page fails to load or throws; inside the shell it keeps the navigation usable. */
export function RouteErrorPage({ inline = false }: { inline?: boolean }) {
  const error = useRouteError()
  useEffect(() => console.error('A page failed', error), [error])
  return <ErrorScreen error={error} inline={inline} />
}
