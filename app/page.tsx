"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type ApiResponse = {
  isSuccess: boolean;
  message: string;
  data: SummaryData;
};

type MetricRow = {
  label: string;
  value: string;
  negative?: boolean;
  hint?: string;
};

type ExpandableMetricRow = MetricRow & {
  key: string;
  details?: MetricRow[];
};

type MultipriceBreakdown = {
  [key: string]: unknown;
};

type PriceCount = {
  price: number;
  count: number;
};

type SalesBlock = {
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

type ReservationState = {
  totalReservation: number;
  totalPerson: number;
  totalDeposit: number;
  totalPaidDeposit: number;
};

type WalletIncome = {
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

type WalletExpense = {
  cash: number;
  nonCash: number;
  debit: number;
  qrisStatic: number;
  manualTransfer: number;
  cityLedger: number;
  onlineFood: number;
  deposit?: number;
};

type SummaryData = {
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

const baseUrl = process.env.NEXT_PUBLIC_REPORT_BASE_URL ?? "http://localhost:3000";
const bearerToken = process.env.NEXT_PUBLIC_REPORT_TOKEN ?? "";

function formatNumber(num: number) {
  return Number(num || 0).toLocaleString("id-ID");
}

function formatCurrency(num: number, showNegativeStyle = false) {
  const abs = Math.abs(Number(num || 0));
  const value = `Rp ${formatNumber(abs)}`;
  if (showNegativeStyle || num < 0) {
    return `(${value})`;
  }
  return value;
}

function formatDateForInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createRows(data: SummaryData) {
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
      { label: "Total Penjualan Kotor", value: formatCurrency(grossSales) },
    ] satisfies MetricRow[],
    statisticRows: [
      { label: "Total Penjualan Kotor", value: formatCurrency(statisticsGrossSales) },
      { label: "Total Bill / Order / Transaksi", value: `${formatNumber(statisticsTotalBill)} Bill` },
      { label: "Pengunjung / Pembeli", value: `${formatNumber(statisticsTotalGuest)} Orang` },
      { label: "Rata-rata Nilai Penjualan / orang", value: `${formatCurrency(avgAmountPerGuest)} / Orang` },
      { label: "Rata-rata Nilai Penjualan / Bill", value: `${formatCurrency(avgAmountPerBill)} / Bill` },
    ] satisfies MetricRow[],
    reservationRows: [
      { label: "Jumlah Reservasi", value: formatNumber((data.reservation.waiting.totalReservation || 0) + (data.reservation.accepted.totalReservation || 0) + (data.reservation.succeed.totalReservation || 0) + (data.reservation.failed.totalReservation || 0)) },
      { label: "Jumlah Orang", value: `${formatNumber((data.reservation.waiting.totalPerson || 0) + (data.reservation.accepted.totalPerson || 0) + (data.reservation.succeed.totalPerson || 0) + (data.reservation.failed.totalPerson || 0))} Orang` },
      { label: "Total DP", value: formatCurrency((data.reservation.waiting.totalDeposit || 0) + (data.reservation.accepted.totalDeposit || 0) + (data.reservation.succeed.totalDeposit || 0) + (data.reservation.failed.totalDeposit || 0)) },
      { label: "Total DP Terbayar", value: formatCurrency((data.reservation.waiting.totalPaidDeposit || 0) + (data.reservation.accepted.totalPaidDeposit || 0) + (data.reservation.succeed.totalPaidDeposit || 0) + (data.reservation.failed.totalPaidDeposit || 0)) },
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
      { label: "Total Penjualan Kotor", value: formatCurrency(grossCityLedger) },
    ] satisfies MetricRow[],
    onlineFoodRows: [
      { label: "Jumlah Produk Terjual", value: formatNumber(data.onlineFood.productSoldCount || 0) },
      { label: "Total Pesanan", value: `${formatNumber(data.onlineFood.orderCount || 0)} Pesanan` },
      { label: "Total Produk Terjual", value: formatCurrency(data.onlineFood.productSoldTotal || 0) },
      { label: "Diskon", value: formatCurrency(data.onlineFood.discount || 0, true), negative: true },
      { label: "Platform Fee", value: formatCurrency(data.onlineFood.platformFee || 0) },
      { label: "Multiprice Fee", value: formatCurrency(data.onlineFood.multipriceFee || 0) },
      { label: "Pembulatan", value: formatCurrency(data.onlineFood.rounding || 0) },
      { label: "Total Penjualan Kotor", value: formatCurrency(grossSalesOnlineFood) },
    ] satisfies MetricRow[],
    revenueRows: [
      { label: "Total Penjualan Kotor", value: formatCurrency(grossSales) },
      { label: "Total Penjualan Online Food", value: formatCurrency(grossSalesOnlineFood) },
      { label: "Total Penjualan City Ledger", value: formatCurrency(grossCityLedger) },
      { label: "Platform Fee", value: formatCurrency(totalPlatformFee, true), negative: true, hint: "Lihat Selengkapnya" },
      { label: "Multiprice Fee", value: formatCurrency(totalMultipriceFee, true), negative: true },
      { label: "Xendit Fee", value: formatCurrency(totalXenditFee, true), negative: true, hint: "Lihat Selengkapnya" },
      { label: "Total Pendapatan Kotor", value: formatCurrency(totalGrossSales) },
    ] satisfies MetricRow[],
    incomeRows: [
      { label: "Total Pendapatan Kotor", value: formatCurrency(grossRevenue) },
      { label: "Harga Pokok Penjualan", value: formatCurrency(cogs, true), negative: true },
      {
        label: "Pendapatan Penjualan",
        value: formatCurrency(salesRevenue),
        hint: "didapat dari Total Pendapatan Kotor - Harga Pokok Penjualan",
      },
      { label: "Pembulatan", value: formatCurrency(rounding, rounding < 0), negative: rounding < 0 },
      {
        label: "Total Pendapatan Penjualan",
        value: formatCurrency(totalSalesRevenue),
        hint: "didapat dari Pendapatan Penjualan + Pembulatan",
      },
      { label: "Rugi", value: formatCurrency(loss, true), negative: true, hint: "akumulasi stock terbuang" },
      { label: "Total Pendapatan Bersih", value: formatCurrency(totalNetRevenue) },
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

function SectionCard({ title, rows }: { title: string; rows: MetricRow[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {rows.map((row, index) => (
          <div key={`${title}-${row.label}-${index}`} className="space-y-1">
            <div className="flex items-start justify-between gap-4 text-sm">
              <div className="text-muted-foreground">
                <p>{row.label}</p>
                {row.hint && <p className="text-xs text-red-500">{row.hint}</p>}
              </div>
              <p className={`font-semibold text-right ${row.negative ? "text-red-600" : "text-foreground"}`}>{row.value}</p>
            </div>
            {index < rows.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpandableSectionCard({
  title,
  rows,
}: {
  title: string;
  rows: ExpandableMetricRow[];
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>(
    () =>
      rows.reduce<Record<string, boolean>>((acc, row) => {
        if (row.details?.length) acc[row.key] = true;
        return acc;
      }, {}),
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {rows.map((row, index) => {
          const hasDetails = Boolean(row.details?.length);
          const isExpanded = expandedRows[row.key];

          return (
            <div key={`${title}-${row.key}-${index}`} className="space-y-1">
              <div className="flex items-start justify-between gap-4 text-sm">
                <div className="text-muted-foreground">
                  <p>{row.label}</p>
                  {row.hint && <p className="text-xs text-muted-foreground">{row.hint}</p>}
                  {hasDetails && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRows((prev) => ({
                          ...prev,
                          [row.key]: !prev[row.key],
                        }))
                      }
                      className="text-xs text-red-500 transition hover:text-red-600"
                    >
                      {isExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                    </button>
                  )}
                </div>
                <p className={`font-semibold text-right ${row.negative ? "text-red-600" : "text-foreground"}`}>{row.value}</p>
              </div>

              {hasDetails && isExpanded && (
                <div className="space-y-1 bg-slate-50 p-2">
                  {row.details?.map((detailRow, detailIndex) => (
                    <div key={`${row.key}-detail-${detailIndex}`} className="flex items-center justify-between gap-4 text-sm">
                      <p className="text-muted-foreground">{detailRow.label}</p>
                      <p className={`font-semibold text-right ${detailRow.negative ? "text-red-600" : "text-foreground"}`}>
                        {detailRow.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {index < rows.length - 1 && <Separator />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReservationSectionCard({
  reservation,
}: {
  reservation: SummaryData["reservation"];
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
    totalReservation: true,
    totalPerson: true,
    totalDeposit: true,
    totalPaidDeposit: true,
  });

  const detailRows = [
    { key: "totalReservation", label: "Jumlah Reservasi", unit: "" },
    { key: "totalPerson", label: "Jumlah Orang", unit: " Orang" },
    { key: "totalDeposit", label: "Total DP", unit: "currency" },
    { key: "totalPaidDeposit", label: "Total DP Terbayar", unit: "currency" },
  ] as const;

  const statusList = [
    { label: "Menunggu", key: "waiting" },
    { label: "Diterima", key: "accepted" },
    { label: "Selesai", key: "succeed" },
    { label: "Dibatalkan", key: "failed" },
  ] as const;

  function getTotalValue(metricKey: keyof ReservationState, unit: string) {
    const total =
      (reservation.waiting[metricKey] || 0) +
      (reservation.accepted[metricKey] || 0) +
      (reservation.succeed[metricKey] || 0) +
      (reservation.failed[metricKey] || 0);

    if (unit === "currency") return formatCurrency(total);
    return `${formatNumber(total)}${unit}`;
  }

  function getDetailValue(statusKey: keyof SummaryData["reservation"], metricKey: keyof ReservationState, unit: string) {
    const value = reservation[statusKey][metricKey] || 0;
    if (unit === "currency") return formatCurrency(value);
    return `${formatNumber(value)}${unit}`;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reservasi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {detailRows.map((metric, index) => {
          const isExpanded = expandedRows[metric.key];

          return (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-start justify-between gap-4 text-sm">
                <div className="text-muted-foreground">
                  <p>{metric.label}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRows((prev) => ({
                        ...prev,
                        [metric.key]: !prev[metric.key],
                      }))
                    }
                    className="text-xs text-red-500 transition hover:text-red-600"
                  >
                    {isExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                  </button>
                </div>
                <p className="font-semibold text-right text-foreground">
                  {getTotalValue(metric.key, metric.unit)}
                </p>
              </div>

              {isExpanded && (
                <div className="space-y-1 pt-1">
                  {statusList.map((status) => (
                    <div key={`${metric.key}-${status.key}`} className="flex items-center justify-between gap-4 text-sm">
                      <p className="text-muted-foreground">{status.label}</p>
                      <p className="font-semibold text-right text-foreground">
                        {getDetailValue(status.key, metric.key, metric.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {index < detailRows.length - 1 && <Separator />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const now = new Date();
  const [startDate, setStartDate] = useState(formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(formatDateForInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<SummaryData | null>(null);

  const sections = useMemo(() => (data ? createRows(data) : null), [data]);

  const salesExpandableRows = useMemo<ExpandableMetricRow[]>(
    () =>
      data && sections
        ? sections.salesRows.map((row) => {
            if (row.label === "Total Pesanan") {
              return {
                ...row,
                key: "total-order",
                details: [
                  { label: "Pesanan General", value: formatNumber(data.sales.orderGeneralCount || 0) },
                  { label: "Pesanan Split Bill", value: formatNumber(data.sales.orderSplitBillCount || 0) },
                ],
              };
            }
            if (row.label === "Total Produk Terjual") {
              return {
                ...row,
                key: "total-product-sold",
                details: [
                  { label: "Harga Normal", value: formatCurrency(data.sales.productNormalSoldTotal || 0) },
                  { label: "Harga Custom Amount", value: formatCurrency(data.sales.productCustomAmountSoldTotal || 0) },
                ],
              };
            }
            return { ...row, key: row.label };
          })
        : [],
    [data, sections],
  );

  const cityLedgerExpandableRows = useMemo<ExpandableMetricRow[]>(
    () =>
      data && sections
        ? sections.cityLedgerRows.map((row) => {
            if (row.label === "Total Pesanan") {
              return {
                ...row,
                key: "city-ledger-total-order",
                details: [
                  { label: "Pesanan General", value: formatNumber(data.cityLedger.orderGeneralCount || 0) },
                  { label: "Pesanan Split Bill", value: formatNumber(data.cityLedger.orderSplitBillCount || 0) },
                ],
              };
            }
            if (row.label === "Total Produk Terjual") {
              return {
                ...row,
                key: "city-ledger-total-product-sold",
                details: [
                  { label: "Harga Normal", value: formatCurrency(data.cityLedger.productNormalSoldTotal || 0) },
                  { label: "Harga Custom Amount", value: formatCurrency(data.cityLedger.productCustomAmountSoldTotal || 0) },
                ],
              };
            }
            return { ...row, key: `city-ledger-${row.label}` };
          })
        : [],
    [data, sections],
  );

  const revenueExpandableRows = useMemo<ExpandableMetricRow[]>(
    () =>
      data && sections
        ? sections.revenueRows.map((row) => {
            if (row.label === "Platform Fee") {
              const platformFeeMap = new Map<number, number>();
              const allPlatformFeeBreakdowns = [
                ...data.platformFeeBreakdown.sales,
                ...data.platformFeeBreakdown.onlineFood,
                ...data.platformFeeBreakdown.cityLedger,
              ];

              for (const item of allPlatformFeeBreakdowns) {
                const currentCount = platformFeeMap.get(item.price) || 0;
                platformFeeMap.set(item.price, currentCount + (item.count || 0));
              }

              const details = [...platformFeeMap.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([price, count]) => ({
                  label: `${formatNumber(price)} x ${formatNumber(count)} Transaksi`,
                  value: formatCurrency(price * count, true),
                  negative: true,
                }));

              if (data.platformFeeBreakdown.compliment) {
                details.push({
                  label: "Compliment",
                  value: formatCurrency(data.platformFeeBreakdown.compliment, true),
                  negative: true,
                });
              }

              return {
                ...row,
                key: "revenue-platform-fee",
                details,
              };
            }
            if (row.label === "Xendit Fee") {
              return {
                ...row,
                key: "revenue-xendit-fee",
                details: [
                  { label: "E-Wallet x 0 Transaksi", value: formatCurrency(0, true), negative: true },
                  { label: "QRIS x 0 Transaksi", value: formatCurrency(0, true), negative: true },
                  { label: "VA x 0 Transaksi", value: formatCurrency(0, true), negative: true },
                ],
              };
            }
            return { ...row, key: `revenue-${row.label}` };
          })
        : [],
    [data, sections],
  );

  const walletIncomeExpandableRows = useMemo<ExpandableMetricRow[]>(
    () =>
      data && sections
        ? sections.walletIncomeRows.map((row) => {
            if (row.label === "Tunai") {
              return {
                ...row,
                key: "wallet-income-cash",
                details: [
                  { label: "Pemasukan Manual", value: formatCurrency(0) },
                  { label: "Pemasukan Penjualan", value: formatCurrency(data.walletIncome.cashAmount || 0) },
                ],
              };
            }
            if (row.label === "Deposit") {
              const depositCount = data.walletIncome.depositCount || 0;
              return {
                ...row,
                key: "wallet-income-deposit",
                details: [
                  {
                    label: `Tunai x ${formatNumber(depositCount)} Transaksi`,
                    value: formatCurrency(data.walletIncome.depositAmount || 0),
                  },
                  { label: "Non Tunai x 0 Transaksi", value: formatCurrency(0) },
                  { label: "Debit x 0 Transaksi", value: formatCurrency(0) },
                  { label: "QRIS Static x 0 Transaksi", value: formatCurrency(0) },
                  { label: "Transfer Manual x 0 Transaksi", value: formatCurrency(0) },
                ],
              };
            }
            return { ...row, key: `wallet-income-${row.label}` };
          })
        : [],
    [data, sections],
  );

  async function fetchSaleSummary() {
    if (!startDate || !endDate) {
      setError("Pilih tanggal terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${baseUrl}/v3/report/sale/summary?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          "Content-Type": "application/json",
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
      });
      const json = (await response.json()) as ApiResponse;
      if (!json?.isSuccess || !json?.data) {
        throw new Error("Gagal mengambil data report.");
      }
      setData(json.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Laporan Detail</CardTitle>
            <p className="text-sm text-muted-foreground">
              Laporan tanggal:{" "}
              <span className="font-medium text-red-600">
                {new Date(startDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} -{" "}
                {new Date(endDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Tanggal Mulai</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Hingga Tanggal</Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-9" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">(Max Range: 31 Hari)</p>
            <Button onClick={fetchSaleSummary} disabled={loading} className="w-full md:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Memuat..." : "Fetch Data"}
            </Button>
          </CardContent>
        </Card>

        {!bearerToken && (
          <Alert className="border-amber-400 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle>Token belum diatur</AlertTitle>
            <AlertDescription>
              Isi <code>NEXT_PUBLIC_REPORT_TOKEN</code> dan <code>NEXT_PUBLIC_REPORT_BASE_URL</code> di file <code>.env.local</code> agar data API bisa terbaca.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Gagal memuat report</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sections && (
          <div className="grid gap-4">
            <ExpandableSectionCard title="Penjualan" rows={salesExpandableRows} />
            <SectionCard title="Statistik" rows={sections.statisticRows} />
            <ReservationSectionCard reservation={data.reservation} />
            <ExpandableSectionCard title="City Ledger" rows={cityLedgerExpandableRows} />
            <SectionCard title="Online Food" rows={sections.onlineFoodRows} />
            <ExpandableSectionCard title="Pendapatan" rows={revenueExpandableRows} />
            <SectionCard title="Pemasukan" rows={sections.incomeRows} />
            <ExpandableSectionCard title="Pemasukan Dompet" rows={walletIncomeExpandableRows} />
            <SectionCard title="Pengeluaran Dompet" rows={sections.walletExpenseRows} />
          </div>
        )}
      </div>
    </main>
  );
}
