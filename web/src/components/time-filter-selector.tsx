import { CalendarDays, Check, ChevronDown, X } from 'lucide-react'
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
  const { timeFilter, setTimeFilter, availableYears, clearFilter, isAllTime } = useTimeFilter()
  const { t, locale } = useI18n()
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [invalid, setInvalid] = useState(false)

  const calendarLocale = locale.toLowerCase().startsWith('zh') ? zhCN : enUS
  const activeYear = range?.from?.getFullYear() ?? Number(availableYears[0] ?? new Date().getFullYear())

  useEffect(() => {
    if (!open) return
    const current = parsePeriodRange(timeFilter)
    const from = current ? fromISO(current.start) : undefined
    const to = current ? fromISO(current.end) : undefined
    setRange(from ? { from, to } : undefined)
    setStart(current?.start ?? '')
    setEnd(current?.end ?? '')
    setInvalid(false)
    // Only resync when the panel opens; preset clicks close it immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pickRange(next: DateRange | undefined) {
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
    setRange(from ? { from, to } : undefined)
    setInvalid(false)
  }

  function apply() {
    if (!start || !end || start > end) {
      setInvalid(true)
      return
    }
    setTimeFilter(start + ' - ' + end)
    onOpenChange(false)
  }

  function preset(value: string) {
    setTimeFilter(value)
    onOpenChange(false)
  }

  function resetAll() {
    clearFilter()
    setRange(undefined)
    setStart('')
    setEnd('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('time.pickerTitle')}</DialogTitle>
          <DialogDescription>{t('time.pickerHint')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Button
              variant={isAllTime ? 'secondary' : 'ghost'}
              size="sm"
              className="justify-start"
              onClick={resetAll}
            >
              {t('time.allTime')}
              {isAllTime ? <Check className="ml-auto size-3.5" /> : null}
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
                    variant={timeFilter === year ? 'default' : 'outline'}
                    onClick={() => preset(year)}
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
                      variant={timeFilter === value ? 'default' : 'outline'}
                      onClick={() => preset(value)}
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
                      variant={timeFilter === value ? 'default' : 'outline'}
                      onClick={() => preset(value)}
                    >
                      {month}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Calendar
              mode="range"
              selected={range}
              onSelect={pickRange}
              numberOfMonths={2}
              locale={calendarLocale}
              className="rounded-lg border"
            />

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
          <Button variant="ghost" className="mr-auto" onClick={resetAll}>
            {t('time.clearAll')}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={apply} disabled={!start || !end}>
            {t('time.applyRange')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TimeFilterSelector({ className }: { className?: string }) {
  const { timeFilter, clearFilter, isAllTime } = useTimeFilter()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button variant={isAllTime ? 'outline' : 'secondary'} onClick={() => setOpen(true)}>
        <CalendarDays className="hidden text-muted-foreground sm:block" data-icon="inline-start" />
        <span className="max-w-[100px] truncate sm:max-w-none" title={formatPeriodLabel(timeFilter, t)}>
          {formatPeriodLabel(timeFilter, t)}
        </span>
        <ChevronDown className="hidden text-muted-foreground opacity-70 sm:block" data-icon="inline-end" />
      </Button>

      {!isAllTime && (
        <Hint label={t('time.allTime')}>
          <Button variant="ghost" size="icon-sm" onClick={clearFilter} aria-label={t('time.allTime')}>
            <X />
          </Button>
        </Hint>
      )}

      <PeriodDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

export function CalendarPeriodButton() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Hint label={t('time.pickerTitle')}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('time.pickerTitle')}
          onClick={() => setOpen(true)}
        >
          <CalendarDays />
        </Button>
      </Hint>
      <PeriodDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
