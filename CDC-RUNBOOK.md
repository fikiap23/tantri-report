# CDC Runbook — GitOps (lokal + production)

Urutan deploy sampai pipeline CDC jalan:

```text
BE-TS Postgres (wal_level=logical)
  → tantri-kafka + tantri-kafka-connect
  → publication tantri_mps_pub
  → register-connector.sh
  → tunggu initial snapshot
  → mongodb-mps
  → tantri-debezium-production (relay)
  → tantri-backend-mps-go (blue)
  → verifikasi
```

Semua path di bawah relatif dari root repo **`gitops/`**.

| Step | Folder |
|------|--------|
| Postgres + Redis (dari root compose; jangan up service app root) | `production/tantri/services/tantri-backend-ts` |
| BE-TS app (yang dipakai) | `.../tantri-backend-ts/blue` atau `.../green` |
| Kafka broker | `tantri-kafka/production` |
| Kafka Connect + CDC scripts | `tantri-kafka-connect/production` |
| Mongo MPS | `tantri-database/tantri-database-mongodb-mps/production` |
| Relay | `tantri-debezium/production` |
| MPS app | `tantri-backend-mps-go/production/blue` |

**Aturan keras**

- Jangan start **relay** sebelum **semua** topic CDC ada di Kafka (`tantri.cdc.public.Order`, `Cafe`, `WalletsBalance`, dll.) — jangan hanya tunggu Order.
- Jangan start **MPS** sebelum topic `order-upsert` punya offset > 0.
- Container MPS production: `tantri-backend-mps-go-blue-production` (bukan `tantri-backend-mps-blue-production`).
- `TANTRI_JWT_SECRETKEY` di MPS harus sama dengan `JWT_SECRET` di BE-TS.
- Catch-up cepat: `TANTRI_RELAY_ORDERDEBOUNCE=0s` + resource relay cukup (lihat `tantri-debezium/production`).
- Update relay saat catch-up masih jalan: ikuti **§D** (jangan reset fresh).

---

## A. Ringkasan alur (sama lokal & prod)

```mermaid
flowchart LR
  pg[Postgres_TS] -->|WAL| connect[kafka_connect]
  connect -->|tantri.cdc.public| kafka[tantri_kafka]
  relay[tantri_debezium_production] -->|consume_cdc| kafka
  relay -->|legacy_topics| kafka
  mps[tantri_backend_mps_go_blue] -->|consume_legacy| kafka
  mps --> mongo[mongodb_mps]
```

---

## B. Cara run di lokal (GitOps compose + image dari Dockerfile)

Tujuan: pakai **folder compose GitOps production** yang sama, tapi **image app di-build lokal dari Dockerfile** (tag `:blue-production` / `:production`) — **bukan** `docker pull` registry. Hostname Docker resolve ke container lokal saja; **tidak menyentuh DB server production**.

### B.1 Build image dari Dockerfile

Dari root monorepo `backend/` (sejajar dengan `gitops/`):

```bash
docker build -t registry.gitlab.com/tantri-project/tantri-backend-ts:blue-production \
  -f tantri-backend-ts/build/Dockerfile.production tantri-backend-ts
# optional standby:
# docker tag registry.gitlab.com/tantri-project/tantri-backend-ts:blue-production \
#   registry.gitlab.com/tantri-project/tantri-backend-ts:green-production

docker build -t registry.gitlab.com/tantri-project/tantri-debezium:production \
  -f tantri-debezium/build/Dockerfile tantri-debezium

docker build -t registry.gitlab.com/tantri-project/tantri-mps:blue-production \
  -f tantri-backend-mps-go/build/Dockerfile.production tantri-backend-mps-go
```

Infra tetap image publik: `postgres:14`, `redis:7.4-alpine`, `mongo:6.0`, `bitnamilegacy/kafka:...`, `debezium/connect:...`.

### B.2 Prasyarat lokal

```bash
docker network create sasanadigital-network 2>/dev/null || true

# Path volume (pakai Docker jika sudo tidak tersedia)
docker run --rm -v /:/host alpine:3.20 sh -c '
mkdir -p \
  /host/datadrive/tantri/volumes/tantri-data-postgre-production-volumes \
  /host/datadrive/tantri/volumes/tantri-backend-production-volumes/public \
  /host/datadrive/volumes/tantri-database-redis-production/data \
  /host/datadrive/volumes/tantri-kafka-production \
  /host/datadrive/volumes/tantri-database-mongodb-production \
  /host/datadrive/volumes/tantri-database-mongodb-mps-production
cat > /host/datadrive/volumes/tantri-database-redis-production/redis.conf <<EOF
bind 0.0.0.0
protected-mode no
appendonly yes
EOF
chmod -R a+rwX /host/datadrive
'
```

