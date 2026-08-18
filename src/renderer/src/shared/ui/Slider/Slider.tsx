import { useId, type InputHTMLAttributes } from 'react'

export type SliderTick = { value: number; label: string }

type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'min' | 'max' | 'step' | 'value' | 'onChange' | 'list'
> & {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  /** Rendered as the native `<datalist>` (tick dashes on the track, Chromium-only
   *  — fine, the app only ever runs on the embedded Chromium) and as labels below. */
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
  ticks,
  disabled,
  className,
  ...props
}: SliderProps): React.JSX.Element {
  const listId = useId()

  return (
    <div className={['flex w-full flex-col gap-2', className].filter(Boolean).join(' ')}>
      <input
        type="range"
        className={TRACK}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        list={listId}
        onChange={(event) => onChange(Number(event.target.value))}
        {...props}
      />
      <datalist id={listId}>
        {ticks.map((tick) => (
          <option key={tick.value} value={tick.value} label={tick.label} />
        ))}
      </datalist>
      <div className="flex justify-between font-mono text-2xs text-text-faint">
        {ticks.map((tick) => (
          <span key={tick.value}>{tick.label}</span>
        ))}
      </div>
    </div>
  )
}

export default Slider
