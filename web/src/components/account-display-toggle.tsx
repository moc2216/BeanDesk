import { Check, Tags } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { useAccountDisplay, type AccountDisplayMode } from '@/lib/account-display'

const MODES: AccountDisplayMode[] = ['localized', 'raw']

export function AccountDisplayToggle() {
  const { t } = useI18n()
  const { mode, setMode } = useAccountDisplay()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('accountDisplay.label')}>
          <Tags />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('accountDisplay.label')}</DropdownMenuLabel>
        <DropdownMenuGroup>
          {MODES.map((value) => (
            <DropdownMenuItem key={value} onClick={() => setMode(value)}>
              <span>{t(value === 'raw' ? 'accountDisplay.raw' : 'accountDisplay.localized')}</span>
              {mode === value ? <Check /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
