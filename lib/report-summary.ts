export type ApiResponse = {
  isSuccess: boolean;
  message: string;
  data: SummaryData;
};

export type MetricRow = {
  label: string;
  value: string;
  negative?: boolean;
  hint?: string;
};

export type ExpandableMetricRow = MetricRow & {
  key: string;
  details?: MetricRow[];
};

type MultipriceBreakdown = {
  [key: string]: unknown;
};

export type PriceCount = {
  price: number;
  count: number;
};

export type SalesBlock = {
  productSoldCount: number;
  orderCount: number;
  orderGeneralCount?: number;
  orderSplitBillCount?: number;
  productSoldTotal: number;
  productNormalSoldTotal?: number;
  productCustomAmountSoldTotal?: number;
  discount?: number;
  tax?: number;
  platformFee: number;
  serviceFee?: number;
  multipriceFee: number;
  rounding: number;
  xenditFee: number;
  cogs: number;
  guestCount: number;
  multiprices?: MultipriceBreakdown[];
};

export type ReservationState = {
  totalReservation: number;
  totalPerson: number;
  totalDeposit: number;
  totalPaidDeposit: number;
};

export type WalletIncome = {
  cashAmount: number;
  cashCount: number;
  nonCashAmount: number;
  nonCashCount: number;
  debitAmount: number;
  debitCount: number;
  qrisStaticAmount: number;
  qrisStaticCount: number;
  manualTransferAmount: number;
  manualTransferCount: number;
  onlineFoodAmount: number;
  onlineFoodCount: number;
  cityLedgerAmount: number;
  cityLedgerCount: number;
  depositAmount?: number;
  depositCount?: number;
};

export type WalletExpense = {
  cash: number;
  nonCash: number;
  debit: number;
  qrisStatic: number;
  manualTransfer: number;
  cityLedger: number;
  onlineFood: number;
  deposit?: number;
};

export type SummaryData = {
  sales: SalesBlock;
  onlineFood: SalesBlock;
  cityLedger: SalesBlock;
  compliment: SalesBlock & {
    complimentAmount?: number;
  };
  platformFeeBreakdown: {
    sales: PriceCount[];
    onlineFood: PriceCount[];
    cityLedger: PriceCount[];
    compliment: number;
  };
  reservation: {
    waiting: ReservationState;
    accepted: ReservationState;
    succeed: ReservationState;
    failed: ReservationState;
  };
  walletIncome: WalletIncome;
  walletExpense: WalletExpense;
  loss: number;
};

export const REPORT_BASE_URL = process.env.NEXT_PUBLIC_REPORT_BASE_URL ?? "http://localhost:3000";
export const REPORT_BEARER_TOKEN = process.env.NEXT_PUBLIC_REPORT_TOKEN ?? "";

export function formatNumber(num: number) {
  return Number(num || 0).toLocaleString("id-ID");
}

export function formatCurrency(num: number, showNegativeStyle = false) {
  const abs = Math.abs(Number(num || 0));
  const value = `Rp ${formatNumber(abs)}`;
  if (showNegativeStyle || num < 0) {
    return `(${value})`;
  }
  return value;
}

export function formatDateForInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type BaseMetrics = {
  grossSales: number;
  grossSalesOnlineFood: number;
  grossCityLedger: number;
  grossCompliment: number;
  statisticsGrossSales: number;
  statisticsTotalBill: number;
  statisticsTotalGuest: number;
  avgAmountPerGuest: number;
  avgAmountPerBill: number;
  totalPlatformFee: number;
  totalMultipriceFee: number;
  totalXenditFee: number;
  totalGrossSales: number;
  grossRevenue: number;
  cogs: number;
  salesRevenue: number;
  rounding: number;
  totalSalesRevenue: number;
  loss: number;
  totalNetRevenue: number;
  totalWalletIncome: number;
  totalWalletExpense: number;
};

