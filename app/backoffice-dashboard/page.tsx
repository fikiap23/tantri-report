'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReportViewToggle } from '@/components/report-view-toggle'
import {
  ReportScopeType,
  REPORT_BEARER_TOKEN,
  calculateReportV2,
  fetchSaleSummaryRange,
  formatCurrency,
  formatDateForInput,
  formatNumber,
  getOrderCountByBlock,
  type SummaryData,
} from '@/lib/report-calculations'
import { cn } from '@/lib/utils'

type Preset = 'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'custom'

type DateRange = {
  startDate: string
  endDate: string
}

type RowItem = {
  label: string
  value: string
  negative?: boolean
  details?: Array<{
    label: string
    value: string
    negative?: boolean
  }>
}

type DummyField = {
  key: string
  requestToBE: string
}

const CARD_CLASS = 'rounded border border-[#e5e7eb] bg-white p-4'

const DUMMY_FIELDS: DummyField[] = [
  {
    key: 'walletExpense.detailBreakdown',
    requestToBE: 'Breakdown pengeluaran dompet per channel + jumlah transaksi',
  },
  {
    key: 'feeBreakdown.xendit',
    requestToBE: 'Breakdown Xendit fee per payment method + count transaksi',
  },
]

function getPresetRange(preset: Preset): DateRange {
  const now = new Date()
  const today = formatDateForInput(now)

  if (preset === 'today') return { startDate: today, endDate: today }

  if (preset === 'yesterday') {
    const y = new Date(now)
    y.setDate(now.getDate() - 1)
    const d = formatDateForInput(y)
    return { startDate: d, endDate: d }
  }

  if (preset === 'thisMonth') {
    return {
      startDate: formatDateForInput(
        new Date(now.getFullYear(), now.getMonth(), 1),
      ),
      endDate: formatDateForInput(
        new Date(now.getFullYear(), now.getMonth() + 1, 0),
      ),
    }
  }

  if (preset === 'lastMonth') {
    return {
      startDate: formatDateForInput(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      ),
      endDate: formatDateForInput(
        new Date(now.getFullYear(), now.getMonth(), 0),
      ),
    }
  }

  return {
    startDate: formatDateForInput(
      new Date(now.getFullYear(), now.getMonth(), 1),
    ),
    endDate: formatDateForInput(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    ),
  }
}

