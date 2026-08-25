import { useEffect, useRef, type InputHTMLAttributes } from 'react'
import { cx } from '../cx'

export type SliderTick = { value: number; label: string }

type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'min' | 'max' | 'step' | 'value' | 'onChange'
> & {
  min: number
  max: number
  step: number
  value: number
  /** Fires on every step while dragging/pressing a key — React's onChange for
   *  a range input maps to the native `input` event, not `change`. Drive the
   *  visible thumb/label from this. */
  onChange: (value: number) => void
  /** Fires once the value settles (mouse/touch release, key release, blur) —
   *  the native `change` event React does not expose directly. Optional:
   *  callers that do not care about mid-drag frequency (no side effect behind
   *  `onChange`) can omit it and read every step from `onChange` alone. */
  onChangeCommitted?: (value: number) => void
  /** Rendered as labels below the track, each positioned at its true share of
   *  `min..max` — never flex-distributed evenly, which would misplace every
   *  mark but the first/last for a non-linear sequence like context-window
   *  doublings (1k, 2k, 4k, 8k…). */
  ticks: SliderTick[]
}

// Utility over CSS module (unlike Popover/Dialog): pseudo-elements ARE
// reachable from a className via arbitrary variants, no physical limit forces
// a stylesheet here.
const TRACK =
  'h-[4px] w-full cursor-pointer appearance-none rounded-full bg-surface-sunken ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  '[&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:rounded-full ' +
  '[&::-moz-range-track]:h-[4px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-sunken ' +
  '[&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-[16px] [&::-webkit-slider-thumb]:w-[16px] ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-accent ' +
  '[&::-moz-range-thumb]:h-[16px] [&::-moz-range-thumb]:w-[16px] [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-accent'

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  onChangeCommitted,
  ticks,
  disabled,
  className,
  ...props
}: SliderProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const percent = (tick: number): number => (min === max ? 0 : ((tick - min) / (max - min)) * 100)
  // Ticks carry human labels (e.g. "8k"); the input alone exposes only the
  // raw number, so a value that lands on a known tick gets that label
  // instead. No match (a value between marks) leaves aria-valuetext unset —
  // the native number announcement is still correct there.
  const valueText = ticks.find((tick) => tick.value === value)?.label

  // The native `change` event — not exposed by React's onChange, which maps
  // to `input` — is the one signal that fires exactly once per commit
  // (mouseup, touchend, or a keyup that actually changed the value), so it
  // replaces four separate React handlers that could double-fire (e.g. Tab
  // away used to trigger both keyup and blur).
  useEffect(() => {
    const node = ref.current
    if (node === null || onChangeCommitted === undefined) return
    const onChangeNative = (event: Event): void => {
      onChangeCommitted(Number((event.target as HTMLInputElement).value))
    }
    node.addEventListener('change', onChangeNative)
    return () => node.removeEventListener('change', onChangeNative)
  }, [onChangeCommitted])

  return (
    <div className={cx('flex w-full flex-col gap-3', className)}>
      <input
        ref={ref}
        type="range"
        className={TRACK}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
        {...props}
      />
      {/* overflow-x-hidden: the first/last label's OWN centring would
          otherwise poke a few px past the container at 0%/100% (verified
          live, F2.5) — clamped per-label below instead of cut off here, this
          is only the second line of defence. */}
      <div className="relative h-[14px] overflow-x-hidden">
        {ticks.map((tick, index) => {
          // Centred on its mark, except the two ends: centring there would
          // push half the label's own width past the track's edge.
          const edge =
            index === 0
              ? 'translate-x-0'
              : index === ticks.length - 1
                ? '-translate-x-full'
                : '-translate-x-1/2'
          return (
            <span
              key={tick.value}
              className={`absolute font-mono text-2xs whitespace-nowrap text-text-faint ${edge}`}
              style={{ left: `${percent(tick.value)}%` }}
            >
              {tick.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default Slider
