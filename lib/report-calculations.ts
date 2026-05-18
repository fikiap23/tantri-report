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

/** Item di `multiprices[]` — struktur detail bisa bervariasi per channel. */
export type MultipriceEntry = Record<string, unknown>

export type PriceCount = {
  price: number
  count: number
}

/** Blok penjualan / city ledger (bentuk sama di response API). */
export type SalesChannelBlock = {
  productSoldCount: number
  orderGeneralCount: number
  orderSplitBillCount: number
  productSoldTotal: number
  productNormalSoldTotal: number
  productCustomAmountSoldTotal: number
  discount: number
  tax: number
  platformFeeByCustomer: number
  platformFeeByCafe: number
  serviceFee: number
  multipriceFee: number
  rounding: number
  xenditFee: number
  cogs: number
  guestCount: number
  multiprices: MultipriceEntry[]
  orderDineInCount: number
  orderTakeAwayCount: number
  orderDeliveryCount: number
  orderCancelledCount: number
  settlement: number
}

/** Blok online food (tanpa tax / serviceFee di response API). */
export type OnlineFoodChannelBlock = {
  orderGeneralCount: number
  orderSplitBillCount: number
  productSoldCount: number
  productSoldTotal: number
  productNormalSoldTotal: number
  productCustomAmountSoldTotal: number
  discount: number
  platformFeeByCustomer: number
  platformFeeByCafe: number
  multipriceFee: number
  rounding: number
  xenditFee: number
  cogs: number
  guestCount: number
  multiprices: MultipriceEntry[]
  orderDineInCount: number
  orderTakeAwayCount: number
  orderDeliveryCount: number
  orderCancelledCount: number
  settlement: number
}

/** Blok compliment. */
export type ComplimentChannelBlock = {
  orderGeneralCount: number
  orderSplitBillCount: number
  productSoldCount: number
  productSoldTotal: number
  productNormalSoldTotal: number
  productCustomAmountSoldTotal: number
  platformFeeByCustomer: number
  platformFeeByCafe: number
  complimentAmount: number
  rounding: number
  xenditFee: number
  cogs: number
  guestCount: number
  multiprices: MultipriceEntry[]
  orderDineInCount: number
  orderTakeAwayCount: number
  orderDeliveryCount: number
  orderCancelledCount: number
}

/** Alias untuk kalkulasi yang memakai bentuk sales/city ledger. */
export type SalesBlock = SalesChannelBlock

export type PlatformFeeBlockFields = {
  platformFeeByCustomer: number
  platformFeeByCafe: number
}

export type PlatformFeePayer = 'byCustomer' | 'byCafe'

export type PlatformFeeComplimentCount = {
  count: number
}

export type PlatformFeeBreakdownSlice = {
  sales: PriceCount[]
  onlineFood: PriceCount[]
  cityLedger: PriceCount[]
  compliment: PlatformFeeComplimentCount
}

export type PlatformFeeBreakdown = {
  byCustomer: PlatformFeeBreakdownSlice
  byCafe: PlatformFeeBreakdownSlice
}

export function getBlockPlatformFeeByCustomer(
  block: PlatformFeeBlockFields,
): number {
  return block.platformFeeByCustomer
}

function blockPlatformFeeByCafe(block: PlatformFeeBlockFields): number {
  return block.platformFeeByCafe
}

function sumPriceCountItems(items: PriceCount[] | undefined): number {
  return (items || []).reduce(
    (sum, item) => sum + (item.price || 0) * (item.count || 0),
    0,
  )
}

function getPlatformFeeBreakdownSlice(
  data: SummaryData,
  payer: PlatformFeePayer,
): PlatformFeeBreakdownSlice {
  return payer === 'byCustomer'
    ? data.platformFeeBreakdown.byCustomer
    : data.platformFeeBreakdown.byCafe
}

function priceCountBreakdownRows(items: PriceCount[]): MetricRow[] {
  return (items || []).map((item) => ({
    label: `${formatNumber(item.price || 0)} x ${formatNumber(item.count || 0)} Transaksi`,
    value: formatCurrency((item.price || 0) * (item.count || 0)),
  }))
}

type PlatformFeeBillingChannelRow = {
  key: string
  label: string
  total: number
  rows: MetricRow[]
  expandable: boolean
}

type PlatformFeeBillingSection = {
  payer: PlatformFeePayer
  title: string
  channels: PlatformFeeBillingChannelRow[]
  compliment: { label: string; value: string; total: number }
  total: number
}

