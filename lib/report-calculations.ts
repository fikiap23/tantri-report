/**
 * Satu modul: tipe API, formatter, fetch, dan kalkulasi view per versi UI.
 * Alur: fetch → SummaryData → calculateReportV1 | calculateReportV2 → render.
 */

// --- Types (response API) ---

export type ApiResponse = {
  isSuccess: boolean
  message: string
  data: SummaryData
}

export enum ReportScopeType {
  MERCHANT = 'MERCHANT',
  OFFICE = 'OFFICE',
}

export type MetricRow = {
  label: string
  value: string
  negative?: boolean
  hint?: string
}

export type ExpandableMetricRow = MetricRow & {
  key: string
  details?: MetricRow[]
}

type MultipriceBreakdown = {
  [key: string]: unknown
}

export type PriceCount = {
  price: number
  count: number
}

export type SalesBlock = {
  productSoldCount: number
  orderCount?: number
  orderGeneralCount?: number
  orderSplitBillCount?: number
  orderDineInCount?: number
  orderTakeAwayCount?: number
  orderDeliveryCount?: number
  orderCancelledCount?: number
  productSoldTotal: number
  productNormalSoldTotal?: number
  productCustomAmountSoldTotal?: number
  discount?: number
  tax?: number
  platformFee: number
  serviceFee?: number
  multipriceFee: number
  rounding: number
  xenditFee: number
  cogs: number
  guestCount: number
  multiprices?: MultipriceBreakdown[]
  settlement?: number
}

export function getOrderCountByBlock(
  block: Pick<
    SalesBlock,
    | 'orderGeneralCount'
    | 'orderSplitBillCount'
    | 'orderDineInCount'
    | 'orderTakeAwayCount'
    | 'orderDeliveryCount'
  >,
): number {
  const generalAndSplit =
    (block.orderGeneralCount || 0) + (block.orderSplitBillCount || 0)
  if (generalAndSplit > 0) return generalAndSplit
  return (
    (block.orderDineInCount || 0) +
    (block.orderTakeAwayCount || 0) +
    (block.orderDeliveryCount || 0)
  )
}

export type ReservationState = {
  totalReservation: number
  totalPerson: number
  totalDeposit: number
  totalPaidDeposit: number
}

export type WalletIncome = {
  cashAmount: number
  cashCount: number
  nonCashAmount: number
  nonCashCount: number
  debitAmount: number
  debitCount: number
  qrisStaticAmount: number
  qrisStaticCount: number
  manualTransferAmount: number
  manualTransferCount: number
  onlineFoodAmount: number
  onlineFoodCount: number
  cityLedgerAmount: number
  cityLedgerCount: number
  depositAmount?: number
  depositCount?: number
}

export type WalletExpenseChannel = {
  cash?: number
  nonCash?: number
  debit?: number
  qrisStatic?: number
  manualTransfer?: number
  cityLedger?: number
  onlineFood?: number
  deposit?: number
}

export type WalletExpense = WalletExpenseChannel & {
  /** Legacy shape */
  deposit?: number
  /** New API shape */
  bookClosing?: WalletExpenseChannel
  other?: WalletExpenseChannel
}

/** Pecahan tunai dompet operasional (manual vs penjualan). */
export type CashWalletDeposit = {
  manualTransaction: number
  orderTransaction: number
}

export type DepositWalletDeposit = {
  totalDepositCash: number
  totalDepositDebit: number
  totalDepositQRStatic: number
  totalDepositEWallet: number
  totalDepositManualTransfer: number
  countDepositCash: number
  countDepositDebit: number
  countDepositQRStatic: number
  countDepositEWallet: number
  countDepositManualTransfer: number
}

export type DepositWallet = {
  deposit: DepositWalletDeposit
  totalWithdraw: number
}

export type XenditFeeBreakdownItem = {
  amount: number
  count: number
}

export type XenditFeeBreakdown = {
  eWallet?: XenditFeeBreakdownItem
  qris?: XenditFeeBreakdownItem
  virtualAccount?: XenditFeeBreakdownItem
  visa?: XenditFeeBreakdownItem
}

export type SummaryData = {
  nameCashiers?: string[]
  waitingTransactions?: WaitingTransaction[]
  sales: SalesBlock
  onlineFood: SalesBlock
  cityLedger: SalesBlock
  compliment: SalesBlock & {
    complimentAmount?: number
  }
  platformFeeBreakdown: {
    sales: PriceCount[]
    onlineFood: PriceCount[]
    cityLedger: PriceCount[]
    compliment: number
  }
  xenditFee?: XenditFeeBreakdown
  reservation: {
    waiting: ReservationState
    accepted: ReservationState
    succeed: ReservationState
    failed: ReservationState
  }
  walletIncome: WalletIncome
  walletExpense: WalletExpense
  loss: number
  /** Dipotong dari total pendapatan kotor (setelah fee). */
  totalDepositDeduction?: number
  cashWalletDeposit?: CashWalletDeposit
  depositWallet?: DepositWallet
}

export type WaitingTransaction = {
  createdBy: string
  customerName: string
  totalPriceProduct: number
  totalPrice: number
  fee: number
  date: string
}

export type ShiftUserSummaryItem = {
  name: string
  nameShift: string
  timeShift: string
  isOverDay: boolean
  debtOrders: unknown[]
  report: SummaryData
}

function totalDepositIncomeFromWallet(data: SummaryData): number {
  const dep = data.depositWallet?.deposit
  if (dep) {
    return (
      (dep.totalDepositCash || 0) +
      (dep.totalDepositDebit || 0) +
      (dep.totalDepositQRStatic || 0) +
      (dep.totalDepositEWallet || 0) +
      (dep.totalDepositManualTransfer || 0)
    )
  }
  return data.walletIncome.depositAmount ?? 0
}

