// =================================================================
// PASTIKAN LINK INI BENAR
const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGyZmd8oN7ZX__52lX-xQVI1u8MXqNpaEbVWtjVBUUc1E9mK4sl-AQ_4jtaf-qxdhrjP-HmW8ao2li/pub?output=csv"; // <- add output=csv for proper CSV download
// =================================================================

let rawData = [];
let todayData = [];

window.onload = function () {
    // Tampilkan tanggal hari ini di UI
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    document.getElementById("currentDateDisplay").innerText = new Date().toLocaleDateString("id-ID", options);

    console.log("Memulai proses ambil data...");
    fetchData();
};

function fetchData() {
    Papa.parse(SHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            console.log("✅ Data berhasil ditarik dari Google Sheet!");
            console.log("Contoh data baris pertama:", results.data[0]);

            rawData = results.data;

            // Cek nama kolom
            if (rawData.length > 0) {
                const keys = Object.keys(rawData[0]);
                if (!keys.includes("WAKTU") || !keys.includes("TRANSAKSI")) {
                    alert(
                        "⚠️ Error: Nama kolom di Sheet tidak sesuai! Script mencari: WAKTU, TRANSAKSI, PETUGAS, NOMINAL. \nYang ditemukan: " +
                            keys.join(", ")
                    );
                }
            }

            filterTodayData();
            populateTellers();

            document.getElementById("loading").style.display = "none";
            document.getElementById("dashboardContent").style.display = "block";

            applyCalculation();
        },
        error: function (err) {
            alert("❌ Gagal mengambil data. Cek Link CSV atau Koneksi Internet.");
            console.error(err);
        },
    });
}

// --- PARSING TANGGAL LEBIH KUAT (UNIVERSAL) ---
function parseUniversalDate(dateStr) {
    if (!dateStr) return null;

    // Hapus spasi berlebih
    dateStr = dateStr.trim();

    // Pisahkan Jam (jika ada)
    let datePart = dateStr.split(" ")[0];
    let timePart = dateStr.split(" ")[1] || "00:00:00";

    let day, month, year;

    // Cek format: Apakah mengandung "/" (25/11/2025) atau "-" (2025-11-25)
    if (datePart.includes("/")) {
        // Asumsi Format Indo/Inggris: DD/MM/YYYY
        const parts = datePart.split("/");
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1; // JS bulan mulai 0
        year = parseInt(parts[2]);
    } else if (datePart.includes("-")) {
        // Asumsi Format ISO: YYYY-MM-DD
        const parts = datePart.split("-");
        // Cek mana yang tahun (4 digit)
        if (parts[0].length === 4) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
        } else {
            // Kasus langka: DD-MM-YYYY
            day = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            year = parseInt(parts[2]);
        }
    } else {
        return new Date(dateStr); // Serahkan ke JS bawaan
    }

    // Ambil Jam Menit Detik
    const timeParts = timePart.split(":");
    const hour = parseInt(timeParts[0]) || 0;
    const minute = parseInt(timeParts[1]) || 0;
    const second = parseInt(timeParts[2]) || 0;

    const resultDate = new Date(year, month, day, hour, minute, second);

    // Validasi apakah tanggal valid
    if (isNaN(resultDate.getTime())) return null;

    return resultDate;
}

function filterTodayData() {
    const today = new Date();

    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0"); // +1 because getMonth() is 0-based
    const todayDay = String(today.getDate()).padStart(2, "0");
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    console.log(`🔎 Memfilter data untuk tanggal hari ini: ${today.toLocaleDateString()}`);
    console.log(`Format perbandingan: ${todayStr}`);

    todayData = rawData.filter((row) => {
        if (!row.WAKTU) return false;

        const rowDateObj = parseUniversalDate(row.WAKTU);

        if (!rowDateObj) {
            console.warn(`⚠️ Gagal membaca tanggal pada baris:`, row);
            return false;
        }

        const rowYear = rowDateObj.getFullYear();
        const rowMonth = String(rowDateObj.getMonth() + 1).padStart(2, "0");
        const rowDay = String(rowDateObj.getDate()).padStart(2, "0");
        const rowDateStr = `${rowYear}-${rowMonth}-${rowDay}`;

        console.log(`Cek: Sheet(${rowDateStr}) vs HariIni(${todayStr}) - Match: ${rowDateStr === todayStr}`);

        return rowDateStr === todayStr;
    });

    console.log(`📊 Total data ditemukan untuk hari ini: ${todayData.length} baris.`);
    if (todayData.length === 0) {
        console.warn("⚠️ Tidak ada data yang cocok dengan tanggal hari ini. Cek apakah tanggal di Google Sheet sudah update?");
    }
}