export function computeBaseMetrics(data: SummaryData): BaseMetrics {
  const grossSales =
    (data.sales.productSoldTotal || 0) -
    (data.sales.discount || 0) +
    (data.sales.tax || 0) +
    (data.sales.platformFee || 0) +
    (data.sales.serviceFee || 0) +
    (data.sales.multipriceFee || 0) +
    (data.sales.rounding || 0);

  const grossSalesOnlineFood =
    (data.onlineFood.productSoldTotal || 0) -
    (data.onlineFood.discount || 0) +
    (data.onlineFood.platformFee || 0) +
    (data.onlineFood.multipriceFee || 0) +
    (data.onlineFood.rounding || 0);

  const grossCityLedger =
    (data.cityLedger.productSoldTotal || 0) -
    (data.cityLedger.discount || 0) +
    (data.cityLedger.tax || 0) +
    (data.cityLedger.platformFee || 0) +
    (data.cityLedger.serviceFee || 0) +
    (data.cityLedger.multipriceFee || 0) +
    (data.cityLedger.rounding || 0);

  const grossCompliment =
    (data.compliment.productSoldTotal || 0) -
    (data.compliment.discount || 0) +
    (data.compliment.tax || 0) +
    (data.compliment.platformFee || 0) +
    (data.compliment.serviceFee || 0) +
    (data.compliment.multipriceFee || 0) +
    (data.compliment.rounding || 0);

  const statisticsGrossSales = grossSales + grossCityLedger;
  const statisticsTotalBill = (data.sales.orderCount || 0) + (data.cityLedger.orderCount || 0);
  const statisticsTotalGuest = (data.sales.guestCount || 0) + (data.cityLedger.guestCount || 0);
  const avgAmountPerGuest = statisticsTotalGuest ? statisticsGrossSales / statisticsTotalGuest : 0;
  const avgAmountPerBill = statisticsTotalBill ? statisticsGrossSales / statisticsTotalBill : 0;

  const totalPlatformFee =
    (data.sales?.platformFee || 0) + (data.cityLedger?.platformFee || 0) + (data.onlineFood?.platformFee || 0);

  const totalMultipriceFee =
    (data.sales?.multipriceFee || 0) +
    (data.compliment?.multipriceFee || 0) +
    (data.onlineFood?.multipriceFee || 0) +
    (data.cityLedger?.multipriceFee || 0);

  const totalXenditFee =
    (data.sales?.xenditFee || 0) +
    (data.cityLedger?.xenditFee || 0) +
    (data.onlineFood?.xenditFee || 0) +
    (data.compliment?.xenditFee || 0);

  const totalGrossSales =
    grossSales + grossSalesOnlineFood + grossCityLedger - totalPlatformFee - totalMultipriceFee - totalXenditFee;

  const grossRevenue = totalGrossSales;
  const cogs = (data.sales.cogs || 0) + (data.onlineFood.cogs || 0) + (data.cityLedger.cogs || 0) + (data.compliment.cogs || 0);
  const salesRevenue = grossRevenue - cogs;
  const rounding =
    (data.sales.rounding || 0) +
    (data.onlineFood.rounding || 0) +
    (data.cityLedger.rounding || 0) +
    (data.compliment.rounding || 0);
  const totalSalesRevenue = salesRevenue + rounding;
  const loss = data?.loss || 0;
  const totalNetRevenue = totalSalesRevenue - loss;

  const totalWalletIncome =
    (data.walletIncome.cashAmount || 0) +
    (data.walletIncome.nonCashAmount || 0) +
    (data.walletIncome.debitAmount || 0) +
    (data.walletIncome.qrisStaticAmount || 0) +
    (data.walletIncome.manualTransferAmount || 0) +
    (data.walletIncome.onlineFoodAmount || 0) +
    (data.walletIncome.cityLedgerAmount || 0) +
    (data.walletIncome.depositAmount || 0);

  const totalWalletExpense =
    (data.walletExpense.cash || 0) +
    (data.walletExpense.nonCash || 0) +
    (data.walletExpense.debit || 0) +
    (data.walletExpense.qrisStatic || 0) +
    (data.walletExpense.manualTransfer || 0) +
    (data.walletExpense.cityLedger || 0) +
    (data.walletExpense.onlineFood || 0) +
    (data.walletExpense.deposit || 0);

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
  };
}

