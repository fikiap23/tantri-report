'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Info,
  Loader2,
  Printer,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReportViewToggle } from '@/components/report-view-toggle'
import { cn } from '@/lib/utils'
import {
  type ShiftUserSummaryItem,
  type SummaryData,
  REPORT_BEARER_TOKEN,
  calculateReportV2,
  fetchShiftSaleSummaryByUserDate,
  formatCurrency,
  formatDateForInput,
  formatNumber,
  getOrderCountByBlock,
} from '@/lib/report-calculations'

const accent = 'text-[#c62828]'
const accentBg = 'bg-[#c62828] hover:bg-[#b71c1c]'

function formatLongDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function SectionShell({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-neutral-200 bg-neutral-100 px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-900">{title}</h2>
      </div>
      <div className="divide-y divide-neutral-200">{children}</div>
    </div>
  )
}

function DottedRule() {
  return <div className="border-t border-dotted border-neutral-300" />
}

function RowLine({
  label,
  value,
  valueClassName,
  sublabel,
  link,
  onLinkClick,
  leftAdornment,
  valueAdornment,
  denseLink,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  sublabel?: string
  link?: boolean
  onLinkClick?: () => void
  leftAdornment?: React.ReactNode
  valueAdornment?: React.ReactNode
  denseLink?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          {leftAdornment}
          <span className="text-sm font-medium text-neutral-900">{label}</span>
        </div>
        {sublabel && (
          <p className="mt-0.5 text-xs text-neutral-500">{sublabel}</p>
        )}
        {link && (
          <button
            type="button"
            onClick={onLinkClick}
            className={cn(
              'mt-0.5 text-xs font-medium',
              accent,
              denseLink && 'mt-0',
            )}
          >
            Selengkapnya
          </button>
        )}
      </div>
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-neutral-900',
          valueClassName,
        )}
      >
        {value}
        {valueAdornment}
      </div>
    </div>
  )
}

function KpiCard({
  title,
  value,
  showInfo = true,
}: {
  title: string
  value: string
  showInfo?: boolean
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
        <span>{title}</span>
        {showInfo && (
          <Info className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
        )}
      </div>
      <p className="text-lg font-bold leading-tight text-neutral-900">
        {value}
      </p>
    </div>
  )
}