function populateTellers() {
    const tellers = new Set();
    todayData.forEach((row) => {
        if (row.PETUGAS) tellers.add(row.PETUGAS.trim());
    });

    const select = document.getElementById("filterTeller");
    select.innerHTML = '<option value="All">Semua Petugas</option>';
    Array.from(tellers)
        .sort()
        .forEach((teller) => {
            const option = document.createElement("option");
            option.value = teller;
            option.text = teller;
            select.appendChild(option);
        });
}

function applyCalculation() {
    const modalAwal = parseFloat(document.getElementById("inputModal").value) || 0;
    const selectedShift = document.getElementById("filterShift").value;
    const selectedTeller = document.getElementById("filterTeller").value;

    const finalData = todayData.filter((row) => {
        const rowDateObj = parseUniversalDate(row.WAKTU);

        // 1. Filter Teller
        if (selectedTeller !== "All" && row.PETUGAS !== selectedTeller) return false;

        // 2. Filter Shift (Logic Menit)
        const currentMinutes = rowDateObj.getHours() * 60 + rowDateObj.getMinutes();

        if (selectedShift === "Pagi") return currentMinutes >= 360 && currentMinutes <= 720;
        if (selectedShift === "Siang") return currentMinutes >= 730 && currentMinutes <= 1080;
        if (selectedShift === "Malam") return currentMinutes >= 1140 && currentMinutes <= 1380;

        return true;
    });

    updateUI(finalData, modalAwal);
}

function updateUI(data, modal) {
    let totalMasuk = 0;
    let totalKeluar = 0;
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    data
        .slice()
        .reverse()
        .forEach((row) => {
            // Bersihkan nominal dari Rp dan titik
            let cleanNominal = row.NOMINAL.toString().replace(/[^0-9]/g, "");
            let amount = parseFloat(cleanNominal) || 0;

            const jenis = row.TRANSAKSI.toUpperCase();
            let isMasuk = false;
            let labelClass = "";

            if (jenis.includes("TOP UP") || jenis.includes("SETOR")) {
                totalMasuk += amount;
                isMasuk = true;
                labelClass = "tag-in";
            } else if (jenis.includes("CASH OUT") || jenis.includes("PENARIKAN") || jenis.includes("TARIK")) {
                totalKeluar += amount;
                isMasuk = false;
                labelClass = "tag-out";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.WAKTU.split(" ")[1]}</td> 
                <td>${row.PETUGAS}</td>
                <td><span class="tag ${labelClass}">${row.TRANSAKSI}</span></td>
                <td style="font-weight:bold; color: ${isMasuk ? "var(--success)" : "var(--danger)"}">
                    ${formatRupiah(amount)}
                </td>
            `;
            tbody.appendChild(tr);
        });

    const saldoAkhir = modal + totalMasuk - totalKeluar;

    document.getElementById("finalBalance").innerText = formatRupiah(saldoAkhir);
    document.getElementById("totalIn").innerText = formatRupiah(totalMasuk);
    document.getElementById("totalOut").innerText = formatRupiah(totalKeluar);
    document.getElementById("totalCount").innerText = data.length + " Trx";

    if (data.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align:center; padding:20px;">Belum ada data di shift/filter ini. <br><small>Coba ubah filter Shift menjadi "Semua Jam"</small></td></tr>';
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
}