function complimentFeeFromBreakdown(
  block: ComplimentChannelBlock,
  payer: PlatformFeePayer,
): number {
  return payer === 'byCustomer'
    ? block.platformFeeByCustomer
    : block.platformFeeByCafe
}

function complimentCountFromBreakdown(
  compliment: PlatformFeeComplimentCount,
): number {
  return compliment.count
}

export function buildPlatformFeeBillingSection(
  data: SummaryData,
  payer: PlatformFeePayer,
): PlatformFeeBillingSection {
  const slice = getPlatformFeeBreakdownSlice(data, payer)
  const channelDefs = [
    {
      key: 'sales',
      label: 'Platform Fee Penjualan',
      items: slice.sales,
      block: data.sales,
    },
    {
      key: 'onlineFood',
      label: 'Platform Fee Online Food',
      items: slice.onlineFood,
      block: data.onlineFood,
    },
    {
      key: 'cityLedger',
      label: 'Platform Fee Online City Ledger',
      items: slice.cityLedger,
      block: data.cityLedger,
    },
  ] as const

  const channels: PlatformFeeBillingChannelRow[] = channelDefs.map((ch) => {
    const fromBreakdown = sumPriceCountItems(ch.items)
    const fromBlock =
      payer === 'byCustomer'
        ? getBlockPlatformFeeByCustomer(ch.block)
        : blockPlatformFeeByCafe(ch.block)
    const total = fromBreakdown > 0 ? fromBreakdown : fromBlock
    const rows = priceCountBreakdownRows(ch.items || [])
    return {
      key: ch.key,
      label: ch.label,
      total,
      rows,
      expandable: rows.length > 0,
    }
  })

  const complimentFee = complimentFeeFromBreakdown(data.compliment, payer)
  const complimentCount = complimentCountFromBreakdown(slice.compliment)
  const compliment = {
    label: 'Platform Fee Compliment',
    value:
      complimentFee > 0
        ? formatCurrency(complimentFee)
        : complimentCount > 0
          ? `${formatNumber(complimentCount)} Transaksi`
          : formatCurrency(0),
    total: complimentFee,
  }

  const total =
    channels.reduce((sum, ch) => sum + ch.total, 0) + compliment.total

  return {
    payer,
    title:
      payer === 'byCustomer'
        ? 'Dibebankan ke Pelanggan'
        : 'Dibebankan ke Merchant',
    channels,
    compliment,
    total,
  }
}

export function totalPlatformFeeBillingAmount(data: SummaryData): number {
  const blocks = [data.sales, data.onlineFood, data.cityLedger, data.compliment]
  return blocks.reduce(
    (sum, block) =>
      sum +
      getBlockPlatformFeeByCustomer(block) +
      blockPlatformFeeByCafe(block),
    0,
  )
}

export type OrderCountFields = {
  orderGeneralCount: number
  orderSplitBillCount: number
  orderDineInCount: number
  orderTakeAwayCount: number
  orderDeliveryCount: number
}

export function getOrderCountByBlock(block: OrderCountFields): number {
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
}

export type WalletExpenseChannel = {
  cash: number
  nonCash: number
  debit: number
  qrisStatic: number
  manualTransfer: number
  cityLedger: number
  onlineFood: number
}

export type WalletExpense = {
  bookClosing: WalletExpenseChannel
  other: WalletExpenseChannel
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
  eWallet: XenditFeeBreakdownItem
  qris: XenditFeeBreakdownItem
  virtualAccount: XenditFeeBreakdownItem
  visa: XenditFeeBreakdownItem
}

export type ReservationSummary = {
  waiting: ReservationState
  accepted: ReservationState
  succeed: ReservationState
  failed: ReservationState
}

export type WaitingTransaction = {
  createdBy: string
  customerName: string
  totalPriceProduct: number
  totalPrice: number
  fee: number
  date: string
}

/** Root `data` dari GET report sale summary — selaras response API. */
export type SummaryData = {
  nameCashiers: string[]
  waitingTransactions: WaitingTransaction[]
  sales: SalesChannelBlock
  onlineFood: OnlineFoodChannelBlock
  cityLedger: SalesChannelBlock
  compliment: ComplimentChannelBlock
  platformFeeBreakdown: PlatformFeeBreakdown
  xenditFee: XenditFeeBreakdown
  reservation: ReservationSummary
  loss: number
  totalDepositDeduction: number
  walletIncome: WalletIncome
  walletExpense: WalletExpense
  cashWalletDeposit: CashWalletDeposit
  depositWallet: DepositWallet
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
  const dep = data.depositWallet.deposit
  return (
    dep.totalDepositCash +
    dep.totalDepositDebit +
    dep.totalDepositQRStatic +
    dep.totalDepositEWallet +
    dep.totalDepositManualTransfer
  )
}

