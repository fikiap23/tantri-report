'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildPlatformFeeBillingSection,
  formatCurrency,
  totalPlatformFeeBillingAmount,
  type PlatformFeePayer,
  type SummaryData,
} from '@/lib/report-calculations'

const accent = 'text-[#c62828]'

function DottedRule() {
  return <div className="border-t border-dotted border-neutral-300" />
}

function PlatformFeePayerSection({
  data,
  payer,
  expandedChannels,
  onToggleChannel,
  sectionOpen,
  onToggleSection,
}: {
  data: SummaryData
  payer: PlatformFeePayer
  expandedChannels: Record<string, boolean>
  onToggleChannel: (key: string) => void
  sectionOpen: boolean
  onToggleSection: () => void
}) {
  const section = useMemo(
    () => buildPlatformFeeBillingSection(data, payer),
    [data, payer],
  )

  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <button
                type="button"
                onClick={onToggleSection}
                className="mt-0.5 text-neutral-500"
                aria-expanded={sectionOpen}
              >
                {sectionOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {section.title}
                </p>
                <button
                  type="button"
                  onClick={onToggleSection}
                  className={cn('mt-1 text-xs font-medium', accent)}
                >
                  {sectionOpen ? 'Sembunyikan' : 'Selengkapnya'}
                </button>
              </div>
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-neutral-900">
            {formatCurrency(section.total)}
          </span>
        </div>
      </div>

      {sectionOpen && (
        <div className="space-y-0 bg-neutral-50/50 pb-2">
          {section.channels.map((channel) => {
            const channelKey = `${payer}-${channel.key}`
            const isChannelOpen = expandedChannels[channelKey] ?? false
            return (
              <div key={channelKey} className="px-4 py-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    {channel.expandable ? (
                      <button
                        type="button"
                        onClick={() => onToggleChannel(channelKey)}
                        className="shrink-0 text-neutral-500"
                        aria-expanded={isChannelOpen}
                      >
                        {isChannelOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="text-neutral-800">{channel.label}</span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                    {formatCurrency(channel.total)}
                  </span>
                </div>
                {channel.expandable && isChannelOpen && (
                  <div className="mt-2 space-y-1 border-l-2 border-neutral-200 pl-6">
                    {channel.rows.map((row, i) => (
                      <div
                        key={`${channelKey}-${i}`}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="text-neutral-600">{row.label}</span>
                        <span className="font-medium tabular-nums text-neutral-900">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
            <span className="text-neutral-800">{section.compliment.label}</span>
            <span className="font-semibold tabular-nums text-neutral-900">
              {section.compliment.value}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function CollapsiblePlatformFeeCard({
  data,
  defaultOpen = false,
}: {
  data: SummaryData
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [expandedPayer, setExpandedPayer] = useState<
    Record<PlatformFeePayer, boolean>
  >({
    byCustomer: true,
    byCafe: true,
  })
  const [expandedChannels, setExpandedChannels] = useState<
    Record<string, boolean>
  >({})

  const grandTotal = useMemo(() => totalPlatformFeeBillingAmount(data), [data])

  function toggleChannel(key: string) {
    setExpandedChannels((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-neutral-900">
          Tagihan Platform Fee
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-neutral-600 transition',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div>
          <PlatformFeePayerSection
            data={data}
            payer="byCustomer"
            expandedChannels={expandedChannels}
            onToggleChannel={toggleChannel}
            sectionOpen={expandedPayer.byCustomer}
            onToggleSection={() =>
              setExpandedPayer((p) => ({
                ...p,
                byCustomer: !p.byCustomer,
              }))
            }
          />
          <PlatformFeePayerSection
            data={data}
            payer="byCafe"
            expandedChannels={expandedChannels}
            onToggleChannel={toggleChannel}
            sectionOpen={expandedPayer.byCafe}
            onToggleSection={() =>
              setExpandedPayer((p) => ({ ...p, byCafe: !p.byCafe }))
            }
          />
          <DottedRule />
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="text-sm font-bold text-neutral-900">
              Total Tagihan Platform Fee
            </span>
            <span className="text-sm font-bold tabular-nums text-neutral-900">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