function totalDepositIncomeCountFromWallet(data: SummaryData): number {
  const dep = data.depositWallet?.deposit
  if (dep) {
    return (
      (dep.countDepositCash || 0) +
      (dep.countDepositDebit || 0) +
      (dep.countDepositQRStatic || 0) +
      (dep.countDepositEWallet || 0) +
      (dep.countDepositManualTransfer || 0)
    )
  }
  return data.walletIncome.depositCount ?? 0
}

function walletExpenseDepositAmount(data: SummaryData): number {
  if (typeof data.walletExpense.deposit === 'number') {
    return data.walletExpense.deposit
  }
  return data.depositWallet?.totalWithdraw ?? 0
}

export function getWalletExpenseAmountByMethod(
  data: SummaryData,
  method: keyof WalletExpenseChannel,
): number {
  const direct = Number(data.walletExpense?.[method] ?? 0)
  const bookClosing = Number(data.walletExpense?.bookClosing?.[method] ?? 0)
  const other = Number(data.walletExpense?.other?.[method] ?? 0)
  return direct + bookClosing + other
}

function totalSettlementAmount(data: SummaryData): number {
  return (
    Number(data.sales.settlement ?? 0) +
    Number(data.onlineFood.settlement ?? 0) +
    Number(data.cityLedger.settlement ?? 0)
  )
}

function totalXenditFeeFromBreakdown(data: SummaryData): number {
  const breakdown = data.xenditFee
  if (!breakdown) return 0
  return (
    Number(breakdown.eWallet?.amount ?? 0) +
    Number(breakdown.qris?.amount ?? 0) +
    Number(breakdown.virtualAccount?.amount ?? 0) +
    Number(breakdown.visa?.amount ?? 0)
  )
}

// --- Env & format ---

export const REPORT_BASE_URL =
  process.env.NEXT_PUBLIC_REPORT_BASE_URL ?? 'http://localhost:3000'
export const REPORT_BEARER_TOKEN = process.env.NEXT_PUBLIC_REPORT_TOKEN ?? ''

export function formatNumber(num: number) {
  return Number(num || 0).toLocaleString('id-ID')
}

export function formatCurrency(num: number, showNegativeStyle = false) {
  const abs = Math.abs(Number(num || 0))
  const value = `Rp ${formatNumber(abs)}`
  if (showNegativeStyle || num < 0) {
    return `(${value})`
  }
  return value
}

/** YYYY-MM-DD for `<input type="date">` — always uses the user's local calendar day (not UTC). */
export function formatDateForInput(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const da = parts[2]
  if (!y || !mo || !da) return isoDate
  const base = new Date(y, mo - 1, da)
  base.setDate(base.getDate() + days)
  return formatDateForInput(base)
}

// --- Angka inti (dipakai membangun baris) ---

export type ReportMetrics = {
  grossSales: number
  grossSalesOnlineFood: number
  grossCityLedger: number
  grossCompliment: number
  statisticsGrossSales: number
  statisticsTotalBill: number
  statisticsTotalGuest: number
  avgAmountPerGuest: number
  avgAmountPerBill: number
  totalPlatformFee: number
  totalMultipriceFee: number
  totalXenditFee: number
  totalGrossSales: number
  grossRevenue: number
  cogs: number
  salesRevenue: number
  rounding: number
  totalSalesRevenue: number
  loss: number
  totalNetRevenue: number
  totalWalletIncome: number
  totalWalletExpense: number
  totalSettlement: number
}

