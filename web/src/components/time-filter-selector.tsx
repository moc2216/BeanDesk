import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { enUS, zhCN } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Hint } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { formatPeriodLabel, parsePeriodRange } from '@/lib/period-label'
import { useTimeFilter } from '@/lib/time-context'
import { cn } from '@/lib/utils'

function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return date.getFullYear() + '-' + month + '-' + day
}

function fromISO(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function PeriodDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { timeFilter, setTimeFilter, availableYears, clearFilter } = useTimeFilter()
  const { t, locale } = useI18n()
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(Number(availableYears[0] ?? new Date().getFullYear()))
  const [leftMonth, setLeftMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [rightMonth, setRightMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
  )

  const calendarLocale = locale.toLowerCase().startsWith('zh') ? zhCN : enUS
  const activeYear = selectedYear
  const knownYears = availableYears.map(Number).filter((value) => Number.isFinite(value))
  const firstYear = knownYears.length ? Math.min(...knownYears) : new Date().getFullYear() - 5
  const lastYear = Math.max(new Date().getFullYear(), ...knownYears) + 1

  useEffect(() => {
    if (!open) return
    const current = parsePeriodRange(timeFilter)
    const from = current ? fromISO(current.start) : undefined
    const to = current ? fromISO(current.end) : undefined
    setRange(from ? { from, to } : undefined)
    setStart(current?.start ?? '')
    setEnd(current?.end ?? '')
    setInvalid(false)
    const preset = current ? null : timeFilter || ''
    setPending(preset)
    const parsedYear = Number((preset ?? '').slice(0, 4))
    setSelectedYear(parsedYear > 1900 ? parsedYear : Number(availableYears[0] ?? new Date().getFullYear()))
    const anchor = from ?? new Date()
    const anchorEnd = to ?? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
    setLeftMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    setRightMonth(new Date(anchorEnd.getFullYear(), anchorEnd.getMonth(), 1))
    // Only resync when the panel opens; choosing a preset no longer closes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pickRange(next: DateRange | undefined) {
    setPending(null)
    setRange(next)
    setStart(next?.from ? toISO(next.from) : '')
    setEnd(next?.to ? toISO(next.to) : '')
    setInvalid(false)
  }

  function pickManual(which: 'start' | 'end', value: string) {
    const nextStart = which === 'start' ? value : start
    const nextEnd = which === 'end' ? value : end
    setStart(nextStart)
    setEnd(nextEnd)
    const from = fromISO(nextStart)
    const to = fromISO(nextEnd)
    setPending(null)
    setRange(from ? { from, to } : undefined)
    setInvalid(false)
  }

  function apply() {
    if (pending !== null) {
      if (pending === '') clearFilter()
      else setTimeFilter(pending)
      onOpenChange(false)
      return
    }
    if (!start && !end) {
      // No explicit range: all data is the default.
      clearFilter()
      onOpenChange(false)
      return
    }
    if (!start || !end || start > end) {
      setInvalid(true)
      return
    }
    setTimeFilter(start + ' - ' + end)
    onOpenChange(false)
  }

  function clearDraft() {
    // No explicit period means all data; apply then clears the filter and closes.
    setPending('')
    setRange(undefined)
    setStart('')
    setEnd('')
    setInvalid(false)
  }

  function choosePreset(value: string) {
    setPending(value)
    setRange(undefined)
    setStart('')
    setEnd('')
    setInvalid(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
          // Let buttons and calendar cells handle their own Enter.
          if ((event.target as HTMLElement).closest('button')) return
          event.preventDefault()
          apply()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('time.pickerTitle')}</DialogTitle>
          <DialogDescription>{t('time.pickerHint')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Button
              variant={pending === '' ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={() => choosePreset('')}
            >
              {t('time.allTime')}
              {pending === '' ? <Check className="ml-auto size-3.5" /> : null}
            </Button>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t('time.year')}
              </span>
              <div className="flex flex-wrap gap-1">
                {availableYears.map((year) => (
                  <Button
                    key={year}
                    size="xs"
                    variant={pending?.startsWith(year) ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedYear(Number(year))
                      choosePreset(year)
                    }}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t('time.quarter')}
              </span>
              <div className="grid grid-cols-2 gap-1">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
                  const value = activeYear + '-' + quarter
                  return (
                    <Button
                      key={value}
                      size="xs"
                      variant={pending === value ? 'default' : 'outline'}
                      onClick={() => choosePreset(value)}
                    >
                      {quarter}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t('time.month')}
              </span>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 12 }, (_, index) => {
                  const month = String(index + 1).padStart(2, '0')
                  const value = activeYear + '-' + month
                  return (
                    <Button
                      key={value}
                      size="xs"
                      variant={pending === value ? 'default' : 'outline'}
                      onClick={() => choosePreset(value)}
                    >
                      {month}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative grid grid-cols-2 items-start gap-10">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t('time.startMonth')}
                  </span>
                  <Select
                    value={String(leftMonth.getFullYear())}
                    onValueChange={(value) =>
                      setLeftMonth(new Date(Number(value), leftMonth.getMonth(), 1))
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 w-[76px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: lastYear - firstYear + 1 },
                        (_, index) => firstYear + index,
                      ).map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(leftMonth.getMonth() + 1)}
                    onValueChange={(value) =>
                      setLeftMonth(new Date(leftMonth.getFullYear(), Number(value) - 1, 1))
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 w-[76px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <SelectItem key={month} value={String(month)}>
                          {new Date(2000, month - 1, 1).toLocaleString(locale, { month: 'short' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={pickRange}
                  month={leftMonth}
                  onMonthChange={setLeftMonth}
                  hideNavigation
                  fixedWeeks
                  numberOfMonths={1}
                  locale={calendarLocale}
                  startMonth={new Date(firstYear, 0)}
                  endMonth={new Date(lastYear, 11)}
                  classNames={{ month_caption: 'sr-only' }}
                  className="rounded-lg border"
                />
              </div>

              <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('time.prevMonth')}
                  onClick={() => {
                    setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))
                    setRightMonth(new Date(rightMonth.getFullYear(), rightMonth.getMonth() - 1, 1))
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('time.nextMonth')}
                  onClick={() => {
                    setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))
                    setRightMonth(new Date(rightMonth.getFullYear(), rightMonth.getMonth() + 1, 1))
                  }}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t('time.endMonth')}
                  </span>
                  <Select
                    value={String(rightMonth.getFullYear())}
                    onValueChange={(value) =>
                      setRightMonth(new Date(Number(value), rightMonth.getMonth(), 1))
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 w-[76px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: lastYear - firstYear + 1 },
                        (_, index) => firstYear + index,
                      ).map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(rightMonth.getMonth() + 1)}
                    onValueChange={(value) =>
                      setRightMonth(new Date(rightMonth.getFullYear(), Number(value) - 1, 1))
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 w-[76px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <SelectItem key={month} value={String(month)}>
                          {new Date(2000, month - 1, 1).toLocaleString(locale, { month: 'short' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={pickRange}
                  month={rightMonth}
                  onMonthChange={setRightMonth}
                  hideNavigation
                  fixedWeeks
                  numberOfMonths={1}
                  locale={calendarLocale}
                  startMonth={new Date(firstYear, 0)}
                  endMonth={new Date(lastYear, 11)}
                  classNames={{ month_caption: 'sr-only' }}
                  className="rounded-lg border"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('time.rangeHint')}</p>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="period-start" className="text-xs">
                  {t('time.startDate')}
                </Label>
                <Input
                  id="period-start"
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(event) => pickManual('start', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="period-end" className="text-xs">
                  {t('time.endDate')}
                </Label>
                <Input
                  id="period-end"
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(event) => pickManual('end', event.target.value)}
                />
              </div>
            </div>
            {invalid ? <p className="text-xs text-destructive">{t('time.rangeInvalid')}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="mr-auto" onClick={clearDraft}>
            {t('time.clearAll')}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={apply}
          >
            {t('time.applyRange')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TimeFilterSelector({ className }: { className?: string }) {
  const { timeFilter, isAllTime } = useTimeFilter()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('flex items-center gap-1', className)}>

      <Hint label={formatPeriodLabel(timeFilter, t)}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label={t('time.pickerTitle')}
          className="relative"
        >
          <CalendarDays className="text-muted-foreground" />
          {!isAllTime ? (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
          ) : null}
        </Button>
      </Hint>

      <PeriodDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