function totalDepositIncomeCountFromWallet(data: SummaryData): number {
  const dep = data.depositWallet.deposit
  return (
    dep.countDepositCash +
    dep.countDepositDebit +
    dep.countDepositQRStatic +
    dep.countDepositEWallet +
    dep.countDepositManualTransfer
  )
}

function walletExpenseDepositAmount(data: SummaryData): number {
  return data.depositWallet.totalWithdraw
}

function depositWalletIncomeDetails(data: SummaryData): MetricRow[] {
  const dep = data.depositWallet.deposit
  return [
    {
      label: `Tunai x ${formatNumber(dep.countDepositCash)} Transaksi`,
      value: formatCurrency(dep.totalDepositCash),
    },
    {
      label: `Debit x ${formatNumber(dep.countDepositDebit)} Transaksi`,
      value: formatCurrency(dep.totalDepositDebit),
    },
    {
      label: `QRIS Static x ${formatNumber(dep.countDepositQRStatic)} Transaksi`,
      value: formatCurrency(dep.totalDepositQRStatic),
    },
    {
      label: `E-Wallet x ${formatNumber(dep.countDepositEWallet)} Transaksi`,
      value: formatCurrency(dep.totalDepositEWallet),
    },
    {
      label: `Transfer Manual x ${formatNumber(dep.countDepositManualTransfer)} Transaksi`,
      value: formatCurrency(dep.totalDepositManualTransfer),
    },
  ]
}

const WALLET_EXPENSE_METHODS: (keyof WalletExpenseChannel)[] = [
  'cash',
  'nonCash',
  'debit',
  'qrisStatic',
  'manualTransfer',
  'cityLedger',
  'onlineFood',
]

export function getWalletExpenseAmountByMethod(
  data: SummaryData,
  method: keyof WalletExpenseChannel,
): number {
  return (
    data.walletExpense.bookClosing[method] + data.walletExpense.other[method]
  )
}