function computeMetrics(data: SummaryData): ReportMetrics {
  const grossSales =
    (data.sales.productSoldTotal || 0) -
    (data.sales.discount || 0) +
    (data.sales.tax || 0) +
    (data.sales.platformFee || 0) +
    (data.sales.serviceFee || 0) +
    (data.sales.multipriceFee || 0) +
    (data.sales.rounding || 0)

  const grossSalesOnlineFood =
    (data.onlineFood.productSoldTotal || 0) -
    (data.onlineFood.discount || 0) +
    (data.onlineFood.platformFee || 0) +
    (data.onlineFood.multipriceFee || 0) +
    (data.onlineFood.rounding || 0)

  const grossCityLedger =
    (data.cityLedger.productSoldTotal || 0) -
    (data.cityLedger.discount || 0) +
    (data.cityLedger.tax || 0) +
    (data.cityLedger.platformFee || 0) +
    (data.cityLedger.serviceFee || 0) +
    (data.cityLedger.multipriceFee || 0) +
    (data.cityLedger.rounding || 0)

  const grossCompliment =
    (data.compliment.productSoldTotal || 0) -
    (data.compliment.discount || 0) +
    (data.compliment.tax || 0) +
    (data.compliment.platformFee || 0) +
    (data.compliment.serviceFee || 0) +
    (data.compliment.multipriceFee || 0) +
    (data.compliment.rounding || 0)

  const statisticsGrossSales = grossSales + grossCityLedger
  const statisticsTotalBill =
    getOrderCountByBlock(data.sales) + getOrderCountByBlock(data.cityLedger)
  const statisticsTotalGuest =
    (data.sales.guestCount || 0) + (data.cityLedger.guestCount || 0)
  const avgAmountPerGuest = statisticsTotalGuest
    ? statisticsGrossSales / statisticsTotalGuest
    : 0
  const avgAmountPerBill = statisticsTotalBill
    ? statisticsGrossSales / statisticsTotalBill
    : 0

  const totalPlatformFee =
    (data.sales?.platformFee || 0) +
    (data.cityLedger?.platformFee || 0) +
    (data.onlineFood?.platformFee || 0)

  const totalMultipriceFee =
    (data.sales?.multipriceFee || 0) +
    (data.compliment?.multipriceFee || 0) +
    (data.onlineFood?.multipriceFee || 0) +
    (data.cityLedger?.multipriceFee || 0)

  const totalXenditFeeByChannel =
    (data.sales?.xenditFee || 0) +
    (data.cityLedger?.xenditFee || 0) +
    (data.onlineFood?.xenditFee || 0) +
    (data.compliment?.xenditFee || 0)
  const totalXenditFee =
    totalXenditFeeFromBreakdown(data) || totalXenditFeeByChannel

  const totalDepositDeduction = Number(data.totalDepositDeduction ?? 0)

  const totalGrossSales =
    grossSales +
    grossSalesOnlineFood +
    grossCityLedger -
    totalPlatformFee -
    totalMultipriceFee -
    totalXenditFee -
    totalDepositDeduction

  const grossRevenue = totalGrossSales
  const cogs =
    (data.sales.cogs || 0) +
    (data.onlineFood.cogs || 0) +
    (data.cityLedger.cogs || 0) +
    (data.compliment.cogs || 0)
  const salesRevenue = grossRevenue - cogs
  const rounding =
    (data.sales.rounding || 0) +
    (data.onlineFood.rounding || 0) +
    (data.cityLedger.rounding || 0) +
    (data.compliment.rounding || 0)
  const totalSalesRevenue = salesRevenue
  const loss = data?.loss || 0
  const totalNetRevenue = totalSalesRevenue - loss

  const depositIncomeTotal = totalDepositIncomeFromWallet(data)

  const totalWalletIncome =
    (data.walletIncome.cashAmount || 0) +
    (data.walletIncome.nonCashAmount || 0) +
    (data.walletIncome.debitAmount || 0) +
    (data.walletIncome.qrisStaticAmount || 0) +
    (data.walletIncome.manualTransferAmount || 0) +
    (data.walletIncome.onlineFoodAmount || 0) +
    (data.walletIncome.cityLedgerAmount || 0) +
    depositIncomeTotal +
    totalSettlementAmount(data)

  const totalWalletExpense =
    getWalletExpenseAmountByMethod(data, 'cash') +
    getWalletExpenseAmountByMethod(data, 'nonCash') +
    getWalletExpenseAmountByMethod(data, 'debit') +
    getWalletExpenseAmountByMethod(data, 'qrisStatic') +
    getWalletExpenseAmountByMethod(data, 'manualTransfer') +
    getWalletExpenseAmountByMethod(data, 'cityLedger') +
    getWalletExpenseAmountByMethod(data, 'onlineFood') +
    walletExpenseDepositAmount(data)

  return {
    grossSales,
    grossSalesOnlineFood,
    grossCityLedger,
    grossCompliment,
    statisticsGrossSales,
    statisticsTotalBill,
    statisticsTotalGuest,
    avgAmountPerGuest,
    avgAmountPerBill,
    totalPlatformFee,
    totalMultipriceFee,
    totalXenditFee,
    totalGrossSales,
    grossRevenue,
    cogs,
    salesRevenue,
    rounding,
    totalSalesRevenue,
    loss,
    totalNetRevenue,
    totalWalletIncome,
    totalWalletExpense,
    totalSettlement: totalSettlementAmount(data),
  }
}

type SectionRows = {
  salesRows: MetricRow[]
  statisticRows: MetricRow[]
  reservationRows: MetricRow[]
  cityLedgerRows: MetricRow[]
  onlineFoodRows: MetricRow[]
  revenueRows: MetricRow[]
  incomeRows: MetricRow[]
  walletIncomeRows: MetricRow[]
  walletExpenseRows: MetricRow[]
}