function CollapsiblePlatformFeeCard({
  data,
  defaultOpen = false,
}: {
  data: SummaryData
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sales: true,
    onlineFood: true,
    cityLedger: true,
  })
  const details = useMemo(() => {
    function buildChannelRows(
      label: string,
      key: 'sales' | 'onlineFood' | 'cityLedger',
      items: SummaryData['platformFeeBreakdown']['sales'],
    ) {
      const hasApiData = Array.isArray(items) && items.length > 0
      const rows = hasApiData
        ? items.map((item) => ({
            label: `${formatNumber(item.price || 0)} x ${formatNumber(item.count || 0)} Transaksi`,
            value: formatCurrency((item.price || 0) * (item.count || 0)),
          }))
        : [{ label: `Breakdown ${label} (belum ada di API)`, value: '-' }]
      const total = hasApiData
        ? items.reduce(
            (sum, item) => sum + (item.price || 0) * (item.count || 0),
            0,
          )
        : 0
      return { key, label, rows, total, hasApiData }
    }

    const sales = buildChannelRows(
      'Penjualan',
      'sales',
      data.platformFeeBreakdown.sales,
    )
    const onlineFood = buildChannelRows(
      'Online Food',
      'onlineFood',
      data.platformFeeBreakdown.onlineFood,
    )
    const cityLedger = buildChannelRows(
      'City Ledger',
      'cityLedger',
      data.platformFeeBreakdown.cityLedger,
    )
    const complimentValue = data.platformFeeBreakdown.compliment
    const compliment = {
      label:
        typeof complimentValue === 'number'
          ? 'Platform Fee Compliment'
          : 'Platform Fee Compliment (belum ada di API)',
      value:
        typeof complimentValue === 'number'
          ? formatCurrency(complimentValue)
          : '-',
      total: typeof complimentValue === 'number' ? complimentValue : 0,
    }
    const total =
      sales.total + onlineFood.total + cityLedger.total + compliment.total
    return { sections: [sales, onlineFood, cityLedger], compliment, total }
  }, [data])

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
        <div className="divide-y divide-neutral-200">
          {details.sections.map((section) => {
            const isOpen = expandedSections[section.key] ?? false
            return (
              <div key={section.key}>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [section.key]: !isOpen,
                        }))
                      }
                      className="text-neutral-500"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <span className="font-semibold text-neutral-900">
                      {`Platform Fee ${section.label}`}
                    </span>
                  </div>
                  <span className="font-semibold text-neutral-900">
                    {formatCurrency(section.total)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [section.key]: !isOpen,
                    }))
                  }
                  className={cn('px-4 pb-1 text-xs font-medium', accent)}
                >
                  {isOpen ? 'Sembunyikan' : 'Selengkapnya'}
                </button>
                {isOpen && (
                  <div className="space-y-1 bg-neutral-50/80 px-4 py-2">
                    {section.rows.map((row, i) => (
                      <div
                        key={`${section.key}-${i}`}
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
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-neutral-600">{details.compliment.label}</span>
            <span className="font-semibold text-neutral-900">
              {details.compliment.value}
            </span>
          </div>
          <DottedRule />
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="font-bold text-neutral-900">
              Total Tagihan Platform Fee
            </span>
            <span className="font-bold text-neutral-900">
              {formatCurrency(details.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function V2ReservationBlock({
  reservation,
}: {
  reservation: SummaryData['reservation']
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    totalReservation: false,
    totalPerson: false,
    totalDeposit: false,
    totalPaidDeposit: false,
  })

  const detailRows = [
    {
      key: 'totalReservation' as const,
      label: 'Jumlah Reservasi',
      unit: '' as const,
    },
    {
      key: 'totalPerson' as const,
      label: 'Jumlah Tamu',
      unit: ' Orang' as const,
    },
    {
      key: 'totalDeposit' as const,
      label: 'Total Uang Muka (DP)',
      unit: 'currency' as const,
    },
    {
      key: 'totalPaidDeposit' as const,
      label: 'Total Uang Muka (DP) Terbayar',
      unit: 'currency' as const,
    },
  ]

  const statusList = [
    { label: 'Menunggu', key: 'waiting' as const },
    { label: 'Diterima', key: 'accepted' as const },
    { label: 'Selesai', key: 'succeed' as const },
    { label: 'Dibatalkan', key: 'failed' as const },
  ]

  function getTotal(
    metricKey: keyof typeof reservation.waiting,
    unit: (typeof detailRows)[number]['unit'],
  ) {
    const total =
      (reservation.waiting[metricKey] || 0) +
      (reservation.accepted[metricKey] || 0) +
      (reservation.succeed[metricKey] || 0) +
      (reservation.failed[metricKey] || 0)
    if (unit === 'currency') return formatCurrency(total)
    return `${formatNumber(total)}${unit}`
  }

  function getDetail(
    statusKey: keyof typeof reservation,
    metricKey: keyof typeof reservation.waiting,
    unit: (typeof detailRows)[number]['unit'],
  ) {
    const value = reservation[statusKey][metricKey] || 0
    if (unit === 'currency') return formatCurrency(value)
    return `${formatNumber(value)}${unit}`
  }

  return (
    <SectionShell title="Reservasi">
      {detailRows.map((metric) => {
        const isOpen = expanded[metric.key]
        return (
          <div key={metric.key} className="divide-y divide-neutral-200">
            <div className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setExpanded((p) => ({
                          ...p,
                          [metric.key]: !p[metric.key],
                        }))
                      }
                      className="mt-0.5 text-neutral-500"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {metric.label}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((p) => ({
                            ...p,
                            [metric.key]: !p[metric.key],
                          }))
                        }
                        className={cn('mt-1 text-xs font-medium', accent)}
                      >
                        {isOpen ? 'Sembunyikan' : 'Selengkapnya'}
                      </button>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-900">
                  {getTotal(metric.key, metric.unit)}
                </span>
              </div>
              {isOpen && (
                <div className="mt-3 space-y-2 border-l-2 border-neutral-100 pl-3">
                  {statusList.map((s) => (
                    <div key={s.key} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{s.label}</span>
                      <span className="font-medium tabular-nums">
                        {getDetail(s.key, metric.key, metric.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </SectionShell>
  )
}

export default function SummaryV2Page() {
  const now = new Date()
  const [date, setDate] = useState(formatDateForInput(now))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SummaryData | null>(null)
  const [shiftReports, setShiftReports] = useState<ShiftUserSummaryItem[]>([])
  const [activeShiftIndex, setActiveShiftIndex] = useState(0)
  const report = useMemo(
    () => (data ? calculateReportV2(data) : null),
    [data],
  )
  const activeShift = shiftReports[activeShiftIndex] ?? null

  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>(
    {},
  )
  const [expandedWalletIncome, setExpandedWalletIncome] = useState<
    Record<string, boolean>
  >({})
  const [isWalletIncomeTotalOpen, setIsWalletIncomeTotalOpen] = useState(false)
  const [expandedCompliment, setExpandedCompliment] = useState<
    Record<string, boolean>
  >({})
  const [expandedWalletExpenseGroups, setExpandedWalletExpenseGroups] = useState<
    Record<'bookClosing' | 'other', boolean>
  >({
    bookClosing: true,
    other: true,
  })

  async function fetchSaleSummary() {
    if (!date) {
      setError('Pilih tanggal terlebih dahulu.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const summaries = await fetchShiftSaleSummaryByUserDate(date)
      setShiftReports(summaries)
      setActiveShiftIndex(0)
      setData(summaries[0]?.report ?? null)
      if (summaries.length === 0) {
        setError('Data shift tidak ditemukan di tanggal ini.')
      }
    } catch (err) {
      setShiftReports([])
      setData(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengambil data.',
      )
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleExport() {
    if (!data) return
    const blob = new Blob(
      [JSON.stringify({ date, activeShift, data }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-per-shift-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const subtitle = formatLongDate(date)

  return (
    <main className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 sm:px-6 print:max-w-none">
        <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-neutral-900">
                  Laporan Per-Shift
                </h1>
                <p className="mt-1 text-sm">
                  Tanggal:{' '}
                  <span className={cn('font-medium', accent)}>{subtitle}</span>
                </p>
                {Boolean(activeShift) && (
                  <p className="mt-1 text-sm">
                    Shift Aktif:{' '}
                    <span className={cn('font-medium', accent)}>
                      {`${activeShift?.name} · ${activeShift?.nameShift} ${activeShift?.timeShift}`}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ReportViewToggle />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="grid gap-2 sm:grid-cols-1 print:hidden">
                <div className="space-y-1">
                  <Label htmlFor="v2-date" className="text-xs">
                    Tanggal
                  </Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                    <Input
                      id="v2-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-neutral-300"
                  onClick={fetchSaleSummary}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                  <span className="max-w-[200px] truncate text-xs sm:text-sm">
                    {formatLongDate(date)}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-neutral-300"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={cn('gap-1.5 text-white', accentBg)}
                  onClick={handleExport}
                  disabled={!data}
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-500 print:hidden">
            Ambil data per tanggal, lalu pilih shift user yang ingin dilihat.
          </p>
          <Button
            type="button"
            onClick={fetchSaleSummary}
            disabled={loading}
            className={cn('w-full sm:w-auto print:hidden', accentBg)}
            size="sm"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Memuat...' : 'Muat data'}
          </Button>
        </div>

        {!REPORT_BEARER_TOKEN && (
          <Alert className="border-amber-400 bg-amber-50 print:hidden">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle>Token belum diatur</AlertTitle>
            <AlertDescription>
              Isi <code>NEXT_PUBLIC_REPORT_TOKEN</code> dan{' '}
              <code>NEXT_PUBLIC_REPORT_BASE_URL</code> di{' '}
              <code>.env.local</code>.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="print:hidden">
            <AlertTitle>Gagal memuat report</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {shiftReports.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm print:hidden">
            <p className="mb-2 text-sm font-semibold text-neutral-900">Daftar Shift</p>
            <div className="flex flex-wrap gap-2">
              {shiftReports.map((item, index) => (
                <Button
                  key={`${item.name}-${item.nameShift}-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveShiftIndex(index)
                    setData(item.report)
                  }}
                  className={cn(
                    'border-neutral-300 text-xs',
                    index === activeShiftIndex && 'border-[#c62828] text-[#c62828]',
                  )}
                >
                  {`${item.name} · ${item.nameShift} ${item.timeShift.trim()}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {data && report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                title="Margin Bisnis"
                value={formatCurrency(report.metrics.totalNetRevenue)}
              />
              <KpiCard
                title="Pendapatan Kotor"
                value={formatCurrency(report.metrics.grossRevenue)}
              />
              <KpiCard
                title="Penjualan Kotor"
                value={formatCurrency(report.metrics.grossSales)}
              />
              <KpiCard
                title="Pemasukan Dompet"
                value={formatCurrency(report.metrics.totalWalletIncome)}
              />
              <KpiCard
                title="Pengeluaran Dompet"
                value={formatCurrency(report.metrics.totalWalletExpense)}
              />
              <KpiCard
                title="Rata-Rata Penjualan"
                value={`${formatCurrency(report.metrics.avgAmountPerBill)} / Bill`}
                showInfo={false}
              />
            </div>

            {/* Penjualan */}
            <SectionShell title="Penjualan">
              {report.salesExpandableRows.map((row, idx) => {
                const isTotal = row.label === 'Total Penjualan Kotor'
                const hasDetails = Boolean(row.details?.length)
                const isOpen = expandedSales[row.key] ?? false
                const isOrder = row.label === 'Total Pesanan'
                const isProduct = row.label === 'Total Produk Terjual'

                if (isTotal) {
                  return (
                    <div key={row.key}>
                      <DottedRule />
                      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                        <span className="text-sm font-bold text-neutral-900">
                          {row.label}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-neutral-900">
                          {row.value}
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={row.key}>
                    <RowLine
                      label={
                        row.label === 'Jumlah Produk Terjual'
                          ? 'Jumlah Item Terjual'
                          : row.label === 'Total Produk Terjual'
                            ? 'Total Penjualan Produk'
                            : row.label
                      }
                      sublabel={
                        isOrder || isProduct
                          ? (row.hint as string | undefined) ||
                            (isOrder
                              ? `${formatNumber(getOrderCountByBlock(data.sales))} Pesanan`
                              : undefined)
                          : row.hint
                      }
                      link={hasDetails && (isOrder || isProduct)}
                      onLinkClick={() =>
                        hasDetails &&
                        setExpandedSales((p) => ({ ...p, [row.key]: !isOpen }))
                      }
                      leftAdornment={
                        hasDetails && (isOrder || isProduct) ? (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setExpandedSales((p) => ({
                                ...p,
                                [row.key]: !isOpen,
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        ) : undefined
                      }
                      value={
                        isOrder ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-semibold',
                              accent,
                            )}
                          >
                            {row.value}
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        ) : (
                          row.value
                        )
                      }
                      valueClassName={row.negative ? 'text-red-600' : undefined}
                    />
                    {hasDetails && isOpen && (isOrder || isProduct) && (
                      <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                        {row.details?.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-neutral-600">{d.label}</span>
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                d.negative && 'text-red-600',
                              )}
                            >
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {idx < report.salesExpandableRows.length - 1 && !isTotal && (
                      <div className="border-t border-neutral-200" />
                    )}
                  </div>
                )
              })}
            </SectionShell>

            {/* Statistik */}
            <SectionShell title="Statistik">
              <RowLine
                label="Total Penjualan Kotor"
                value={formatCurrency(report.metrics.statisticsGrossSales)}
              />
              <RowLine
                label="Jumlah Transaksi"
                value={`${formatNumber(report.metrics.statisticsTotalBill)} Bill`}
                leftAdornment={
                  <Info className="mt-0.5 h-4 w-4 text-neutral-400" />
                }
              />
              <RowLine
                label="Jumlah Pelanggan"
                value={`${formatNumber(report.metrics.statisticsTotalGuest)} Orang`}
                leftAdornment={
                  <Info className="mt-0.5 h-4 w-4 text-neutral-400" />
                }
              />
              <DottedRule />
              <RowLine
                label="Rata-Rata Nilai / Transaksi"
                value={`${formatCurrency(report.metrics.avgAmountPerBill)} / Bill`}
              />
              <RowLine
                label="Rata-Rata Nilai / Pelanggan"
                value={`${formatCurrency(report.metrics.avgAmountPerGuest)} / Orang`}
              />
            </SectionShell>

            {/* Pemasukan Dompet */}
            <SectionShell title="Pemasukan Dompet">
              {report.walletIncomeExpandableRows.map((row, idx) => {
                const hasDetails = Boolean(row.details?.length)
                const isOpen = expandedWalletIncome[row.key] ?? false
                const showChevronUp =
                  row.label === 'Tunai' ||
                  row.label === 'Online Food' ||
                  row.label === 'Deposit'
                return (
                  <div key={row.key}>
                    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          {hasDetails && (
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() =>
                                setExpandedWalletIncome((p) => ({
                                  ...p,
                                  [row.key]: !isOpen,
                                }))
                              }
                              className="mt-0.5 text-neutral-500"
                            >
                              {showChevronUp ? (
                                isOpen ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )
                              ) : isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {row.label}
                            </p>
                            {row.hint && (
                              <p className="mt-0.5 text-xs text-neutral-500">
                                {row.hint}
                              </p>
                            )}
                            {hasDetails && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWalletIncome((p) => ({
                                    ...p,
                                    [row.key]: !isOpen,
                                  }))
                                }
                                className={cn(
                                  'mt-0.5 text-xs font-medium',
                                  accent,
                                )}
                              >
                                Selengkapnya
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-neutral-900">
                        {row.value}
                      </span>
                    </div>
                    {hasDetails && isOpen && (
                      <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                        {row.details?.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-neutral-600">{d.label}</span>
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                d.negative && 'text-red-600',
                              )}
                            >
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {idx < report.walletIncomeExpandableRows.length - 1 && (
                      <div className="border-t border-neutral-200" />
                    )}
                  </div>
                )
              })}
              <DottedRule />
              <div className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-expanded={isWalletIncomeTotalOpen}
                      onClick={() => setIsWalletIncomeTotalOpen((prev) => !prev)}
                      className="text-neutral-500"
                    >
                      {isWalletIncomeTotalOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <span className="text-sm font-bold text-neutral-900">
                      Total Pemasukan Dompet
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-neutral-900">
                    {formatCurrency(report.metrics.totalWalletIncome)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWalletIncomeTotalOpen((prev) => !prev)}
                  className={cn('mt-1 text-xs font-medium', accent)}
                >
                  {isWalletIncomeTotalOpen ? 'Sembunyikan' : 'Selengkapnya'}
                </button>
              </div>
              {isWalletIncomeTotalOpen && (
                <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Pemasukan Dompet</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(report.metrics.totalWalletIncome)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">
                      Settlement
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(report.metrics.totalSettlement)}
                    </span>
                  </div>
                </div>
              )}
            </SectionShell>

            {/* Pengeluaran Dompet */}
            <SectionShell title="Pengeluaran Dompet">
              {(
                [
                  {
                    key: 'bookClosing' as const,
                    label: 'Tutup Buku',
                    data:
                      data.walletExpense.bookClosing ?? {
                        cash: data.walletExpense.cash,
                        nonCash: data.walletExpense.nonCash,
                        debit: data.walletExpense.debit,
                        qrisStatic: data.walletExpense.qrisStatic,
                        manualTransfer: data.walletExpense.manualTransfer,
                        onlineFood: data.walletExpense.onlineFood,
                        cityLedger: data.walletExpense.cityLedger,
                        deposit: data.walletExpense.deposit,
                      },
                  },
                  {
                    key: 'other' as const,
                    label: 'Lainnya',
                    data: data.walletExpense.other ?? {},
                  },
                ] as const
              ).map((group) => {
                const isOpen = expandedWalletExpenseGroups[group.key]
                const total =
                  Number(group.data.cash ?? 0) +
                  Number(group.data.nonCash ?? 0) +
                  Number(group.data.debit ?? 0) +
                  Number(group.data.qrisStatic ?? 0) +
                  Number(group.data.manualTransfer ?? 0) +
                  Number(group.data.onlineFood ?? 0) +
                  Number(group.data.cityLedger ?? 0) +
                  Number(group.data.deposit ?? 0)
                return (
                  <div key={group.key}>
                    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWalletExpenseGroups((p) => ({
                                ...p,
                                [group.key]: !p[group.key],
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {group.label}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedWalletExpenseGroups((p) => ({
                                  ...p,
                                  [group.key]: !p[group.key],
                                }))
                              }
                              className={cn('mt-0.5 text-xs font-medium', accent)}
                            >
                              {isOpen ? 'Sembunyikan' : 'Selengkapnya'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-red-600">
                        {formatCurrency(total, true)}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Tunai</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.cash ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Non-Tunai</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.nonCash ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Debit</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.debit ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">QRIS Static</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.qrisStatic ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Transfer Manual</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(
                              Number(group.data.manualTransfer ?? 0),
                              true,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Online Food</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.onlineFood ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Deposit</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.deposit ?? 0), true)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">City Ledger</span>
                          <span className="font-semibold tabular-nums text-red-600">
                            {formatCurrency(Number(group.data.cityLedger ?? 0), true)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-neutral-200" />
                  </div>
                )
              })}
              <DottedRule />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Total Pengeluaran Dompet
                </span>
                <span className="text-sm font-bold tabular-nums text-red-600">
                  {formatCurrency(report.metrics.totalWalletExpense, true)}
                </span>
              </div>
            </SectionShell>

            <V2ReservationBlock reservation={data.reservation} />

            {/* Online Food */}
            <SectionShell title="Online Food">
              <RowLine
                label="Jumlah Item Terjual"
                value={formatNumber(data.onlineFood.productSoldCount || 0)}
              />
              {report.onlineFoodExpandableRows.map((row) => {
                if (row.label === 'Jumlah Produk Terjual') return null
                const hasDetails = Boolean(row.details?.length)
                const key = row.key
                const isOpen = expandedSales[key] ?? false
                if (row.label === 'Total Pesanan') {
                  return (
                    <div key={key}>
                      <RowLine
                        label="Jumlah Transaksi"
                        sublabel={`${formatNumber(getOrderCountByBlock(data.onlineFood))} Pesanan`}
                        link={hasDetails}
                        onLinkClick={() =>
                          hasDetails &&
                          setExpandedSales((p) => ({ ...p, [key]: !isOpen }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSales((p) => ({
                                ...p,
                                [key]: !isOpen,
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        }
                        value={
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-semibold',
                              accent,
                            )}
                          >
                            {row.value}
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        }
                      />
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                if (row.label === 'Total Produk Terjual') {
                  return (
                    <div key={key}>
                      <RowLine
                        label="Total Penjualan Produk"
                        link={hasDetails}
                        onLinkClick={() =>
                          hasDetails &&
                          setExpandedSales((p) => ({ ...p, [key]: !isOpen }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSales((p) => ({
                                ...p,
                                [key]: !isOpen,
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        }
                        value={<span className="font-bold">{row.value}</span>}
                      />
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              })}
              <RowLine
                label="Diskon"
                value={formatCurrency(data.onlineFood.discount || 0, true)}
                valueClassName="text-red-600"
              />
              <RowLine
                label="Platform Fee"
                value={formatCurrency(data.onlineFood.platformFee || 0)}
              />
              <RowLine
                label="Service Fee"
                value={formatCurrency(data.onlineFood.serviceFee || 0)}
              />
              <RowLine
                label="Multi-Price Fee"
                value={formatCurrency(data.onlineFood.multipriceFee || 0)}
              />
              <RowLine
                label="Pajak"
                value={formatCurrency(data.onlineFood.tax || 0)}
              />
              <RowLine
                label="Pembulatan"
                value={formatCurrency(data.onlineFood.rounding || 0)}
              />
              <DottedRule />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Total Penjualan Online Food
                </span>
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  {formatCurrency(report.metrics.grossSalesOnlineFood)}
                </span>
              </div>
            </SectionShell>

            {/* City Ledger */}
            <SectionShell title="City Ledger">
              <RowLine
                label="Jumlah Item Terjual"
                value={formatNumber(data.cityLedger.productSoldCount || 0)}
              />
              {report.cityLedgerExpandableRows.map((row) => {
                const hasDetails = Boolean(row.details?.length)
                const key = `cl-${row.key}`
                const isOpen = expandedSales[key] ?? false
                if (row.label === 'Total Pesanan') {
                  return (
                    <div key={key}>
                      <RowLine
                        label="Jumlah Transaksi"
                        sublabel={`${formatNumber(getOrderCountByBlock(data.cityLedger))} Pesanan`}
                        link={hasDetails}
                        onLinkClick={() =>
                          hasDetails &&
                          setExpandedSales((p) => ({ ...p, [key]: !isOpen }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSales((p) => ({
                                ...p,
                                [key]: !isOpen,
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        }
                        value={
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-semibold',
                              accent,
                            )}
                          >
                            {row.value}
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        }
                      />
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                if (row.label === 'Total Produk Terjual') {
                  return (
                    <div key={key}>
                      <RowLine
                        label="Total Penjualan Produk"
                        link={hasDetails}
                        onLinkClick={() =>
                          hasDetails &&
                          setExpandedSales((p) => ({ ...p, [key]: !isOpen }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSales((p) => ({
                                ...p,
                                [key]: !isOpen,
                              }))
                            }
                            className="mt-0.5 text-neutral-500"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        }
                        value={<span className="font-bold">{row.value}</span>}
                      />
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              })}
              <RowLine
                label="Diskon"
                value={formatCurrency(data.cityLedger.discount || 0, true)}
                valueClassName="text-red-600"
              />
              <RowLine
                label="Platform Fee"
                value={formatCurrency(data.cityLedger.platformFee || 0)}
              />
              <RowLine
                label="Service Fee"
                value={formatCurrency(data.cityLedger.serviceFee || 0)}
              />
              <RowLine
                label="Multi-Price Fee"
                value={formatCurrency(data.cityLedger.multipriceFee || 0)}
              />
              <RowLine
                label="Pajak"
                value={formatCurrency(data.cityLedger.tax || 0)}
              />
              <RowLine
                label="Pembulatan"
                value={formatCurrency(data.cityLedger.rounding || 0)}
              />
              <DottedRule />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Total Penjualan City Ledger
                </span>
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  {formatCurrency(report.metrics.grossCityLedger)}
                </span>
              </div>
            </SectionShell>

            {/* Compliment */}
            <SectionShell title="Compliment">
              {report.complimentExpandableRows.map((row) => {
                const hasDetails = Boolean(row.details?.length)
                const isOpen = expandedCompliment[row.key] ?? false
                if (row.label === 'Jumlah Transaksi') {
                  return (
                    <div key={row.key}>
                      <RowLine
                        label={row.label}
                        link={hasDetails}
                        onLinkClick={() =>
                          setExpandedCompliment((p) => ({
                            ...p,
                            [row.key]: !isOpen,
                          }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCompliment((p) => ({
                                ...p,
                                [row.key]: !isOpen,
                              }))
                            }
                            className="text-neutral-500"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        }
                        value={
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 font-semibold',
                              accent,
                            )}
                          >
                            {row.value}
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        }
                      />
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                if (row.label === 'Total Penjualan Produk') {
                  return (
                    <div key={row.key}>
                      <RowLine
                        label={row.label}
                        link={hasDetails}
                        onLinkClick={() =>
                          setExpandedCompliment((p) => ({
                            ...p,
                            [row.key]: !isOpen,
                          }))
                        }
                        leftAdornment={
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCompliment((p) => ({
                                ...p,
                                [row.key]: !isOpen,
                              }))
                            }
                            className="text-neutral-500"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        }
                        value={<span className="font-bold">{row.value}</span>}
                      />
                      {hasDetails && (
                        <button
                          type="button"
                          className={cn(
                            'block w-full px-4 pb-2 text-left text-xs font-medium',
                            accent,
                          )}
                          onClick={() =>
                            setExpandedCompliment((p) => ({
                              ...p,
                              [row.key]: !isOpen,
                            }))
                          }
                        >
                          Selengkapnya
                        </button>
                      )}
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <div key={row.key}>
                    <RowLine label={row.label} value={row.value} />
                  </div>
                )
              })}
              <DottedRule />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Nominal Compliment
                </span>
                <span className="text-sm font-bold tabular-nums text-red-600">
                  {formatCurrency(data.compliment.complimentAmount || 0, true)}
                </span>
              </div>
            </SectionShell>

            <CollapsiblePlatformFeeCard data={data} />

            {/* Pendapatan */}
            <SectionShell title="Pendapatan">
              <RowLine
                label="Total Penjualan Kotor"
                value={formatCurrency(report.metrics.grossSales)}
              />
              <RowLine
                label="Total Penjualan Online Food"
                value={formatCurrency(report.metrics.grossSalesOnlineFood)}
              />
              <RowLine
                label="Total Penjualan City Ledger"
                value={formatCurrency(report.metrics.grossCityLedger)}
              />
              <RowLine
                label="Total Penjualan Compliment"
                value={formatCurrency(report.metrics.grossCompliment)}
              />
              {report.revenueExpandableRows
                .filter((r) =>
                  ['Platform Fee', 'Multiprice Fee', 'Xendit Fee'].includes(
                    r.label,
                  ),
                )
                .map((row) => {
                  const hasDetails = Boolean(row.details?.length)
                  const isOpen = expandedSales[`rev-${row.key}`] ?? false
                  return (
                    <div key={row.key} className="border-t border-neutral-200">
                      <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSales((p) => ({
                                  ...p,
                                  [`rev-${row.key}`]: !isOpen,
                                }))
                              }
                              className="mt-0.5 text-neutral-500"
                            >
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <p className="text-sm font-medium text-neutral-900">
                                {row.label}
                              </p>
                              {hasDetails && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSales((p) => ({
                                      ...p,
                                      [`rev-${row.key}`]: !isOpen,
                                    }))
                                  }
                                  className={cn(
                                    'mt-1 text-xs font-medium',
                                    accent,
                                  )}
                                >
                                  Selengkapnya
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-red-600">
                          {row.value}
                        </span>
                      </div>
                      {hasDetails && isOpen && (
                        <div className="space-y-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
                          {row.details?.map((d, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-neutral-600">
                                {d.label}
                              </span>
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  d.negative && 'text-red-600',
                                )}
                              >
                                {d.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              <RowLine
                label="Potongan Deposit"
                value={formatCurrency(data.totalDepositDeduction ?? 0, true)}
                valueClassName="text-red-600"
              />
              <DottedRule />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Total Pendapatan Kotor
                </span>
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  {formatCurrency(report.metrics.totalGrossSales)}
                </span>
              </div>
              <RowLine
                label="Harga Pokok Penjualan (HPP)"
                value={formatCurrency(report.metrics.cogs, true)}
                valueClassName="text-red-600"
              />
              <RowLine
                label="Pembulatan"
                value={formatCurrency(report.metrics.rounding)}
              />
              <RowLine
                label="Margin Penjualan"
                value={formatCurrency(report.metrics.totalSalesRevenue)}
              />
              <DottedRule />
              <RowLine
                label="Waste / Bahan Terbuang"
                value={formatCurrency(report.metrics.loss, true)}
                valueClassName="text-red-600"
              />
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span className="text-sm font-bold text-neutral-900">
                  Margin Bisnis
                </span>
                <span className="text-sm font-bold tabular-nums text-neutral-900">
                  {formatCurrency(report.metrics.totalNetRevenue)}
                </span>
              </div>
            </SectionShell>

            {Boolean(data.waitingTransactions?.length) && (
              <SectionShell title="Pembayaran Tertunda">
                {data.waitingTransactions?.map((trx, index) => (
                  <div key={`${trx.customerName}-${trx.date}-${index}`}>
                    <RowLine
                      label={new Date(trx.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      sublabel={`${trx.customerName} · Cashier ${trx.createdBy}`}
                      value={formatCurrency(trx.totalPrice)}
                    />
                    {index < (data.waitingTransactions?.length || 0) - 1 && (
                      <div className="border-t border-neutral-200" />
                    )}
                  </div>
                ))}
              </SectionShell>
            )}
          </>
        )}
      </div>
    </main>
  )
}
