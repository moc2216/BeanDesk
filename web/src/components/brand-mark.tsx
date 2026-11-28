import { cn } from '@/lib/utils'

/** Bean mark: blue squircle with a cream bean and an upward ledger seam. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-5 shrink-0', className)}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#0a6cf5" />
      <g transform="translate(1 1) scale(0.034) rotate(22 512 512)">
        <path
          d="M 545 232
             C 680 232 790 345 790 505
             C 790 665 675 790 520 790
             C 430 790 350 740 318 660
             C 296 600 322 548 372 518
             C 414 492 432 452 420 410
             C 402 346 452 264 545 232 Z"
          fill="#fafaf8"
        />
        <path
          d="M 470 742 C 520 640 486 430 566 280"
          fill="none"
          stroke="#0757cb"
          strokeWidth="26"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}