function buildSectionRows(data: SummaryData, m: ReportMetrics): SectionRows {
  return {
    salesRows: [
      {
        label: 'Jumlah Produk Terjual',
        value: formatNumber(data.sales.productSoldCount || 0),
      },
      {
        label: 'Total Pesanan',
        value: `${formatNumber(getOrderCountByBlock(data.sales))} Pesanan`,
      },
      {
        label: 'Total Produk Terjual',
        value: formatCurrency(data.sales.productSoldTotal || 0),
      },
      {
        label: 'Diskon',
        value: formatCurrency(data.sales.discount || 0, true),
        negative: true,
      },
      { label: 'Pajak', value: formatCurrency(data.sales.tax || 0) },
      {
        label: 'Platform Fee',
        value: formatCurrency(data.sales.platformFee || 0),
      },
      {
        label: 'Service Fee',
        value: formatCurrency(data.sales.serviceFee || 0),
      },
      {
        label: 'Multiprice Fee',
        value: formatCurrency(data.sales.multipriceFee || 0),
      },
      { label: 'Pembulatan', value: formatCurrency(data.sales.rounding || 0) },
      { label: 'Total Penjualan Kotor', value: formatCurrency(m.grossSales) },
    ],
    statisticRows: [
      {
        label: 'Total Penjualan Kotor',
        value: formatCurrency(m.statisticsGrossSales),
      },
      {
        label: 'Total Bill / Order / Transaksi',
        value: `${formatNumber(m.statisticsTotalBill)} Bill`,
      },
      {
        label: 'Pengunjung / Pembeli',
        value: `${formatNumber(m.statisticsTotalGuest)} Orang`,
      },
      {
        label: 'Rata-rata Nilai Penjualan / orang',
        value: `${formatCurrency(m.avgAmountPerGuest)} / Orang`,
      },
      {
        label: 'Rata-rata Nilai Penjualan / Bill',
        value: `${formatCurrency(m.avgAmountPerBill)} / Bill`,
      },
    ],
    reservationRows: [
      {
        label: 'Jumlah Reservasi',
        value: formatNumber(
          (data.reservation.waiting.totalReservation || 0) +
            (data.reservation.accepted.totalReservation || 0) +
            (data.reservation.succeed.totalReservation || 0) +
            (data.reservation.failed.totalReservation || 0),
        ),
      },
      {
        label: 'Jumlah Orang',
        value: `${formatNumber(
          (data.reservation.waiting.totalPerson || 0) +
            (data.reservation.accepted.totalPerson || 0) +
            (data.reservation.succeed.totalPerson || 0) +
            (data.reservation.failed.totalPerson || 0),
        )} Orang`,
      },
      {
        label: 'Total DP',
        value: formatCurrency(
          (data.reservation.waiting.totalDeposit || 0) +
            (data.reservation.accepted.totalDeposit || 0) +
            (data.reservation.succeed.totalDeposit || 0) +
            (data.reservation.failed.totalDeposit || 0),
        ),
      },
      {
        label: 'Total DP Terbayar',
        value: formatCurrency(
          (data.reservation.waiting.totalPaidDeposit || 0) +
            (data.reservation.accepted.totalPaidDeposit || 0) +
            (data.reservation.succeed.totalPaidDeposit || 0) +
            (data.reservation.failed.totalPaidDeposit || 0),
        ),
      },
    ],
    cityLedgerRows: [
      {
        label: 'Jumlah Produk Terjual',
        value: formatNumber(data.cityLedger.productSoldCount || 0),
      },
      {
        label: 'Total Pesanan',
        value: `${formatNumber(getOrderCountByBlock(data.cityLedger))} Pesanan`,
      },
      {
        label: 'Total Produk Terjual',
        value: formatCurrency(data.cityLedger.productSoldTotal || 0),
      },
      {
        label: 'Diskon',
        value: formatCurrency(data.cityLedger.discount || 0, true),
        negative: true,
      },
      { label: 'Pajak', value: formatCurrency(data.cityLedger.tax || 0) },
      {
        label: 'Platform Fee',
        value: formatCurrency(data.cityLedger.platformFee || 0),
      },
      {
        label: 'Service Fee',
        value: formatCurrency(data.cityLedger.serviceFee || 0),
      },
      {
        label: 'Multiprice Fee',
        value: formatCurrency(data.cityLedger.multipriceFee || 0),
      },
      {
        label: 'Pembulatan',
        value: formatCurrency(data.cityLedger.rounding || 0),
      },
      {
        label: 'Total Penjualan Kotor',
        value: formatCurrency(m.grossCityLedger),
      },
    ],
    onlineFoodRows: [
      {
        label: 'Jumlah Produk Terjual',
        value: formatNumber(data.onlineFood.productSoldCount || 0),
      },
      {
        label: 'Total Pesanan',
        value: `${formatNumber(getOrderCountByBlock(data.onlineFood))} Pesanan`,
      },
      {
        label: 'Total Produk Terjual',
        value: formatCurrency(data.onlineFood.productSoldTotal || 0),
      },
      {
        label: 'Diskon',
        value: formatCurrency(data.onlineFood.discount || 0, true),
        negative: true,
      },
      {
        label: 'Platform Fee',
        value: formatCurrency(data.onlineFood.platformFee || 0),
      },
      {
        label: 'Multiprice Fee',
        value: formatCurrency(data.onlineFood.multipriceFee || 0),
      },
      {
        label: 'Pembulatan',
        value: formatCurrency(data.onlineFood.rounding || 0),
      },
      {
        label: 'Total Penjualan Kotor',
        value: formatCurrency(m.grossSalesOnlineFood),
      },
    ],
    revenueRows: [
      { label: 'Total Penjualan Kotor', value: formatCurrency(m.grossSales) },
      {
        label: 'Total Penjualan Online Food',
        value: formatCurrency(m.grossSalesOnlineFood),
      },
      {
        label: 'Total Penjualan City Ledger',
        value: formatCurrency(m.grossCityLedger),
      },
      {
        label: 'Platform Fee',
        value: formatCurrency(m.totalPlatformFee, true),
        negative: true,
        hint: 'Lihat Selengkapnya',
      },
      {
        label: 'Multiprice Fee',
        value: formatCurrency(m.totalMultipriceFee, true),
        negative: true,
      },
      {
        label: 'Xendit Fee',
        value: formatCurrency(m.totalXenditFee, true),
        negative: true,
        hint: 'Lihat Selengkapnya',
      },
      {
        label: 'Potongan Deposit',
        value: formatCurrency(data.totalDepositDeduction ?? 0, true),
        negative: true,
      },
      {
        label: 'Total Pendapatan Kotor',
        value: formatCurrency(m.totalGrossSales),
      },
    ],
    incomeRows: [
      {
        label: 'Total Pendapatan Kotor',
        value: formatCurrency(m.grossRevenue),
      },
      {
        label: 'Harga Pokok Penjualan',
        value: formatCurrency(m.cogs, true),
        negative: true,
      },
      {
        label: 'Pendapatan Penjualan',
        value: formatCurrency(m.salesRevenue),
        hint: 'didapat dari Total Pendapatan Kotor - Harga Pokok Penjualan',
      },
      {
        label: 'Pembulatan',
        value: formatCurrency(m.rounding, m.rounding < 0),
        negative: m.rounding < 0,
      },
      {
        label: 'Total Pendapatan Penjualan',
        value: formatCurrency(m.totalSalesRevenue),
        hint: 'didapat dari Pendapatan Penjualan + Pembulatan',
      },
      {
        label: 'Rugi',
        value: formatCurrency(m.loss, true),
        negative: true,
        hint: 'akumulasi stock terbuang',
      },
      {
        label: 'Total Pendapatan Bersih',
        value: formatCurrency(m.totalNetRevenue),
      },
    ],
    walletIncomeRows: [
      {
        label: 'Tunai',
        value: formatCurrency(data.walletIncome.cashAmount || 0),
        hint: `${formatNumber(data.walletIncome.cashCount || 0)} Transaksi`,
      },
      {
        label: 'Non-Tunai',
        value: formatCurrency(data.walletIncome.nonCashAmount || 0),
        hint: `${formatNumber(data.walletIncome.nonCashCount || 0)} Transaksi`,
      },
      {
        label: 'Debit',
        value: formatCurrency(data.walletIncome.debitAmount || 0),
        hint: `${formatNumber(data.walletIncome.debitCount || 0)} Transaksi`,
      },
      {
        label: 'QRIS Static',
        value: formatCurrency(data.walletIncome.qrisStaticAmount || 0),
        hint: `${formatNumber(data.walletIncome.qrisStaticCount || 0)} Transaksi`,
      },
      {
        label: 'Transfer Manual',
        value: formatCurrency(data.walletIncome.manualTransferAmount || 0),
        hint: `${formatNumber(data.walletIncome.manualTransferCount || 0)} Transaksi`,
      },
      {
        label: 'Online Food',
        value: formatCurrency(data.walletIncome.onlineFoodAmount || 0),
        hint: `${formatNumber(data.walletIncome.onlineFoodCount || 0)} Transaksi`,
      },
      {
        label: 'City Ledger',
        value: formatCurrency(data.walletIncome.cityLedgerAmount || 0),
        hint: `${formatNumber(data.walletIncome.cityLedgerCount || 0)} Transaksi`,
      },
      {
        label: 'Deposit',
        value: formatCurrency(totalDepositIncomeFromWallet(data)),
        hint: `${formatNumber(totalDepositIncomeCountFromWallet(data))} Transaksi`,
      },
      {
        label: 'Settlement',
        value: formatCurrency(m.totalSettlement),
        hint: `${formatNumber(
          Number(data.sales.settlement ? 1 : 0) +
            Number(data.onlineFood.settlement ? 1 : 0) +
            Number(data.cityLedger.settlement ? 1 : 0),
        )} Transaksi`,
      },
    ],
    walletExpenseRows: [
      {
        label: 'Tunai',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'cash'),
          true,
        ),
        negative: true,
      },
      {
        label: 'Non-Tunai',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'nonCash'),
          true,
        ),
        negative: true,
      },
      {
        label: 'Debit',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'debit'),
          true,
        ),
        negative: true,
      },
      {
        label: 'QRIS Static',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'qrisStatic'),
          true,
        ),
        negative: true,
      },
      {
        label: 'Transfer Manual',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'manualTransfer'),
          true,
        ),
        negative: true,
      },
      {
        label: 'City Ledger',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'cityLedger'),
          true,
        ),
        negative: true,
      },
      {
        label: 'Online Food',
        value: formatCurrency(
          getWalletExpenseAmountByMethod(data, 'onlineFood'),
          true,
        ),
        negative: true,
      },
      {
        label: 'Deposit',
        value: formatCurrency(walletExpenseDepositAmount(data), true),
        negative: true,
      },
    ],
  }
}