function MetricCard({
  title,
  total,
  rows,
  accent,
  unitLabel = 'Rupiah',
}: {
  title: string
  total: string
  rows: RowItem[]
  accent?: boolean
  unitLabel?: string
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      <p
        className={cn(
          'mt-2 text-[32px] font-bold leading-none text-neutral-800',
          accent && 'text-[#ab1e2d]',
        )}
      >
        {total}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{unitLabel}</p>
      <div className="mt-4 space-y-1.5">
        {rows.map((row) => {
          const rowKey = `${title}-${row.label}`
          const hasDetails = Boolean(row.details?.length)
          const isExpanded = expandedRows[rowKey] ?? false

          return (
            <div key={rowKey} className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-600">{row.label}</span>
                <span
                  className={cn(
                    'font-medium tabular-nums text-neutral-700',
                    row.negative && 'text-[#ab1e2d]',
                  )}
                >
                  {row.value}
                </span>
              </div>
              {hasDetails && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRows((prev) => ({
                      ...prev,
                      [rowKey]: !isExpanded,
                    }))
                  }
                  className="text-left text-[11px] font-medium text-[#ab1e2d] underline underline-offset-2"
                >
                  {isExpanded ? 'Sembunyikan' : 'Lihat Selengkapnya'}
                </button>
              )}
              {hasDetails && isExpanded && (
                <div className="space-y-1.5">
                  {row.details?.map((detail) => (
                    <div
                      key={`${rowKey}-${detail.label}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-neutral-600">{detail.label}</span>
                      <span
                        className={cn(
                          'font-medium tabular-nums text-neutral-700',
                          detail.negative && 'text-[#ab1e2d]',
                        )}
                      >
                        {detail.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function BackofficeDashboardPage() {
  const [preset, setPreset] = useState<Preset>('today')
  const initialRange = getPresetRange('today')
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SummaryData | null>(null)
  const [scopeType, setScopeType] = useState<ReportScopeType>(
    ReportScopeType.MERCHANT,
  )

  const report = useMemo(() => (data ? calculateReportV2(data) : null), [data])

  const dashboard = useMemo(() => {
    if (!data || !report) return null

    const transactionRows: RowItem[] = [
      {
        label: 'Makan Di Tempat',
        value: formatNumber(data.sales.orderDineInCount || 0),
      },
      {
        label: 'Take Away',
        value: formatNumber(data.sales.orderTakeAwayCount || 0),
      },
      {
        label: 'Pesan Antar',
        value: formatNumber(data.sales.orderDeliveryCount || 0),
      },
      {
        label: 'Online Food',
        value: formatNumber(getOrderCountByBlock(data.onlineFood)),
      },
      {
        label: 'Compliment',
        value: formatNumber(getOrderCountByBlock(data.compliment)),
      },
    ]

    const cancelledOrders =
      (data.sales.orderCancelledCount || 0) +
      (data.cityLedger.orderCancelledCount || 0) +
      (data.onlineFood.orderCancelledCount || 0) +
      (data.compliment.orderCancelledCount || 0)
    const successOrders =
      getOrderCountByBlock(data.sales) +
      getOrderCountByBlock(data.cityLedger) +
      getOrderCountByBlock(data.onlineFood) +
      getOrderCountByBlock(data.compliment)
    const totalOrders = successOrders + cancelledOrders
    const totalReservations =
      (data.reservation.waiting.totalReservation || 0) +
      (data.reservation.accepted.totalReservation || 0) +
      (data.reservation.succeed.totalReservation || 0) +
      (data.reservation.failed.totalReservation || 0)

    return {
      totalOrders,
      successOrders,
      cancelledOrders,
      totalReservations,
      reservationRows: [
        {
          label: 'Jumlah Reservasi',
          value: formatNumber(
            (data.reservation.waiting.totalReservation || 0) +
              (data.reservation.accepted.totalReservation || 0) +
              (data.reservation.succeed.totalReservation || 0) +
              (data.reservation.failed.totalReservation || 0),
          ),
          details: [
            {
              label: 'Menunggu',
              value: formatNumber(data.reservation.waiting.totalReservation || 0),
            },
            {
              label: 'Diterima',
              value: formatNumber(data.reservation.accepted.totalReservation || 0),
            },
            {
              label: 'Selesai',
              value: formatNumber(data.reservation.succeed.totalReservation || 0),
            },
            {
              label: 'Dibatalkan',
              value: formatNumber(data.reservation.failed.totalReservation || 0),
            },
          ],
        },
        {
          label: 'Jumlah Tamu',
          value: `${formatNumber(
            (data.reservation.waiting.totalPerson || 0) +
              (data.reservation.accepted.totalPerson || 0) +
              (data.reservation.succeed.totalPerson || 0) +
              (data.reservation.failed.totalPerson || 0),
          )} Orang`,
          details: [
            {
              label: 'Menunggu',
              value: `${formatNumber(data.reservation.waiting.totalPerson || 0)} Orang`,
            },
            {
              label: 'Diterima',
              value: `${formatNumber(data.reservation.accepted.totalPerson || 0)} Orang`,
            },
            {
              label: 'Selesai',
              value: `${formatNumber(data.reservation.succeed.totalPerson || 0)} Orang`,
            },
            {
              label: 'Dibatalkan',
              value: `${formatNumber(data.reservation.failed.totalPerson || 0)} Orang`,
            },
          ],
        },
        {
          label: 'Total Uang Muka (DP)',
          value: formatCurrency(
            (data.reservation.waiting.totalDeposit || 0) +
              (data.reservation.accepted.totalDeposit || 0) +
              (data.reservation.succeed.totalDeposit || 0) +
              (data.reservation.failed.totalDeposit || 0),
          ),
          details: [
            {
              label: 'Menunggu',
              value: formatCurrency(data.reservation.waiting.totalDeposit || 0),
            },
            {
              label: 'Diterima',
              value: formatCurrency(data.reservation.accepted.totalDeposit || 0),
            },
            {
              label: 'Selesai',
              value: formatCurrency(data.reservation.succeed.totalDeposit || 0),
            },
            {
              label: 'Dibatalkan',
              value: formatCurrency(data.reservation.failed.totalDeposit || 0),
            },
          ],
        },
        {
          label: 'Total Uang Muka (DP) Terbayar',
          value: formatCurrency(
            (data.reservation.waiting.totalPaidDeposit || 0) +
              (data.reservation.accepted.totalPaidDeposit || 0) +
              (data.reservation.succeed.totalPaidDeposit || 0) +
              (data.reservation.failed.totalPaidDeposit || 0),
          ),
          details: [
            {
              label: 'Menunggu',
              value: formatCurrency(data.reservation.waiting.totalPaidDeposit || 0),
            },
            {
              label: 'Diterima',
              value: formatCurrency(data.reservation.accepted.totalPaidDeposit || 0),
            },
            {
              label: 'Selesai',
              value: formatCurrency(data.reservation.succeed.totalPaidDeposit || 0),
            },
            {
              label: 'Dibatalkan',
              value: formatCurrency(data.reservation.failed.totalPaidDeposit || 0),
            },
          ],
        },
      ] as RowItem[],
      grossSalesRows: [
        {
          label: 'Total Produk Terjual',
          value: formatCurrency(data.sales.productSoldTotal || 0),
        },
        {
          label: 'Total Custom Amount',
          value: formatCurrency(data.sales.productCustomAmountSoldTotal || 0),
        },
        {
          label: 'Diskon',
          value: formatCurrency(data.sales.discount || 0, true),
          negative: true,
        },
        {
          label: 'Platform Fee',
          value: formatCurrency(data.sales.platformFee || 0),
          negative: true,
        },
        {
          label: 'Multiprice Fee',
          value: formatCurrency(data.sales.multipriceFee || 0),
          negative: true,
        },
        {
          label: 'Service Fee',
          value: formatCurrency(data.sales.serviceFee || 0),
          negative: true,
        },
        { label: 'Pajak', value: formatCurrency(data.sales.tax || 0) },
        {
          label: 'Pembulatan',
          value: formatCurrency(data.sales.rounding || 0),
        },
      ] as RowItem[],
      onlineFoodRows: [
        {
          label: 'Total Produk Terjual',
          value: formatCurrency(data.onlineFood.productSoldTotal || 0),
        },
        {
          label: 'Total Custom Amount',
          value: formatCurrency(
            data.onlineFood.productCustomAmountSoldTotal || 0,
          ),
        },
        {
          label: 'Diskon',
          value: formatCurrency(data.onlineFood.discount || 0, true),
          negative: true,
        },
        {
          label: 'Platform Fee',
          value: formatCurrency(data.onlineFood.platformFee || 0),
          negative: true,
        },
        {
          label: 'Multiprice Fee',
          value: formatCurrency(data.onlineFood.multipriceFee || 0),
          negative: true,
        },
        {
          label: 'Pembulatan',
          value: formatCurrency(data.onlineFood.rounding || 0),
        },
      ] as RowItem[],
      complimentRows: [
        {
          label: 'Total Produk Terjual',
          value: formatCurrency(data.compliment.productSoldTotal || 0),
        },
        {
          label: 'Platform Fee',
          value: formatCurrency(data.compliment.platformFee || 0),
          negative: true,
        },
        {
          label: 'Nominal Compliment',
          value: formatCurrency(data.compliment.complimentAmount || 0, true),
          negative: true,
        },
      ] as RowItem[],
      estimatedRevenueRows: [
        {
          label: 'Total Penjualan Kotor',
          value: formatCurrency(report.metrics.grossSales),
        },
        {
          label: 'Total Penjualan Kotor Online Food',
          value: formatCurrency(report.metrics.grossSalesOnlineFood),
        },
        {
          label: 'Total Penjualan Kotor Compliment',
          value: formatCurrency(report.metrics.grossCompliment),
        },
        {
          label: 'Platform Fee',
          value: formatCurrency(report.metrics.totalPlatformFee, true),
          negative: true,
        },
        {
          label: 'Platform Fee Compliment',
          value: formatCurrency(data.compliment.platformFee || 0, true),
          negative: true,
        },
        {
          label: 'Multiprice Fee',
          value: formatCurrency(report.metrics.totalMultipriceFee, true),
          negative: true,
        },
        {
          label: 'Xendit Fee',
          value: formatCurrency(report.metrics.totalXenditFee, true),
          negative: true,
        },
        {
          label: 'Potongan Deposit',
          value: formatCurrency(data.totalDepositDeduction ?? 0, true),
          negative: true,
        },
      ] as RowItem[],
      incomeRows: [
        {
          label: 'Total Pendapatan Kotor',
          value: formatCurrency(report.metrics.totalGrossSales),
        },
        {
          label: 'Harga Pokok Penjualan',
          value: formatCurrency(report.metrics.cogs, true),
          negative: true,
        },
        {
          label: 'Pendapatan Penjualan',
          value: formatCurrency(report.metrics.salesRevenue),
        },
        {
          label: 'Pembulatan',
          value: formatCurrency(
            report.metrics.rounding,
            report.metrics.rounding < 0,
          ),
          negative: report.metrics.rounding < 0,
        },
        {
          label: 'Total Pendapatan Penjualan',
          value: formatCurrency(report.metrics.totalSalesRevenue),
        },
        {
          label: 'Rugi',
          value: formatCurrency(report.metrics.loss, true),
          negative: true,
        },
      ] as RowItem[],
      walletIncomeRows: [
        {
          label: 'Tunai',
          value: formatCurrency(data.walletIncome.cashAmount || 0),
          details: [
            {
              label: 'Pemasukan Manual',
              value: formatCurrency(
                data.cashWalletDeposit?.manualTransaction ?? 0,
              ),
            },
            {
              label: 'Pemasukan Penjualan',
              value: formatCurrency(
                data.cashWalletDeposit?.orderTransaction ??
                  data.walletIncome.cashAmount ??
                  0,
              ),
            },
          ],
        },
        {
          label: 'Non Tunai',
          value: formatCurrency(data.walletIncome.nonCashAmount || 0),
        },
        {
          label: 'Debit',
          value: formatCurrency(data.walletIncome.debitAmount || 0),
        },
        {
          label: 'QR Static',
          value: formatCurrency(data.walletIncome.qrisStaticAmount || 0),
        },
        {
          label: 'Transfer Manual',
          value: formatCurrency(data.walletIncome.manualTransferAmount || 0),
        },
        {
          label: 'Online Food',
          value: formatCurrency(data.walletIncome.onlineFoodAmount || 0),
        },
      ] as RowItem[],
      walletExpenseRows: [
        {
          label: 'Tunai',
          value: formatCurrency(data.walletExpense.cash || 0, true),
          negative: true,
        },
        {
          label: 'Non Tunai',
          value: formatCurrency(data.walletExpense.nonCash || 0, true),
          negative: true,
        },
        {
          label: 'Debit',
          value: formatCurrency(data.walletExpense.debit || 0, true),
          negative: true,
        },
        {
          label: 'QR Static',
          value: formatCurrency(data.walletExpense.qrisStatic || 0, true),
          negative: true,
        },
        {
          label: 'Transfer Manual',
          value: formatCurrency(data.walletExpense.manualTransfer || 0, true),
          negative: true,
        },
        {
          label: 'Online Food',
          value: formatCurrency(data.walletExpense.onlineFood || 0, true),
          negative: true,
        },
      ] as RowItem[],
      transactionRows,
    }
  }, [data, report])

  function onPresetChange(nextPreset: Preset) {
    setPreset(nextPreset)
    if (nextPreset !== 'custom') {
      const range = getPresetRange(nextPreset)
      setStartDate(range.startDate)
      setEndDate(range.endDate)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetchSaleSummaryRange(
        startDate,
        endDate,
        scopeType,
      )
      setData(response)
    } catch (err) {
      setData(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memuat data.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#eceff3] p-4 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-800">
              Lihat Berdasarkan Tanggal
            </h1>
            <p className="text-xs text-neutral-500">
              Endpoint: /v2/report/sale/summary
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ReportViewToggle />
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="bo-scopeType">
                Scope Type
              </Label>
              <select
                id="bo-scopeType"
                value={scopeType}
                onChange={(e) =>
                  setScopeType(e.target.value as ReportScopeType)
                }
                className="h-9 rounded border border-neutral-300 bg-white px-3 text-sm"
              >
                <option value={ReportScopeType.MERCHANT}>
                  {ReportScopeType.MERCHANT}
                </option>
                <option value={ReportScopeType.OFFICE}>
                  {ReportScopeType.OFFICE}
                </option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preset</Label>
              <select
                value={preset}
                onChange={(e) => onPresetChange(e.target.value as Preset)}
                className="h-9 rounded border border-neutral-300 bg-white px-3 text-sm"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {preset === 'custom' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </>
            )}
            <Button
              onClick={loadData}
              disabled={loading}
              className="h-9 bg-[#ab1e2d] hover:bg-[#971a27]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {loading ? 'Loading...' : 'Load'}
            </Button>
          </div>
        </div>

        {!REPORT_BEARER_TOKEN && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle>Token belum diatur</AlertTitle>
            <AlertDescription>
              Isi NEXT_PUBLIC_REPORT_TOKEN dan NEXT_PUBLIC_REPORT_BASE_URL di
              .env.local.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Gagal memuat data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {dashboard && report && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <section className={CARD_CLASS}>
                <h2 className="text-sm font-semibold text-neutral-800">
                  Total Pesanan
                </h2>
                <p className="mt-2 text-[32px] font-bold leading-none text-[#ab1e2d]">
                  {formatNumber(dashboard.totalOrders)}
                </p>
                <p className="mt-2 text-xs text-neutral-600">Transaksi</p>
                <div className="mt-1 flex gap-4 text-xs">
                  <p className="text-emerald-600">
                    Selesai: {formatNumber(dashboard.successOrders)}
                  </p>
                  <p className="text-[#ab1e2d]">
                    Dibatalkan: {formatNumber(dashboard.cancelledOrders)}
                  </p>
                </div>
                <div className="mt-4 space-y-1.5">
                  {dashboard.transactionRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-neutral-600">{row.label}</span>
                      <span className="font-medium tabular-nums text-neutral-700">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <MetricCard
                title="Total Penjualan Kotor"
                total={formatNumber(Math.round(report.metrics.grossSales))}
                rows={dashboard.grossSalesRows}
              />
              <MetricCard
                title="Total Penjualan Kotor Online Food"
                total={formatNumber(
                  Math.round(report.metrics.grossSalesOnlineFood),
                )}
                rows={dashboard.onlineFoodRows}
              />
              <MetricCard
                title="Total Penjualan Kotor Compliment"
                total={formatNumber(Math.round(report.metrics.grossCompliment))}
                rows={dashboard.complimentRows}
              />
              <MetricCard
                title="Estimasi Pendapatan"
                total={formatNumber(Math.round(report.metrics.totalNetRevenue))}
                rows={dashboard.estimatedRevenueRows}
              />
              <MetricCard
                title="Pemasukan"
                total={formatNumber(
                  Math.round(report.metrics.totalSalesRevenue),
                )}
                rows={dashboard.incomeRows}
              />
              <MetricCard
                title="Pemasukan Dompet"
                total={formatNumber(
                  Math.round(report.metrics.totalWalletIncome),
                )}
                rows={dashboard.walletIncomeRows}
                accent
              />
              <MetricCard
                title="Pengeluaran Dompet"
                total={formatNumber(
                  Math.round(report.metrics.totalWalletExpense),
                )}
                rows={dashboard.walletExpenseRows}
              />
              <MetricCard
                title="Reservasi"
                total={formatNumber(dashboard.totalReservations)}
                rows={dashboard.reservationRows}
                unitLabel="Reservasi"
              />
            </div>

            <section className={CARD_CLASS}>
              <h2 className="text-sm font-semibold text-neutral-800">
                Field Dummy (Perlu Request ke BE)
              </h2>
              <div className="mt-3 space-y-2">
                {DUMMY_FIELDS.map((field) => (
                  <div key={field.key} className="text-xs">
                    <p className="font-medium text-neutral-800">{field.key}</p>
                    <p className="text-neutral-600">{field.requestToBE}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