function totalWalletExpenseAmount(data: SummaryData): number {
  const channels = WALLET_EXPENSE_METHODS.reduce(
    (sum, method) => sum + getWalletExpenseAmountByMethod(data, method),
    0,
  )
  return channels + data.depositWallet.totalWithdraw
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
  /** Total tagihan platform fee (pelanggan + merchant) */
  totalPlatformFeeBilling: number
  totalPlatformFeeCustomer: number
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
  const { sales, onlineFood, cityLedger, compliment, walletIncome, walletExpense } =
    data

  const salesPlatformFeeByCustomer = sales.platformFeeByCustomer
  const onlineFoodPlatformFeeByCustomer = onlineFood.platformFeeByCustomer
  const cityLedgerPlatformFeeByCustomer = cityLedger.platformFeeByCustomer
  const complimentPlatformFeeByCustomer = compliment.platformFeeByCustomer

  const salesPlatformFeeByCafe = sales.platformFeeByCafe
  const onlineFoodPlatformFeeByCafe = onlineFood.platformFeeByCafe
  const cityLedgerPlatformFeeByCafe = cityLedger.platformFeeByCafe
  const complimentPlatformFeeByCafe = compliment.platformFeeByCafe

  const grossSales =
    (sales.productSoldTotal || 0) -
    (sales.discount || 0) +
    (sales.tax || 0) +
    salesPlatformFeeByCustomer +
    (sales.serviceFee || 0) +
    (sales.multipriceFee || 0) +
    (sales.rounding || 0)

  const grossSalesOnlineFood =
    (onlineFood.productSoldTotal || 0) -
    (onlineFood.discount || 0) +
    onlineFoodPlatformFeeByCustomer +
    (onlineFood.multipriceFee || 0) +
    (onlineFood.rounding || 0)

  const grossCityLedger =
    (cityLedger.productSoldTotal || 0) -
    (cityLedger.discount || 0) +
    (cityLedger.tax || 0) +
    cityLedgerPlatformFeeByCustomer +
    (cityLedger.serviceFee || 0) +
    (cityLedger.multipriceFee || 0) +
    (cityLedger.rounding || 0)

  const grossCompliment =
    compliment.productSoldTotal +
    complimentPlatformFeeByCustomer +
    compliment.rounding

  const salesOrderGeneralAndSplit =
    (sales.orderGeneralCount || 0) + (sales.orderSplitBillCount || 0)
  const salesOrderCount =
    salesOrderGeneralAndSplit > 0
      ? salesOrderGeneralAndSplit
      : (sales.orderDineInCount || 0) +
        (sales.orderTakeAwayCount || 0) +
        (sales.orderDeliveryCount || 0)

  const cityLedgerOrderGeneralAndSplit =
    (cityLedger.orderGeneralCount || 0) + (cityLedger.orderSplitBillCount || 0)
  const cityLedgerOrderCount =
    cityLedgerOrderGeneralAndSplit > 0
      ? cityLedgerOrderGeneralAndSplit
      : (cityLedger.orderDineInCount || 0) +
        (cityLedger.orderTakeAwayCount || 0) +
        (cityLedger.orderDeliveryCount || 0)

  const statisticsGrossSales = grossSales + grossCityLedger
  const statisticsTotalBill = salesOrderCount + cityLedgerOrderCount
  const statisticsTotalGuest =
    (sales.guestCount || 0) + (cityLedger.guestCount || 0)
  const avgAmountPerGuest = statisticsTotalGuest
    ? statisticsGrossSales / statisticsTotalGuest
    : 0
  const avgAmountPerBill = statisticsTotalBill
    ? statisticsGrossSales / statisticsTotalBill
    : 0

  const totalPlatformFeeCustomer =
    salesPlatformFeeByCustomer +
    onlineFoodPlatformFeeByCustomer +
    cityLedgerPlatformFeeByCustomer +
    complimentPlatformFeeByCustomer

  const totalPlatformFeeBilling =
    salesPlatformFeeByCustomer +
    salesPlatformFeeByCafe +
    onlineFoodPlatformFeeByCustomer +
    onlineFoodPlatformFeeByCafe +
    cityLedgerPlatformFeeByCustomer +
    cityLedgerPlatformFeeByCafe +
    complimentPlatformFeeByCustomer +
    complimentPlatformFeeByCafe

  const totalPlatformFee = totalPlatformFeeBilling

  const totalMultipriceFee =
    sales.multipriceFee +
    onlineFood.multipriceFee +
    cityLedger.multipriceFee

  const totalXenditFeeByChannel =
    (sales.xenditFee || 0) +
    (cityLedger.xenditFee || 0) +
    (onlineFood.xenditFee || 0) +
    (compliment.xenditFee || 0)

  const xenditBreakdown = data.xenditFee
  const totalXenditFeeFromBreakdown = xenditBreakdown
    ? Number(xenditBreakdown.eWallet?.amount ?? 0) +
      Number(xenditBreakdown.qris?.amount ?? 0) +
      Number(xenditBreakdown.virtualAccount?.amount ?? 0) +
      Number(xenditBreakdown.visa?.amount ?? 0)
    : 0

  const totalXenditFee = totalXenditFeeFromBreakdown || totalXenditFeeByChannel

  const totalDepositDeduction = Number(data.totalDepositDeduction ?? 0)

  const totalGrossSales =
    grossSales +
    grossSalesOnlineFood +
    grossCityLedger -
    totalPlatformFeeBilling -
    totalMultipriceFee -
    totalXenditFee -
    totalDepositDeduction

  const grossRevenue = totalGrossSales
  const cogs =
    (sales.cogs || 0) +
    (onlineFood.cogs || 0) +
    (cityLedger.cogs || 0) +
    (compliment.cogs || 0)
  const salesRevenue = grossRevenue - cogs
  const rounding =
    (sales.rounding || 0) +
    (onlineFood.rounding || 0) +
    (cityLedger.rounding || 0) +
    (compliment.rounding || 0)
  const totalSalesRevenue = salesRevenue
  const loss = data.loss || 0
  const totalNetRevenue = totalSalesRevenue - loss

  const depositWallet = data.depositWallet.deposit
  const depositIncomeTotal =
    depositWallet.totalDepositCash +
    depositWallet.totalDepositDebit +
    depositWallet.totalDepositQRStatic +
    depositWallet.totalDepositEWallet +
    depositWallet.totalDepositManualTransfer

  const settlement =
    Number(sales.settlement ?? 0) +
    Number(onlineFood.settlement ?? 0) +
    Number(cityLedger.settlement ?? 0)

  const totalWalletIncome =
    (walletIncome.cashAmount || 0) +
    (walletIncome.nonCashAmount || 0) +
    (walletIncome.debitAmount || 0) +
    (walletIncome.qrisStaticAmount || 0) +
    (walletIncome.manualTransferAmount || 0) +
    (walletIncome.onlineFoodAmount || 0) +
    (walletIncome.cityLedgerAmount || 0) +
    depositIncomeTotal +
    settlement

  const totalWalletExpense = totalWalletExpenseAmount(data)

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
    totalPlatformFeeBilling,
    totalPlatformFeeCustomer,
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
    totalSettlement: settlement,
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
        value: formatCurrency(getBlockPlatformFeeByCustomer(data.sales)),
        hint: 'Hanya Platform Fee yang dibebankan ke pelanggan',
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
        value: formatCurrency(getBlockPlatformFeeByCustomer(data.cityLedger)),
        hint: 'Hanya Platform Fee yang dibebankan ke pelanggan',
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
        value: formatCurrency(getBlockPlatformFeeByCustomer(data.onlineFood)),
        hint: 'Hanya Platform Fee yang dibebankan ke pelanggan',
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
        label: 'Total Tagihan Platform Fee',
        value: formatCurrency(m.totalPlatformFeeBilling, true),
        negative: true,
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
        label: 'Total Pendapatan Penjualan',
        value: formatCurrency(m.totalSalesRevenue),
        hint: 'didapat dari Pendapatan Penjualan',
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

type ChannelSlice = OrderCountFields & {
  productNormalSoldTotal: number
  productCustomAmountSoldTotal: number
  multiprices: MultipriceEntry[]
}

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
    const explicitTotal =
      (item.total as number | undefined) ??
      (item.amount as number | undefined) ??
      (item.totalAmount as number | undefined)
    /** productPrice, fee, platformFee, serviceFee dari API sudah agregat lintas order. */
    const feeTotal = Number((item.fee as number | undefined) ?? 0)
    const platformFeeTotal = Number(
      (item.platformFee as number | undefined) ?? 0,
    )
    const serviceFeeTotal = Number((item.serviceFee as number | undefined) ?? 0)
    const base =
      (item.productPrice as number | undefined) ??
      (item.productSoldTotal as number | undefined) ??
      (item.value as number | undefined)
    const amountRaw =
      typeof explicitTotal === 'number' && !Number.isNaN(explicitTotal)
        ? explicitTotal
        : Number(base ?? 0) + feeTotal + platformFeeTotal + serviceFeeTotal
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
  const customer = buildPlatformFeeBillingSection(data, 'byCustomer')
  const merchant = buildPlatformFeeBillingSection(data, 'byCafe')
  return [
    {
      label: customer.title,
      value: formatCurrency(customer.total, true),
      negative: true,
    },
    {
      label: merchant.title,
      value: formatCurrency(merchant.total, true),
      negative: true,
    },
  ]
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
    /** fee dari API sudah total agregat per channel, bukan per transaksi. */
    rows.push({
      label: `${toTitleFoodChannel(rawName)} Fee x ${formatNumber(count || 0)} Transaksi`,
      value: formatCurrency(fee, true),
      negative: true,
    })
  }

  if (rows.length > 0) return rows

  const totalMultiprice =
    data.sales.multipriceFee +
    data.onlineFood.multipriceFee +
    data.cityLedger.multipriceFee

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
      if (
        row.label === 'Platform Fee' ||
        row.label === 'Total Tagihan Platform Fee'
      ) {
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
        return {
          ...row,
          key: 'wallet-income-deposit',
          details: depositWalletIncomeDetails(data),
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
      value: formatCurrency(getBlockPlatformFeeByCustomer(c)),
      key: 'cmp-pf',
    },
  ]
}

function revenueExpandableRowsV2(
  revenueRows: MetricRow[],
  data: SummaryData,
): ExpandableMetricRow[] {
  return revenueRows.map((row) => {
    if (
      row.label === 'Platform Fee' ||
      row.label === 'Total Tagihan Platform Fee'
    ) {
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
      return {
        ...row,
        key: 'wallet-income-deposit',
        details: depositWalletIncomeDetails(data),
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