export function createRows(data: SummaryData) {
  const m = computeBaseMetrics(data);

  return {
    salesRows: [
      { label: "Jumlah Produk Terjual", value: formatNumber(data.sales.productSoldCount || 0) },
      { label: "Total Pesanan", value: `${formatNumber(data.sales.orderCount || 0)} Pesanan` },
      { label: "Total Produk Terjual", value: formatCurrency(data.sales.productSoldTotal || 0) },
      { label: "Diskon", value: formatCurrency(data.sales.discount || 0, true), negative: true },
      { label: "Pajak", value: formatCurrency(data.sales.tax || 0) },
      { label: "Platform Fee", value: formatCurrency(data.sales.platformFee || 0) },
      { label: "Service Fee", value: formatCurrency(data.sales.serviceFee || 0) },
      { label: "Multiprice Fee", value: formatCurrency(data.sales.multipriceFee || 0) },
      { label: "Pembulatan", value: formatCurrency(data.sales.rounding || 0) },
      { label: "Total Penjualan Kotor", value: formatCurrency(m.grossSales) },
    ] satisfies MetricRow[],
    statisticRows: [
      { label: "Total Penjualan Kotor", value: formatCurrency(m.statisticsGrossSales) },
      { label: "Total Bill / Order / Transaksi", value: `${formatNumber(m.statisticsTotalBill)} Bill` },
      { label: "Pengunjung / Pembeli", value: `${formatNumber(m.statisticsTotalGuest)} Orang` },
      { label: "Rata-rata Nilai Penjualan / orang", value: `${formatCurrency(m.avgAmountPerGuest)} / Orang` },
      { label: "Rata-rata Nilai Penjualan / Bill", value: `${formatCurrency(m.avgAmountPerBill)} / Bill` },
    ] satisfies MetricRow[],
    reservationRows: [
      {
        label: "Jumlah Reservasi",
        value: formatNumber(
          (data.reservation.waiting.totalReservation || 0) +
            (data.reservation.accepted.totalReservation || 0) +
            (data.reservation.succeed.totalReservation || 0) +
            (data.reservation.failed.totalReservation || 0),
        ),
      },
      {
        label: "Jumlah Orang",
        value: `${formatNumber(
          (data.reservation.waiting.totalPerson || 0) +
            (data.reservation.accepted.totalPerson || 0) +
            (data.reservation.succeed.totalPerson || 0) +
            (data.reservation.failed.totalPerson || 0),
        )} Orang`,
      },
      {
        label: "Total DP",
        value: formatCurrency(
          (data.reservation.waiting.totalDeposit || 0) +
            (data.reservation.accepted.totalDeposit || 0) +
            (data.reservation.succeed.totalDeposit || 0) +
            (data.reservation.failed.totalDeposit || 0),
        ),
      },
      {
        label: "Total DP Terbayar",
        value: formatCurrency(
          (data.reservation.waiting.totalPaidDeposit || 0) +
            (data.reservation.accepted.totalPaidDeposit || 0) +
            (data.reservation.succeed.totalPaidDeposit || 0) +
            (data.reservation.failed.totalPaidDeposit || 0),
        ),
      },
    ] satisfies MetricRow[],
    cityLedgerRows: [
      { label: "Jumlah Produk Terjual", value: formatNumber(data.cityLedger.productSoldCount || 0) },
      { label: "Total Pesanan", value: `${formatNumber(data.cityLedger.orderCount || 0)} Pesanan` },
      { label: "Total Produk Terjual", value: formatCurrency(data.cityLedger.productSoldTotal || 0) },
      { label: "Diskon", value: formatCurrency(data.cityLedger.discount || 0, true), negative: true },
      { label: "Pajak", value: formatCurrency(data.cityLedger.tax || 0) },
      { label: "Platform Fee", value: formatCurrency(data.cityLedger.platformFee || 0) },
      { label: "Service Fee", value: formatCurrency(data.cityLedger.serviceFee || 0) },
      { label: "Multiprice Fee", value: formatCurrency(data.cityLedger.multipriceFee || 0) },
      { label: "Pembulatan", value: formatCurrency(data.cityLedger.rounding || 0) },
      { label: "Total Penjualan Kotor", value: formatCurrency(m.grossCityLedger) },
    ] satisfies MetricRow[],
    onlineFoodRows: [
      { label: "Jumlah Produk Terjual", value: formatNumber(data.onlineFood.productSoldCount || 0) },
      { label: "Total Pesanan", value: `${formatNumber(data.onlineFood.orderCount || 0)} Pesanan` },
      { label: "Total Produk Terjual", value: formatCurrency(data.onlineFood.productSoldTotal || 0) },
      { label: "Diskon", value: formatCurrency(data.onlineFood.discount || 0, true), negative: true },
      { label: "Platform Fee", value: formatCurrency(data.onlineFood.platformFee || 0) },
      { label: "Multiprice Fee", value: formatCurrency(data.onlineFood.multipriceFee || 0) },
      { label: "Pembulatan", value: formatCurrency(data.onlineFood.rounding || 0) },
      { label: "Total Penjualan Kotor", value: formatCurrency(m.grossSalesOnlineFood) },
    ] satisfies MetricRow[],
    revenueRows: [
      { label: "Total Penjualan Kotor", value: formatCurrency(m.grossSales) },
      { label: "Total Penjualan Online Food", value: formatCurrency(m.grossSalesOnlineFood) },
      { label: "Total Penjualan City Ledger", value: formatCurrency(m.grossCityLedger) },
      { label: "Platform Fee", value: formatCurrency(m.totalPlatformFee, true), negative: true, hint: "Lihat Selengkapnya" },
      { label: "Multiprice Fee", value: formatCurrency(m.totalMultipriceFee, true), negative: true },
      { label: "Xendit Fee", value: formatCurrency(m.totalXenditFee, true), negative: true, hint: "Lihat Selengkapnya" },
      { label: "Total Pendapatan Kotor", value: formatCurrency(m.totalGrossSales) },
    ] satisfies MetricRow[],
    incomeRows: [
      { label: "Total Pendapatan Kotor", value: formatCurrency(m.grossRevenue) },
      { label: "Harga Pokok Penjualan", value: formatCurrency(m.cogs, true), negative: true },
      {
        label: "Pendapatan Penjualan",
        value: formatCurrency(m.salesRevenue),
        hint: "didapat dari Total Pendapatan Kotor - Harga Pokok Penjualan",
      },
      { label: "Pembulatan", value: formatCurrency(m.rounding, m.rounding < 0), negative: m.rounding < 0 },
      {
        label: "Total Pendapatan Penjualan",
        value: formatCurrency(m.totalSalesRevenue),
        hint: "didapat dari Pendapatan Penjualan + Pembulatan",
      },
      { label: "Rugi", value: formatCurrency(m.loss, true), negative: true, hint: "akumulasi stock terbuang" },
      { label: "Total Pendapatan Bersih", value: formatCurrency(m.totalNetRevenue) },
    ] satisfies MetricRow[],
    walletIncomeRows: [
      { label: "Tunai", value: formatCurrency(data.walletIncome.cashAmount || 0), hint: `${formatNumber(data.walletIncome.cashCount || 0)} Transaksi` },
      { label: "Non-Tunai", value: formatCurrency(data.walletIncome.nonCashAmount || 0), hint: `${formatNumber(data.walletIncome.nonCashCount || 0)} Transaksi` },
      { label: "Debit", value: formatCurrency(data.walletIncome.debitAmount || 0), hint: `${formatNumber(data.walletIncome.debitCount || 0)} Transaksi` },
      { label: "QRIS Static", value: formatCurrency(data.walletIncome.qrisStaticAmount || 0), hint: `${formatNumber(data.walletIncome.qrisStaticCount || 0)} Transaksi` },
      { label: "Transfer Manual", value: formatCurrency(data.walletIncome.manualTransferAmount || 0), hint: `${formatNumber(data.walletIncome.manualTransferCount || 0)} Transaksi` },
      { label: "Online Food", value: formatCurrency(data.walletIncome.onlineFoodAmount || 0), hint: `${formatNumber(data.walletIncome.onlineFoodCount || 0)} Transaksi` },
      { label: "City Ledger", value: formatCurrency(data.walletIncome.cityLedgerAmount || 0), hint: `${formatNumber(data.walletIncome.cityLedgerCount || 0)} Transaksi` },
      { label: "Deposit", value: formatCurrency(data.walletIncome.depositAmount || 0), hint: `${formatNumber(data.walletIncome.depositCount || 0)} Transaksi` },
    ] satisfies MetricRow[],
    walletExpenseRows: [
      { label: "Tunai", value: formatCurrency(data.walletExpense.cash || 0, true), negative: true },
      { label: "Non-Tunai", value: formatCurrency(data.walletExpense.nonCash || 0, true), negative: true },
      { label: "Debit", value: formatCurrency(data.walletExpense.debit || 0, true), negative: true },
      { label: "QRIS Static", value: formatCurrency(data.walletExpense.qrisStatic || 0, true), negative: true },
      { label: "Transfer Manual", value: formatCurrency(data.walletExpense.manualTransfer || 0, true), negative: true },
      { label: "City Ledger", value: formatCurrency(data.walletExpense.cityLedger || 0, true), negative: true },
      { label: "Online Food", value: formatCurrency(data.walletExpense.onlineFood || 0, true), negative: true },
      { label: "Deposit", value: formatCurrency(data.walletExpense.deposit || 0, true), negative: true },
    ] satisfies MetricRow[],
  };
}