type ChannelSlice = Pick<
  SalesBlock,
  | 'orderGeneralCount'
  | 'orderSplitBillCount'
  | 'orderDineInCount'
  | 'orderTakeAwayCount'
  | 'orderDeliveryCount'
  | 'productNormalSoldTotal'
  | 'productCustomAmountSoldTotal'
  | 'multiprices'
>

function getOrderDetails(block: ChannelSlice): MetricRow[] {
  const details: MetricRow[] = [
    {
      label: 'Pesanan General',
      value: formatNumber(block.orderGeneralCount || 0),
    },
  ]
  const hasOrderTypeBreakdown =
    (block.orderDineInCount || 0) > 0 ||
    (block.orderTakeAwayCount || 0) > 0 ||
    (block.orderDeliveryCount || 0) > 0
  if (hasOrderTypeBreakdown) {
    details.push({
      label: 'Makan di Tempat',
      value: formatNumber(block.orderDineInCount || 0),
    })
    details.push({
      label: 'Take Away',
      value: formatNumber(block.orderTakeAwayCount || 0),
    })
    details.push({
      label: 'Pesan Antar',
      value: formatNumber(block.orderDeliveryCount || 0),
    })
  }
  details.push({
    label: 'Pesanan Split Bill',
    value: formatNumber(block.orderSplitBillCount || 0),
  })
  return details
}

function getMultipriceProductDetails(
  block: ChannelSlice,
  options?: {
    emptyLabel?: string
  },
): MetricRow[] {
  const details: MetricRow[] = []
  for (const item of block.multiprices || []) {
    if (!item || typeof item !== 'object') continue
    const labelRaw =
      (item.name as string | undefined) ||
      (item.label as string | undefined) ||
      (item.multipriceName as string | undefined) ||
      (item.priceName as string | undefined) ||
      ''
    const amountRaw =
      (item.total as number | undefined) ??
      (item.amount as number | undefined) ??
      (item.totalAmount as number | undefined) ??
      (item.productPrice as number | undefined) ??
      (item.productSoldTotal as number | undefined) ??
      (item.soldTotal as number | undefined) ??
      (item.value as number | undefined) ??
      0
    const amount = typeof amountRaw === 'number' ? amountRaw : 0
    if (amount <= 0) continue
    const normalizedLabel = labelRaw
      ? labelRaw.toLowerCase().startsWith('harga ')
        ? labelRaw
        : `Harga ${toTitleFoodChannel(labelRaw)}`
      : 'Harga Lainnya'
    details.push({ label: normalizedLabel, value: formatCurrency(amount) })
  }
  if (details.length === 0) {
    details.push({
      label: options?.emptyLabel || 'Harga Bazaar (belum ada di API)',
      value: '-',
    })
  }
  return details
}

