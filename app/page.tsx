"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ReportViewToggle } from "@/components/report-view-toggle";
import {
  type ApiResponse,
  type ExpandableMetricRow,
  type MetricRow,
  type ReservationState,
  type SummaryData,
  REPORT_BASE_URL,
  REPORT_BEARER_TOKEN,
  createRows,
  formatCurrency,
  formatDateForInput,
  formatNumber,
} from "@/lib/report-summary";

const baseUrl = REPORT_BASE_URL;
const bearerToken = REPORT_BEARER_TOKEN;

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <CardTitle className="text-lg">Laporan Detail</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Laporan tanggal:{" "}
                  <span className="font-medium text-red-600">
                    {new Date(startDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} -{" "}
                    {new Date(endDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </p>
              </div>
              <ReportViewToggle />
            </div>
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

        {sections && data && (
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