Pastikan `.env` di **blue/** (atau green/) lengkap. Up juga Mongo TS:

```bash
cd gitops/tantri-database/tantri-database-mongodb/production
docker compose --env-file .env up -d tantri-database-mongodb-production
```

**Peringatan lokal:** `.env` blue/green berisi URL/API key production — jangan trigger payment/bot. DB tetap lokal.

### B.3 Urutan perintah lokal (GitOps)

Dari root `gitops/`:

```bash
# 1a) Postgres + Redis saja (root compose masih berisi service app — JANGAN up app root;
#     app yang dipakai = blue/green, bentrok PORT_BE jika keduanya jalan)
cd production/tantri/services/tantri-backend-ts
docker compose --env-file .env up -d tantri-postgre-db-production tantri-database-redis-production
# Jika Postgres sudah jalan tanpa wal_level:
# docker compose --env-file .env up -d --force-recreate tantri-postgre-db-production
docker exec tantri-postgre-db-production \
  psql -U tantri_postgresql_production -d tantri_production -tAc "SHOW wal_level;"
# harus: logical

# 1b) BE-TS app — blue (atau green)
cd blue
docker compose --env-file .env up -d
cd ..

# 2) Kafka broker
cd ../../../../tantri-kafka/production
docker compose up -d
until docker exec tantri-kafka-production kafka-topics.sh --bootstrap-server localhost:9092 --list >/dev/null 2>&1; do sleep 3; done

# 2b) Kafka Connect
cd ../tantri-kafka-connect/production
docker compose up -d
until docker exec tantri-kafka-connect-production curl -sf http://localhost:8083/connectors >/dev/null; do sleep 3; done

# 3) Publication (sering sudah dibuat entrypoint TS; aman di-run ulang)
docker exec -i tantri-postgre-db-production \
  psql -U tantri_postgresql_production -d tantri_production <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'tantri_mps_pub') THEN
    CREATE PUBLICATION tantri_mps_pub FOR TABLE
      "Order", "ProductOrder", "SplitBill",
      "CafeLogCredit", "Cafe", "CafeLog",
      "User", "OfficeOnCafe",
      "WalletsBalance", "Reservation", "WastedStock";
  END IF;
END $$;
SELECT pubname FROM pg_publication WHERE pubname = 'tantri_mps_pub';
SQL

# 4) Register Debezium connector
./register-connector.sh

# 5) Tunggu snapshot — auto-exit saat RUNNING + SEMUA topic CDC ada
#    (Order saja tidak cukup — start relay terlalu awal mematikan reader Cafe/Wallets)
#    DB kosong: topic Order mungkin belum ada; cukup connector+task RUNNING.
while true; do
  echo "==== $(date) ===="
  status=$(docker exec tantri-kafka-connect-production curl -sf \
    http://localhost:8083/connectors/tantri-postgres-connector/status 2>/dev/null || echo '{}')
  echo "$status" | head -c 500; echo
  offsets=$(docker exec tantri-kafka-production kafka-get-offsets.sh \
    --bootstrap-server localhost:9092 --topic tantri.cdc.public.Order 2>/dev/null || true)
  echo "$offsets"
  cstate=$(printf '%s' "$status" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
  tstate=$(printf '%s' "$status" | grep -o '"state":"[^"]*"' | tail -1 | cut -d'"' -f4)
  sum=$(echo "$offsets" | awk -F: '{s+=$3} END{print s+0}')
  pg_orders=$(docker exec tantri-postgre-db-production \
    psql -U tantri_postgresql_production -d tantri_production -tAc \
    'SELECT COUNT(*) FROM "Order";' 2>/dev/null | tr -d '[:space:]' || echo 0)
  if [ "$cstate" = "FAILED" ] || [ "$tstate" = "FAILED" ]; then
    echo "ERROR: connector/task FAILED — cek docker logs tantri-kafka-connect-production"; exit 1
  fi
  if [ "$cstate" = "RUNNING" ] && [ "$tstate" = "RUNNING" ]; then
    if [ "${sum:-0}" -gt 0 ] || [ "${pg_orders:-0}" -eq 0 ]; then
      echo "Snapshot OK (connector RUNNING, Order kafka=${sum} pg=${pg_orders}) — lanjut step 6."
      break
    fi
  fi
  sleep 15
done

# 6) Mongo MPS
cd ../../../tantri-database/tantri-database-mongodb-mps/production
docker compose --env-file .env up -d

# 6b) Buat topic legacy SEBELUM start relay (wajib — relay tidak auto-create)
cd ../../../tantri-kafka-connect/production
for topic in order-upsert order-delete cafe-log-credit-upsert cafe-upsert \
  cafe-status-log-upsert wallets-balance-upsert reservation-upsert \
  wasted-stock-upsert office-on-cafe-upsert; do
  docker exec tantri-kafka-production kafka-topics.sh --bootstrap-server localhost:9092 \
    --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1
done

# 7) Relay (setelah Connect RUNNING + legacy topics ada)
cd ../tantri-debezium/production
docker compose --env-file .env up -d
sleep 5
docker exec tantri-kafka-production kafka-get-offsets.sh \
  --bootstrap-server localhost:9092 --topic order-upsert
# harus offset total > 0 jika Postgres punya Order; kalau Unknown Topic → ulang step 6b + docker restart tantri-debezium-production

# 8) MPS
cd ../tantri-backend-mps-go/production/blue
docker compose --env-file .env up -d

# 9) Verifikasi
curl -s http://localhost:8085/health
docker logs --tail 30 tantri-debezium-production
docker logs --tail 30 tantri-backend-mps-go-blue-production
```

### B.4 Down lokal (hentikan stack GitOps lokal)

Dari root `gitops/`. Urutan: app CDC dulu, lalu BE-TS, lalu DB (opsional).

**A) Stop cepat (container tetap ada, `docker start` bisa lanjut):**

```bash
docker stop tantri-backend-mps-go-blue-production tantri-debezium-production \
  tantri-kafka-connect-production tantri-kafka-production \
  tantri-backend-ts-blue-production \
  tantri-database-mongodb-mps-production 2>/dev/null || true
# Postgres/Redis/Mongo TS biarkan hidup jika masih dipakai
```

**B) Compose down penuh (hapus container; volume `/datadrive/...` tetap):**

```bash
# 1) CDC apps
cd tantri-backend-mps-go/production/blue
docker compose --env-file .env down

cd ../../tantri-debezium/production
docker compose --env-file .env down

cd ../tantri-kafka-connect/production
docker compose down

cd ../tantri-kafka/production
docker compose down

# 2) Mongo MPS
cd ../../../../tantri-database/tantri-database-mongodb-mps/production
docker compose --env-file .env down

# 3) BE-TS blue (atau green)
cd ../../../production/tantri/services/tantri-backend-ts/blue
docker compose --env-file .env down
# cd ../green && docker compose --env-file .env down

# 4) Postgres + Redis (root compose — jangan lupa hanya service DB)
cd ..
docker compose --env-file .env down

# 5) Mongo TS (opsional; dari services/tantri-backend-ts → naik 4 level ke gitops/)
cd ../../../../tantri-database/tantri-database-mongodb/production
docker compose --env-file .env down
```

**C) Bersih CDC sebelum down (slot/publication/topic/Mongo MPS wipe):**

```bash
cd tantri-kafka-connect/production
./uninstall-cdc.sh
# lalu lanjut §B.4 B) compose down
```

**D) Opsional — wipe volume lokal (data hilang; hati-hati):**

```bash
docker run --rm -v /:/host alpine:3.20 sh -c '
rm -rf \
  /host/datadrive/volumes/tantri-kafka-production/* \
  /host/datadrive/volumes/tantri-database-mongodb-mps-production/*
# Postgres seed ikut hilang jika di-uncomment:
# rm -rf /host/datadrive/tantri/volumes/tantri-data-postgre-production-volumes/*
'
```

Setelah down, naikkan lagi dengan urutan §B.3.

---

## C. Cara run di server production (GitOps)

Jalankan **hanya di server production**. Ini menulis ke volume `/datadrive/...` dan DB real.

### C.1 Prasyarat production

1. Maintenance window untuk recreate Postgres (`wal_level=logical`) — BE-TS sempat putus DB.
2. Backup Postgres:

```bash
docker exec tantri-postgre-db-production \
  pg_dump -Fc -U tantri_postgresql_production -d tantri_production \
  > tantri-pre-cdc-$(date +%Y%m%d-%H%M).dump
ls -lh tantri-pre-cdc-*.dump
```

3. Image `:blue-production` / `:green-production` (BE-TS, MPS), `:production` (debezium) sudah di registry; path `/datadrive/...` sudah ada di server.
4. Network: `docker network create sasanadigital-network` (skip jika ada).

### C.2 Urutan perintah production

Dari root `gitops/` di server (biasanya `/datadrive/gitops` atau clone setara):

```bash
# 1a) Postgres + Redis saja dari root (jangan up service tantri-backend-ts di root)
cd production/tantri/services/tantri-backend-ts
docker compose --env-file .env up -d tantri-postgre-db-production tantri-database-redis-production
# Jika container Postgres sudah ada sebelum patch wal_level:
docker compose --env-file .env up -d --force-recreate tantri-postgre-db-production
docker exec tantri-postgre-db-production \
  psql -U tantri_postgresql_production -d tantri_production -tAc "SHOW wal_level;"
# harus: logical

# 1b) Restart BE-TS yang aktif (blue ATAU green)
docker restart tantri-backend-ts-blue-production
# atau: docker restart tantri-backend-ts-green-production

# 2) Kafka broker
mkdir -p /datadrive/volumes/tantri-kafka-production
cd ../../../../tantri-kafka/production
docker compose up -d
until docker exec tantri-kafka-production kafka-topics.sh --bootstrap-server localhost:9092 --list >/dev/null 2>&1; do sleep 5; done

# 2b) Kafka Connect
cd ../tantri-kafka-connect/production
docker compose up -d
until docker exec tantri-kafka-connect-production curl -sf http://localhost:8083/connectors >/dev/null; do sleep 3; done

# 3) Publication
docker exec -i tantri-postgre-db-production \
  psql -U tantri_postgresql_production -d tantri_production <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'tantri_mps_pub') THEN
    CREATE PUBLICATION tantri_mps_pub FOR TABLE
      "Order", "ProductOrder", "SplitBill",
      "CafeLogCredit", "Cafe", "CafeLog",
      "User", "OfficeOnCafe",
      "WalletsBalance", "Reservation", "WastedStock";
  END IF;
END $$;
SQL

# 4) Register connector (memulai initial snapshot)
./register-connector.sh

# 5) Pantau snapshot — auto-exit; JANGAN start relay/MPS sebelum loop ini break
while true; do
  echo "==== $(date) ===="
  status=$(docker exec tantri-kafka-connect-production curl -sf \
    http://localhost:8083/connectors/tantri-postgres-connector/status 2>/dev/null || echo '{}')
  echo "$status" | head -c 500; echo
  offsets=$(docker exec tantri-kafka-production kafka-get-offsets.sh \
    --bootstrap-server localhost:9092 --topic tantri.cdc.public.Order 2>/dev/null || true)
  echo "$offsets"
  cstate=$(printf '%s' "$status" | grep -o '"state":"[^"]*"' | head -1 | cut -d'"' -f4)
  tstate=$(printf '%s' "$status" | grep -o '"state":"[^"]*"' | tail -1 | cut -d'"' -f4)
  sum=$(echo "$offsets" | awk -F: '{s+=$3} END{print s+0}')
  pg_orders=$(docker exec tantri-postgre-db-production \
    psql -U tantri_postgresql_production -d tantri_production -tAc \
    'SELECT COUNT(*) FROM "Order";' 2>/dev/null | tr -d '[:space:]' || echo 0)
  if [ "$cstate" = "FAILED" ] || [ "$tstate" = "FAILED" ]; then
    echo "ERROR: connector/task FAILED — cek docker logs tantri-kafka-connect-production"; exit 1
  fi
  if [ "$cstate" = "RUNNING" ] && [ "$tstate" = "RUNNING" ]; then
    if [ "${sum:-0}" -gt 0 ] || [ "${pg_orders:-0}" -eq 0 ]; then
      echo "Snapshot OK (connector RUNNING, Order kafka=${sum} pg=${pg_orders}) — lanjut step 6."
      break
    fi
  fi
  sleep 15
done

# 6) Mongo MPS (skip jika sudah jalan)
cd ../../../tantri-database/tantri-database-mongodb-mps/production
docker compose --env-file .env up -d

# 6b) Buat topic legacy SEBELUM start relay (wajib)
cd ../../../tantri-kafka-connect/production
for topic in order-upsert order-delete cafe-log-credit-upsert cafe-upsert \
  cafe-status-log-upsert wallets-balance-upsert reservation-upsert \
  wasted-stock-upsert office-on-cafe-upsert; do
  docker exec tantri-kafka-production kafka-topics.sh --bootstrap-server localhost:9092 \
    --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1
done

# 7) Relay
cd ../tantri-debezium/production
docker compose --env-file .env up -d
sleep 5
docker logs --tail 30 tantri-debezium-production
docker exec tantri-kafka-production kafka-get-offsets.sh \
  --bootstrap-server localhost:9092 --topic order-upsert
# Stop di sini jika order-upsert masih 0 / Unknown Topic (ulang 6b + restart relay)

# 8) MPS
cd ../tantri-backend-mps-go/production/blue
docker compose --env-file .env up -d

# 9) Verifikasi
curl -s http://localhost:8085/health
docker exec tantri-kafka-connect-production curl -s \
  http://localhost:8083/connectors/tantri-postgres-connector/status
```

**Blue/green BE-TS:** App aktif di `blue/` atau `green/`. Root compose tetap berisi service app lama (`tantri-backend-ts-production`) — **jangan di-up** bareng blue/green (bentrok `PORT_BE`). Up root hanya `tantri-postgre-db-production` + `tantri-database-redis-production` (dengan `wal_level=logical`).

### C.3 Pastikan data sudah sinkron (count PG vs Mongo MPS)

Jalankan setelah MPS up. Semua baris harus `OK` (count sama).

```bash
MONGO_USER=$(docker exec tantri-database-mongodb-mps-production printenv MONGO_INITDB_ROOT_USERNAME)
MONGO_PASS=$(docker exec tantri-database-mongodb-mps-production printenv MONGO_INITDB_ROOT_PASSWORD)
MONGO_DB=$(docker exec tantri-database-mongodb-mps-production printenv MONGO_INITDB_DATABASE)
MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:27017/${MONGO_DB}?authSource=admin"

printf '%-16s %8s %8s %s\n' "entity" "pg" "mongo" "ok?"
for pair in 'Cafe|Cafe' 'OfficeOnCafe|OfficeOnCafe' 'Order|Order' 'WalletsBalance|WalletsBalance'; do
  pg_table="${pair%%|*}"
  mongo_col="${pair##*|}"
  pg=$(docker exec tantri-postgre-db-production \
    psql -U tantri_postgresql_production -d tantri_production -tAc \
    "SELECT COUNT(*) FROM \"${pg_table}\";" 2>/dev/null | tr -d '[:space:]')
  mongo=$(docker exec tantri-database-mongodb-mps-production mongosh "$MONGO_URI" --quiet --eval \
    "db.getCollection('${mongo_col}').countDocuments()" 2>/dev/null | tr -d '[:space:]')
  if [ "${pg:-0}" = "${mongo:-0}" ]; then mark=OK; else mark=DIFF; fi
  printf '%-16s %8s %8s %s\n' "$pg_table" "${pg:-?}" "${mongo:-?}" "$mark"
done
```

Kalau ada `DIFF`: tunggu sebentar lalu ulang. Tetap beda → cek relay/MPS logs atau `./reset-cdc-fresh.sh`.

---

## D. Deploy update relay (tanpa reset — catch-up aman)

Pakai ini kalau relay/MPS **sudah jalan** (termasuk sedang catch-up snapshot) dan kamu hanya mau update:

- image relay (kode Go: retry reader, debounce, dll.)
- `.env` / resource compose (`ORDERDEBOUNCE`, `MAXCONNS`, CPU/RAM)

**Jangan** jalankan `./reset-cdc-fresh.sh` di sini. Reset menghapus topic CDC/legacy, consumer group, dan Mongo MPS → catch-up ulang dari nol.

Restart / `compose up --force-recreate` **tidak** menghapus offset consumer group. Relay lanjut dari posisi terakhir.

### D.1 Apa yang di-deploy

| Artefak | Path | Perlu recreate container? |
|---------|------|---------------------------|
| Image relay | `registry.gitlab.com/tantri-project/tantri-debezium:production` | Ya (pull + up) |
| Env relay | `gitops/tantri-debezium/production/.env` | Ya |
| Resource | `gitops/tantri-debezium/production/docker-compose.yml` | Ya |
| Script reset | `gitops/tantri-kafka-connect/production/reset-cdc-fresh.sh` | Tidak (hanya sync file; **jangan dijalankan** kecuali memang mau wipe) |

Env yang disarankan saat catch-up:

```env
TANTRI_RELAY_ORDERDEBOUNCE=0s
TANTRI_POSTGRES_MAXCONNS=40
```

### D.2 Build & push image (lokal / CI)

Dari monorepo `backend/` (sejajar `gitops/`):

```bash
cd tantri-debezium
docker build -t registry.gitlab.com/tantri-project/tantri-debezium:production \
  -f build/Dockerfile .
docker push registry.gitlab.com/tantri-project/tantri-debezium:production
```

Atau pakai pipeline GitLab yang biasa dipakai tim (tag `:production`).

### D.3 Sync GitOps di server

Pastikan server punya commit/file terbaru untuk:

- `gitops/tantri-debezium/production/.env`
- `gitops/tantri-debezium/production/docker-compose.yml`
- (opsional) `gitops/tantri-kafka-connect/production/reset-cdc-fresh.sh` — sync saja, jangan run

### D.4 Recreate relay di server

```bash
cd gitops/tantri-debezium/production

docker compose --env-file .env pull
docker compose --env-file .env up -d --force-recreate
```

Cek env masuk:

```bash
docker exec tantri-debezium-production printenv TANTRI_RELAY_ORDERDEBOUNCE
# diharapkan: 0s
```

Kalau setelah recreate group Cafe masih tanpa member:

```bash
docker restart tantri-debezium-production
sleep 8
```

MPS (`tantri-backend-mps-go-blue-production`) **tidak wajib** di-restart kecuali sempat error Mongo / salah nama container.

### D.5 Verifikasi setelah deploy

```bash
# 1) Semua reader relay hidup (harus ada relay@ di CONSUMER-ID)
for g in Order Cafe WalletsBalance ProductOrder SplitBill OfficeOnCafe User; do
  echo "=== $g ==="
  docker exec tantri-kafka-production kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 \
    --group "tantri-debezium--tantri.cdc.public.$g" --describe 2>/dev/null | head -4
done

# 2) Legacy Cafe harus naik (kalau sebelumnya 0 karena reader mati)
docker exec tantri-kafka-production kafka-get-offsets.sh \
  --bootstrap-server localhost:9092 --topic cafe-upsert

# 3) Lag Order turun (catch-up lanjut, bukan dari 0)
docker exec tantri-kafka-production kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group 'tantri-debezium--tantri.cdc.public.Order' --describe

# 4) Log bersih
docker logs --tail 30 tantri-debezium-production
```

Sukses jika:

- Group Cafe / Wallets / Order punya member `relay@...`
- `cafe-upsert` offset > 0 dalam beberapa menit
- `CURRENT-OFFSET` Order **lanjut** dari sebelum recreate (bukan kembali ke 0)
- Tidak ada error auth Postgres berulang

### D.6 Yang tidak boleh saat catch-up

| Jangan | Akibat |
|--------|--------|
| `./reset-cdc-fresh.sh` | Wipe topic + Mongo → ulang 1.8M+ row |
| Hapus consumer group `tantri-debezium--*` | Offset hilang → replay ulang |
| Wipe Mongo MPS (`dropDatabase`) | Progress Order/Cafe yang sudah masuk hilang |
| Start relay sebelum semua topic CDC ada | Reader Cafe/Wallets mati diam-diam (hanya Order hidup) |

Kalau memang perlu wipe penuh (data corrupt / publication rusak), baru pakai §E reset fresh — dan pastikan script yang sudah tunggu **semua** topic CDC.

---

## E. Verifikasi & rollback

### Checklist sukses

| Cek | Perintah / ekspektasi |
|-----|------------------------|
| `wal_level` | `logical` |
| Connector | state `RUNNING`, task `RUNNING` |
| Topic CDC | Semua `tantri.cdc.public.*` (Order, Cafe, WalletsBalance, …) ada di broker |
| Relay consumers | Group `tantri-debezium--tantri.cdc.public.Cafe` (dan Order) punya `CONSUMER-ID` |
| Topic legacy | `order-upsert` / `cafe-upsert` offset > 0 |
| Relay | log tanpa error auth Postgres / unknown topic |
| MPS | `curl http://localhost:8085/health` OK — container `tantri-backend-mps-go-blue-production` |
| JWT | `TANTRI_JWT_SECRETKEY` = `JWT_SECRET` TS |

### Rollback cepat (hentikan CDC app, DB TS tetap hidup)

```bash
docker stop tantri-backend-mps-go-blue-production tantri-debezium-production 2>/dev/null || true
docker stop tantri-kafka-connect-production tantri-kafka-production 2>/dev/null || true
```

### Reset CDC fresh (wipe + snapshot ulang)

**Server / GitOps:**

```bash
cd gitops/tantri-kafka-connect/production
./reset-cdc-fresh.sh
```

Wipe connector/slot/publication/topic + Mongo MPS, recreate publication, register connector, tunggu **semua** topic CDC ada, buat legacy topics, start relay & MPS, verifikasi consumer Cafe+Order. Kafka/Connect tetap dipakai (tidak di-compose-down).

Soft reset (tanpa wipe Mongo / drop publication): hapus connector lalu `./register-connector.sh`, atau lokal `make reset-cdc`.

### Uninstall CDC (permanen)

**Server / GitOps (tanpa source `tantri-backend-ts`):** script di folder yang sama dengan `register-connector.sh`. Host punya Docker CLI; script `docker exec` ke container.

```bash
cd gitops/tantri-kafka-connect/production
./uninstall-cdc.sh
```

Itu menghapus connector, slot, publication, topic Kafka CDC/legacy, wipe Mongo MPS, lalu stop relay/MPS/Kafka/Connect. Postgres TS + Redis tetap hidup.

Opsional — hapus container dari compose (script hanya `docker stop`):

```bash
cd gitops/tantri-kafka-connect/production && docker compose down
cd ../tantri-debezium/production && docker compose --env-file .env down
cd ../tantri-backend-mps-go/production/blue && docker compose --env-file .env down
cd ../tantri-kafka/production && docker compose down
```

**Lokal dengan source TS saja:** `cd tantri-backend-ts && make uninstall-cdc` / `make reset-cdc-fresh`. Di server production jangan andalkan path ini.

Catatan `wal_level`: setelah uninstall masih `logical` di compose. Revert ke `replica` = hapus `command:` `wal_level=logical` di root compose TS lalu `--force-recreate` Postgres.

### Troubleshooting singkat

| Gejala | Fix |
|--------|-----|
| Connector FAILED | Cek `wal_level`, publication, password; jalankan ulang `register-connector.sh` |
| Snapshot offset 0 lama | `docker logs -f tantri-kafka-connect-production` |
| Relay auth / pgx error | `TANTRI_POSTGRES_URL` harus `sslmode=disable`, tanpa `?schema=public`; `@` di password = `%40` |
| MPS JWT invalid | Samakan secret dengan TS |
| Mongo kosong | MPS start terlalu awal — stop MPS, pastikan `order-upsert` > 0, start lagi |
| Relay `Unknown Topic Or Partition` | Buat topic legacy dulu (§ step 6b), lalu `docker restart tantri-debezium-production` |
| Hanya group Order punya `CONSUMER-ID`; Cafe/Wallets kosong | Relay start sebelum semua topic CDC ada — `docker restart tantri-debezium-production`; pastikan script tunggu semua `tantri.cdc.public.*` |
| `cafe-upsert` = 0 padahal CDC Cafe > 0 | Sama: reader Cafe mati — restart relay; cek `kafka-consumer-groups ...Cafe --describe` |
| Catch-up Order sangat lambat | Set `TANTRI_RELAY_ORDERDEBOUNCE=0s`, naikkan CPU/RAM relay, `TANTRI_POSTGRES_MAXCONNS=40`; deploy via **§D** — **jangan** reset fresh |
| Container MPS not found | Pakai `tantri-backend-mps-go-blue-production` |
| `/datadrive` missing (lokal) | Buat path di §B.1 |