function toTitleFoodChannel(name: string) {
  const normalized = name.trim().toLowerCase()
  if (normalized === 'gofood') return 'GoFood'
  if (normalized === 'grabfood') return 'GrabFood'
  if (normalized === 'shopeefood') return 'ShopeeFood'
  if (!normalized) return 'Channel'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getOnlineFoodWalletDetails(data: SummaryData): MetricRow[] {
  const details = new Map<string, string>()
  for (const item of data.onlineFood.multiprices || []) {
    if (!item || typeof item !== 'object') continue
    const rawName = (item.name as string | undefined) || ''
    const key = rawName.trim().toLowerCase()
    if (!key) continue
    const amountRaw =
      (item.total as number | undefined) ??
      (item.amount as number | undefined) ??
      (item.totalAmount as number | undefined) ??
      (item.productPrice as number | undefined) ??
      (item.productSoldTotal as number | undefined) ??
      (item.value as number | undefined)
    if (typeof amountRaw === 'number' && amountRaw >= 0) {
      details.set(toTitleFoodChannel(key), formatCurrency(amountRaw))
    } else {
      details.set(toTitleFoodChannel(key), formatCurrency(0))
    }
  }
  return [...details.entries()].map(([label, value]) => ({ label, value }))
}

function expandOrderProductChannelRows(
  rows: MetricRow[],
  block: ChannelSlice,
  keys: {
    orderDetailKey: string
    productDetailKey: string
    defaultKey: (row: MetricRow) => string
  },
): ExpandableMetricRow[] {
  return rows.map((row) => {
    if (row.label === 'Total Pesanan') {
      return {
        ...row,
        key: keys.orderDetailKey,
        details: getOrderDetails(block),
      }
    }
    if (row.label === 'Total Produk Terjual') {
      return {
        ...row,
        key: keys.productDetailKey,
        details: [
          {
            label: 'Harga Normal',
            value: formatCurrency(block.productNormalSoldTotal || 0),
          },
          ...getMultipriceProductDetails(block),
          {
            label: 'Harga Custom Amount',
            value: formatCurrency(block.productCustomAmountSoldTotal || 0),
          },
        ],
      }
    }
    return { ...row, key: keys.defaultKey(row) }
  })
}

function platformFeeRevenueDetails(data: SummaryData): MetricRow[] {
  const platformFeeMap = new Map<number, number>()
  const all = [
    ...data.platformFeeBreakdown.sales,
    ...data.platformFeeBreakdown.onlineFood,
    ...data.platformFeeBreakdown.cityLedger,
  ]
  for (const item of all) {
    platformFeeMap.set(
      item.price,
      (platformFeeMap.get(item.price) || 0) + (item.count || 0),
    )
  }
  const details = [...platformFeeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([price, count]) => ({
      label: `${formatNumber(price)} x ${formatNumber(count)} Transaksi`,
      value: formatCurrency(price * count, true),
      negative: true as const,
    }))
  if (data.platformFeeBreakdown.compliment) {
    details.push({
      label: 'Compliment',
      value: formatCurrency(data.platformFeeBreakdown.compliment, true),
      negative: true,
    })
  }
  return details
}

function xenditFeeDetails(data: SummaryData): MetricRow[] {
  const breakdown = data.xenditFee
  if (breakdown) {
    return [
      {
        label: `E-Wallet x ${formatNumber(Number(breakdown.eWallet?.count ?? 0))} Transaksi`,
        value: formatCurrency(Number(breakdown.eWallet?.amount ?? 0), true),
        negative: true,
      },
      {
        label: `QRIS x ${formatNumber(Number(breakdown.qris?.count ?? 0))} Transaksi`,
        value: formatCurrency(Number(breakdown.qris?.amount ?? 0), true),
        negative: true,
      },
      {
        label: `VA x ${formatNumber(Number(breakdown.virtualAccount?.count ?? 0))} Transaksi`,
        value: formatCurrency(
          Number(breakdown.virtualAccount?.amount ?? 0),
          true,
        ),
        negative: true,
      },
      {
        label: `VISA x ${formatNumber(Number(breakdown.visa?.count ?? 0))} Transaksi`,
        value: formatCurrency(Number(breakdown.visa?.amount ?? 0), true),
        negative: true,
      },
    ]
  }
  return [
    {
      label: 'E-Wallet x - Transaksi (belum ada di API)',
      value: '-',
      negative: true,
    },
    {
      label: 'QRIS x - Transaksi (belum ada di API)',
      value: '-',
      negative: true,
    },
    {
      label: 'VA x - Transaksi (belum ada di API)',
      value: '-',
      negative: true,
    },
    {
      label: 'VISA x - Transaksi (belum ada di API)',
      value: '-',
      negative: true,
    },
  ]
}

function multipriceFeeDetails(data: SummaryData): MetricRow[] {
  const rows: MetricRow[] = []
  for (const item of data.onlineFood.multiprices || []) {
    if (!item || typeof item !== 'object') continue
    const rawName = (item.name as string | undefined) || ''
    const fee = Number((item.fee as number | undefined) ?? 0)
    const count = Number((item.nTransaction as number | undefined) ?? 0)
    if (!rawName) continue
    if (fee <= 0 && count <= 0) continue
    const totalFee = fee * Math.max(count || 1, 1)
    rows.push({
      label: `${toTitleFoodChannel(rawName)} Fee x ${formatNumber(count || 0)} Transaksi`,
      value: formatCurrency(totalFee, true),
      negative: true,
    })
  }

  if (rows.length > 0) return rows

  const totalMultiprice =
    (data.sales.multipriceFee || 0) +
    (data.onlineFood.multipriceFee || 0) +
    (data.cityLedger.multipriceFee || 0) +
    (data.compliment.multipriceFee || 0)

  if (totalMultiprice > 0) {
    return [
      {
        label: 'Breakdown Multi-Price Fee (belum ada di API)',
        value: formatCurrency(totalMultiprice, true),
        negative: true,
      },
    ]
  }

  return [
    {
      label: 'Breakdown Multi-Price Fee (belum ada di API)',
      value: '-',
      negative: true,
    },
  ]
}

// --- Public: UI klasik ---

export function calculateReportV1(data: SummaryData) {
  const m = computeMetrics(data)
  const sections = buildSectionRows(data, m)

  const salesExpandableRows = expandOrderProductChannelRows(
    sections.salesRows,
    data.sales,
    {
      orderDetailKey: 'total-order',
      productDetailKey: 'total-product-sold',
      defaultKey: (row) => row.label,
    },
  )

  const cityLedgerExpandableRows = expandOrderProductChannelRows(
    sections.cityLedgerRows,
    data.cityLedger,
    {
      orderDetailKey: 'city-ledger-total-order',
      productDetailKey: 'city-ledger-total-product-sold',
      defaultKey: (row) => `city-ledger-${row.label}`,
    },
  )

  const revenueExpandableRows: ExpandableMetricRow[] = sections.revenueRows.map(
    (row) => {
      if (row.label === 'Platform Fee') {
        return {
          ...row,
          key: 'revenue-platform-fee',
          details: platformFeeRevenueDetails(data),
        }
      }
      if (row.label === 'Xendit Fee') {
        return {
          ...row,
          key: 'revenue-xendit-fee',
          details: xenditFeeDetails(data),
        }
      }
      return { ...row, key: `revenue-${row.label}` }
    },
  )

  const walletIncomeExpandableRows: ExpandableMetricRow[] =
    sections.walletIncomeRows.map((row) => {
      if (row.label === 'Tunai') {
        const manual = data.cashWalletDeposit?.manualTransaction ?? 0
        const order =
          data.cashWalletDeposit?.orderTransaction ??
          data.walletIncome.cashAmount ??
          0
        return {
          ...row,
          key: 'wallet-income-cash',
          details: [
            { label: 'Pemasukan Manual', value: formatCurrency(manual) },
            { label: 'Pemasukan Penjualan', value: formatCurrency(order) },
          ],
        }
      }
      if (row.label === 'Deposit') {
        const dep = data.depositWallet?.deposit
        if (dep) {
          return {
            ...row,
            key: 'wallet-income-deposit',
            details: [
              {
                label: `Tunai x ${formatNumber(dep.countDepositCash)} Transaksi`,
                value: formatCurrency(dep.totalDepositCash || 0),
              },
              {
                label: `Debit x ${formatNumber(dep.countDepositDebit)} Transaksi`,
                value: formatCurrency(dep.totalDepositDebit || 0),
              },
              {
                label: `QRIS Static x ${formatNumber(dep.countDepositQRStatic)} Transaksi`,
                value: formatCurrency(dep.totalDepositQRStatic || 0),
              },
              {
                label: `E-Wallet x ${formatNumber(dep.countDepositEWallet)} Transaksi`,
                value: formatCurrency(dep.totalDepositEWallet || 0),
              },
              {
                label: `Transfer Manual x ${formatNumber(dep.countDepositManualTransfer)} Transaksi`,
                value: formatCurrency(dep.totalDepositManualTransfer || 0),
              },
            ],
          }
        }
        const depositCount = data.walletIncome.depositCount || 0
        return {
          ...row,
          key: 'wallet-income-deposit',
          details: [
            {
              label: `Tunai x ${formatNumber(depositCount)} Transaksi`,
              value: formatCurrency(data.walletIncome.depositAmount || 0),
            },
            { label: 'Non Tunai x 0 Transaksi', value: formatCurrency(0) },
            { label: 'Debit x 0 Transaksi', value: formatCurrency(0) },
            { label: 'QRIS Static x 0 Transaksi', value: formatCurrency(0) },
            {
              label: 'Transfer Manual x 0 Transaksi',
              value: formatCurrency(0),
            },
          ],
        }
      }
      return { ...row, key: `wallet-income-${row.label}` }
    })

  return {
    sections,
    salesExpandableRows,
    cityLedgerExpandableRows,
    revenueExpandableRows,
    walletIncomeExpandableRows,
  }
}

// --- Public: UI summary v2 ---

function complimentExpandableRows(data: SummaryData): ExpandableMetricRow[] {
  const c = data.compliment
  return [
    {
      label: 'Jumlah Item Terjual',
      value: formatNumber(c.productSoldCount || 0),
      key: 'cmp-items',
    },
    {
      label: 'Jumlah Transaksi',
      value: `${formatNumber(getOrderCountByBlock(c))} Pesanan`,
      key: 'cmp-orders',
      details: getOrderDetails(c),
    },
    {
      label: 'Total Penjualan Produk',
      value: formatCurrency(c.productSoldTotal || 0),
      key: 'cmp-product',
      details: [
        {
          label: 'Harga Normal',
          value: formatCurrency(c.productNormalSoldTotal || 0),
        },
        ...getMultipriceProductDetails(c, {
          emptyLabel: 'Harga Compliment (belum ada di API)',
        }),
        {
          label: 'Harga Custom Amount',
          value: formatCurrency(c.productCustomAmountSoldTotal || 0),
        },
      ],
    },
    {
      label: 'Platform Fee',
      value: formatCurrency(c.platformFee || 0),
      key: 'cmp-pf',
    },
  ]
}

function revenueExpandableRowsV2(
  revenueRows: MetricRow[],
  data: SummaryData,
): ExpandableMetricRow[] {
  return revenueRows.map((row) => {
    if (row.label === 'Platform Fee') {
      return {
        ...row,
        key: 'revenue-platform-fee',
        details: platformFeeRevenueDetails(data),
      }
    }
    if (row.label === 'Multiprice Fee') {
      return {
        ...row,
        key: 'revenue-multiprice',
        details: multipriceFeeDetails(data),
      }
    }
    if (row.label === 'Xendit Fee') {
      return {
        ...row,
        key: 'revenue-xendit-fee',
        details: xenditFeeDetails(data),
      }
    }
    return { ...row, key: `revenue-${row.label}` }
  })
}

function walletIncomeExpandableRowsV2(
  walletIncomeRows: MetricRow[],
  data: SummaryData,
): ExpandableMetricRow[] {
  return walletIncomeRows.map((row) => {
    if (row.label === 'Tunai') {
      const manual = data.cashWalletDeposit?.manualTransaction ?? 0
      const order =
        data.cashWalletDeposit?.orderTransaction ??
        data.walletIncome.cashAmount ??
        0
      return {
        ...row,
        key: 'wallet-income-cash',
        details: [
          { label: 'Pemasukan Manual', value: formatCurrency(manual) },
          { label: 'Pemasukan Penjualan', value: formatCurrency(order) },
        ],
      }
    }
    if (row.label === 'Online Food') {
      return {
        ...row,
        key: 'wallet-income-of',
        details: getOnlineFoodWalletDetails(data),
      }
    }
    if (row.label === 'Deposit') {
      const dep = data.depositWallet?.deposit
      if (dep) {
        return {
          ...row,
          key: 'wallet-income-deposit',
          details: [
            {
              label: `Tunai x ${formatNumber(dep.countDepositCash)} Transaksi`,
              value: formatCurrency(dep.totalDepositCash || 0),
            },
            {
              label: `Debit x ${formatNumber(dep.countDepositDebit)} Transaksi`,
              value: formatCurrency(dep.totalDepositDebit || 0),
            },
            {
              label: `QRIS Static x ${formatNumber(dep.countDepositQRStatic)} Transaksi`,
              value: formatCurrency(dep.totalDepositQRStatic || 0),
            },
            {
              label: `E-Wallet x ${formatNumber(dep.countDepositEWallet)} Transaksi`,
              value: formatCurrency(dep.totalDepositEWallet || 0),
            },
            {
              label: `Transfer Manual x ${formatNumber(dep.countDepositManualTransfer)} Transaksi`,
              value: formatCurrency(dep.totalDepositManualTransfer || 0),
            },
          ],
        }
      }
      const depositCount = data.walletIncome.depositCount || 0
      return {
        ...row,
        key: 'wallet-income-deposit',
        details: [
          {
            label: `Tunai x ${formatNumber(depositCount)} Transaksi`,
            value: formatCurrency(data.walletIncome.depositAmount || 0),
          },
          { label: 'Non Tunai x 0 Transaksi', value: formatCurrency(0) },
          { label: 'Debit x 0 Transaksi', value: formatCurrency(0) },
          { label: 'QRIS Static x 0 Transaksi', value: formatCurrency(0) },
          { label: 'Transfer Manual x 0 Transaksi', value: formatCurrency(0) },
        ],
      }
    }
    return { ...row, key: `wallet-income-${row.label}` }
  })
}

export function calculateReportV2(data: SummaryData) {
  const metrics = computeMetrics(data)
  const sections = buildSectionRows(data, metrics)

  const salesExpandableRows = expandOrderProductChannelRows(
    sections.salesRows,
    data.sales,
    {
      orderDetailKey: 'total-order',
      productDetailKey: 'total-product-sold',
      defaultKey: (row) => row.label,
    },
  )

  const cityLedgerExpandableRows = expandOrderProductChannelRows(
    sections.cityLedgerRows,
    data.cityLedger,
    {
      orderDetailKey: 'city-ledger-total-order',
      productDetailKey: 'city-ledger-total-product-sold',
      defaultKey: (row) => `city-ledger-${row.label}`,
    },
  )

  const onlineFoodExpandableRows = expandOrderProductChannelRows(
    sections.onlineFoodRows,
    data.onlineFood,
    {
      orderDetailKey: 'of-total-order',
      productDetailKey: 'of-total-product-sold',
      defaultKey: (row) => `of-${row.label}`,
    },
  )

  return {
    metrics,
    sections,
    salesExpandableRows,
    cityLedgerExpandableRows,
    onlineFoodExpandableRows,
    complimentExpandableRows: complimentExpandableRows(data),
    revenueExpandableRows: revenueExpandableRowsV2(sections.revenueRows, data),
    walletIncomeExpandableRows: walletIncomeExpandableRowsV2(
      sections.walletIncomeRows,
      data,
    ),
  }
}

// --- Fetch ---

export async function fetchSaleSummaryRange(
  startDate: string,
  endDate: string,
  scopeType: ReportScopeType = ReportScopeType.MERCHANT,
): Promise<SummaryData> {
  const adjustedEndDate = addDaysToIsoDate(endDate, 1)
  const response = await fetch(
    `${REPORT_BASE_URL}/v2/report/sale/summary?startDate=${startDate}&endDate=${adjustedEndDate}&scopeType=${scopeType}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(REPORT_BEARER_TOKEN
          ? { Authorization: `Bearer ${REPORT_BEARER_TOKEN}` }
          : {}),
      },
    },
  )
  const json = (await response.json()) as ApiResponse
  if (!json?.isSuccess || !json?.data) {
    throw new Error('Gagal mengambil data report.')
  }
  return json.data
}

export async function fetchShiftSaleSummaryRange(
  startDate: string,
  endDate: string,
): Promise<SummaryData> {
  const adjustedEndDate = addDaysToIsoDate(endDate, 1)
  const response = await fetch(
    `${REPORT_BASE_URL}/v2/report/shift/sale/summary?startDate=${startDate}&endDate=${adjustedEndDate}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(REPORT_BEARER_TOKEN
          ? { Authorization: `Bearer ${REPORT_BEARER_TOKEN}` }
          : {}),
      },
    },
  )
  const json = (await response.json()) as ApiResponse
  if (!json?.isSuccess || !json?.data) {
    throw new Error('Gagal mengambil data report shift.')
  }
  return json.data
}

export async function fetchShiftSaleSummaryByUserDate(
  date: string,
): Promise<ShiftUserSummaryItem[]> {
  const response = await fetch(
    `${REPORT_BASE_URL}/v2/report/shift/sale/summary/by-user?date=${date}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(REPORT_BEARER_TOKEN
          ? { Authorization: `Bearer ${REPORT_BEARER_TOKEN}` }
          : {}),
      },
    },
  )
  const json = (await response.json()) as {
    isSuccess: boolean
    message: string
    data?: ShiftUserSummaryItem[]
  }
  if (!json?.isSuccess || !Array.isArray(json?.data)) {
    throw new Error('Gagal mengambil data laporan per shift.')
  }
  return json.data
}
