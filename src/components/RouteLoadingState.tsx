type RouteLoadingStateProps = {
  title: string
  message: string
}

export function RouteLoadingState({ title, message }: RouteLoadingStateProps) {
  return (
    <section className="route-loading-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  )
}
