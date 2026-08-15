/**
 * StateView — renders the five states of ViewState<T> (idle, loading, ready,
 * empty, cancelled, error) so no feature hand-rolls its own if/else ladder.
 * Only `ready` takes a render prop; the other four render a fixed, quiet UI.
 * @startingPoint section="Components" subtitle="Renders ViewState<T> — loading/empty/error/ready" viewport="700x160"
 */
export interface ViewState<T> {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'cancelled' | 'error';
  data?: T;
  progress?: { done: number; total: number | null };
  error?: { message: string };
}

export interface StateViewProps<T> {
  state: ViewState<T>;
  render: (data: T) => React.ReactNode;
  emptyMessage?: string;
}
