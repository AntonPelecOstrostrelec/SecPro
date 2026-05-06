// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', function() {
  lucide.createIcons();
  restoreSidebarState();
  if (typeof updateHomeStats === 'function') updateHomeStats();
  // Allow decimal comma in all number inputs — convert comma to dot
  document.addEventListener('keydown', function(e) {
    if (e.key === ',' && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.preventDefault();
      const inp = e.target;
      inp.type = 'text';
      const pos = inp.selectionStart || inp.value.length;
      if (inp.value.indexOf('.') === -1) {
        inp.value = inp.value.slice(0, pos) + '.' + inp.value.slice(pos);
        inp.setSelectionRange(pos + 1, pos + 1);
      }
      function restore() {
        inp.type = 'number';
        inp.removeEventListener('blur', restore);
      }
      inp.addEventListener('blur', restore);
    }
  });
});

// ==================== NAVIGATION ====================
function toggleSection(titleEl) {
  const section = titleEl.nextElementSibling;
  if (!section || !section.classList.contains('sidebar-section')) return;
  titleEl.classList.toggle('collapsed');
  section.classList.toggle('collapsed');

  // Save collapse state to localStorage
  const sectionName = titleEl.getAttribute('data-section');
  if (sectionName) {
    const states = JSON.parse(localStorage.getItem('secpro-sidebar-state') || '{}');
    states[sectionName] = titleEl.classList.contains('collapsed');
    localStorage.setItem('secpro-sidebar-state', JSON.stringify(states));
  }
}

function restoreSidebarState() {
  const states = JSON.parse(localStorage.getItem('secpro-sidebar-state') || '{}');
  Object.keys(states).forEach(function(sectionName) {
    if (states[sectionName]) {
      const titleEl = document.querySelector('.sidebar-title[data-section="' + sectionName + '"]');
      if (titleEl) {
        titleEl.classList.add('collapsed');
        var section = titleEl.nextElementSibling;
        if (section) section.classList.add('collapsed');
      }
    }
  });
}

function showPage(id) {
  // Legacy redirect: Klienti page merged into Kontakty
  if (id === 'clients') id = 'contacts';
  closeMobileSidebar();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    const onclick = n.getAttribute('onclick') || '';
    if (onclick.indexOf("'" + id + "'") !== -1) {
      n.classList.add('active');
      // Auto-expand parent section if collapsed
      const section = n.closest('.sidebar-section');
      if (section && section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        const title = section.previousElementSibling;
        if (title) title.classList.remove('collapsed');
      }
    }
  });
  if (id === 'historia' && typeof renderHistory === 'function') renderHistory();
  if (id === 'home') renderDashboard();
  if (id === 'aml') renderAmlList();
  if (id === 'ai') renderAiSettingsPage();
  if (id === 'saved-leads') renderSavedLeads();
  if (id === 'dokumenty') renderDocs();
  if (id === 'signatures') { if (typeof refreshRemoteSignatures === 'function') refreshRemoteSignatures(); }
  if (id === 'clients' && typeof renderClients === 'function') renderClients();
  // When showing My Properties, force-refresh remote sig statuses so verified
  // (orange) chips transition to done (green) the moment the client signs.
  // Bypass the 15-second cache — the user is actively expecting fresh data.
  if (id === 'properties') {
    _remoteSignLastFetch = 0;
    if (typeof refreshRemoteSignatures === 'function') refreshRemoteSignatures();
  }
  window.scrollTo(0, 0);
}

// ==================== HELPERS ====================
const fmt = (n) => new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtInt = (n) => new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDec = (n, d) => n.toFixed(d).replace('.', ',');

let charts = {};
function getOrCreateChart(canvasId, config) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, config);
  return charts[canvasId];
}

// ==================== 1. INVESTOVANIE ====================
function calcInvestment() {
  const P0 = +document.getElementById('inv-initial').value;
  const M = +document.getElementById('inv-monthly').value;
  const r = +document.getElementById('inv-rate').value / 100;
  const years = +document.getElementById('inv-years').value;

  const annualDeposit = M * 12;
  const data = [];
  let value = P0;
  for (let y = 1; y <= years; y++) {
    value = (annualDeposit + value) * (1 + r);
    data.push({ year: y, value: value, deposit: P0 + annualDeposit * y });
  }

  const totalDeposit = P0 + M * 12 * years;
  const finalValue = data[data.length - 1].value;
  const profit = finalValue - totalDeposit;

  document.getElementById('inv-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">Hodnota investície</div><div class="result-value">${fmt(finalValue)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkový vklad</div><div class="result-value">${fmt(totalDeposit)} EUR</div></div>
      <div class="result-box"><div class="result-label">Čistý výnos</div><div class="result-value">${fmt(profit)} EUR</div></div>
      <div class="result-box"><div class="result-label">Zhodnotenie</div><div class="result-value">${fmt(profit / totalDeposit * 100)} %</div></div>
    </div>`;

  getOrCreateChart('inv-chart', {
    type: 'bar',
    data: {
      labels: data.map(d => d.year + '. rok'),
      datasets: [
        { label: 'Vklady', data: data.map(d => d.deposit), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Hodnota investície', data: data.map(d => d.value), backgroundColor: 'rgba(16,185,129,0.3)', borderColor: '#10b981', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th>Rok</th><th>Ročný vklad</th><th>Celkový vklad</th><th>Hodnota</th><th>Čistý zisk</th></tr></thead><tbody>';
  data.forEach(d => {
    tableHtml += `<tr><td>${d.year}</td><td>${fmt(M * 12)}</td><td>${fmt(d.deposit)}</td><td>${fmt(d.value)}</td><td>${fmt(d.value - d.deposit)}</td></tr>`;
  });
  tableHtml += '</tbody></table></div>';
  document.getElementById('inv-table').innerHTML = tableHtml;
}

// ==================== 2. MILIONOVA KALKULACKA ====================
function calcMillion() {
  const target = +document.getElementById('mil-target').value;
  const years = +document.getElementById('mil-years').value;
  const r = +document.getElementById('mil-rate').value / 100;

  const monthlyRate = r / 12;
  const months = years * 12;
  const fvFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  const monthlyPayment = target / fvFactor;
  const totalDeposit = monthlyPayment * months;
  const profit = target - totalDeposit;

  document.getElementById('mil-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">Mesačná investícia musí byť</div><div class="result-value">${fmt(monthlyPayment)} EUR</div></div>
      <div class="result-box"><div class="result-label">Cieľová suma</div><div class="result-value">${fmt(target)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkovo vložených</div><div class="result-value">${fmt(totalDeposit)} EUR</div></div>
      <div class="result-box"><div class="result-label">Výnos z investície</div><div class="result-value">${fmt(profit)} EUR</div></div>
    </div>`;

  const chartData = [];
  let val = 0;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) val = val * (1 + monthlyRate) + monthlyPayment;
    chartData.push({ year: y, value: val, deposit: monthlyPayment * 12 * y });
  }

  getOrCreateChart('mil-chart', {
    type: 'line',
    data: {
      labels: chartData.map(d => d.year + '. rok'),
      datasets: [
        { label: 'Hodnota investície', data: chartData.map(d => d.value), borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)', fill: true, tension: 0.3 },
        { label: 'Vklady', data: chartData.map(d => d.deposit), borderColor: '#64748b', borderDash: [5, 5], fill: false, tension: 0 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });
}

// ==================== 3. MESACNA RENTA ====================
function calcRenta() {
  const capital = +document.getElementById('ren-capital').value;
  const years = +document.getElementById('ren-years').value;
  const r = +document.getElementById('ren-rate').value / 100;
  const exhaust = document.getElementById('ren-exhaust').value;
  const remain = exhaust === 'ano' ? 0 : +document.getElementById('ren-remain').value;

  const monthlyRate = r / 12;
  const months = years * 12;
  let renta;
  if (monthlyRate === 0) {
    renta = (capital - remain) / months;
  } else {
    const pvFactor = (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
    const fvRemain = remain / Math.pow(1 + monthlyRate, months);
    renta = (capital - fvRemain) / pvFactor;
  }
  const totalPaid = renta * months;
  const profitDuringPayout = totalPaid - capital + remain;

  document.getElementById('ren-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">Mesačná renta</div><div class="result-value">${fmt(renta)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkovo vyplatené</div><div class="result-value">${fmt(totalPaid)} EUR</div></div>
      <div class="result-box"><div class="result-label">Výnos z investície</div><div class="result-value">${fmt(profitDuringPayout)} EUR</div></div>
      <div class="result-box"><div class="result-label">Zostávajúci kapitál</div><div class="result-value">${fmt(remain)} EUR</div></div>
    </div>`;

  const chartData = [];
  let balance = capital;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) - renta;
    }
    chartData.push({ year: y, balance: Math.max(0, balance), withdrawn: renta * 12 * y });
  }

  getOrCreateChart('ren-chart', {
    type: 'line',
    data: {
      labels: chartData.map(d => d.year + '. rok'),
      datasets: [
        { label: 'Zostatok kapitálu', data: chartData.map(d => d.balance), borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)', fill: true, tension: 0.3 },
        { label: 'Celkovo vybraté', data: chartData.map(d => d.withdrawn), borderColor: '#10b981', fill: false, tension: 0 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });
}

document.getElementById('ren-exhaust').addEventListener('change', function() {
  document.getElementById('ren-remain-group').style.display = this.value === 'nie' ? 'flex' : 'none';
});

// ==================== 4. FINANCNA MATEMATIKA ====================
function calcFinMath() {
  const PV = +document.getElementById('fm-pv').value;
  const PMT = +document.getElementById('fm-pmt').value;
  const years = +document.getElementById('fm-years').value;
  const r = +document.getElementById('fm-rate').value / 100;
  const freq = +document.getElementById('fm-freq').value;

  const ratePerPeriod = r / freq;
  const totalPeriods = years * freq;

  // FV of lump sum
  const fvLump = PV * Math.pow(1 + ratePerPeriod, totalPeriods);
  // FV of annuity (payments adjusted to compounding frequency)
  let fvAnnuity = 0;
  if (PMT > 0 && freq > 0) {
    const pmtPerPeriod = PMT * 12 / freq;
    let val = 0;
    for (let p = 1; p <= totalPeriods; p++) {
      val = (val + pmtPerPeriod) * (1 + ratePerPeriod);
    }
    fvAnnuity = val;
  }

  const FV = fvLump + fvAnnuity;
  const totalDeposit = PV + PMT * years * 12;
  const profit = FV - totalDeposit;

  document.getElementById('fm-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">Konečná hodnota</div><div class="result-value">${fmt(FV)} EUR</div></div>
      <div class="result-box"><div class="result-label">Počiatočná hodnota</div><div class="result-value">${fmt(PV)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkové vklady</div><div class="result-value">${fmt(totalDeposit)} EUR</div></div>
      <div class="result-box"><div class="result-label">Čistý výnos</div><div class="result-value">${fmt(profit)} EUR</div></div>
    </div>`;

  const chartData = [];
  for (let y = 1; y <= years; y++) {
    const fv = PV * Math.pow(1 + ratePerPeriod, y * freq);
    let ann = 0;
    if (PMT > 0 && freq > 0) {
      const ppp = PMT * 12 / freq;
      let v = 0;
      for (let p = 1; p <= y * freq; p++) v = (v + ppp) * (1 + ratePerPeriod);
      ann = v;
    }
    chartData.push({ year: y, value: fv + ann, deposit: PV + PMT * 12 * y });
  }

  getOrCreateChart('fm-chart', {
    type: 'line',
    data: {
      labels: chartData.map(d => d.year + '. rok'),
      datasets: [
        { label: 'Hodnota', data: chartData.map(d => d.value), borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)', fill: true, tension: 0.3 },
        { label: 'Vklady', data: chartData.map(d => d.deposit), borderColor: '#64748b', borderDash: [5, 5], fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
  });
}

// ==================== 5. II. PILIER ====================
function calcPilier() {
  const salary = +document.getElementById('pil-salary').value;
  const years = +document.getElementById('pil-years').value;
  const growth = +document.getElementById('pil-growth').value / 100;
  const current = +document.getElementById('pil-current').value;

  const rates = [
    { name: 'Garantovaný (2%)', rate: 0.02 },
    { name: 'Akciový (4%)', rate: 0.04 },
    { name: 'Indexový (8%)', rate: 0.08 }
  ];

  const results = rates.map(({ name, rate }) => {
    let value = current;
    let sal = salary;
    const yearData = [];
    for (let y = 1; y <= years; y++) {
      sal = sal * (1 + growth); // salary grows first (matches Excel)
      const annualContrib = sal * 0.04 * 12; // 4% of monthly salary * 12 (matches Excel 'odvod 4%')
      value = (value + annualContrib) * (1 + rate); // annual compounding (matches Excel)
      yearData.push({ year: y, value, salary: sal });
    }
    return { name, rate, finalValue: value, yearData };
  });

  const diff = results[2].finalValue - results[0].finalValue;

  let html = '<div class="results-grid">';
  results.forEach(r => {
    const isHighlight = r.rate === 0.08 ? ' highlight' : '';
    html += `<div class="result-box${isHighlight}"><div class="result-label">${r.name}</div><div class="result-value">${fmt(r.finalValue)} EUR</div></div>`;
  });
  html += `<div class="result-box"><div class="result-label">Rozdiel garant vs index</div><div class="result-value">${fmt(diff)} EUR</div></div>`;
  html += '</div>';
  document.getElementById('pil-results').innerHTML = html;

  getOrCreateChart('pil-chart', {
    type: 'line',
    data: {
      labels: results[0].yearData.map(d => d.year + '. rok'),
      datasets: results.map((r, i) => ({
        label: r.name,
        data: r.yearData.map(d => d.value),
        borderColor: ['#94a3b8', '#3b82f6', '#1a56db'][i],
        backgroundColor: ['rgba(148,163,184,0.1)', 'rgba(59,130,246,0.1)', 'rgba(26,86,219,0.1)'][i],
        fill: i === 2,
        tension: 0.3
      }))
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
  });

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th>Rok</th><th>Mzda</th><th>Mesačný odvod</th><th>Garantovaný 2%</th><th>Akciový 4%</th><th>Indexový 8%</th></tr></thead><tbody>';
  for (let y = 0; y < years; y++) {
    const sal = results[0].yearData[y].salary;
    tableHtml += `<tr><td>${y + 1}</td><td>${fmt(sal)}</td><td>${fmt(sal * 0.04)}</td><td>${fmt(results[0].yearData[y].value)}</td><td>${fmt(results[1].yearData[y].value)}</td><td>${fmt(results[2].yearData[y].value)}</td></tr>`;
  }
  tableHtml += '</tbody></table></div>';
  document.getElementById('pil-table').innerHTML = tableHtml;
}

// ==================== 6. HYPOTEKA + INVESTICIA ====================
function calcHypoteka() {
  const loan = +document.getElementById('hyp-loan').value;
  const annualRate = +document.getElementById('hyp-rate').value / 100;
  const years = +document.getElementById('hyp-years').value;
  const fee = +document.getElementById('hyp-fee').value;
  const monthlyInv = +document.getElementById('hyp-inv').value;
  const invRate = +document.getElementById('hyp-inv-rate').value / 100;

  const monthlyRate = annualRate / 12;
  const months = years * 12;

  // Annuity calculation
  let annuity;
  if (monthlyRate === 0) {
    annuity = loan / months;
  } else {
    annuity = loan * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  }
  const totalMortgage = annuity * months;
  const overpayment = totalMortgage - loan;

  // Investment calculation
  let invValue = 0;
  const invMonthlyRate = invRate / 12;
  const invYearData = [];
  const mortYearData = [];
  let remaining = loan;

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      invValue = invValue * (1 + invMonthlyRate) + monthlyInv;
      const interest = remaining * monthlyRate;
      const principal = annuity - interest;
      remaining = Math.max(0, remaining - principal);
    }
    invYearData.push(invValue);
    mortYearData.push(remaining);
  }

  const totalInvDeposit = monthlyInv * 12 * years;
  const invProfit = invValue - totalInvDeposit;
  const netSavings = invProfit - overpayment;

  document.getElementById('hyp-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box"><div class="result-label">Mesačná splátka</div><div class="result-value">${fmt(annuity)} EUR</div></div>
      <div class="result-box"><div class="result-label">Preplatenosť úveru</div><div class="result-value">${fmt(overpayment)} EUR</div></div>
      <div class="result-box highlight"><div class="result-label">Hodnota investície</div><div class="result-value">${fmt(invValue)} EUR</div></div>
      <div class="result-box"><div class="result-label">Čistý zisk investície</div><div class="result-value">${fmt(invProfit)} EUR</div></div>
    </div>
    <div class="info-box" style="margin-top:1rem">
      Celková úspora pre klienta (zisk z investície - preplatenosť úveru): <strong>${fmt(netSavings)} EUR</strong>
    </div>`;

  const labels = [];
  for (let y = 1; y <= years; y++) labels.push(y + '. rok');

  getOrCreateChart('hyp-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Hodnota investície', data: invYearData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
        { label: 'Zostatok úveru', data: mortYearData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th>Rok</th><th>Zostatok úveru</th><th>Hodnota investície</th><th>Čistý vklad invest.</th><th>Rozdiel</th></tr></thead><tbody>';
  for (let y = 0; y < years; y++) {
    const deposit = monthlyInv * 12 * (y + 1);
    tableHtml += `<tr><td>${y + 1}</td><td>${fmt(mortYearData[y])}</td><td>${fmt(invYearData[y])}</td><td>${fmt(deposit)}</td><td>${fmt(invYearData[y] - mortYearData[y])}</td></tr>`;
  }
  tableHtml += '</tbody></table></div>';
  document.getElementById('hyp-table').innerHTML = tableHtml;
}

// ==================== 7. TVORBA REZERVY ====================
function calcRezerva() {
  const initial = +document.getElementById('rez-initial').value;
  const monthly = +document.getElementById('rez-monthly').value;
  const rate = +document.getElementById('rez-rate').value / 100;
  const years = +document.getElementById('rez-years').value;

  const monthlyRate = rate / 12;
  let value = initial;
  const data = [];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + monthly) * (1 + monthlyRate);
    }
    const totalDeposit = initial + monthly * 12 * y;
    data.push({ year: y, value, deposit: totalDeposit, profit: value - totalDeposit });
  }

  const final = data[data.length - 1];

  document.getElementById('rez-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">Celkovo na účte</div><div class="result-value">${fmt(final.value)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkový vklad</div><div class="result-value">${fmt(final.deposit)} EUR</div></div>
      <div class="result-box"><div class="result-label">Čistý zisk</div><div class="result-value">${fmt(final.profit)} EUR</div></div>
    </div>`;

  getOrCreateChart('rez-chart', {
    type: 'bar',
    data: {
      labels: data.map(d => d.year + '.'),
      datasets: [
        { label: 'Vklady', data: data.map(d => d.deposit), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Celkovo na účte', data: data.map(d => d.value), backgroundColor: 'rgba(16,185,129,0.3)', borderColor: '#10b981', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th>Rok</th><th>Celkový vklad</th><th>Čistý zisk</th><th>Celkovo na účte</th></tr></thead><tbody>';
  data.forEach(d => {
    tableHtml += `<tr><td>${d.year}</td><td>${fmt(d.deposit)}</td><td>${fmt(d.profit)}</td><td>${fmt(d.value)}</td></tr>`;
  });
  tableHtml += '</tbody></table></div>';
  document.getElementById('rez-table').innerHTML = tableHtml;
}

// ==================== 8. DIVIDENDOVE FONDY ====================
function calcDividenda() {
  const amount = +document.getElementById('div-amount').value;
  const yieldPct = +document.getElementById('div-yield').value / 100;
  const reinvest = document.getElementById('div-reinvest').value === 'ano';
  const years = +document.getElementById('div-years').value;

  const data = [];
  let balance = amount;
  let totalDividends = 0;
  const quarterlyRate = yieldPct / 4;

  for (let y = 1; y <= years; y++) {
    let yearlyDividend = 0;
    for (let q = 0; q < 4; q++) {
      const qDiv = balance * quarterlyRate;
      yearlyDividend += qDiv;
      totalDividends += qDiv;
      if (reinvest) {
        balance += qDiv;
      }
    }
    data.push({
      year: y,
      balance: balance,
      dividend: yearlyDividend,
      totalDividends: totalDividends,
      totalReturn: reinvest ? balance - amount : totalDividends
    });
  }

  const final = data[data.length - 1];

  document.getElementById('div-results').innerHTML = `
    <div class="results-grid">
      <div class="result-box highlight"><div class="result-label">${reinvest ? 'Celková hodnota' : 'Celkovo vyplatené dividendy'}</div><div class="result-value">${fmt(reinvest ? final.balance : final.totalDividends)} EUR</div></div>
      <div class="result-box"><div class="result-label">Počiatočný vklad</div><div class="result-value">${fmt(amount)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkový výnos</div><div class="result-value">${fmt(final.totalReturn)} EUR</div></div>
      <div class="result-box"><div class="result-label">Dividenda posledný rok</div><div class="result-value">${fmt(final.dividend)} EUR</div></div>
    </div>`;

  getOrCreateChart('div-chart', {
    type: 'bar',
    data: {
      labels: data.map(d => d.year + '. rok'),
      datasets: reinvest ? [
        { label: 'Počiatočný vklad', data: data.map(() => amount), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Celková hodnota s reinvesticiou', data: data.map(d => d.balance), backgroundColor: 'rgba(16,185,129,0.3)', borderColor: '#10b981', borderWidth: 1 }
      ] : [
        { label: 'Ročná dividenda', data: data.map(d => d.dividend), backgroundColor: 'rgba(26,86,219,0.5)', borderColor: '#1a56db', borderWidth: 1 },
        { label: 'Celkovo vyplatené', data: data.map(d => d.totalDividends), backgroundColor: 'rgba(16,185,129,0.3)', borderColor: '#10b981', borderWidth: 1 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th>Rok</th><th>Hodnota</th><th>Dividenda v roku</th><th>Celkové dividendy</th><th>Celkový výnos</th></tr></thead><tbody>';
  data.forEach(d => {
    tableHtml += `<tr><td>${d.year}</td><td>${fmt(d.balance)}</td><td>${fmt(d.dividend)}</td><td>${fmt(d.totalDividends)}</td><td>${fmt(d.totalReturn)}</td></tr>`;
  });
  tableHtml += '</tbody></table></div>';
  document.getElementById('div-table').innerHTML = tableHtml;
}

// ==================== 9. VSTUPNE UDAJE KLIENTA (AOF) ====================
function calcAOF() {
  const gross = +document.getElementById('aof-gross').value;
  const net = +document.getElementById('aof-net').value;
  const age = +document.getElementById('aof-age').value;
  const retireAge = +document.getElementById('aof-retire').value;
  const desiredPension = +document.getElementById('aof-pension').value;
  const hasPilier2 = document.getElementById('aof-pilier2').value === 'ano';

  const yearsToRetire = retireAge - age;

  // I. pilier odvody (závisí od II. piliera)
  const pilier1Contrib = hasPilier2 ? gross * 0.1325 : gross * 0.18;
  const pilier2Contrib = hasPilier2 ? gross * 0.06 : 0;

  // Estimated state pension - age-based brackets with 900€ cap (matches Excel)
  let pensionPct = 0.4;
  if (age < 25) pensionPct = 0.25;
  else if (age < 31) pensionPct = 0.3;
  const rawPension = Math.min(gross * pensionPct, 900);
  const estimatedPension = rawPension * 0.9; // po zmene zákona
  const gap = Math.abs(desiredPension - estimatedPension);

  // Required capital for 20-year pension
  const rate20 = 0.03;
  const months20 = 20 * 12;
  const mr20 = rate20 / 12;
  const earlyRetireAdj = retireAge < 64 ? (64 - retireAge) * 12 * desiredPension : 0;
  const requiredCapital20 = Math.round(gap * (1 - Math.pow(1 + mr20, -months20)) / mr20) + earlyRetireAdj;

  // Required capital for lifetime (100 - retireAge years, matches Excel)
  const lifetimeYears = 100 - retireAge;
  const monthsLife = lifetimeYears * 12;
  const requiredCapitalLife = Math.round(gap * (1 - Math.pow(1 + mr20, -monthsLife)) / mr20) + earlyRetireAdj;

  // Monthly investment needed at 7%
  const invRate = 0.07;
  const invMR = invRate / 12;
  const invMonths = yearsToRetire * 12;
  const fvFactor = (Math.pow(1 + invMR, invMonths) - 1) / invMR;
  const monthlyNeeded = requiredCapitalLife / fvFactor;

  // Ideal reserve
  const idealReserve = net * 6;

  // PN and disability calculations
  const pnBenefit = Math.min(gross * 0.55, 1099);
  const pnGap = net - pnBenefit;

  document.getElementById('aof-results').innerHTML = `
    <div class="card" style="margin-top:1rem;background:var(--primary-bg)">
      <div class="card-title">Výsledky analýzy</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Roky do dôchodku</div><div class="result-value">${yearsToRetire}</div></div>
        <div class="result-box"><div class="result-label">Ideálna rezerva</div><div class="result-value">${fmt(idealReserve)} EUR</div></div>
        <div class="result-box"><div class="result-label">Predp. štátny dôchodok (po zmene)</div><div class="result-value">${fmt(estimatedPension)} EUR</div></div>
        <div class="result-box"><div class="result-label">Predp. dôchodok (pred zmenou)</div><div class="result-value">${fmt(rawPension)} EUR</div></div>
        <div class="result-box"><div class="result-label">Bude chýbať mesačne</div><div class="result-value">${fmt(gap)} EUR</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-title">Dôchodkové zabezpečenie</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Nutný kapitál na 20-ročný dôchodok</div><div class="result-value">${fmtInt(requiredCapital20)} EUR</div></div>
        <div class="result-box highlight"><div class="result-label">Nutný kapitál na doživotný dôchodok</div><div class="result-value">${fmtInt(requiredCapitalLife)} EUR</div></div>
        <div class="result-box highlight"><div class="result-label">Potrebné investovať mesačne (pri 7% p.a.)</div><div class="result-value">${fmt(monthlyNeeded)} EUR</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-title">Zabezpečenie príjmu</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Odvody I. pilier</div><div class="result-value">${fmt(pilier1Contrib)} EUR</div></div>
        ${hasPilier2 ? `<div class="result-box"><div class="result-label">Odvody II. pilier</div><div class="result-value">${fmt(pilier2Contrib)} EUR</div></div>` : ''}
        <div class="result-box"><div class="result-label">PN dávka (od 2. mesiaca)</div><div class="result-value">${fmt(pnBenefit)} EUR</div></div>
        <div class="result-box"><div class="result-label">Pri PN bude chýbať</div><div class="result-value">${fmt(pnGap)} EUR</div></div>
      </div>
    </div>`;
}

// ==================== 10. ROZLOZENIE INVESTICIE ====================
function calcRozlozenie() {
  const horizon = +document.getElementById('roz-horizon').value;
  const risk = +document.getElementById('roz-risk').value;
  const type = document.getElementById('roz-type').value;
  const amount = +document.getElementById('roz-amount').value;
  const reservePct = +document.getElementById('roz-reserve').value / 100;

  const investAmount = amount * (1 - reservePct);
  const reserveAmount = amount * reservePct;

  // Allocation matrix based on risk profile
  const allocations = {
    1:  { cash: 1.00, bond: 0.00, equity: 0.00, hedge: 0.00, real: 0.00 },
    2:  { cash: 0.90, bond: 0.10, equity: 0.00, hedge: 0.00, real: 0.00 },
    3:  { cash: 0.70, bond: 0.30, equity: 0.00, hedge: 0.00, real: 0.00 },
    4:  { cash: 0.35, bond: 0.40, equity: 0.15, hedge: 0.00, real: 0.10 },
    5:  { cash: 0.15, bond: 0.35, equity: 0.30, hedge: 0.00, real: 0.20 },
    6:  { cash: 0.10, bond: 0.30, equity: 0.35, hedge: 0.05, real: 0.20 },
    7:  { cash: 0.10, bond: 0.25, equity: 0.35, hedge: 0.10, real: 0.20 },
    8:  { cash: 0.10, bond: 0.20, equity: 0.35, hedge: 0.15, real: 0.20 },
    9:  { cash: 0.10, bond: 0.15, equity: 0.40, hedge: 0.15, real: 0.15 },
    10: { cash: 0.10, bond: 0.15, equity: 0.40, hedge: 0.20, real: 0.15 }
  };

  // If regular investment, shift risk up slightly
  let adjustedRisk = risk;
  if (type === 'regular') adjustedRisk = Math.min(10, risk + 1);
  const alloc = allocations[adjustedRisk] || allocations[6];

  const funds = [
    { name: 'Peňažný trh (Amundi Euro Cash)', key: 'cash', returnRate: 0.025, volatility: 0.005, entryFee: 0.002, mgmtFee: 0.002 },
    { name: 'Kvalitné dlhopisy (Simplea Euro Bond)', key: 'bond', returnRate: 0.04, volatility: 0.04, entryFee: 0, mgmtFee: 0.015 },
    { name: 'Akciový trh (Simplea Global Equity ESG)', key: 'equity', returnRate: 0.08, volatility: 0.12, entryFee: 0, mgmtFee: 0.03 },
    { name: 'Rizikové fondy (Double Speed)', key: 'hedge', returnRate: 0.13, volatility: 0.25, entryFee: 0, mgmtFee: 0.05 },
    { name: 'Realitné fondy (Trigea)', key: 'real', returnRate: 0.06, volatility: 0.05, entryFee: 0.03, mgmtFee: 0.03 }
  ];

  let weightedReturn = 0;
  let weightedVolatility = 0;
  const fundDetails = [];

  funds.forEach(f => {
    const weight = alloc[f.key];
    if (weight > 0) {
      const invested = investAmount * weight;
      weightedReturn += f.returnRate * weight;
      weightedVolatility += f.volatility * weight;
      fundDetails.push({ ...f, weight, invested });
    }
  });

  // Calculate expected value (lump sum vs regular investment - matches Excel)
  let expectedValue, totalInvested;
  if (type === 'lump') {
    expectedValue = investAmount * Math.pow(1 + weightedReturn, horizon);
    totalInvested = investAmount;
  } else {
    // Regular: FV of annuity with monthly compounding
    const mr = weightedReturn / 12;
    const totalMonths = horizon * 12;
    expectedValue = investAmount * (Math.pow(1 + mr, totalMonths) - 1) / mr;
    totalInvested = investAmount * horizon * 12;
  }
  const profit = expectedValue - totalInvested;

  let html = `
    <div class="results-grid" style="margin-top:1rem">
      <div class="result-box"><div class="result-label">${type === 'lump' ? 'Investovaná suma' : 'Mesačná investícia'}</div><div class="result-value">${fmt(investAmount)} EUR</div></div>
      <div class="result-box"><div class="result-label">Rezerva</div><div class="result-value">${fmt(reserveAmount)} EUR</div></div>
      <div class="result-box highlight"><div class="result-label">Očakávaná hodnota (${horizon} r.)</div><div class="result-value">${fmt(expectedValue)} EUR</div></div>
      <div class="result-box highlight"><div class="result-label">Očakávaný výnos</div><div class="result-value">${fmt(profit)} EUR</div></div>
    </div>
    <div class="info-box" style="margin-top:1rem">
      Očakávané zhodnotenie: <strong>${fmtDec(weightedReturn * 100, 2)}% p.a.</strong> | Očakávaná volatilita: <strong>${fmtDec(weightedVolatility * 100, 2)}% p.a.</strong> | Rizikovosť: <strong>${adjustedRisk} z 10</strong>
    </div>
    <div class="table-wrap" style="margin-top:1rem">
      <table>
        <thead><tr><th style="text-align:left">Fond</th><th>Váha</th><th>Očak. výnos</th><th>Volatilita</th><th>Investované</th></tr></thead>
        <tbody>`;
  fundDetails.forEach(f => {
    html += `<tr><td style="text-align:left">${f.name}</td><td>${fmtDec(f.weight * 100, 0)}%</td><td>${fmtDec(f.returnRate * 100, 1)}%</td><td>${fmtDec(f.volatility * 100, 1)}%</td><td>${fmt(f.invested)} EUR</td></tr>`;
  });
  html += '</tbody></table></div>';
  document.getElementById('roz-results').innerHTML = html;

  // Pie chart
  getOrCreateChart('roz-chart', {
    type: 'doughnut',
    data: {
      labels: fundDetails.map(f => f.name.split('(')[0].trim()),
      datasets: [{
        data: fundDetails.map(f => f.weight * 100),
        backgroundColor: ['#93bbfd', '#3b82f6', '#1a56db', '#1e3a8a', '#0ea5e9'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

// ==================== 11. HYPOTECNA KALKULACKA (mHypoteka) ====================
function mhToggleApplicants() {
  const n = +document.getElementById('mh-applicants').value;
  for (let i = 2; i <= 4; i++) {
    const el = document.getElementById('mh-applicant' + i);
    if (el) el.style.display = i <= n ? 'block' : 'none';
  }
}

// Set default date
document.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  document.getElementById('mh-date').value = d.toISOString().split('T')[0];
});

let mhLastResult = null;

function calcMHypoteka() {
  const dateStr = document.getElementById('mh-date').value;
  const appDate = dateStr ? new Date(dateStr) : new Date();
  const numApplicants = +document.getElementById('mh-applicants').value;

  // Collect applicant data
  const applicants = [];
  let totalIncome = 0;
  let totalAlimony = 0;
  let totalHousing = 0;
  for (let i = 1; i <= numApplicants; i++) {
    const income = +document.getElementById('mh-income' + i).value || 0;
    const alimony = +document.getElementById('mh-alimony' + i).value || 0;
    const housing = +document.getElementById('mh-housing' + i).value || 0;
    const dobStr = document.getElementById('mh-dob' + i).value;
    let age = 0;
    if (dobStr) {
      const dob = new Date(dobStr);
      age = Math.floor((appDate - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }
    applicants.push({ income, alimony, housing, age, dob: dobStr });
    totalIncome += income;
    totalAlimony += alimony;
    totalHousing += housing;
  }

  const netIncome = Math.max(totalIncome - totalAlimony, 0);
  const minAge = Math.min(...applicants.map(a => a.age));

  // Dependants
  const dependants = +document.getElementById('mh-dependants').value || 0;
  const children = +document.getElementById('mh-children').value || 0;
  const totalDependants = numApplicants + dependants;

  // Existing obligations
  const loanPayments = +document.getElementById('mh-loan-payments').value || 0;
  const overdraft = +document.getElementById('mh-overdraft').value || 0;
  const creditCard = +document.getElementById('mh-creditcard').value || 0;
  const alimonyExec = +document.getElementById('mh-alimony-exec').value || 0;
  const adjustedAlimony = alimonyExec > 0 ? Math.max(alimonyExec, 30) : 0;

  // Loan parameters
  const loanAmount = +document.getElementById('mh-loan-amount').value || 0;
  const termMonths = +document.getElementById('mh-term').value || 360;
  const annualRate = +document.getElementById('mh-interest').value / 100 || 0.0384;
  const loanType = document.getElementById('mh-loan-type').value;

  // Life Insurance
  const lifeIns = document.getElementById('mh-life-insurance').value;
  const liCoeff = 0.015;
  let liIncluded = 0, liNotIncluded = 0;
  if (lifeIns === 'ano-zahrnute') {
    liIncluded = (liCoeff / (1 - liCoeff)) * loanAmount;
  } else if (lifeIns === 'ano-nezahrnute') {
    liNotIncluded = loanAmount * liCoeff;
  }
  const loanWithLI = loanAmount + liIncluded;

  // Property
  const property1 = +document.getElementById('mh-property1').value || 0;
  const free1 = +document.getElementById('mh-free1').value || 0;
  const zp1 = +document.getElementById('mh-zp1').value || 0;
  const insurance1 = +document.getElementById('mh-insurance1').value || 0;
  const insuranceTotal = (insurance1 / 12) * termMonths;

  // LtV standard/max values based on loan type
  let ltvStandard = 0.80, ltvMax = 0.90;
  if (loanType === 'neucelovy-standard') { ltvStandard = 0.70; ltvMax = 0.80; }
  else if (loanType === 'ucelovy-nestandard') { ltvStandard = 0.65; ltvMax = 0.90; }

  // Actual LtV
  const actualLtV = free1 > 0 ? loanWithLI / free1 : 0;

  // COSTS calculation (expenses per Slovak law)
  const baseCost = 284.13;
  const perPerson = 198.22;
  const perChild = 129.74;
  const expenses = totalDependants === 0 ? 0 : (baseCost + Math.max((totalDependants - children - 1) * perPerson + children * perChild - totalAlimony, 0) + adjustedAlimony);
  const expensesWithHousing = expenses + totalHousing;

  // KUGD (bank model expenses)
  const kugd = totalDependants === 0 ? 0 : Math.max(totalDependants * Math.pow(185 * Math.pow(totalDependants, -0.4), 1 - 0.4) * Math.pow(netIncome / totalDependants, 0.4), 0);

  // Available income
  const availableIncome = Math.max(0.95 * (netIncome - Math.max(expensesWithHousing, kugd)), 0);

  // Free income (after obligations)
  const freeIncome = Math.max(availableIncome - loanPayments - 0.03 * overdraft - 0.03 * creditCard, 0);

  // DSTI stress test rate
  const stressRate = Math.min(annualRate + 0.02, 0.06);
  const stressRateM = stressRate / 12;

  // Annuity calculation
  const monthlyRate = annualRate / 12;
  let annuity = 0, annuityStress = 0;
  if (monthlyRate > 0 && termMonths > 0) {
    annuity = Math.round((loanWithLI * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)))) * 100) / 100;
    annuityStress = Math.round((loanWithLI * (stressRateM / (1 - Math.pow(1 + stressRateM, -360)))) * 100) / 100;
  }

  // First declining payment
  let decliningFirst = 0, decliningStress = 0;
  if (termMonths > 0) {
    decliningFirst = loanWithLI / termMonths + loanWithLI * monthlyRate;
    decliningStress = loanWithLI / 360 + loanWithLI * stressRateM;
  }

  // Maximum loan based on income
  let maxLoanIncome = 0;
  if (freeIncome > 0 && stressRateM > 0 && termMonths > 0) {
    const effectiveTerm = minAge < 60 ? Math.min(termMonths, 360) : (termMonths > 60 ? 60 : termMonths);
    maxLoanIncome = freeIncome / (stressRateM / (1 - Math.pow(1 + stressRateM, -effectiveTerm)));
  }

  // Maximum loan based on LtV
  const maxLoanLtV = ltvMax * free1;
  const maxLoanFinal = Math.min(maxLoanIncome, maxLoanLtV);

  // DSTI calculations
  const dstiBasis = netIncome - expenses;
  const dstiAnnuity = dstiBasis > 0 ? (loanPayments + 0.03 * overdraft + 0.03 * creditCard + Math.max(annuity, annuityStress)) / dstiBasis : 0;
  const dstiDeclining = dstiBasis > 0 ? (loanPayments + 0.03 * overdraft + 0.03 * creditCard + Math.max(decliningFirst, decliningStress)) / dstiBasis : 0;
  const dstiOk = dstiAnnuity < 0.6;
  const dstiDecOk = dstiDeclining < 0.6;

  // DTI calculation
  const dtiNumerator = loanPayments + overdraft * 0.03 + creditCard * 0.03 + loanWithLI;
  let dtiLimit = 0;
  applicants.forEach(a => {
    const lim = a.age < 41 ? 8 : (a.age + termMonths/12 < 65 ? 8 : Math.max(8 - 0.25 * (a.age - 40), 3));
    dtiLimit += (a.income - a.alimony) * lim;
  });
  const dtiValue = netIncome > 0 ? dtiNumerator / (12 * netIncome) : 0;
  const dtiLimitNorm = dtiLimit / (12 * netIncome);
  const dtiOk = dtiValue <= dtiLimitNorm;

  // Maturity check
  const maturityOk = termMonths <= 360 ? true : (actualLtV <= 0.8 && dtiValue <= 8 && dstiAnnuity < 0.6);

  // RPMN (APR) approximation - simplified using IRR approach
  const totalPaidAnnuity = annuity * termMonths + zp1 + insuranceTotal + liNotIncluded;
  const totalPaidDeclining = (() => {
    let total = 0, rem = loanWithLI;
    for (let m = 1; m <= termMonths; m++) {
      const principal = loanWithLI / termMonths;
      const interest = rem * monthlyRate;
      total += principal + interest;
      rem -= principal;
    }
    return total + zp1 + insuranceTotal + liNotIncluded;
  })();

  // Simple APR approximation
  const rpmn = termMonths > 0 ? (Math.pow(totalPaidAnnuity / loanAmount, 12 / termMonths) - 1) : 0;
  const rpmnDeclining = termMonths > 0 ? (Math.pow(totalPaidDeclining / loanAmount, 12 / termMonths) - 1) : 0;

  // Build amortization schedule (annuity)
  const schedule = [];
  let remaining = loanWithLI;
  for (let m = 1; m <= termMonths; m++) {
    const interest = remaining * monthlyRate;
    const principal = annuity - interest;
    remaining = Math.max(remaining - principal, 0);
    schedule.push({ month: m, principal, interest, payment: annuity, balance: remaining });
  }

  // Declining schedule
  const scheduleDecl = [];
  remaining = loanWithLI;
  const fixedPrincipal = loanWithLI / termMonths;
  for (let m = 1; m <= termMonths; m++) {
    const interest = remaining * monthlyRate;
    const payment = fixedPrincipal + interest;
    remaining = Math.max(remaining - fixedPrincipal, 0);
    scheduleDecl.push({ month: m, principal: fixedPrincipal, interest, payment, balance: remaining });
  }

  // Store results
  mhLastResult = {
    name: document.getElementById('mh-name').value || 'Klient',
    date: dateStr,
    reqNum: document.getElementById('mh-reqnum').value,
    applicants, numApplicants, totalIncome: netIncome, totalAlimony,
    dependants, children, totalDependants,
    loanPayments, overdraft, creditCard, alimonyExec, adjustedAlimony,
    loanAmount, loanWithLI, termMonths, annualRate, loanType, lifeIns, liIncluded, liNotIncluded,
    property1, free1, zp1, insurance1, insuranceTotal,
    ltvStandard, ltvMax, actualLtV,
    expenses, expensesWithHousing, kugd, availableIncome, freeIncome,
    annuity, annuityStress, decliningFirst, decliningStress,
    maxLoanIncome, maxLoanLtV, maxLoanFinal,
    dstiAnnuity, dstiDeclining, dstiOk, dstiDecOk,
    dtiValue, dtiLimitNorm, dtiOk,
    maturityOk,
    totalPaidAnnuity, totalPaidDeclining,
    rpmn, rpmnDeclining,
    schedule, scheduleDecl
  };

  // Render results
  const statusBadge = (ok) => ok
    ? '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:6px;font-weight:700;font-size:0.8rem">OK</span>'
    : '<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:6px;font-weight:700;font-size:0.8rem">PREKROČENÝ</span>';

  document.getElementById('mh-results').innerHTML = `
    <div class="card" style="margin-top:1.5rem;background:var(--primary-bg)">
      <div class="card-title">Výsledky prepočtu</div>
      <div class="results-grid">
        <div class="result-box highlight"><div class="result-label">Anuitná splátka</div><div class="result-value">${fmt(annuity)} EUR</div></div>
        <div class="result-box"><div class="result-label">1. klesajúca splátka</div><div class="result-value">${fmt(decliningFirst)} EUR</div></div>
        <div class="result-box highlight"><div class="result-label">Max. úver (príjem)</div><div class="result-value">${fmtInt(maxLoanIncome)} EUR</div></div>
        <div class="result-box"><div class="result-label">Max. úver (LtV)</div><div class="result-value">${fmtInt(maxLoanLtV)} EUR</div></div>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <div class="card-title">Rizikové ukazovatele</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th style="text-align:left">Ukazovateľ</th><th>Hodnota</th><th>Limit</th><th>Stav</th></tr></thead>
          <tbody>
            <tr><td style="text-align:left">DSTI (anuitné)</td><td>${fmtDec(dstiAnnuity * 100, 2)}%</td><td>60,00%</td><td>${statusBadge(dstiOk)}</td></tr>
            <tr><td style="text-align:left">DSTI (klesajúce)</td><td>${fmtDec(dstiDeclining * 100, 2)}%</td><td>60,00%</td><td>${statusBadge(dstiDecOk)}</td></tr>
            <tr><td style="text-align:left">DTI</td><td>${fmtDec(dtiValue, 2)}</td><td>${fmtDec(dtiLimitNorm, 2)}</td><td>${statusBadge(dtiOk)}</td></tr>
            <tr><td style="text-align:left">LtV</td><td>${fmtDec(actualLtV * 100, 2)}%</td><td>${fmtDec(ltvMax * 100, 0)}%</td><td>${statusBadge(actualLtV <= ltvMax)}</td></tr>
            <tr><td style="text-align:left">Splatnosť (anuitné)</td><td>${termMonths} mes.</td><td>360 mes.</td><td>${statusBadge(maturityOk)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <div class="card-title">Finančný profil</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Čistý príjem domácnosti</div><div class="result-value">${fmt(netIncome)} EUR</div></div>
        <div class="result-box"><div class="result-label">Náklady podľa zákona</div><div class="result-value">${fmt(expenses)} EUR</div></div>
        <div class="result-box"><div class="result-label">KUGD (model banky)</div><div class="result-value">${fmt(kugd)} EUR</div></div>
        <div class="result-box"><div class="result-label">Disponibilný príjem</div><div class="result-value">${fmt(freeIncome)} EUR</div></div>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <div class="card-title">Celkové náklady úveru</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Celkovo zaplatené (anuitné)</div><div class="result-value">${fmtInt(totalPaidAnnuity)} EUR</div></div>
        <div class="result-box"><div class="result-label">Celkovo zaplatené (klesajúce)</div><div class="result-value">${fmtInt(totalPaidDeclining)} EUR</div></div>
        <div class="result-box"><div class="result-label">RPMN (anuitné)</div><div class="result-value">${fmtDec(rpmn * 100, 2)}%</div></div>
        <div class="result-box"><div class="result-label">RPMN (klesajúce)</div><div class="result-value">${fmtDec(rpmnDeclining * 100, 2)}%</div></div>
      </div>
    </div>
  `;

  // Amortization schedule (show first 24 + last 12 months)
  const visibleMonths = [];
  for (let i = 0; i < Math.min(24, schedule.length); i++) visibleMonths.push(schedule[i]);
  if (schedule.length > 36) visibleMonths.push(null); // separator
  for (let i = Math.max(24, schedule.length - 12); i < schedule.length; i++) visibleMonths.push(schedule[i]);

  let schedHtml = '<div class="card" style="margin-top:1rem"><div class="card-title">Splátkový kalendár (anuitné splátky)</div><div class="table-wrap"><table><thead><tr><th>Mesiac</th><th>Splátka istiny</th><th>Úrok</th><th>Mesačná splátka</th><th>Zostatok</th></tr></thead><tbody>';
  visibleMonths.forEach(s => {
    if (!s) {
      schedHtml += '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:0.5rem">...</td></tr>';
    } else {
      schedHtml += `<tr><td>${s.month}</td><td>${fmt(s.principal)}</td><td>${fmt(s.interest)}</td><td>${fmt(s.payment)}</td><td>${fmt(s.balance)}</td></tr>`;
    }
  });
  schedHtml += '</tbody></table></div></div>';
  document.getElementById('mh-schedule').innerHTML = schedHtml;

  // Chart - balance over time
  const chartLabels = [], chartBalance = [], chartPrincipal = [], chartInterest = [];
  for (let i = 0; i < schedule.length; i += 12) {
    const year = Math.floor(i / 12) + 1;
    chartLabels.push(year + '. rok');
    chartBalance.push(schedule[i].balance);
    // Yearly totals
    let yPrincipal = 0, yInterest = 0;
    for (let m = i; m < Math.min(i + 12, schedule.length); m++) {
      yPrincipal += schedule[m].principal;
      yInterest += schedule[m].interest;
    }
    chartPrincipal.push(yPrincipal);
    chartInterest.push(yInterest);
  }

  getOrCreateChart('mh-chart', {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        { label: 'Istina', data: chartPrincipal, backgroundColor: 'rgba(26,86,219,0.5)', borderColor: '#1a56db', borderWidth: 1 },
        { label: 'Úrok', data: chartInterest, backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#ef4444', borderWidth: 1 },
        { label: 'Zostatok', data: chartBalance, type: 'line', borderColor: '#1e3a8a', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', tension: 0.3, pointRadius: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Ročná splátka (EUR)' } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Zostatok (EUR)' }, grid: { drawOnChartArea: false } }
      }
    }
  });

  document.getElementById('mh-pdf-section').style.display = 'flex';
}

// ==================== PDF HELPERS ====================
function pdfSk(t) {
  if (typeof t !== 'string') return t;
  return t.replace(/č/g,'c').replace(/Č/g,'C').replace(/ď/g,'d').replace(/Ď/g,'D')
    .replace(/ľ/g,'l').replace(/Ľ/g,'L').replace(/ň/g,'n').replace(/Ň/g,'N')
    .replace(/ŕ/g,'r').replace(/Ŕ/g,'R').replace(/ĺ/g,'l').replace(/Ĺ/g,'L')
    .replace(/ť/g,'t').replace(/Ť/g,'T');
}
function createPdfDoc(...args) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF(...args);
  const _origText = doc.text.bind(doc);
  doc.text = function(text, x, y, options) {
    if (typeof text === 'string') text = pdfSk(text);
    else if (Array.isArray(text)) text = text.map(t => typeof t === 'string' ? pdfSk(t) : t);
    return _origText(text, x, y, options);
  };
  return doc;
}

// ==================== PDF GENERATION ====================
function generateMHPdf() {
  const r = mhLastResult;
  if (!r) return;

  const doc = createPdfDoc('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - 2 * margin;
  let y = 15;

  const primaryColor = [26, 122, 138];
  const darkColor = [11, 42, 60];
  const lightBg = [229, 245, 241];
  const white = [255, 255, 255];
  const textColor = [30, 41, 59];
  const lightText = [100, 116, 139];

  function addPageHeader() {
    doc.setFillColor(...darkColor);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setFillColor(...primaryColor);
    doc.rect(0, 24, pageW, 4, 'F');
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('SecPro', margin, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Hypotekárna analýza pre klienta', margin + 30, 14);
    doc.text(r.date || '', pageW - margin, 14, { align: 'right' });
    y = 36;
  }

  function sectionTitle(title) {
    if (y > 260) { doc.addPage(); addPageHeader(); }
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
    doc.setTextColor(...textColor);
  }

  function addRow(label, value, highlight) {
    if (y > 275) { doc.addPage(); addPageHeader(); }
    if (highlight) {
      doc.setFillColor(...lightBg);
      doc.rect(margin, y - 3.5, contentW, 6, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(label, margin + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, pageW - margin - 2, y, { align: 'right' });
    y += 6;
  }

  function addStatusRow(label, value, limit, ok) {
    if (y > 275) { doc.addPage(); addPageHeader(); }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(label, margin + 2, y);
    doc.text(value, margin + 85, y);
    doc.text('Limit: ' + limit, margin + 115, y);
    doc.setFont('helvetica', 'bold');
    if (ok) {
      doc.setTextColor(22, 101, 52);
      doc.text('OK', pageW - margin - 2, y, { align: 'right' });
    } else {
      doc.setTextColor(153, 27, 27);
      doc.text('PREKROČENÝ', pageW - margin - 2, y, { align: 'right' });
    }
    y += 6;
  }

  // === PAGE 1: Cover + Summary ===
  addPageHeader();

  // Client info box
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Analýza pre: ' + r.name, margin + 5, y + 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightText);
  doc.text('Číslo žiadosti: ' + (r.reqNum || '-'), margin + 5, y + 15);
  doc.text('Dátum: ' + (r.date || '-'), margin + 80, y + 15);
  doc.text('Počet žiadateľov: ' + r.numApplicants, margin + 130, y + 15);
  y += 28;

  // Key results
  sectionTitle('HLAVNÉ VÝSLEDKY');
  addRow('Žiadaná čiastka úveru', fmt(r.loanAmount) + ' EUR', true);
  addRow('Výška úveru s LI', fmt(r.loanWithLI) + ' EUR');
  addRow('Splatnosť', r.termMonths + ' mesiacov (' + fmtDec(r.termMonths / 12, 1) + ' rokov)');
  addRow('Ročná úroková sadzba', fmtDec(r.annualRate * 100, 2) + '%');
  y += 2;
  addRow('Anuitná mesačná splátka', fmt(r.annuity) + ' EUR', true);
  addRow('1. klesajúca splátka', fmt(r.decliningFirst) + ' EUR');
  addRow('Stresová splátka (DSTI)', fmt(r.annuityStress) + ' EUR');
  y += 2;
  addRow('Maximálna čiastka úveru (podľa príjmu)', fmtInt(r.maxLoanIncome) + ' EUR', true);
  addRow('Maximálna čiastka úveru (podľa LtV)', fmtInt(r.maxLoanLtV) + ' EUR');

  y += 4;
  sectionTitle('RIZIKOVÉ UKAZOVATELE');
  addStatusRow('DSTI (anuitné)', fmtDec(r.dstiAnnuity * 100, 2) + '%', '60,00%', r.dstiOk);
  addStatusRow('DSTI (klesajúce)', fmtDec(r.dstiDeclining * 100, 2) + '%', '60,00%', r.dstiDecOk);
  addStatusRow('DTI', fmtDec(r.dtiValue, 2), fmtDec(r.dtiLimitNorm, 2), r.dtiOk);
  addStatusRow('LtV', fmtDec(r.actualLtV * 100, 2) + '%', fmtDec(r.ltvMax * 100, 0) + '%', r.actualLtV <= r.ltvMax);
  addStatusRow('Splatnosť', r.termMonths + ' mes.', '360 mes.', r.maturityOk);

  y += 4;
  sectionTitle('FINANČNÝ PROFIL DOMÁCNOSTI');
  addRow('Čistý príjem domácnosti', fmt(r.totalIncome) + ' EUR');
  addRow('Počet vyživovaných osôb', r.totalDependants.toString());
  addRow('Náklady podľa zákona (COSTS)', fmt(r.expenses) + ' EUR');
  addRow('Náklady + bývanie', fmt(r.expensesWithHousing) + ' EUR');
  addRow('KUGD (bankový model)', fmt(r.kugd) + ' EUR');
  addRow('Disponibilný príjem', fmt(r.availableIncome) + ' EUR', true);
  addRow('Voľný príjem po záväzkoch', fmt(r.freeIncome) + ' EUR', true);

  y += 4;
  sectionTitle('ZABEZPEČENIE A NÁKLADY');
  addRow('Hodnota nehnuteľnosti č.1', fmt(r.property1) + ' EUR');
  addRow('Voľná hodnota nehnuteľnosti', fmt(r.free1) + ' EUR');
  addRow('Skutočné LtV', fmtDec(r.actualLtV * 100, 2) + '%');
  addRow('Cena znaleckého posudku', fmt(r.zp1) + ' EUR');
  addRow('Poistné za dobu splácania', fmt(r.insuranceTotal) + ' EUR');
  y += 2;
  addRow('Celkovo zaplatené (anuitné)', fmtInt(r.totalPaidAnnuity) + ' EUR', true);
  addRow('Celkovo zaplatené (klesajúce)', fmtInt(r.totalPaidDeclining) + ' EUR');
  addRow('RPMN (anuitné)', fmtDec(r.rpmn * 100, 2) + '%');
  addRow('RPMN (klesajúce)', fmtDec(r.rpmnDeclining * 100, 2) + '%');

  // === PAGE 2: Amortization Schedule ===
  doc.addPage();
  addPageHeader();

  sectionTitle('SPLÁTKOVÝ KALENDÁR - ANUITNÉ SPLÁTKY');

  const tableData = [];
  // Show yearly summary
  for (let yr = 0; yr < Math.ceil(r.termMonths / 12); yr++) {
    let yPrincipal = 0, yInterest = 0, yPayment = 0;
    let endBalance = 0;
    for (let m = yr * 12; m < Math.min((yr + 1) * 12, r.schedule.length); m++) {
      yPrincipal += r.schedule[m].principal;
      yInterest += r.schedule[m].interest;
      yPayment += r.schedule[m].payment;
      endBalance = r.schedule[m].balance;
    }
    tableData.push([
      (yr + 1).toString(),
      fmt(yPrincipal),
      fmt(yInterest),
      fmt(yPayment),
      fmt(endBalance)
    ]);
  }

  doc.autoTable({
    startY: y,
    head: [['Rok', 'Istina', 'Úrok', 'Celková splátka', 'Zostatok']],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: textColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: darkColor,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: function() {
      // Add footer
      doc.setFontSize(7);
      doc.setTextColor(...lightText);
      doc.text('Generované systémom SecPro | Tento dokument má informatívny charakter', pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }
  });

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...lightText);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text('SecPro - Finančná analýza | Generované: ' + new Date().toLocaleDateString('sk-SK'), margin, pageH - 5);
    doc.text('Strana ' + i + ' z ' + totalPages, pageW - margin, pageH - 5, { align: 'right' });
    // Bottom line
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
  }

  doc.save('SecPro_Hypotecna_Analyza_' + (r.name || 'klient').replace(/\s+/g, '_') + '.pdf');
}

// ==================== 16. HISTORIA ANALYZ ====================
const HIST_KEY = 'finio-history';
const HIST_TYPES = {
  'mhypoteka': { label: 'Jedna domácnosť', color: '#1a56db', bg: '#eff6ff', icon: '&#9971;' },
  'mhypoteka-multi': { label: 'Viac domácností', color: '#7c3aed', bg: '#f5f3ff', icon: '&#9971;' },
  'mhypoteka-rovne': { label: 'Rovné splátky', color: '#059669', bg: '#ecfdf5', icon: '&#9776;' },
  'mhypoteka-klesajuce': { label: 'Klesajúce splátky', color: '#d97706', bg: '#fffbeb', icon: '&#9776;' },
  'metodika': { label: 'Porovnanie bánk', color: '#dc2626', bg: '#fef2f2', icon: '&#9878;' }
};

function getHistory() { return _getCached('history', []); }
function setHistory(arr) { _setCached('history', arr); }

function showToast(msg, isError) {
  let t = document.getElementById('finio-toast');
  if (!t) { t = document.createElement('div'); t.id = 'finio-toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 2500);
}

function saveAnalysis(type) {
  let data = null, autoName = '';
  const now = new Date().toISOString();
  if (type === 'mhypoteka' && mhLastResult) {
    data = { inputs: collectMhInputs(), result: mhLastResult };
    autoName = (mhLastResult.name || 'Klient') + ' - Hypotéka';
  } else if (type === 'mhypoteka-multi' && mmLastResult) {
    data = { inputs: collectMmInputs(), result: mmLastResult };
    autoName = (mmLastResult.name || 'Klient') + ' - Viac domácností';
  } else if (type === 'mhypoteka-rovne' && rsLastData) {
    data = { inputs: { amount: +document.getElementById('rs-amount').value, rate: +document.getElementById('rs-rate').value, term: +document.getElementById('rs-term').value }, summary: { annuity: rsLastData.annuity, totalInterest: rsLastData.totalInterest, totalPaid: rsLastData.totalPaid } };
    autoName = fmt(rsLastData.amount) + ' EUR - Rovné splátky';
  } else if (type === 'mhypoteka-klesajuce' && ksLastData) {
    data = { inputs: { amount: +document.getElementById('ks-amount').value, rate: +document.getElementById('ks-rate').value, term: +document.getElementById('ks-term').value }, summary: { firstPayment: ksLastData.firstPayment, lastPayment: ksLastData.lastPayment, totalInterest: ksLastData.totalInterest, totalPaid: ksLastData.totalPaid } };
    autoName = fmt(ksLastData.amount) + ' EUR - Klesajúce splátky';
  } else if (type === 'metodika' && metLastData) {
    data = { inputs: collectMetInputs(), sums: metLastData.sums, totalInput: metLastData.totalInput };
    autoName = 'Porovnanie bánk - ' + fmt(metLastData.totalInput) + ' EUR';
  }
  if (!data) { showToast('Najprv spravte výpočet!', true); return; }
  // Remove schedule arrays to save space
  if (data.result && data.result.schedule) delete data.result.schedule;
  const hist = getHistory();
  // Update existing entry if loaded from history
  if (window.activeHistoryId) {
    const idx = hist.findIndex(e => e.id === window.activeHistoryId && e.type === type);
    if (idx !== -1) {
      hist[idx].data = data;
      hist[idx].date = now;
      setHistory(hist);
      showToast('Analýza aktualizovaná!');
      return;
    }
  }
  const entry = { id: Date.now(), name: autoName, type, date: now, data };
  window.activeHistoryId = entry.id;
  hist.unshift(entry);
  setHistory(hist);
  updateSaveBtnLabel(type, true);
  showNewAnalysisBtn(type, true);
  showToast('Analýza uložená!');
}

function collectMhInputs() {
  const ids = ['mh-name','mh-date','mh-reqnum','mh-applicants','mh-income1','mh-alimony1','mh-housing1','mh-dob1','mh-income2','mh-alimony2','mh-housing2','mh-dob2','mh-income3','mh-alimony3','mh-housing3','mh-dob3','mh-income4','mh-alimony4','mh-housing4','mh-dob4','mh-dependants','mh-children','mh-loans','mh-overdraft','mh-creditcard','mh-alimexec','mh-loan-amount','mh-term','mh-interest','mh-loan-type','mh-life-insurance','mh-property1','mh-free1','mh-zp1','mh-insurance1'];
  const obj = {};
  ids.forEach(id => { const el = document.getElementById(id); if (el) obj[id] = el.value; });
  return obj;
}
function collectMmInputs() {
  const obj = {};
  ['mm-name','mm-date','mm-reqnum','mm-h1-count','mm-h1-income1','mm-h1-alimony1','mm-h1-housing1','mm-h1-dob1','mm-h1-income2','mm-h1-alimony2','mm-h1-housing2','mm-h1-dob2','mm-h1-income3','mm-h1-alimony3','mm-h1-housing3','mm-h1-dob3','mm-h1-dependants','mm-h1-children','mm-h1-loans','mm-h1-overdraft','mm-h1-creditcard','mm-h1-alimexec','mm-h2-count','mm-h2-income1','mm-h2-alimony1','mm-h2-housing1','mm-h2-dob1','mm-h2-income2','mm-h2-alimony2','mm-h2-housing2','mm-h2-dob2','mm-h2-income3','mm-h2-alimony3','mm-h2-housing3','mm-h2-dob3','mm-h2-dependants','mm-h2-children','mm-h2-loans','mm-h2-overdraft','mm-h2-creditcard','mm-h2-alimexec','mm-loan-amount','mm-term','mm-interest','mm-loan-type','mm-life-insurance','mm-property1','mm-free1','mm-zp1','mm-insurance1'].forEach(id => { const el = document.getElementById(id); if (el) obj[id] = el.value; });
  return obj;
}
function collectMetInputs() {
  const obj = {};
  MET_ROWS.forEach(key => { const el = document.getElementById('met-' + key); if (el) obj[key] = +el.value; });
  return obj;
}

function renderHistory() {
  const hist = getHistory();
  const container = document.getElementById('hist-list');
  if (!container) return;
  if (hist.length === 0) {
    container.innerHTML = '<div class="hist-empty"><div class="hist-empty-icon">&#128203;</div><h3 style="color:var(--text);margin-bottom:0.5rem">Zatiaľ žiadne uložené analýzy</h3><p>Po vykonaní výpočtu kliknite na tlačidlo "Uložiť analýzu"</p></div>';
    return;
  }
  container.innerHTML = hist.map(e => {
    const t = HIST_TYPES[e.type] || { label: e.type, color: '#64748b', bg: '#f8fafc', icon: '&#9679;' };
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'});
    return `<div class="hist-card" data-id="${e.id}">
      <div class="hist-card-icon" style="background:${t.bg};color:${t.color}">${t.icon}</div>
      <div class="hist-card-body">
        <div class="hist-card-name">${escHtml(e.name)}</div>
        <div class="hist-card-meta">
          <span class="hist-badge" style="background:${t.bg};color:${t.color}">${t.label}</span>
          <span>${dateStr}</span>
        </div>
      </div>
      <div class="hist-actions">
        <button class="hist-btn hist-btn-open" onclick="loadAnalysis(${e.id})">Otvoriť</button>
        <button class="hist-btn hist-btn-rename" onclick="renameAnalysis(${e.id})">Premenovat</button>
        <button class="hist-btn hist-btn-delete" onclick="confirmDeleteAnalysis(${e.id})">Vymazať</button>
      </div>
    </div>`;
  }).join('');
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renameAnalysis(id) {
  const hist = getHistory();
  const entry = hist.find(e => e.id === id);
  if (!entry) return;
  showModal('Premenovať analýzu', 'Zadajte nový názov:', entry.name, (newName) => {
    if (newName && newName.trim()) {
      entry.name = newName.trim();
      setHistory(hist);
      renderHistory();
      showToast('Analýza premenovaná!');
    }
  });
}

function confirmDeleteAnalysis(id) {
  const hist = getHistory();
  const entry = hist.find(e => e.id === id);
  if (!entry) return;
  showConfirm('Vymazať analyzu?', 'Naozaj chcete vymazat "' + escHtml(entry.name) + '"? Tuto akciu nie je mozne vratit.', () => {
    const newHist = hist.filter(e => e.id !== id);
    setHistory(newHist);
    renderHistory();
    showToast('Analýza vymazaná!');
  });
}

window.activeHistoryId = null;

function loadAnalysis(id) {
  const hist = getHistory();
  const entry = hist.find(e => e.id === id);
  if (!entry) return;
  const inputs = entry.data.inputs;
  if (!inputs) { showToast('Chyba: dáta nie sú dostupné', true); return; }
  window.activeHistoryId = id;

  if (entry.type === 'mhypoteka') {
    showPage('mhypoteka');
    Object.keys(inputs).forEach(k => { const el = document.getElementById(k); if (el) el.value = inputs[k]; });
    if (typeof toggleApplicants === 'function') toggleApplicants();
    calcMHypoteka();
  } else if (entry.type === 'mhypoteka-multi') {
    showPage('mhypoteka-multi');
    Object.keys(inputs).forEach(k => { const el = document.getElementById(k); if (el) el.value = inputs[k]; });
    mmToggleApplicants(1); mmToggleApplicants(2);
    calcMultiHousehold();
  } else if (entry.type === 'mhypoteka-rovne') {
    showPage('mhypoteka-rovne');
    document.getElementById('rs-amount').value = inputs.amount;
    document.getElementById('rs-rate').value = inputs.rate;
    document.getElementById('rs-term').value = inputs.term;
    calcRovneSplatky();
  } else if (entry.type === 'mhypoteka-klesajuce') {
    showPage('mhypoteka-klesajuce');
    document.getElementById('ks-amount').value = inputs.amount;
    document.getElementById('ks-rate').value = inputs.rate;
    document.getElementById('ks-term').value = inputs.term;
    calcKlesajuceSplatky();
  } else if (entry.type === 'metodika') {
    showPage('metodika');
    MET_ROWS.forEach(key => { const el = document.getElementById('met-' + key); if (el && inputs[key] !== undefined) el.value = inputs[key]; });
    calcMetodika();
  }
  updateSaveBtnLabel(entry.type, true);
  showNewAnalysisBtn(entry.type, true);
  showToast('Analýza načítaná!');
}

function updateSaveBtnLabel(type, isUpdate) {
  const btnMap = {
    'mhypoteka': 'save-btn-mhypoteka',
    'mhypoteka-multi': 'save-btn-mhypoteka-multi',
    'mhypoteka-rovne': 'rs-save-btn',
    'mhypoteka-klesajuce': 'ks-save-btn',
    'metodika': 'save-btn-metodika'
  };
  const btn = document.getElementById(btnMap[type]);
  if (!btn) return;
  if (isUpdate) {
    btn.innerHTML = '&#128260; Aktualizovať analýzu';
    btn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
  } else {
    btn.innerHTML = '&#128190; Uložiť analýzu';
    btn.style.background = 'linear-gradient(135deg,#0ea5e9,#06b6d4)';
  }
}

function showNewAnalysisBtn(type, show) {
  const btn = document.getElementById('new-btn-' + type);
  if (btn) btn.style.display = show ? 'inline-block' : 'none';
}

function startNewAnalysis(type) {
  window.activeHistoryId = null;
  updateSaveBtnLabel(type, false);
  showNewAnalysisBtn(type, false);
  // Clear form inputs
  const page = document.getElementById('page-' + type);
  if (page) {
    page.querySelectorAll('input[type="number"], input[type="text"], input[type="date"]').forEach(inp => {
      if (inp.type === 'number') inp.value = '';
      else if (inp.type === 'date') inp.value = '';
      else inp.value = '';
    });
    page.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
  }
  // Hide results
  if (type === 'mhypoteka') { document.getElementById('mh-results').innerHTML = ''; document.getElementById('mh-schedule').innerHTML = ''; document.getElementById('mh-pdf-section').style.display = 'none'; mhLastResult = null; }
  if (type === 'mhypoteka-multi') { document.getElementById('mm-results').innerHTML = ''; document.getElementById('mm-pdf-section').style.display = 'none'; mmLastResult = null; }
  if (type === 'mhypoteka-rovne') { document.getElementById('rs-results').innerHTML = ''; document.getElementById('rs-save-btn').style.display = 'none'; rsLastData = null; }
  if (type === 'mhypoteka-klesajuce') { document.getElementById('ks-results').innerHTML = ''; document.getElementById('ks-save-btn').style.display = 'none'; ksLastData = null; }
  if (type === 'metodika') { document.querySelectorAll('.met-input').forEach(function(inp) { inp.value = 0; }); calcMetodika(); metLastData = null; }
  showToast('Pripravené na novú analýzu');
}

function showModal(title, desc, currentVal, onSave) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-box"><h3>${title}</h3><p>${desc}</p><input type="text" id="modal-input" value="${escHtml(currentVal)}"><div class="modal-btns"><button onclick="this.closest('.modal-overlay').remove()" style="background:#f1f5f9;color:var(--text)">Zrušiť</button><button id="modal-save" style="background:var(--primary);color:white">Uložiť</button></div></div>`;
  document.body.appendChild(ov);
  const inp = document.getElementById('modal-input');
  inp.focus(); inp.select();
  document.getElementById('modal-save').onclick = () => { onSave(inp.value); ov.remove(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') { onSave(inp.value); ov.remove(); } };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

function showConfirm(title, desc, onConfirm) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-box"><h3>${title}</h3><p>${desc}</p><div class="modal-btns"><button onclick="this.closest('.modal-overlay').remove()" style="background:#f1f5f9;color:var(--text)">Zrušiť</button><button id="modal-confirm" style="background:#991b1b;color:white">Vymazať</button></div></div>`;
  document.body.appendChild(ov);
  document.getElementById('modal-confirm').onclick = () => { onConfirm(); ov.remove(); };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

// ==================== 15. UVEROVA METODIKA ====================
const BANK_RULES = {
  zam:       { bks:1, csob:1, mbank:1, prima:1, slsp:1, tatra:1, unicredit:1, vub:1, '365':1 },
  diety:     { bks:null, csob:0.4, mbank:0.5, prima:0.5, slsp:0.5, tatra:0.5, unicredit:0.5, vub:0.88, '365':{fn:v=>(v*0.6)/12,div12:true} },
  'szco-obrat': { bks:null, csob:{fn:v=>(v*0.5)/12}, mbank:{fn:v=>(v*0.4)/12}, prima:{fn:v=>(v*0.3)/12}, slsp:{fn:v=>(v*0.6)/12}, tatra:{fn:v=>(v*0.2)/12}, unicredit:{fn:v=>(v*0.5)/12}, vub:{fn:v=>(v*0.55)/12}, '365':{fn:v=>(v*0.2)/12} },
  'szco-zisk': { bks:1, csob:null, mbank:null, prima:1, slsp:1, tatra:1, unicredit:1, vub:1, '365':1 },
  sro50:     { bks:null, csob:{fn:v=>(v*0.5)/12}, mbank:null, prima:null, slsp:{fn:v=>(v*0.1)/12}, tatra:{fn:v=>(v*0.2)/12}, unicredit:null, vub:{fn:v=>(v*0.55)/12}, '365':{fn:v=>(v*0.2)/12} },
  sro50p:    { bks:null, csob:{fn:v=>(v*0.3)/12}, mbank:null, prima:null, slsp:{fn:v=>(v*0.1)/12}, tatra:{fn:v=>(v*0.2)/12}, unicredit:null, vub:{fn:v=>(v*0.55)/12}, '365':{fn:v=>(v*0.2)/12} },
  sro80:     { bks:null, csob:{fn:v=>(v*0.3)/12}, mbank:null, prima:null, slsp:{fn:v=>(v*0.1)/12}, tatra:{fn:v=>(v*0.2)/12}, unicredit:null, vub:{fn:v=>(v*0.12)/12}, '365':{fn:v=>(v*0.2)/12} },
  'sro-zisk': { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:{fn:v=>v/12}, '365':null },
  mandat:    { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:{fn:v=>(v*0.6)/12}, vub:null, '365':null },
  komory:    { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  pfa:       { bks:null, csob:{fn:v=>(v*0.7)/12}, mbank:{fn:v=>(v*0.6)/12}, prima:null, slsp:{fn:v=>(v*0.6)/12}, tatra:{fn:v=>(v*0.6)/12}, unicredit:{fn:v=>(v*0.6)/12}, vub:{fn:v=>(v*0.3)/12}, '365':{fn:v=>(v*0.5)/12} },
  najom:     { bks:0.4, csob:0.7, mbank:0.6, prima:null, slsp:0.5, tatra:0.5, unicredit:1, vub:0.5, '365':0.6 },
  matrp:     { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  vyzivne:   { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  bonus:     { bks:1, csob:null, mbank:null, prima:1, slsp:1, tatra:null, unicredit:1, vub:1, '365':1 },
  pridavky:  { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  invalid:   { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  vysluha:   { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  starobny:  { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null },
  vdovsky:   { bks:null, csob:null, mbank:null, prima:null, slsp:null, tatra:null, unicredit:null, vub:null, '365':null }
};

const MET_BANKS = ['bks','csob','mbank','prima','slsp','tatra','unicredit','vub','365'];
const MET_BANK_NAMES = { bks:'BKS', csob:'ČSOB', mbank:'mBank', prima:'Prima', slsp:'SLSP', tatra:'Tatra', unicredit:'UniCredit', vub:'VÚB', '365':'365' };
const MET_ROWS = ['zam','diety','szco-obrat','szco-zisk','sro50','sro50p','sro80','sro-zisk','mandat','komory','pfa','najom','matrp','vyzivne','bonus','pridavky','invalid','vysluha','starobny','vdovsky'];
const MET_ROW_LABELS = {
  'zam':'Zamestnanie - čistý príjem','diety':'Diéty','szco-obrat':'SZČO obrat','szco-zisk':'SZČO zisk',
  'sro50':'s.r.o. obrat do 50 000','sro50p':'s.r.o. obrat nad 50 000','sro80':'s.r.o. obrat nad 80 000',
  'sro-zisk':'s.r.o. podiel na zisku','mandat':'Mandátna zmluva','komory':'Komory',
  'pfa':'PFA / Finportal','najom':'Nájomné','matrp':'Materská / RD','vyzivne':'Výživné',
  'bonus':'Daňový bonus na dieťa','pridavky':'Rodinné prídavky','invalid':'Invalidný dôchodok',
  'vysluha':'Výsluhový dôchodok','starobny':'Starobný dôchodok','vdovsky':'Vdovský dôchodok'
};

let metLastData = null;

const MET_NOTES = {
  // Row: diety
  'diety-prima': 'Max. 70% celkových príjmov',
  'diety-slsp': 'Max 500 EUR',
  'diety-tatra': 'Max 30% celkových príjmov',
  'diety-unicredit': 'Diéty iba vodiči kamiónov, 50% za posledných 6M PP min 12M, doba neurčitá, diéty na účet.',
  'diety-vub': 'Akceptujú do 100%, pokiaľ sú vyplácané bezhotovostne na účet. Od 04.06.2024 platí, že ak klient má variabilnú časť mzdy (diéty), zníži sa o 12%.',
  'diety-365': '60% diét, ak sú pravidelne mesačne vyplácané na bankový účet a potvrdené zamestnávateľom. Neakceptujú diéty zo zahraničia.',
  // Row: szco-obrat
  'szco-obrat-bks': 'Individuálne posúdenie',
  'szco-obrat-csob': 'Obrat do 50.000 EUR: 50% z obratu. Obrat nad 50.000 EUR: 40% z obratu. Max čistý mesačný príjem 20.000 EUR.',
  'szco-obrat-mbank': 'mHypotéka nad 50% LTV: 40% z obratu z DP. LTV do 50%: 60% z obratu z výpisov z účtu za 6M. Max účelový 165.000 EUR, neúčelový 75.000 EUR.',
  'szco-obrat-slsp': 'Štandardne 10% z tržieb. Slobodné povolania: 20-40%. Paušalisti: 60%. Max 4.000 EUR mesačne.',
  'szco-obrat-tatra': '20% z tržieb, max 5.500 EUR/mes. Min. doba podnikania 24 mesiacov. Max LTV 80%.',
  'szco-obrat-unicredit': '50% z príjmu v DP. Slobodné povolania: 60%. Max LTV 80%. Max podiel dlhu 60%.',
  'szco-obrat-vub': '55% ročného príjmu z DP/12 pri obrate do 80 tis. EUR. 12% pri obrate nad 80 tis. EUR.',
  'szco-obrat-365': '20% z ročných tržieb/12 alebo (Základ dane - Daň)/12 - vyššia hodnota. Slobodné povolania: 40% z ročných tržieb/12. Min. 18 mesiacov podnikania.',
  // Row: szco-zisk
  'szco-zisk-bks': 'Individuálne posúdenie',
  // Row: sro50
  'sro50-bks': 'Individuálne posúdenie',
  'sro50-csob': 'Obrat do 50.000 EUR: 50% z obratu / 12 x podiel. Max čistý mesačný príjem 20.000 EUR.',
  'sro50-slsp': '10% z tržieb. Slobodné povolania: 20-40%. Max 4.000 EUR mesačne.',
  'sro50-tatra': '20% z tržieb, max 5.500 EUR/mes. Min. podiel v spoločnosti 50%. Min. existencia 24 mesiacov.',
  'sro50-vub': '55% ročných tržieb z účtovnej závierky/12. Klient musí byť 100% vlastník alebo s manželkou výluční vlastníci.',
  'sro50-365': '20% z obratu spoločnosti x podiel žiadateľa. Min. 18 mesiacov, podaný DP, zaplatená daň, zisk >= 0.',
  // Row: sro50p
  'sro50p-csob': 'Obrat nad 50.000 EUR: 30% z obratu / 12 x podiel. Max čistý mesačný príjem 20.000 EUR.',
  'sro50p-slsp': '10% z tržieb. Max 4.000 EUR mesačne.',
  'sro50p-tatra': '20% z tržieb, max 5.500 EUR/mes. Min. podiel 50%.',
  'sro50p-vub': '55% ročných tržieb/12 do 80 tis. EUR. 12% nad 80 tis. EUR.',
  'sro50p-365': '20% z obratu spoločnosti x podiel. Min. 18 mesiacov.',
  // Row: sro80
  'sro80-csob': 'Obrat nad 50.000 EUR: 30% z obratu / 12 x podiel.',
  'sro80-slsp': '10% z tržieb. Max 4.000 EUR mesačne.',
  'sro80-tatra': '20% z tržieb, max 5.500 EUR/mes.',
  'sro80-vub': '12% ročných tržieb z účtovnej závierky/12 pri obrate nad 80 tis. EUR.',
  'sro80-365': '20% z obratu spoločnosti x podiel.',
  // Row: sro-zisk
  'sro-zisk-bks': 'Individuálne posúdenie',
  'sro-zisk-mbank': 'Musí byť na účet',
  'sro-zisk-slsp': 'Nemusí byť na účet',
  'sro-zisk-tatra': 'Nemusí byť prerozdelený',
  'sro-zisk-unicredit': 'Akceptujú pri vlastníctve nad 33%. Max LTV 80%. 100% v prípade rozdeleného a vyplateného podielu za posledné 3 roky/36 mesiacov.',
  'sro-zisk-vub': 'Príjem spoločníka = (HV po zdanení / 12) x spoluvlastnícky podiel. Klient musí byť vlastníkom aspoň 50% spoločnosti.',
  // Row: mandat
  'mandat-bks': 'Individuálne posúdenie',
  'mandat-slsp': 'Individuálne posúdenie výšky',
  'mandat-unicredit': '60%',
  'mandat-365': 'Individuálne posúdenie',
  // Row: komory
  'komory-csob': 'Komory: Advokáti, lekári, zubári, psychológovia, lekárnička, veterinári, daňoví poradcovia, audítori, architekti, reštaurátori, notári, exekútori, geodeti. 50% príjmov/12.',
  'komory-mbank': '40%',
  'komory-slsp': '30-40% tržieb. Max 4.000 EUR mesačne.',
  'komory-tatra': 'Rovnaké podmienky ako SLSP.',
  'komory-unicredit': '60%',
  'komory-vub': '55%',
  'komory-365': '40%',
  // Row: pfa
  'pfa-csob': '70% vyplatených provízií za posledných 12 mesiacov. Min. priemer 1.500 EUR. Min. zmluva s Finportal 12 mesiacov.',
  'pfa-mbank': '60% z priemeru provízií. Očistený priemer (bez najvyššej a najnižšej za 12M). Max úverová angažovanosť 400.000 EUR.',
  'pfa-slsp': 'Štandardne 40%, individuálne max 60% z obratov z DP.',
  'pfa-tatra': '30-60% z tržieb, max 5.500 EUR/mes. Min. ročné tržby 35.000 EUR. Min. doba 24 mesiacov.',
  'pfa-unicredit': '60% vyplatených provízií za 12M. PFA musí byť registrovaný v Banke.',
  'pfa-vub': '30% z provízií za posledných 18 mesiacov. Min. spolupráca s Finportal 18 mesiacov.',
  'pfa-365': '50% provízií ak činnosť trvala min. 18 mesiacov. Príjem vyplácaný na bankový účet.',
  // Row: najom
  'najom-bks': '40% z nájomného',
  'najom-csob': 'Doplnkový príjem. 70% z priemernej výšky prenájmu za posledné 3 mesiace. Vlastník nehnuteľnosti min. od októbra predchádzajúceho roku.',
  'najom-mbank': '60-70% čistého nájomného. LV + aktuálna nájomná zmluva + výpis z BÚ za 6M. Max 5 nájmov.',
  'najom-slsp': 'Z DP alebo 50% z výšky nájmu, ak ešte nemal povinnosť podať DP.',
  'najom-tatra': 'Doplnkový príjem. Podľa DP - základ dane - daň / 12.',
  'najom-unicredit': '100% z daňového základu - daň / 12. Nemôže ísť o nehnuteľnosť zabezpečujúcu úver pre tretiu osobu.',
  'najom-vub': '50% z obratov na účte za 6M alebo 50% z príjmov z prenájmu v DP - vyššia z hodnôt.',
  'najom-365': '60% z mesačného prenájmu. Nájomná zmluva min. 12M, platná min. 6M. Neakceptujú komerčné nehnuteľnosti.',
  // Row: matrp
  'matrp-csob': '473,30 EUR (materská) alebo 345,20 EUR (RD). Neakceptujú súčasne s iným príjmom.',
  'matrp-slsp': '473,30 EUR alebo 345,20 EUR. Na úvere musí byť ďalší dlžník s akceptovateľným príjmom. Neakceptujú súčasne s iným príjmom.',
  'matrp-unicredit': '100%. Pri súbehu s TPP len 50%.',
  'matrp-vub': 'Akceptuje. Nie súčasne s TPP alebo podnikaním. Individuálne posúdenie v kombinácii s inými príjmami.',
  // Row: vyzivne
  'vyzivne-mbank': 'Ako príjem neakceptujú. Overená výška výživného sa použije na krytie životných nákladov na vyživované osoby.',
  'vyzivne-slsp': 'Akceptujú 50% z súdom stanovenej sumy, max 500 EUR. Musí byť vyplácané na účet.',
  'vyzivne-vub': 'Akceptujú od 1.4.2022. Rozhodnutie súdu + výpisy z účtu za 6M.',
  'vyzivne-365': '60% z výšky mesačného výživného do 18 rokov veku. Akceptujú vyplácanie na účet aj hotovostne. Neakceptujú dobrovoľné výživné.',
  // Row: vysluha
  'vysluha-vub': 'Akceptujú. Výmer z odboru sociálneho zabezpečenia. Ak výmer starší ako 3M, potrebné výpisy z účtu za 6M.',
  'vysluha-365': 'Akceptujú, ak je vek poberateľa min. 35 rokov a výška dôchodku min. 133 EUR.',
  // Row: vdovsky
  'vdovsky-mbank': 'Doplnkový príjem',
  'vdovsky-prima': 'Doplnkový príjem',
  'vdovsky-unicredit': '60% z výmeru, max 300 EUR. Nemôže byť jediný príjem v žiadosti.',
  'vdovsky-vub': 'Doplnkový príjem',
  'vdovsky-365': 'Akceptujú, ak je vek poberateľa min. 52 rokov a výška dôchodku min. 133 EUR.'
};

function calcMetodika() {
  const sums = {};
  MET_BANKS.forEach(b => sums[b] = 0);
  let totalInput = 0;
  const rowData = {};

  MET_ROWS.forEach(key => {
    const inputId = 'met-' + key;
    const val = +(document.getElementById(inputId) || {}).value || 0;
    totalInput += val;
    rowData[key] = { input: val, banks: {} };

    MET_BANKS.forEach(bank => {
      const rule = BANK_RULES[key][bank];
      const cellId = 'met-' + key + '-' + bank;
      const cell = document.getElementById(cellId);
      if (!cell) return;

      if (rule === null) {
        cell.textContent = '-';
        cell.className = 'met-inactive';
        rowData[key].banks[bank] = null;
      } else {
        let result;
        if (typeof rule === 'number') {
          result = val * rule;
        } else if (typeof rule === 'object' && rule.fn) {
          result = rule.fn(val);
        } else {
          result = 0;
        }
        result = Math.round(result * 100) / 100;
        cell.textContent = result > 0 ? fmt(result) : '0';
        cell.className = result > 0 ? 'met-active' : '';
        sums[bank] += result;
        rowData[key].banks[bank] = result;
      }
      // Add tooltip note icon if note exists
      const noteKey = key + '-' + bank;
      if (MET_NOTES[noteKey]) {
        cell.style.position = 'relative';
        cell.innerHTML = cell.textContent + '<span class="met-note-icon">i<span class="met-tooltip">' + MET_NOTES[noteKey] + '</span></span>';
      }
    });
  });

  document.getElementById('met-sum-input').textContent = fmt(totalInput);
  MET_BANKS.forEach(bank => {
    document.getElementById('met-sum-' + bank).textContent = fmt(Math.round(sums[bank] * 100) / 100);
  });

  // Chart
  const labels = MET_BANKS.map(b => MET_BANK_NAMES[b]);
  const data = MET_BANKS.map(b => Math.round(sums[b] * 100) / 100);
  getOrCreateChart('met-chart', {
    type: 'bar', data: { labels, datasets: [{
      label: 'Akceptovaný príjem (EUR)', data,
      backgroundColor: data.map((v, i) => {
        const maxV = Math.max(...data);
        return v === maxV && v > 0 ? 'rgba(16,185,129,0.7)' : 'rgba(26,86,219,0.5)';
      }),
      borderColor: data.map((v, i) => {
        const maxV = Math.max(...data);
        return v === maxV && v > 0 ? '#10b981' : '#1a56db';
      }),
      borderWidth: 1
    }]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'EUR' } } }
    }
  });

  metLastData = { sums, totalInput, rowData };
}

function generateMetodikaPdf() {
  if (!metLastData) calcMetodika();
  const d = metLastData;
  const doc = createPdfDoc('l', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), mg = 12;
  const dark = [11,42,60], primary = [26,122,138], white = [255,255,255], text = [30,41,59], light = [100,116,139], bg = [229,245,241];

  // Header
  doc.setFillColor(...dark); doc.rect(0,0,pw,24,'F');
  doc.setFillColor(...primary); doc.rect(0,21,pw,3,'F');
  doc.setTextColor(...white); doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text('SecPro', mg, 14);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.text('Porovnanie akceptácie príjmov bankami', mg+28, 14);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('sk-SK'), pw-mg, 14, {align:'right'});

  let y = 32;

  // Summary cards row
  const bestBank = MET_BANKS.reduce((a, b) => d.sums[a] > d.sums[b] ? a : b);
  const bestVal = Math.round(d.sums[bestBank]*100)/100;
  const sorted = MET_BANKS.map(b => ({bank:b, val:Math.round(d.sums[b]*100)/100})).sort((a,b) => b.val - a.val);
  const top3 = sorted.filter(s => s.val > 0).slice(0, 3);

  // Best bank big card
  doc.setFillColor(220,252,231); doc.roundedRect(mg, y, 90, 22, 3, 3, 'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(22,101,52);
  doc.text('Najvyšší akceptovaný príjem', mg+4, y+7);
  doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text(MET_BANK_NAMES[bestBank] + '  ' + fmt(bestVal) + ' EUR', mg+4, y+17);

  // Top 3 cards
  if (top3.length >= 2) {
    doc.setFillColor(...bg); doc.roundedRect(mg+96, y, 70, 22, 3, 3, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...primary);
    doc.text('2. miesto', mg+100, y+7);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...dark);
    doc.text(MET_BANK_NAMES[top3[1].bank] + '  ' + fmt(top3[1].val) + ' EUR', mg+100, y+17);
  }
  if (top3.length >= 3) {
    doc.setFillColor(...bg); doc.roundedRect(mg+172, y, 70, 22, 3, 3, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...primary);
    doc.text('3. miesto', mg+176, y+7);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...dark);
    doc.text(MET_BANK_NAMES[top3[2].bank] + '  ' + fmt(top3[2].val) + ' EUR', mg+176, y+17);
  }

  y += 30;

  // Bar chart (manual drawing)
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...dark);
  doc.text('Akceptovaný príjem podľa bánk (EUR)', mg, y); y += 6;
  const chartW = pw - 2*mg, chartH = 40, barW = chartW / MET_BANKS.length * 0.65, gap = chartW / MET_BANKS.length;
  const maxVal = Math.max(...MET_BANKS.map(b => d.sums[b]), 1);
  // Grid lines
  doc.setDrawColor(226,232,240); doc.setLineWidth(0.2);
  for (let g = 0; g <= 4; g++) {
    const gy = y + chartH - (g/4)*chartH;
    doc.line(mg, gy, mg+chartW, gy);
    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...light);
    doc.text(fmtInt(maxVal*g/4), mg-1, gy+1, {align:'right'});
  }
  // Bars
  MET_BANKS.forEach((b, i) => {
    const val = Math.round(d.sums[b]*100)/100;
    const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
    const x = mg + i * gap + (gap - barW) / 2;
    const bY = y + chartH - barH;
    if (b === bestBank) { doc.setFillColor(16,185,129); } else { doc.setFillColor(...primary); }
    if (barH > 0.5) doc.roundedRect(x, bY, barW, barH, 1, 1, 'F');
    // Bank label
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...dark);
    doc.text(MET_BANK_NAMES[b], x + barW/2, y + chartH + 5, {align:'center'});
    // Value on top
    if (val > 0) {
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...text);
      doc.text(fmt(val), x + barW/2, bY - 1.5, {align:'center'});
    }
  });
  y += chartH + 12;

  // Table (clean, no asterisks)
  const head = [['Typ príjmu', 'Vstup', 'BKS', 'ČSOB', 'mBank', 'Prima', 'SLSP', 'Tatra', 'UniCredit', 'VÚB', '365']];
  const body = [];
  MET_ROWS.forEach(key => {
    const rd = d.rowData[key];
    if (!rd || rd.input === 0) return;
    const row = [MET_ROW_LABELS[key], fmt(rd.input)];
    MET_BANKS.forEach(b => {
      const v = rd.banks[b];
      row.push(v === null ? '-' : fmt(v));
    });
    body.push(row);
  });
  const sumRow = ['SPOLU', fmt(d.totalInput)];
  MET_BANKS.forEach(b => sumRow.push(fmt(Math.round(d.sums[b]*100)/100)));
  body.push(sumRow);

  doc.autoTable({
    startY: y, head, body, margin: { left: mg, right: mg },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: text, halign: 'right' },
    headStyles: { fillColor: dark, textColor: white, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { halign: 'left', cellWidth: 45 }, 1: { fontStyle: 'bold', fillColor: [254,242,242], textColor: [220,38,38] } },
    alternateRowStyles: { fillColor: [248,250,252] },
    willDrawCell: function(data) {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fillColor = dark;
        data.cell.styles.textColor = white;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index >= 2 && data.row.index < body.length - 1) {
        const val = data.cell.raw;
        if (val && val !== '-' && val !== '0' && val !== '0,00') {
          data.cell.styles.fillColor = [220,252,231];
          data.cell.styles.textColor = [22,101,52];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === '-') {
          data.cell.styles.textColor = [203,213,225];
        }
      }
    }
  });

  // Footer
  const tp = doc.internal.getNumberOfPages();
  for (let i = 1; i <= tp; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(...light);
    doc.text('SecPro - Finančná analýza | Výpočty sú orientačné', mg, ph-5);
    doc.text('Strana '+i+' z '+tp, pw-mg, ph-5, {align:'right'});
    doc.setDrawColor(...primary); doc.setLineWidth(0.5); doc.line(mg, ph-9, pw-mg, ph-9);
  }

  doc.save('SecPro_Porovnanie_Bank.pdf');
}

// ==================== 12. MULTI-HOUSEHOLD HELPERS ====================
function mmToggleApplicants(h) {
  const n = +document.getElementById('mm-h' + h + '-count').value;
  for (let i = 2; i <= 3; i++) {
    const el = document.getElementById('mm-h' + h + '-app' + i);
    if (el) el.style.display = i <= n ? 'block' : 'none';
  }
}

function mmCollectHousehold(h, appDate) {
  const count = +document.getElementById('mm-h' + h + '-count').value;
  const applicants = [];
  let totalIncome = 0, totalAlimony = 0, totalHousing = 0;
  for (let i = 1; i <= count; i++) {
    const income = +(document.getElementById('mm-h' + h + '-income' + i) || {}).value || 0;
    const alimony = +(document.getElementById('mm-h' + h + '-alimony' + i) || {}).value || 0;
    const housing = +(document.getElementById('mm-h' + h + '-housing' + i) || {}).value || 0;
    const dobStr = (document.getElementById('mm-h' + h + '-dob' + i) || {}).value || '';
    let age = 0;
    if (dobStr) { age = Math.floor((appDate - new Date(dobStr)) / (365.25 * 24 * 60 * 60 * 1000)); }
    applicants.push({ income, alimony, housing, age, dob: dobStr });
    totalIncome += income; totalAlimony += alimony; totalHousing += housing;
  }
  const netIncome = Math.max(totalIncome - totalAlimony, 0);
  const dependants = +document.getElementById('mm-h' + h + '-dependants').value || 0;
  const children = +document.getElementById('mm-h' + h + '-children').value || 0;
  const loans = +document.getElementById('mm-h' + h + '-loans').value || 0;
  const overdraft = +document.getElementById('mm-h' + h + '-overdraft').value || 0;
  const creditcard = +document.getElementById('mm-h' + h + '-creditcard').value || 0;
  const alimexec = +document.getElementById('mm-h' + h + '-alimexec').value || 0;
  const totalPersons = count + dependants;
  return { applicants, count, totalIncome, totalAlimony, totalHousing, netIncome, dependants, children, totalPersons, loans, overdraft, creditcard, alimexec };
}

let mmLastResult = null;

function calcMultiHousehold() {
  const dateStr = document.getElementById('mm-date').value || new Date().toISOString().split('T')[0];
  const appDate = new Date(dateStr);
  const h1 = mmCollectHousehold(1, appDate);
  const h2 = mmCollectHousehold(2, appDate);

  // Loan parameters
  const loanAmount = +document.getElementById('mm-loan-amount').value || 0;
  const termMonths = +document.getElementById('mm-term').value || 360;
  const annualRate = +document.getElementById('mm-interest').value / 100 || 0.0384;
  const loanType = document.getElementById('mm-loan-type').value;
  const lifeIns = document.getElementById('mm-life-insurance').value;

  const liCoeff = 0.015;
  let liIncluded = 0;
  if (lifeIns === 'ano-zahrnute') liIncluded = (liCoeff / (1 - liCoeff)) * loanAmount;
  const loanWithLI = loanAmount + liIncluded;

  // Property
  const property1 = +document.getElementById('mm-property1').value || 0;
  const free1 = +document.getElementById('mm-free1').value || 0;
  const zp1 = +document.getElementById('mm-zp1').value || 0;
  const insurance1 = +document.getElementById('mm-insurance1').value || 0;
  const insuranceTotal = (insurance1 / 12) * termMonths;

  let ltvStandard = 0.80, ltvMax = 0.90;
  if (loanType === 'neucelovy-standard') { ltvStandard = 0.70; ltvMax = 0.80; }
  else if (loanType === 'ucelovy-nestandard') { ltvStandard = 0.65; ltvMax = 0.90; }
  const actualLtV = free1 > 0 ? loanWithLI / free1 : 0;

  // Combined totals
  const combinedIncome = h1.netIncome + h2.netIncome;
  const combinedPersons = h1.totalPersons + h2.totalPersons;
  const combinedChildren = h1.children + h2.children;
  const combinedAlimony = h1.totalAlimony + h2.totalAlimony;
  const combinedHousing = h1.totalHousing + h2.totalHousing;

  // Combined alimony/exec
  const adjAlim1 = h1.alimexec > 0 ? Math.max(h1.alimexec, 30) : 0;
  const adjAlim2 = h2.alimexec > 0 ? Math.max(h2.alimexec, 30) : 0;
  const combinedAdjAlim = adjAlim1 + adjAlim2;

  // KUGD per household (weighted by income share)
  const incomeRatio1 = combinedIncome > 0 ? h1.netIncome / combinedIncome : 0.5;
  const incomeRatio2 = 1 - incomeRatio1;
  const kugd1 = h1.totalPersons === 0 ? 0 : Math.max(h1.totalPersons * Math.pow(185 * Math.pow(h1.totalPersons, -0.4), 1 - 0.4) * Math.pow((h1.netIncome > 0 ? (h1.netIncome * combinedIncome / (h1.netIncome + h2.netIncome)) : 0) / h1.totalPersons, 0.4), 0);
  const kugd2 = h2.totalPersons === 0 ? 0 : Math.max(h2.totalPersons * Math.pow(185 * Math.pow(h2.totalPersons, -0.4), 1 - 0.4) * Math.pow((h2.netIncome > 0 ? (h2.netIncome * combinedIncome / (h1.netIncome + h2.netIncome)) : 0) / h2.totalPersons, 0.4), 0);
  const combinedKugd = Math.max(kugd1 + kugd2, combinedPersons === 0 ? 0 : Math.max(combinedPersons * Math.pow(185 * Math.pow(combinedPersons, -0.4), 1 - 0.4) * Math.pow(combinedIncome / combinedPersons, 0.4), 0));

  // COSTS (combined)
  const baseCost = 284.13, perPerson = 198.22, perChild = 129.74;
  const expenses = combinedPersons === 0 ? 0 : (baseCost + Math.max((combinedPersons - combinedChildren - 1) * perPerson + combinedChildren * perChild - combinedAlimony, 0) + combinedAdjAlim);
  const expensesWithHousing = expenses + combinedHousing;

  // Available income
  const availableIncome = Math.max(0.95 * (combinedIncome - Math.max(expensesWithHousing, combinedKugd)), 0);

  // Combined obligations
  const combinedLoans = h1.loans + h2.loans;
  const combinedOverdraft = h1.overdraft + h2.overdraft;
  const combinedCreditcard = h1.creditcard + h2.creditcard;
  const freeIncome = Math.max(availableIncome - combinedLoans - 0.03 * combinedOverdraft - 0.03 * combinedCreditcard, 0);

  // Stress test
  const stressRate = Math.min(annualRate + 0.02, 0.06);
  const stressRateM = stressRate / 12;
  const monthlyRate = annualRate / 12;

  // Annuity
  let annuity = 0, annuityStress = 0;
  if (monthlyRate > 0 && termMonths > 0) {
    annuity = Math.round((loanWithLI * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)))) * 100) / 100;
    annuityStress = Math.round((loanWithLI * (stressRateM / (1 - Math.pow(1 + stressRateM, -360)))) * 100) / 100;
  }

  // Declining first
  const decliningFirst = termMonths > 0 ? loanWithLI / termMonths + loanWithLI * monthlyRate : 0;
  const decliningStress = loanWithLI / 360 + loanWithLI * stressRateM;

  // Min age across both households
  const allApplicants = [...h1.applicants, ...h2.applicants];
  const minAge = Math.min(...allApplicants.map(a => a.age).filter(a => a > 0));

  // Max loan income
  let maxLoanIncome = 0;
  if (freeIncome > 0 && stressRateM > 0) {
    const effectiveTerm = minAge < 60 ? Math.min(termMonths, 360) : (termMonths > 60 ? 60 : termMonths);
    maxLoanIncome = freeIncome / (stressRateM / (1 - Math.pow(1 + stressRateM, -effectiveTerm)));
  }
  const maxLoanLtV = ltvMax * free1;

  // DSTI
  const dstiBasis = combinedIncome - expenses;
  const dstiAnnuity = dstiBasis > 0 ? (combinedLoans + 0.03 * combinedOverdraft + 0.03 * combinedCreditcard + Math.max(annuity, annuityStress)) / dstiBasis : 0;
  const dstiDeclining = dstiBasis > 0 ? (combinedLoans + 0.03 * combinedOverdraft + 0.03 * combinedCreditcard + Math.max(decliningFirst, decliningStress)) / dstiBasis : 0;

  // DTI
  let dtiLimit = 0;
  allApplicants.forEach(a => {
    const lim = a.age < 41 ? 8 : (a.age + termMonths / 12 < 65 ? 8 : Math.max(8 - 0.25 * (a.age - 40), 3));
    dtiLimit += (a.income - a.alimony) * lim;
  });
  const dtiValue = combinedIncome > 0 ? (combinedLoans + combinedOverdraft * 0.03 + combinedCreditcard * 0.03 + loanWithLI) / (12 * combinedIncome) : 0;
  const dtiLimitNorm = combinedIncome > 0 ? dtiLimit / (12 * combinedIncome) : 0;

  // Amortization
  const schedule = [];
  let remaining = loanWithLI;
  for (let m = 1; m <= termMonths; m++) {
    const interest = remaining * monthlyRate;
    const principal = annuity - interest;
    remaining = Math.max(remaining - principal, 0);
    schedule.push({ month: m, principal, interest, payment: annuity, balance: remaining });
  }

  const totalPaidAnnuity = annuity * termMonths + zp1 + insuranceTotal;

  mmLastResult = {
    name: document.getElementById('mm-name').value || 'Klient', date: dateStr,
    reqNum: document.getElementById('mm-reqnum').value, h1, h2,
    combinedIncome, combinedPersons, combinedChildren, combinedAlimony, combinedHousing,
    expenses, expensesWithHousing, combinedKugd, availableIncome, freeIncome,
    loanAmount, loanWithLI, termMonths, annualRate, annuity, annuityStress,
    decliningFirst, decliningStress, maxLoanIncome, maxLoanLtV,
    actualLtV, ltvMax, dstiAnnuity, dstiDeclining,
    dtiValue, dtiLimitNorm, totalPaidAnnuity, schedule,
    combinedLoans, combinedOverdraft, combinedCreditcard,
    property1, free1, zp1, insurance1, insuranceTotal
  };

  const statusBadge = (ok) => ok
    ? '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:6px;font-weight:700;font-size:0.8rem">OK</span>'
    : '<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:6px;font-weight:700;font-size:0.8rem">PREKROČENÝ</span>';

  const hBox = (h, label) => `
    <div style="background:white;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
      <h4 style="color:var(--primary-dark);margin-bottom:0.5rem">${label}</h4>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Čistý príjem</div><div class="result-value">${fmt(h.netIncome)} EUR</div></div>
        <div class="result-box"><div class="result-label">Počet osôb</div><div class="result-value">${h.totalPersons}</div></div>
        <div class="result-box"><div class="result-label">Záväzky</div><div class="result-value">${fmt(h.loans)} EUR</div></div>
      </div>
    </div>`;

  document.getElementById('mm-results').innerHTML = `
    ${hBox(h1, 'Domácnosť č.1')}${hBox(h2, 'Domácnosť č.2')}
    <div class="card" style="margin-top:1rem;background:var(--primary-bg)">
      <div class="card-title">Kombinované výsledky</div>
      <div class="results-grid">
        <div class="result-box highlight"><div class="result-label">Anuitná splátka</div><div class="result-value">${fmt(annuity)} EUR</div></div>
        <div class="result-box"><div class="result-label">1. klesajúca splátka</div><div class="result-value">${fmt(decliningFirst)} EUR</div></div>
        <div class="result-box highlight"><div class="result-label">Max. úver (príjem)</div><div class="result-value">${fmtInt(maxLoanIncome)} EUR</div></div>
        <div class="result-box"><div class="result-label">Max. úver (LtV)</div><div class="result-value">${fmtInt(maxLoanLtV)} EUR</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-title">Rizikové ukazovatele</div>
      <div class="table-wrap"><table>
        <thead><tr><th style="text-align:left">Ukazovateľ</th><th>Hodnota</th><th>Limit</th><th>Stav</th></tr></thead>
        <tbody>
          <tr><td style="text-align:left">DSTI (anuitné)</td><td>${fmtDec(dstiAnnuity * 100, 2)}%</td><td>60,00%</td><td>${statusBadge(dstiAnnuity < 0.6)}</td></tr>
          <tr><td style="text-align:left">DSTI (klesajúce)</td><td>${fmtDec(dstiDeclining * 100, 2)}%</td><td>60,00%</td><td>${statusBadge(dstiDeclining < 0.6)}</td></tr>
          <tr><td style="text-align:left">DTI</td><td>${fmtDec(dtiValue, 2)}</td><td>${fmtDec(dtiLimitNorm, 2)}</td><td>${statusBadge(dtiValue <= dtiLimitNorm)}</td></tr>
          <tr><td style="text-align:left">LtV</td><td>${fmtDec(actualLtV * 100, 2)}%</td><td>${fmtDec(ltvMax * 100, 0)}%</td><td>${statusBadge(actualLtV <= ltvMax)}</td></tr>
        </tbody>
      </table></div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-title">Finančný profil (kombinované)</div>
      <div class="results-grid">
        <div class="result-box"><div class="result-label">Kombinovaný príjem</div><div class="result-value">${fmt(combinedIncome)} EUR</div></div>
        <div class="result-box"><div class="result-label">Náklady (zákon)</div><div class="result-value">${fmt(expenses)} EUR</div></div>
        <div class="result-box"><div class="result-label">KUGD</div><div class="result-value">${fmt(combinedKugd)} EUR</div></div>
        <div class="result-box"><div class="result-label">Voľný príjem</div><div class="result-value">${fmt(freeIncome)} EUR</div></div>
      </div>
    </div>`;

  // Chart
  const labels = [], balData = [], prinData = [], intData = [];
  for (let i = 0; i < schedule.length; i += 12) {
    labels.push(Math.floor(i / 12) + 1 + '. rok');
    balData.push(schedule[i].balance);
    let yP = 0, yI = 0;
    for (let m = i; m < Math.min(i + 12, schedule.length); m++) { yP += schedule[m].principal; yI += schedule[m].interest; }
    prinData.push(yP); intData.push(yI);
  }
  getOrCreateChart('mm-chart', {
    type: 'bar', data: { labels, datasets: [
      { label: 'Istina', data: prinData, backgroundColor: 'rgba(26,86,219,0.5)' },
      { label: 'Úrok', data: intData, backgroundColor: 'rgba(239,68,68,0.4)' },
      { label: 'Zostatok', data: balData, type: 'line', borderColor: '#1e3a8a', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', tension: 0.3, pointRadius: 1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: {
      y: { beginAtZero: true, position: 'left' },
      y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
    }}
  });
  document.getElementById('mm-pdf-section').style.display = 'block';
}

function generateMultiPdf() {
  const r = mmLastResult;
  if (!r) return;
  const doc = createPdfDoc('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const m = 15, cW = pageW - 2 * m;
  let y = 15;
  const dark = [11,42,60], primary = [26,122,138], white = [255,255,255], text = [30,41,59], light = [100,116,139], bg = [229,245,241];

  function hdr() {
    doc.setFillColor(...dark); doc.rect(0,0,pageW,28,'F');
    doc.setFillColor(...primary); doc.rect(0,24,pageW,4,'F');
    doc.setTextColor(...white); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text('SecPro', m, 14); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Hypotekárna analýza - Viac domácností', m+30, 14);
    doc.text(r.date || '', pageW-m, 14, {align:'right'}); y = 36;
  }
  function sec(t) {
    if (y > 260) { doc.addPage(); hdr(); }
    doc.setFillColor(...primary); doc.rect(m,y,cW,8,'F');
    doc.setTextColor(...white); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(t, m+3, y+5.5); y += 12; doc.setTextColor(...text);
  }
  function row(l,v,hl) {
    if (y > 275) { doc.addPage(); hdr(); }
    if (hl) { doc.setFillColor(...bg); doc.rect(m,y-3.5,cW,6,'F'); }
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...text);
    doc.text(l, m+2, y); doc.setFont('helvetica','bold');
    doc.text(v, pageW-m-2, y, {align:'right'}); y += 6;
  }

  hdr();
  doc.setFillColor(...bg); doc.roundedRect(m,y,cW,16,3,3,'F');
  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...dark);
  doc.text('Analýza pre: '+r.name, m+5, y+8);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...light);
  doc.text('Číslo: '+(r.reqNum||'-'), m+5, y+13); y += 22;

  sec('DOMÁCNOSŤ Č.1');
  row('Čistý príjem', fmt(r.h1.netIncome)+' EUR'); row('Počet osôb', r.h1.totalPersons.toString()); row('Záväzky', fmt(r.h1.loans)+' EUR');
  y += 2; sec('DOMÁCNOSŤ Č.2');
  row('Čistý príjem', fmt(r.h2.netIncome)+' EUR'); row('Počet osôb', r.h2.totalPersons.toString()); row('Záväzky', fmt(r.h2.loans)+' EUR');
  y += 2; sec('KOMBINOVANÉ VÝSLEDKY');
  row('Anuitná splátka', fmt(r.annuity)+' EUR', true);
  row('1. klesajúca splátka', fmt(r.decliningFirst)+' EUR');
  row('Max. úver (príjem)', fmtInt(r.maxLoanIncome)+' EUR', true);
  row('Max. úver (LtV)', fmtInt(r.maxLoanLtV)+' EUR');
  row('DSTI (anuitné)', fmtDec(r.dstiAnnuity*100, 2)+'%');
  row('DSTI (klesajúce)', fmtDec(r.dstiDeclining*100, 2)+'%');
  row('DTI', fmtDec(r.dtiValue, 2));
  row('LtV', fmtDec(r.actualLtV*100, 2)+'%');
  y += 2; sec('FINANČNÝ PROFIL');
  row('Kombinovaný príjem', fmt(r.combinedIncome)+' EUR');
  row('Náklady (zákon)', fmt(r.expenses)+' EUR');
  row('KUGD', fmt(r.combinedKugd)+' EUR');
  row('Voľný príjem', fmt(r.freeIncome)+' EUR', true);

  // Amort table
  doc.addPage(); hdr(); sec('SPLÁTKOVÝ KALENDÁR (ROČNÝ PREHĽAD)');
  const tbl = [];
  for (let yr = 0; yr < Math.ceil(r.termMonths/12); yr++) {
    let yP=0,yI=0,yT=0,eB=0;
    for (let mm = yr*12; mm < Math.min((yr+1)*12,r.schedule.length); mm++) {
      yP += r.schedule[mm].principal; yI += r.schedule[mm].interest; yT += r.schedule[mm].payment; eB = r.schedule[mm].balance;
    }
    tbl.push([(yr+1).toString(), fmt(yP), fmt(yI), fmt(yT), fmt(eB)]);
  }
  doc.autoTable({ startY:y, head:[['Rok','Istina','Úrok','Splátka','Zostatok']], body:tbl, margin:{left:m,right:m},
    styles:{fontSize:7.5,cellPadding:2,textColor:text}, headStyles:{fillColor:dark,textColor:white,fontStyle:'bold',fontSize:8,halign:'right'},
    columnStyles:{0:{halign:'center',cellWidth:15},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
    alternateRowStyles:{fillColor:[248,250,252]}
  });
  const tp = doc.internal.getNumberOfPages();
  for (let i=1;i<=tp;i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(...light);
    const pH = doc.internal.pageSize.getHeight();
    doc.text('SecPro - Finančná analýza | '+new Date().toLocaleDateString('sk-SK'), m, pH-5);
    doc.text('Strana '+i+' z '+tp, pageW-m, pH-5, {align:'right'});
    doc.setDrawColor(...primary); doc.setLineWidth(0.5); doc.line(m,pH-10,pageW-m,pH-10);
  }
  doc.save('SecPro_Viac_Domacnosti_'+(r.name||'klient').replace(/\s+/g,'_')+'.pdf');
}

// ==================== 13. ROVNE SPLATKY ====================
let rsLastData = null;
function calcRovneSplatky() {
  const amount = +document.getElementById('rs-amount').value || 0;
  const rate = +document.getElementById('rs-rate').value / 100 || 0;
  const term = +document.getElementById('rs-term').value || 0;
  const monthlyRate = rate / 12;
  const annuity = monthlyRate > 0 ? amount * monthlyRate * Math.pow(1 + monthlyRate, term) / (Math.pow(1 + monthlyRate, term) - 1) : (amount / term);

  const schedule = [];
  let remaining = amount;
  let totalInterest = 0;
  for (let m = 1; m <= term; m++) {
    const interest = remaining * monthlyRate;
    const principal = annuity - interest;
    remaining = Math.max(remaining - principal, 0);
    totalInterest += interest;
    schedule.push({ month: m, principal, interest, payment: annuity, balance: remaining });
  }

  rsLastData = { amount, rate, term, annuity, schedule, totalInterest, totalPaid: annuity * term };

  document.getElementById('rs-results').innerHTML = `
    <div class="results-grid" style="margin-top:1rem">
      <div class="result-box highlight"><div class="result-label">Mesačná splátka</div><div class="result-value">${fmt(annuity)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkovo zaplatené</div><div class="result-value">${fmtInt(annuity * term)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkový úrok</div><div class="result-value">${fmtInt(totalInterest)} EUR</div></div>
      <div class="result-box"><div class="result-label">Preplatenost</div><div class="result-value">${fmtDec(totalInterest / amount * 100, 1)}%</div></div>
    </div>`;

  // Full table
  let tbl = '<div class="table-wrap" style="margin-top:1rem;max-height:500px;overflow-y:auto"><table><thead><tr><th>Mesiac</th><th>Splátka istiny</th><th>Splátka úroku</th><th>Mesačná splátka</th><th>Zostatok istiny</th></tr></thead><tbody>';
  schedule.forEach(s => {
    tbl += `<tr><td>${s.month}</td><td>${fmt(s.principal)}</td><td>${fmt(s.interest)}</td><td>${fmt(s.payment)}</td><td>${fmt(s.balance)}</td></tr>`;
  });
  tbl += '</tbody></table></div>';
  document.getElementById('rs-table').innerHTML = tbl;

  // Chart
  const labels = [], bal = [], prin = [], inte = [];
  for (let i = 0; i < schedule.length; i += 12) {
    labels.push(Math.floor(i / 12) + 1 + '. rok');
    bal.push(schedule[i].balance);
    let yP=0,yI=0;
    for (let mm=i;mm<Math.min(i+12,schedule.length);mm++) { yP+=schedule[mm].principal; yI+=schedule[mm].interest; }
    prin.push(yP); inte.push(yI);
  }
  getOrCreateChart('rs-chart', {
    type: 'bar', data: { labels, datasets: [
      { label: 'Istina', data: prin, backgroundColor: 'rgba(26,86,219,0.5)' },
      { label: 'Úrok', data: inte, backgroundColor: 'rgba(239,68,68,0.4)' },
      { label: 'Zostatok', data: bal, type: 'line', borderColor: '#1e3a8a', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', tension: 0.3, pointRadius: 1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: {
      y: { beginAtZero: true, position: 'left' }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
    }}
  });
  document.getElementById('rs-pdf-btn').style.display = 'inline-block';
  document.getElementById('rs-save-btn').style.display = 'inline-block';
}

function exportRovnePdf() {
  if (!rsLastData) return;
  const r = rsLastData;
  const doc = createPdfDoc('p','mm','a4');
  const pw = doc.internal.pageSize.getWidth(), mg = 15;
  doc.setFillColor(11,42,60); doc.rect(0,0,pw,24,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('SecPro - Harmonogram rovných splátok', mg, 15);
  doc.setFontSize(9); doc.text(new Date().toLocaleDateString('sk-SK'), pw-mg, 15, {align:'right'});

  let y = 32;
  doc.setTextColor(30,41,59); doc.setFontSize(10);
  doc.text('Výška úveru: '+fmt(r.amount)+' EUR', mg, y); y+=6;
  doc.text('Úroková sadzba: '+fmtDec(r.rate*100, 2)+'%', mg, y); y+=6;
  doc.text('Počet splátok: '+r.term+' ('+Math.round(r.term/12)+' rokov)', mg, y); y+=6;
  doc.text('Mesačná splátka: '+fmt(r.annuity)+' EUR', mg, y); y+=10;

  const body = r.schedule.map(s => [s.month.toString(), fmt(s.principal), fmt(s.interest), fmt(s.payment), fmt(s.balance)]);
  doc.autoTable({ startY:y, head:[['Mesiac','Istina (EUR)','Úrok (EUR)','Splátka (EUR)','Zostatok (EUR)']], body,
    margin:{left:mg,right:mg}, styles:{fontSize:6.5,cellPadding:1.5}, headStyles:{fillColor:[11,42,60],textColor:[255,255,255],fontStyle:'bold',fontSize:7,halign:'right'},
    columnStyles:{0:{halign:'center',cellWidth:14},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
    alternateRowStyles:{fillColor:[248,250,252]},
    didDrawPage:()=>{ doc.setFontSize(7); doc.setTextColor(100,116,139); doc.text('SecPro | Predbežný harmonogram splátok', mg, doc.internal.pageSize.getHeight()-5); }
  });
  doc.save('SecPro_Rovne_Splatky.pdf');
}

// ==================== 14. KLESAJUCE SPLATKY ====================
let ksLastData = null;
function calcKlesajuceSplatky() {
  const amount = +document.getElementById('ks-amount').value || 0;
  const rate = +document.getElementById('ks-rate').value / 100 || 0;
  const term = +document.getElementById('ks-term').value || 0;
  const monthlyRate = rate / 12;
  const fixedPrincipal = amount / term;

  const schedule = [];
  let remaining = amount, totalInterest = 0, totalPaid = 0;
  for (let m = 1; m <= term; m++) {
    const interest = remaining * monthlyRate;
    const payment = fixedPrincipal + interest;
    remaining = Math.max(remaining - fixedPrincipal, 0);
    totalInterest += interest;
    totalPaid += payment;
    schedule.push({ month: m, principal: fixedPrincipal, interest, payment, balance: remaining });
  }

  ksLastData = { amount, rate, term, fixedPrincipal, schedule, totalInterest, totalPaid, firstPayment: schedule[0].payment, lastPayment: schedule[schedule.length-1].payment };

  document.getElementById('ks-results').innerHTML = `
    <div class="results-grid" style="margin-top:1rem">
      <div class="result-box highlight"><div class="result-label">Prvá splátka</div><div class="result-value">${fmt(schedule[0].payment)} EUR</div></div>
      <div class="result-box"><div class="result-label">Posledná splátka</div><div class="result-value">${fmt(schedule[schedule.length-1].payment)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkovo zaplatené</div><div class="result-value">${fmtInt(totalPaid)} EUR</div></div>
      <div class="result-box"><div class="result-label">Celkový úrok</div><div class="result-value">${fmtInt(totalInterest)} EUR</div></div>
    </div>`;

  let tbl = '<div class="table-wrap" style="margin-top:1rem;max-height:500px;overflow-y:auto"><table><thead><tr><th>Mesiac</th><th>Splátka istiny</th><th>Splátka úroku</th><th>Mesačná splátka</th><th>Zostatok istiny</th></tr></thead><tbody>';
  schedule.forEach(s => {
    tbl += `<tr><td>${s.month}</td><td>${fmt(s.principal)}</td><td>${fmt(s.interest)}</td><td>${fmt(s.payment)}</td><td>${fmt(s.balance)}</td></tr>`;
  });
  tbl += '</tbody></table></div>';
  document.getElementById('ks-table').innerHTML = tbl;

  const labels = [], bal = [], pay = [];
  for (let i = 0; i < schedule.length; i += 12) {
    labels.push(Math.floor(i / 12) + 1 + '. rok');
    bal.push(schedule[i].balance);
    pay.push(schedule[i].payment);
  }
  getOrCreateChart('ks-chart', {
    type: 'bar', data: { labels, datasets: [
      { label: 'Mesačná splátka', data: pay, backgroundColor: 'rgba(16,185,129,0.5)', borderColor: '#10b981', borderWidth: 1 },
      { label: 'Zostatok', data: bal, type: 'line', borderColor: '#1e3a8a', backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1', tension: 0.3, pointRadius: 1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, scales: {
      y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Splatka (EUR)' } },
      y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Zostatok (EUR)' }, grid: { drawOnChartArea: false } }
    }}
  });
  document.getElementById('ks-pdf-btn').style.display = 'inline-block';
  document.getElementById('ks-save-btn').style.display = 'inline-block';
}

function exportKlesajucePdf() {
  if (!ksLastData) return;
  const r = ksLastData;
  const doc = createPdfDoc('p','mm','a4');
  const pw = doc.internal.pageSize.getWidth(), mg = 15;
  doc.setFillColor(11,42,60); doc.rect(0,0,pw,24,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('SecPro - Harmonogram klesajúcich splátok', mg, 15);
  doc.setFontSize(9); doc.text(new Date().toLocaleDateString('sk-SK'), pw-mg, 15, {align:'right'});

  let y = 32;
  doc.setTextColor(30,41,59); doc.setFontSize(10);
  doc.text('Výška úveru: '+fmt(r.amount)+' EUR', mg, y); y+=6;
  doc.text('Úroková sadzba: '+fmtDec(r.rate*100, 2)+'%', mg, y); y+=6;
  doc.text('Počet splátok: '+r.term+' ('+Math.round(r.term/12)+' rokov)', mg, y); y+=6;
  doc.text('Prvá splátka: '+fmt(r.firstPayment)+' EUR | Posledná: '+fmt(r.lastPayment)+' EUR', mg, y); y+=10;

  const body = r.schedule.map(s => [s.month.toString(), fmt(s.principal), fmt(s.interest), fmt(s.payment), fmt(s.balance)]);
  doc.autoTable({ startY:y, head:[['Mesiac','Istina (EUR)','Úrok (EUR)','Splátka (EUR)','Zostatok (EUR)']], body,
    margin:{left:mg,right:mg}, styles:{fontSize:6.5,cellPadding:1.5}, headStyles:{fillColor:[11,42,60],textColor:[255,255,255],fontStyle:'bold',fontSize:7,halign:'right'},
    columnStyles:{0:{halign:'center',cellWidth:14},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
    alternateRowStyles:{fillColor:[248,250,252]},
    didDrawPage:()=>{ doc.setFontSize(7); doc.setTextColor(100,116,139); doc.text('SecPro | Predbežný harmonogram splátok', mg, doc.internal.pageSize.getHeight()-5); }
  });
  doc.save('SecPro_Klesajuce_Splatky.pdf');
}

// Set multi-household default date
document.addEventListener('DOMContentLoaded', () => {
  const d = new Date().toISOString().split('T')[0];
  if (document.getElementById('mm-date')) document.getElementById('mm-date').value = d;
});

// When the maklér comes back from their email/Gmail tab to SecPro, instantly
// re-poll /api/sign/list so a fresh signature shows up without waiting for
// the next page navigation.
window.addEventListener('focus', () => {
  if (typeof refreshRemoteSignatures !== 'function') return;
  // Only refresh if there are properties pending a signature — keeps us
  // from spamming the API on every tab switch.
  const props = (typeof getProperties === 'function') ? getProperties() : [];
  const hasPendingSig = props.some(p => p.nabor && p.nabor.remoteRequest && !p.nabor.remoteRequest.signedAt);
  if (!hasPendingSig) return;
  _remoteSignLastFetch = 0;
  refreshRemoteSignatures();
});

// ==================== LEAD GENERATOR ====================
let leadsData = [];

function toggleChip(el) {
  const cb = el.querySelector('input[type="checkbox"]');
  if (cb) {
    cb.checked = !cb.checked;
    el.classList.toggle('active', cb.checked);
  }
}

// ===== MULTI-SELECT DROPDOWN =====
function toggleMultiSelect(trigger) {
  const ms = trigger.closest('.multi-select');
  const wasOpen = ms.classList.contains('open');
  // Close all others
  document.querySelectorAll('.multi-select.open').forEach(m => {
    m.classList.remove('open');
    m.querySelector('.multi-select-trigger').classList.remove('open');
  });
  if (!wasOpen) {
    ms.classList.add('open');
    trigger.classList.add('open');
  }
}

function msSelect(optionEl) {
  optionEl.classList.toggle('selected');
  const ms = optionEl.closest('.multi-select');
  msUpdateTrigger(ms);
  const cbName = ms.dataset.callback;
  if (cbName && typeof window[cbName] === 'function') window[cbName]();
}

function msToggleAll(allEl) {
  const ms = allEl.closest('.multi-select');
  const options = ms.querySelectorAll('.multi-select-option');
  const selectedCount = ms.querySelectorAll('.multi-select-option.selected').length;
  const selectAll = selectedCount < options.length;
  options.forEach(o => o.classList.toggle('selected', selectAll));
  msUpdateTrigger(ms);
  const cbName = ms.dataset.callback;
  if (cbName && typeof window[cbName] === 'function') window[cbName]();
}

function msUpdateTrigger(ms) {
  const trigger = ms.querySelector('.multi-select-trigger');
  const placeholder = ms.dataset.placeholder || 'Vybrať';
  const selected = ms.querySelectorAll('.multi-select-option.selected');
  if (selected.length === 0) {
    trigger.innerHTML = placeholder;
  } else if (selected.length === 1) {
    trigger.innerHTML = selected[0].textContent.trim();
  } else {
    trigger.innerHTML = placeholder + ' <span class="multi-select-badge">' + selected.length + '</span>';
  }
}

function msGetValues(msId) {
  const ms = document.getElementById(msId);
  if (!ms) return [];
  return Array.from(ms.querySelectorAll('.multi-select-option.selected')).map(o => o.dataset.value);
}

// Close multi-selects when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.multi-select')) {
    document.querySelectorAll('.multi-select.open').forEach(m => {
      m.classList.remove('open');
      m.querySelector('.multi-select-trigger').classList.remove('open');
    });
  }
});

async function searchLeads() {
  const location = document.getElementById('lead-location').value.trim();
  const type = document.getElementById('lead-type').value;
  const priceMin = document.getElementById('lead-price-min').value;
  const priceMax = document.getElementById('lead-price-max').value;

  // Get selected sources
  const sources = [...document.querySelectorAll('.lead-source-cb:checked')].map(cb => cb.value);
  if (sources.length === 0) {
    document.getElementById('leads-status').textContent = 'Vyberte aspoň jeden zdroj';
    return;
  }

  // UI: loading state
  document.getElementById('leads-btn-text').style.display = 'none';
  document.getElementById('leads-btn-spinner').style.display = 'inline';
  document.getElementById('leads-status').textContent = 'Prehľadávam portály...';
  document.getElementById('leads-results-wrap').style.display = 'none';
  document.getElementById('leads-empty').style.display = 'none';
  document.getElementById('leads-source-status').style.display = 'none';

  // Reset filters on new search
  const sfEl = document.getElementById('leads-status-filter');
  if (sfEl) sfEl.value = '';
  const shEl = document.getElementById('leads-show-hidden');
  if (shEl) shEl.checked = false;

  try {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    params.set('type', type);
    if (priceMin) params.set('priceMin', priceMin);
    if (priceMax) params.set('priceMax', priceMax);
    params.set('sources', sources.join(','));

    // Agency filter
    const noAgency = document.getElementById('lead-no-agency').checked;
    params.set('noAgency', noAgency ? '1' : '0');

    // Deep scan — fetches detail page per listing for richer data
    const deepEl = document.getElementById('lead-deep-scan');
    if (deepEl && deepEl.checked) {
      params.set('deep', '1');
    }

    // Max pages per scraper — controls breadth of search
    const maxPagesEl = document.getElementById('lead-max-pages');
    if (maxPagesEl && maxPagesEl.value) {
      params.set('maxPages', maxPagesEl.value);
    }

    // V2 backend feature flag — query Supabase instead of live scraping
    // Toggle via: localStorage.setItem('secpro_backend', 'v2')  (or 'live')
    const backendMode = localStorage.getItem('secpro_backend');
    const v2El = document.getElementById('lead-backend-v2');
    const useV2 = backendMode === 'v2' || (v2El && v2El.checked);
    if (useV2) {
      params.set('backend', 'v2');
    }

    const resp = await fetch(`/api/leads?${params.toString()}`);
    const data = await resp.json();

    leadsData = data.results || [];

    // Show source status badges
    const statusEl = document.getElementById('leads-source-status');
    statusEl.innerHTML = '';
    const meta = data.meta?.sources || {};
    for (const [name, info] of Object.entries(meta)) {
      const badge = document.createElement('span');
      badge.className = `lead-source-badge ${info.status}`;
      badge.textContent = `${name} (${info.count})${info.status === 'error' ? ' ✗' : ''}`;
      badge.title = info.error || `${info.ms}ms`;
      statusEl.appendChild(badge);
    }
    // Show agency filter badge if active
    if (data.meta?.agencyFiltered > 0) {
      const agBadge = document.createElement('span');
      agBadge.className = 'lead-source-badge';
      agBadge.style.background = '#FFF3E0';
      agBadge.style.color = '#E65100';
      agBadge.textContent = `Vyradených RK: ${data.meta.agencyFiltered}`;
      statusEl.appendChild(agBadge);
    }
    statusEl.style.display = 'flex';

    // Render results
    if (leadsData.length > 0) {
      checkPriceUpdates(leadsData);
      renderLeadCards(leadsData);
      document.getElementById('leads-results-wrap').style.display = 'block';
      document.getElementById('leads-filter-bar').style.display = 'flex';
      document.getElementById('leads-empty').style.display = 'none';
      document.getElementById('leads-status').textContent = `Nájdených ${leadsData.length} inzerátov`;
    } else {
      document.getElementById('leads-results-wrap').style.display = 'none';
      document.getElementById('leads-filter-bar').style.display = 'none';
      document.getElementById('leads-empty').style.display = 'block';
      document.getElementById('leads-status').textContent = '';
    }
  } catch (err) {
    document.getElementById('leads-status').textContent = 'Chyba: ' + err.message;
  } finally {
    document.getElementById('leads-btn-text').style.display = 'inline';
    document.getElementById('leads-btn-spinner').style.display = 'none';
  }
}

// ── Search Lead Status System ──
const SEARCH_LEAD_STATUSES = [
  { key: 'na_spracovanie', label: 'Na spracovanie', color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'prevzaty', label: 'Prevzatý', color: '#10B981', bg: '#ECFDF5' },
  { key: 'nedovolany', label: 'Nedovolaný', color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'nechce_rk', label: 'Nechce RK', color: '#EF4444', bg: '#FEF2F2' },
  { key: 'predane', label: 'Predané', color: '#64748B', bg: '#F1F5F9' },
];

function getLeadStatuses() { return _getCached('lead_statuses', {}); }
function saveLeadStatuses(obj) { _setCached('lead_statuses', obj); }

function getLeadMeta(url) {
  const all = getLeadStatuses();
  return all[url] || null;
}

function setSearchLeadStatus(url, status) {
  const all = getLeadStatuses();
  if (!all[url]) all[url] = { status: null, notes: '', hidden: false, history: [] };
  const prev = all[url].status;
  if (prev === status) {
    all[url].status = null;
    all[url].history.push({ action: 'status_removed', value: status, at: new Date().toISOString() });
  } else {
    all[url].status = status;
    all[url].history.push({ action: 'status', value: status, at: new Date().toISOString() });
  }
  all[url].updatedAt = new Date().toISOString();
  saveLeadStatuses(all);

  // Targeted DOM update — only update THIS card (no full re-render)
  const hash = _leadUrlHash(url);
  const card = document.getElementById('lcard-' + hash);
  if (card) {
    const badges = card.querySelector('.lc2-badges');
    if (badges) {
      // Remove existing status badge
      const existing = badges.querySelector('.lc-status-active');
      if (existing) existing.remove();
      // Add new status badge if status is set
      const newStatus = all[url].status;
      if (newStatus) {
        const st = SEARCH_LEAD_STATUSES.find(function(s) { return s.key === newStatus; });
        if (st) {
          const span = document.createElement('span');
          span.className = 'lc-status-active';
          span.style.cssText = 'background:' + st.bg + ';color:' + st.color + ';border-color:' + st.color + ';';
          span.textContent = st.label;
          badges.appendChild(span);
        }
      }
    }
    // Update the select dropdown to reflect the new state
    const sel = card.querySelector('.lc2-status-select');
    if (sel) sel.value = all[url].status || '';
  }
}

function saveSearchLeadNote(url) {
  const input = document.getElementById('lead-note-' + _leadUrlHash(url));
  if (!input) return;
  const note = input.value.trim();
  const all = getLeadStatuses();
  if (!all[url]) all[url] = { status: null, notes: '', hidden: false, history: [] };
  all[url].notes = note;
  all[url].history.push({ action: 'note', value: note, at: new Date().toISOString() });
  all[url].updatedAt = new Date().toISOString();
  saveLeadStatuses(all);
  input.style.borderColor = '#10B981';
  setTimeout(() => { input.style.borderColor = '#E5E7EB'; }, 1000);
}

function toggleSearchLeadHidden(url) {
  const all = getLeadStatuses();
  if (!all[url]) all[url] = { status: null, notes: '', hidden: false, history: [] };
  all[url].hidden = !all[url].hidden;
  all[url].history.push({ action: all[url].hidden ? 'hidden' : 'unhidden', at: new Date().toISOString() });
  all[url].updatedAt = new Date().toISOString();
  saveLeadStatuses(all);
  reRenderLeadCards();
}

function toggleLeadHistory(url) {
  const hash = _leadUrlHash(url);
  const el = document.getElementById('lead-hist-' + hash);
  if (!el) return;
  if (el.style.display === 'none') {
    const meta = getLeadMeta(url);
    const history = (meta && meta.history) || [];
    if (history.length === 0) {
      el.innerHTML = '<div class="lead-history-entry" style="color:#94A3B8;">Zatiaľ žiadna história</div>';
    } else {
      el.innerHTML = [...history].reverse().map(h => {
        const d = new Date(h.at);
        const time = d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' })
          + ' ' + d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
        let label = '';
        if (h.action === 'status') {
          const st = SEARCH_LEAD_STATUSES.find(s => s.key === h.value);
          label = 'Zmenené na: <span class="lh-action">' + (st ? st.label : h.value) + '</span>';
        } else if (h.action === 'status_removed') {
          label = 'Status odstránený';
        } else if (h.action === 'note') {
          label = 'Poznámka: <span class="lh-action">' + esc(h.value || '(prázdna)') + '</span>';
        } else if (h.action === 'hidden') {
          label = 'Lead skrytý';
        } else if (h.action === 'unhidden') {
          label = 'Lead odkrytý';
        }
        return '<div class="lead-history-entry"><span class="lh-time">' + time + '</span> — ' + label + '</div>';
      }).join('');
    }
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function _leadUrlHash(url) {
  let h = 0;
  for (let i = 0; i < url.length; i++) { h = ((h << 5) - h + url.charCodeAt(i)) | 0; }
  return 'u' + Math.abs(h).toString(36);
}

function reRenderLeadCards() {
  if (typeof leadsData !== 'undefined' && leadsData.length > 0) renderLeadCards(leadsData);
}

// ── Duplicate Detection ──
// Groups leads that likely represent the same property across portals.
// Matches by: (1) same phone number, (2) very similar title + same location.
// Returns Map: leadUrl → [array of duplicate lead objects (excluding self)]
function detectDuplicates(leads) {
  const duplicateMap = new Map(); // url → Set of duplicate urls
  const savedLeads = getSavedLeads();
  const allLeads = [...leads];

  // Include saved leads in the pool for cross-referencing
  savedLeads.forEach(sl => {
    if (!allLeads.some(l => l.url === sl.url)) {
      allLeads.push(sl);
    }
  });

  // (1) Phone-based grouping
  const phoneMap = new Map(); // phone → [leads]
  allLeads.forEach(lead => {
    if (!lead.phone) return;
    const phone = lead.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (phone.length < 5) return;
    if (!phoneMap.has(phone)) phoneMap.set(phone, []);
    phoneMap.get(phone).push(lead);
  });

  phoneMap.forEach(group => {
    if (group.length < 2) return;
    group.forEach(lead => {
      group.forEach(other => {
        if (other.url === lead.url) return;
        // Only flag cross-portal duplicates (skip same source)
        if (other.source === lead.source) return;
        if (!duplicateMap.has(lead.url)) duplicateMap.set(lead.url, new Set());
        duplicateMap.get(lead.url).add(other.url);
      });
    });
  });

  // (2) Title + location similarity
  function normalizeText(str) {
    return (str || '').toLowerCase().replace(/[^a-záäčďéíľĺňóôŕšťúýž0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
  }
  function getWords(str) {
    return normalizeText(str).split(' ').filter(w => w.length > 2);
  }
  function wordOverlap(a, b) {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let matches = 0;
    setA.forEach(w => { if (setB.has(w)) matches++; });
    const total = Math.min(setA.size, setB.size);
    return total > 0 ? matches / total : 0;
  }

  for (let i = 0; i < allLeads.length; i++) {
    for (let j = i + 1; j < allLeads.length; j++) {
      const a = allLeads[i];
      const b = allLeads[j];
      // Only flag cross-portal duplicates (skip same source)
      if (a.source === b.source) continue;
      // Already linked by phone — skip
      if (duplicateMap.has(a.url) && duplicateMap.get(a.url).has(b.url)) continue;
      // Must have same location (normalized)
      const locA = normalizeText(a.location);
      const locB = normalizeText(b.location);
      if (!locA || !locB || locA !== locB) continue;
      // Title word overlap > 80%
      const wordsA = getWords(a.title);
      const wordsB = getWords(b.title);
      if (wordOverlap(wordsA, wordsB) < 0.8) continue;
      // Match found
      if (!duplicateMap.has(a.url)) duplicateMap.set(a.url, new Set());
      if (!duplicateMap.has(b.url)) duplicateMap.set(b.url, new Set());
      duplicateMap.get(a.url).add(b.url);
      duplicateMap.get(b.url).add(a.url);
    }
  }

  // Convert Sets to lead objects for easy rendering
  const leadByUrl = new Map();
  allLeads.forEach(l => leadByUrl.set(l.url, l));

  const result = new Map();
  duplicateMap.forEach((dupUrls, url) => {
    const dupLeads = [];
    dupUrls.forEach(u => {
      const l = leadByUrl.get(u);
      if (l) dupLeads.push(l);
    });
    if (dupLeads.length > 0) result.set(url, dupLeads);
  });

  return result;
}

// Toggle duplicate panel visibility
function toggleDupPanel(hash) {
  const panel = document.getElementById('dup-panel-' + hash);
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function isRealAddress(loc) {
  if (!loc || loc.length > 60) return false;
  // Contains common non-address words → probably a title
  var titleWords = /predaj|predám|prenáj|ponúk|krásn|priestrann|novostavb|rekonštruk|investič|výborn|moderný|luxus|útulný|slnečn|zariad|nezariad|čiastočn|komplet|3.?izb|2.?izb|1.?izb|4.?izb|rodinný dom|garsón|mezonet|penthouse|byt\s|bytu\s|domu\s/i;
  if (titleWords.test(loc)) return false;
  // Looks like an address: contains city name, postal code, or street indicators
  var addressPattern = /\d{3}\s?\d{2}|ulica|ul\.|nám\.|námestie|cesta|trieda|bratislava|košice|žilina|banská|nitra|trnava|prešov|trenčín|martin|poprad|zvolen|komárno|piešťany|michalovce|levice|topoľčany|ružinov|petržalka|staré mesto|nové mesto|dúbravka|karlova|devín|rača|vajnory|lamač|podunaj/i;
  return addressPattern.test(loc);
}

function renderLeadCards(leads) {
  const grid = document.getElementById('leads-cards-grid');
  if (!grid) return;

  const showHidden = document.getElementById('leads-show-hidden')?.checked || false;
  const statusFilter = document.getElementById('leads-status-filter')?.value || '';
  const allMeta = getLeadStatuses();
  const savedLeads = getSavedLeads();
  const dupMap = detectDuplicates(leads);

  // ── Compute market stats for price intelligence ──
  // Filter: must have price > 5000€ (excludes monthly rents) and size > 10m² and PPM in realistic range
  const validPrices = leads.filter(l => l.price > 5000 && l.size > 10);
  const ppmValues = validPrices.map(l => l.price / l.size).filter(v => v > 200 && v < 15000);
  const avgPPM = ppmValues.length > 0 ? ppmValues.reduce((a, b) => a + b, 0) / ppmValues.length : 0;
  const medianPPM = ppmValues.length >= 3 ? ppmValues.sort((a, b) => a - b)[Math.floor(ppmValues.length / 2)] : 0;
  // Group by property type for type-specific medians
  const ppmByType = {};
  validPrices.forEach(function(l) {
    var t = l.type || 'other';
    var v = l.price / l.size;
    if (v < 200 || v > 15000) return;
    if (!ppmByType[t]) ppmByType[t] = [];
    ppmByType[t].push(v);
  });
  Object.keys(ppmByType).forEach(function(t) {
    ppmByType[t].sort(function(a, b) { return a - b; });
  });

  let visible = 0;
  let html = '';

  for (const lead of leads) {
    const meta = allMeta[lead.url] || null;
    const isHidden = meta && meta.hidden;
    const leadStatus = meta ? meta.status : null;
    const leadNotes = meta ? (meta.notes || '') : '';

    if (isHidden && !showHidden) continue;
    if (statusFilter === 'none' && leadStatus) continue;
    if (statusFilter && statusFilter !== 'none' && leadStatus !== statusFilter) continue;

    visible++;
    const hash = _leadUrlHash(lead.url);
    const alreadySaved = savedLeads.some(s => s.url === lead.url);
    const escUrl = esc(lead.url.replace(/'/g, "\\'"));

    // Price change
    const matchedSaved = savedLeads.find(s => s.url === lead.url || (s.phone && lead.phone && s.phone === lead.phone));
    const priceChangeBadge = (matchedSaved && matchedSaved.priceHistory && matchedSaved.priceHistory.length > 1)
      ? formatPriceChangeBadge(matchedSaved.priceHistory) : '';

    // ── Price per m² + market position ──
    const ppm = (lead.price > 5000 && lead.size > 10) ? Math.round(lead.price / lead.size) : 0;
    var ppmHtml = '';
    var marketBadge = '';
    if (ppm > 200 && ppm < 15000) {
      ppmHtml = '<span class="lc-ppm">' + ppm.toLocaleString('sk-SK') + ' \u20AC/m\u00B2</span>';
      // Use type-specific median if available (≥3 samples), otherwise global
      var leadType = lead.type || 'other';
      var typeArr = ppmByType[leadType];
      var useMedian = (typeArr && typeArr.length >= 3) ? typeArr[Math.floor(typeArr.length / 2)] : medianPPM;
      var medLabel = (typeArr && typeArr.length >= 3) ? 'medi\u00E1n ' + leadType : 'medi\u00E1n trhu';
      if (useMedian > 0) {
        var diff = ((ppm - useMedian) / useMedian) * 100;
        if (diff < -12) marketBadge = '<span class="sec-tooltip-wrap"><span class="lc-market lc-market-hot">Pod cenou</span><span class="sec-tooltip">' + ppm.toLocaleString('sk-SK') + ' \u20AC/m\u00B2 vs ' + medLabel + ' ' + Math.round(useMedian).toLocaleString('sk-SK') + ' \u20AC/m\u00B2 (' + diff.toFixed(1) + '%)</span></span>';
        else if (diff < -5) marketBadge = '<span class="sec-tooltip-wrap"><span class="lc-market lc-market-good">Dobr\u00E1 cena</span><span class="sec-tooltip">' + ppm.toLocaleString('sk-SK') + ' \u20AC/m\u00B2 vs ' + medLabel + ' ' + Math.round(useMedian).toLocaleString('sk-SK') + ' \u20AC/m\u00B2 (' + diff.toFixed(1) + '%)</span></span>';
        else if (diff > 15) marketBadge = '<span class="sec-tooltip-wrap"><span class="lc-market lc-market-over">Nadcenen\u00E9</span><span class="sec-tooltip">' + ppm.toLocaleString('sk-SK') + ' \u20AC/m\u00B2 vs ' + medLabel + ' ' + Math.round(useMedian).toLocaleString('sk-SK') + ' \u20AC/m\u00B2 (+' + diff.toFixed(1) + '%)</span></span>';
      }
    }

    // ── Status pills (compact) ──
    var statusHtml = '';
    if (leadStatus) {
      var st = SEARCH_LEAD_STATUSES.find(function(s) { return s.key === leadStatus; });
      if (st) statusHtml = '<span class="lc-status-active" style="background:' + st.bg + ';color:' + st.color + ';border-color:' + st.color + ';">' + st.label + '</span>';
    }

    // ── Quick status dropdown ──
    var statusOpts = SEARCH_LEAD_STATUSES.map(function(s) {
      return '<option value="' + s.key + '"' + (leadStatus === s.key ? ' selected' : '') + '>' + s.label + '</option>';
    }).join('');

    // ── Phone button ──
    var phoneBtn = lead.phone
      ? '<a href="tel:' + lead.phone + '" class="lc2-call" title="Zavola\u0165">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'
        + esc(lead.phone) + '</a>'
      : '<span class="lc2-no-phone">Bez telef\u00F3nu</span>';

    // ── Duplicate badge ──
    var dupBadge = '';
    if (dupMap.has(lead.url)) {
      var dups = dupMap.get(lead.url);
      var dupReasons = dups.map(function(d) {
        if (d.phone && lead.phone && d.phone === lead.phone) return 'Aj na ' + d.source + ' (rovnak\u00FD telef\u00F3n)';
        return 'Aj na ' + d.source + ' (podobn\u00FD n\u00E1zov)';
      }).join(', ');
      dupBadge = '<span class="sec-tooltip-wrap"><span class="lc-dup-badge" onclick="toggleDupPanel(\'' + hash + '\')">Podobn\u00E9 ' + dups.length + 'x</span><span class="sec-tooltip">' + esc(dupReasons) + '</span></span>';
    }

    // Clean location — reject junk values from broken scrapers (query strings, etc.)
    var cleanLoc = '';
    if (lead.location && typeof lead.location === 'string') {
      var l = lead.location.trim();
      // Reject if contains URL-encoding artifacts
      if (l && !/[=?&]/.test(l) && l.length >= 2 && l.length <= 80) {
        cleanLoc = l;
      }
    }
    var locHtml = cleanLoc ? (isRealAddress(cleanLoc)
      ? '<a href="https://www.google.com/maps/search/' + encodeURIComponent(cleanLoc + ', Slovensko') + '" target="_blank" rel="noopener" class="lc2-loc" title="Otvoriť v Google Maps"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(cleanLoc) + '</a>'
      : '<span class="lc2-loc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(cleanLoc) + '</span>')
      : '';

    // Build meta pieces with bullet separators
    var metaPieces = [];
    if (locHtml) metaPieces.push(locHtml);
    if (lead.size) metaPieces.push('<span class="lc2-size">' + lead.size + ' m\u00B2</span>');
    var pricePerM = lead.price && lead.size ? Math.round(lead.price / lead.size) : null;
    if (pricePerM) metaPieces.push('<span class="lc2-ppm">' + pricePerM.toLocaleString('sk-SK') + ' \u20AC/m\u00B2</span>');
    var metaHtml = metaPieces.join('<span class="lc2-sep">\u00B7</span>');

    // ── Card HTML v3 ──
    html += '<div class="lc2' + (isHidden ? ' lc-hidden' : '') + (alreadySaved ? ' lc2-saved' : '') + '" id="lcard-' + hash + '">'
      // ── Top bar: source link + badges + dismiss ──
      + '<div class="lc2-topbar">'
        + '<div class="lc2-badges">'
          + '<a href="' + esc(lead.url) + '" target="_blank" rel="noopener" class="lc2-source" title="Otvori\u0165 inzer\u00E1t na ' + esc(lead.source) + '">'
            + esc(lead.source)
            + '<svg class="lc2-source-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><polyline points="7 7 17 7 17 17"/></svg>'
          + '</a>'
          + marketBadge
          + dupBadge
          + statusHtml
          + priceChangeBadge
        + '</div>'
        + '<button class="lc-dismiss" onclick="toggleSearchLeadHidden(\'' + escUrl + '\')" title="' + (isHidden ? 'Odkry\u0165' : 'Skry\u0165') + '">'
        + (isHidden ? '\u21A9' : '\u2715') + '</button>'
      + '</div>'
      // ── Main content ──
      + '<div class="lc2-main">'
        + (lead.imageUrl
            ? '<img class="lc2-thumb" src="' + esc(lead.imageUrl) + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'lc2-no-img\');this.remove();">'
            : '<div class="lc2-thumb lc2-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>')
        + '<div class="lc2-info">'
          + '<div class="lc2-title" title="' + esc(lead.title) + '">' + esc(lead.title || 'Bez n\u00E1zvu') + '</div>'
          + (metaHtml ? '<div class="lc2-meta">' + metaHtml + '</div>' : '')
        + '</div>'
        + '<div class="lc2-price-block">'
          + '<div class="lc2-price">' + esc(lead.priceText || 'Dohodou') + '</div>'
        + '</div>'
      + '</div>'
      // ── Action bar ──
      + '<div class="lc2-actions">'
        + phoneBtn
        + '<select class="lc2-status-select" onchange="setSearchLeadStatus(\'' + escUrl + '\', this.value)">'
          + '<option value="">Status...</option>' + statusOpts + '</select>'
        + (alreadySaved
          ? '<button class="lc2-saved-tag" onclick="unsaveLead(\'' + escUrl + '\');reRenderLeadCards();" title="Zru\u0161i\u0165 ulo\u017Eenie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>'
          : '<button class="lc2-save" onclick="saveLead(leadsData.find(l=>l.url===\'' + escUrl + '\'));reRenderLeadCards();" title="Ulo\u017Ei\u0165 do leadov"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>')
      + '</div>'
      // ── Expandable: note + history + duplicates ──
      + '<div class="lc2-expand">'
        + '<input type="text" class="lc2-note" id="lead-note-' + hash + '" value="' + esc(leadNotes).replace(/"/g, '&quot;') + '" placeholder="Pozn\u00E1mka..." '
          + 'onkeydown="if(event.key===\'Enter\'){saveSearchLeadNote(\'' + escUrl + '\');this.classList.add(\'lc2-note-ok\');setTimeout(()=>this.classList.remove(\'lc2-note-ok\'),1200);}" '
          + 'onblur="saveSearchLeadNote(\'' + escUrl + '\')" />'
        + '<div class="lc2-expand-row">'
          + '<span class="lc-history-toggle" onclick="toggleLeadHistory(\'' + escUrl + '\')">\u25BE hist\u00F3ria</span>'
        + '</div>'
        + '<div class="lead-history-log" id="lead-hist-' + hash + '" style="display:none;"></div>'
        + (dupMap.has(lead.url) ? (function() {
          var dups = dupMap.get(lead.url);
          var isSL = function(u) { return savedLeads.some(function(s) { return s.url === u; }); };
          return '<div class="lc-dup-panel" id="dup-panel-' + hash + '" style="display:none;">'
            + dups.map(function(d) {
              return '<div class="lc-dup-item">'
                + '<span class="lc-dup-source">' + esc(d.source || '') + '</span>'
                + (isSL(d.url) ? '<span class="lc-dup-saved-tag">Ulo\u017Een\u00FD</span>' : '')
                + '<a href="' + esc(d.url) + '" target="_blank" rel="noopener" class="lc-dup-title">' + esc(d.title || '') + '</a>'
                + '<span class="lc-dup-price">' + esc(d.priceText || '') + '</span>'
              + '</div>';
            }).join('') + '</div>';
        })() : '')
      + '</div>'
    + '</div>';
  }

  grid.innerHTML = html;

  var countEl = document.getElementById('leads-visible-count');
  if (countEl) {
    var total = leads.length;
    var hiddenCount = leads.filter(function(l) { var m = allMeta[l.url]; return m && m.hidden; }).length;
    countEl.textContent = visible + ' z ' + total + ' zobrazen\u00FDch' + (hiddenCount > 0 ? ' (' + hiddenCount + ' skryt\u00FDch)' : '');
  }
}

async function fetchLeadPhone(url, tdElement) {
  tdElement.innerHTML = '<span style="font-size:0.72rem;color:var(--text-light)">Hľadám...</span>';
  try {
    const resp = await fetch(`/api/lead-detail?url=${encodeURIComponent(url)}`);
    const data = await resp.json();
    if (data.phones && data.phones.length > 0) {
      const phone = data.phones[0];
      tdElement.innerHTML = `<a href="tel:${phone}" style="color:#1A7A8A;font-weight:600;text-decoration:none;">${phone}</a>`;
    } else {
      tdElement.innerHTML = '<span style="font-size:0.72rem;color:var(--text-light)">Nenájdené</span>';
    }
  } catch (e) {
    tdElement.innerHTML = '<span style="font-size:0.72rem;color:#E8734A;">Chyba</span>';
  }
}

function exportLeadsCSV() {
  if (!leadsData.length) return;
  const allMeta = getLeadStatuses();
  const headers = ['Zdroj','Názov','Lokalita','Cena','m²','Telefón','Status','Poznámka','Odkaz'];
  const rows = leadsData.map(l => {
    const meta = allMeta[l.url] || {};
    const st = SEARCH_LEAD_STATUSES.find(s => s.key === meta.status);
    return [
      l.source,
      `"${(l.title||'').replace(/"/g,'""')}"`,
      `"${(l.location||'').replace(/"/g,'""')}"`,
      l.price || '',
      l.size || '',
      l.phone || '',
      st ? st.label : '',
      `"${(meta.notes||'').replace(/"/g,'""')}"`,
      l.url
    ];
  });
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ==================== MY PROPERTIES ====================
const PROP_STORAGE_KEY = 'secpro_properties';

// ─── LEONIS sync helpers ───────────────────────────────────────────────────
const ACTIVE_LISTING_STATUS = 'inzercia';
const INACTIVE_STATUSES = ['predana', 'stiahnuta'];

async function syncToLeonis(prop) {
  try {
    const res = await fetch('/api/sync-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prop),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[SecPro] LEONIS sync HTTP', res.status, text);
    }
  } catch (e) {
    console.warn('[SecPro] LEONIS sync failed:', e.message);
  }
}

async function removeFromLeonis(id) {
  try {
    await fetch('/api/sync-listing', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch (e) {
    console.warn('[SecPro] LEONIS removal failed:', e.message);
  }
}

// ─── Manual LEONIS publish / unpublish ────────────────────────────────────
async function publishToLeonis(id) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;

  // Collect photos from the stored property (may be data-URLs or empty)
  const photosToSend = (p.photos && p.photos.length > 0) ? [...p.photos] : [];

  p.leonisPublished = true;
  p.leonisPublishedAt = new Date().toISOString();
  saveProperties(props);
  renderProperties();

  await syncToLeonis({ ...p, photos: photosToSend });
}

async function unpublishFromLeonis(id) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;

  p.leonisPublished = false;
  saveProperties(props);
  renderProperties();

  await removeFromLeonis(id);
}
// ──────────────────────────────────────────────────────────────────────────

function getProperties() { return _getCached('properties', []); }
function saveProperties(arr) { _setCached('properties', arr); }

// Pipeline stages (ordered)
const PROP_PIPELINE = [
  { key: 'novy',        label: 'Nový lead',       icon: '📋', color: '#64748B' },
  { key: 'kontakt',     label: 'Prvý kontakt',    icon: '📞', color: '#2563EB' },
  { key: 'stretnutie',  label: 'Stretnutie',      icon: '🤝', color: '#7C3AED' },
  { key: 'nafotenie',   label: 'Nafotenie',       icon: '📸', color: '#D97706' },
  { key: 'inzercia',    label: 'Inzercia',        icon: '📢', color: '#0891B2' },
  { key: 'obhliadky',   label: 'Obhliadky',       icon: '🏠', color: '#9333EA' },
  { key: 'rezervacia',  label: 'Rezervácia',      icon: '📝', color: '#EA580C' },
  { key: 'predana',     label: 'Predaná',         icon: '✅', color: '#16A34A' },
];
const PROP_PIPELINE_KEYS = PROP_PIPELINE.map(s => s.key);

// ===================== DEAL DOCUMENTS TRACKER =====================
// 5-stage transaction lifecycle with traffic-light status.
// Náborák status is auto-derived from p.nabor; the rest is manual.
const DEAL_TYPES = [
  { key: 'nabor',   abbr: 'Nábor. list', label: 'Náborový list',         paymentApplicable: false },
  { key: 'sz',      abbr: 'SZ',       label: 'Sprostredkovateľská zmluva', paymentApplicable: false, hasSubtype: true },
  { key: 'rezerv',  abbr: 'Rezerv.',  label: 'Rezervačná zmluva',       paymentApplicable: true },
  { key: 'kupna',   abbr: 'Kúpna',    label: 'Kúpna zmluva',            paymentApplicable: true },
  { key: 'faktura', abbr: 'Faktúra',  label: 'Fakturácia',              paymentApplicable: true },
];

// Status meta: traffic-light colors per the agent's feedback.
// not_started = čierna (nerealizované)
// pending     = červená (vyžaduje doplnenie)
// verified    = oranžová (overená, čaká na úhradu / na podpis)
// done        = zelená  (uhradená / podpísaná / hotová)
const DEAL_STATUS_META = {
  not_started: { dot: '#1F2937', bg: '#F3F4F6', color: '#374151', label: 'Nerealizované' },
  pending:     { dot: '#DC2626', bg: '#FEE2E2', color: '#991B1B', label: 'Vyžaduje doplnenie' },
  verified:    { dot: '#F59E0B', bg: '#FEF3C7', color: '#92400E', label: 'Overené, čaká na úhradu' },
  done:        { dot: '#10B981', bg: '#D1FAE5', color: '#065F46', label: 'Uhradené / Hotové' },
};
const DEAL_STATUS_KEYS = ['not_started', 'pending', 'verified', 'done'];

// Get deal status for a given property + deal type.
// For 'nabor' the status is derived through the lifecycle:
//   1. not_started — žiadny náborák uložený
//   2. pending     — náborák uložený, čaká na odoslanie alebo dopodpísanie
//   3. verified    — email odoslaný klientovi, čaká sa na jeho podpis
//   4. done        — klient skutočne podpísal (vzdialene alebo osobne v modáli)
//
// Strict "done" criteria — to avoid false positives:
//   • REMOTE signing: remoteRequest.signedAt is set, or matching token in
//     /api/sign/list reports status='signed'
//   • IN-PERSON signing: BOTH seller AND agent local signatures present
//     (a single seller-only signature is treated as test/incomplete)
function getDealStatus(p, key) {
  if (key === 'nabor') {
    if (!p || !p.nabor) return 'not_started';

    // 1) Remote-signed wins
    const rr = p.nabor.remoteRequest;
    if (rr && rr.signedAt) return 'done';
    if (rr && rr.token && Array.isArray(_remoteSignCache)) {
      const match = _remoteSignCache.find(s => s.token === rr.token);
      if (match && match.status === 'signed') return 'done';
    }

    // 2) In-person signing — both parties signed locally in the modal
    const sigs = p.nabor.signatures || {};
    if (sigs.seller && sigs.agent) return 'done';

    // 3) Email was sent — waiting for client to sign remotely
    if (rr && rr.sentAt) return 'verified';

    // 4) Saved náborák, not yet sent / fully signed
    return 'pending';
  }
  if (!p || !p.deals || !p.deals[key]) return 'not_started';
  const s = p.deals[key].status;
  return DEAL_STATUS_KEYS.includes(s) ? s : 'not_started';
}

// True only when the CLIENT (predávajúci) has actually signed remotely.
// Used to gate the "podpísané — stiahnuť PDF" banner so it doesn't appear
// just because the agent test-drew a signature in the modal.
function isNaborClientSigned(p) {
  if (!p || !p.nabor) return false;
  const rr = p.nabor.remoteRequest;
  if (rr && rr.signedAt) return true;
  if (rr && rr.token && Array.isArray(_remoteSignCache)) {
    const match = _remoteSignCache.find(s => s.token === rr.token);
    if (match && match.status === 'signed') return true;
  }
  return false;
}

function getDealRecord(p, key) {
  if (key === 'nabor') return p && p.nabor ? p.nabor : null;
  return p && p.deals && p.deals[key] ? p.deals[key] : null;
}

// Count attached documents for a deal (nabor: signatures only; others: files[]).
function getDealFileCount(p, key) {
  if (key === 'nabor') {
    if (!p || !p.nabor || !p.nabor.signatures) return 0;
    let n = 0;
    if (p.nabor.signatures.seller) n++;
    if (p.nabor.signatures.agent) n++;
    return n;
  }
  const rec = p && p.deals && p.deals[key];
  return (rec && Array.isArray(rec.files)) ? rec.files.length : 0;
}

// More descriptive labels for the náborák lifecycle states (used in chip tooltip
// and the "signed document" banner).
const NABOR_STATUS_LABELS = {
  not_started: 'Nezačatý',
  pending:     'Rozpracovaný — čaká na odoslanie / podpis',
  verified:    'Email odoslaný — čaká na podpis klienta',
  done:        'Podpísané ✓',
};

// Doc types currently enabled for the [+] add-menu. Others stay greyed out
// with a "Čoskoro" tag until their templates / editors are built.
const DEAL_AVAILABLE_TYPES = new Set(['nabor']);

// Has this property "created" the given deal type? Drives whether a card
// shows up in the dynamic list under "Dokumentácia obchodu".
function isDealCreated(p, key) {
  if (!p) return false;
  if (key === 'nabor') return !!p.nabor;
  return !!(p.deals && p.deals[key]);
}

// Short labels used as the title of each card in the deal list.
function dealCardTitle(key) {
  const dt = DEAL_TYPES.find(x => x.key === key);
  return dt ? dt.label : key;
}

// Short status-line text shown under the card title. Date when relevant.
function dealCardSubtitle(p, key) {
  const status = getDealStatus(p, key);
  const meta = DEAL_STATUS_META[status];
  if (key === 'nabor') {
    const rr = p.nabor && p.nabor.remoteRequest;
    if (rr && rr.signedAt) {
      return 'Podpísané · ' + new Date(rr.signedAt).toLocaleDateString('sk-SK');
    }
    if (rr && rr.sentAt) {
      return 'Email odoslaný · ' + new Date(rr.sentAt).toLocaleDateString('sk-SK');
    }
    if (p.nabor && p.nabor.savedAt) {
      return 'Rozpracovaný · ' + new Date(p.nabor.savedAt).toLocaleDateString('sk-SK');
    }
  }
  const rec = p.deals && p.deals[key];
  if (rec && rec.updatedAt) {
    return meta.label + ' · ' + new Date(rec.updatedAt).toLocaleDateString('sk-SK');
  }
  return meta.label;
}

// Build the deal-tracker block HTML for a property card.
// New design (per user sketch): header with [+] add-menu + a list of cards
// for documents the agent has actually created. Empty state if none.
function getDealsRowHtml(p) {
  // Cards for created documents only — no longer always-visible chips
  const createdCards = DEAL_TYPES
    .filter(t => isDealCreated(p, t.key))
    .map(t => {
      const status = getDealStatus(p, t.key);
      const meta = DEAL_STATUS_META[status];
      const onClick = t.key === 'nabor'
        ? `openNaborModal('${p.id}')`
        : `openDealStatusEditor('${p.id}', '${t.key}')`;
      const fileCount = getDealFileCount(p, t.key);
      const fileBadge = fileCount > 0
        ? `<span class="deal-card-files" title="${fileCount} priložených dokumentov">${fileCount}</span>`
        : '';
      const stateLabel = (t.key === 'nabor' && NABOR_STATUS_LABELS[status])
        ? NABOR_STATUS_LABELS[status]
        : meta.label;
      return `<button class="deal-card-row deal-card-row-${status}" onclick="event.stopPropagation();${onClick}" title="${stateLabel}">
        <span class="deal-card-dot" style="background:${meta.dot};"></span>
        <span class="deal-card-row-label">${t.label}</span>
        <span class="deal-card-row-meta">${dealCardSubtitle(p, t.key)}</span>
        ${fileBadge}
        <svg class="deal-card-row-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`;
    }).join('');

  const emptyState = createdCards
    ? ''
    : `<div class="deal-empty">Zatiaľ žiadne dokumenty. Pridajte cez <b>+</b></div>`;

  // Note: previously a row of 5 always-visible status chips lived here.
  // Replaced with the card list above + a [+] add-menu in the header so the
  // section only shows what the agent has actually started working on.
  // The "signed" certificate card was also removed — the green deal-card-row
  // is enough indication. Click it to open the locked PDF view.

  return `<div class="deal-row">
    <div class="deal-row-head">
      <div class="deal-row-title">📋 Dokumentácia obchodu</div>
      <button class="deal-row-add" onclick="event.stopPropagation();openDealAddMenu(this, '${p.id}');" title="Pridať dokument" aria-label="Pridať dokument">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
    <div class="deal-row-list">
      ${createdCards}
      ${emptyState}
    </div>
  </div>`;
}

// Floating dropdown menu shown when the [+] button is clicked.
// Lists the 5 deal types — only those in DEAL_AVAILABLE_TYPES can be picked.
function openDealAddMenu(btn, propId) {
  // Close any existing menu
  closeDealAddMenu();

  const menu = document.createElement('div');
  menu.className = 'deal-add-menu';
  menu.id = '_deal-add-menu-active';
  menu.dataset.propId = propId;

  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  menu.innerHTML = DEAL_TYPES.map(t => {
    const enabled = DEAL_AVAILABLE_TYPES.has(t.key);
    const created = isDealCreated(p, t.key);
    const cls = !enabled ? 'deal-add-item disabled' : (created ? 'deal-add-item exists' : 'deal-add-item');
    const note = !enabled ? '<span class="dai-tag">Čoskoro</span>'
              : created ? '<span class="dai-tag dai-tag-existing">Už pridané</span>'
              : '';
    const onClick = (enabled && !created)
      ? `event.stopPropagation();addDealForProperty('${propId}', '${t.key}');closeDealAddMenu();`
      : (enabled && created)
        ? `event.stopPropagation();closeDealAddMenu();(${t.key === 'nabor' ? `openNaborModal('${propId}')` : `openDealStatusEditor('${propId}', '${t.key}')`});`
        : 'event.stopPropagation();';
    return `<button class="${cls}" onclick="${onClick}" ${!enabled ? 'aria-disabled="true"' : ''}>
      <span class="dai-label">${t.label}</span>
      ${note}
    </button>`;
  }).join('');

  // Position the menu under the [+] button
  document.body.appendChild(menu);
  const rect = btn.getBoundingClientRect();
  // Prefer right-aligned to the button so the menu doesn't extend off-screen
  const menuW = 230;
  let left = rect.right - menuW + window.scrollX;
  if (left < 8) left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  menu.style.position = 'absolute';
  menu.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
  menu.style.left = left + 'px';
  menu.style.width = menuW + 'px';

  // Close on outside click / Esc
  setTimeout(() => {
    document.addEventListener('click', _onDealAddMenuOutsideClick, { capture: true });
    document.addEventListener('keydown', _onDealAddMenuKey);
  }, 0);
}

function _onDealAddMenuOutsideClick(e) {
  const menu = document.getElementById('_deal-add-menu-active');
  if (!menu) return;
  if (!menu.contains(e.target)) closeDealAddMenu();
}
function _onDealAddMenuKey(e) {
  if (e.key === 'Escape') closeDealAddMenu();
}
function closeDealAddMenu() {
  const menu = document.getElementById('_deal-add-menu-active');
  if (menu) menu.remove();
  document.removeEventListener('click', _onDealAddMenuOutsideClick, { capture: true });
  document.removeEventListener('keydown', _onDealAddMenuKey);
}

// Trigger the right editor for a newly-added document type.
// nabor → opens the náborový list modal directly.
// others → for now disabled, but if enabled in the future, open their editor.
function addDealForProperty(propId, key) {
  if (key === 'nabor') {
    openNaborModal(propId);
    return;
  }
  if (DEAL_AVAILABLE_TYPES.has(key)) {
    openDealStatusEditor(propId, key);
  }
}

// Open the náborák modal in a "signed view" — shows the signed signature
// image prominently and offers a PDF download with the signature embedded.
function openSignedNaborView(propId) {
  // Reuse existing nabor modal — it already restores signatures from the
  // remote request when present (see openNaborModal). The signature box for
  // the seller will show the signed image, and "Generovať PDF" embeds it.
  openNaborModal(propId);
}

// Open the modal silently and immediately generate the PDF for download.
// Used by the "Stiahnuť PDF" button on the signed-doc card.
function downloadSignedNaborPDF(propId) {
  openNaborModal(propId);
  setTimeout(() => {
    if (typeof generateNaborPDF === 'function') generateNaborPDF();
  }, 200);
}

// Working files for the currently open deal-editor session
let _dealEditorFiles = [];

// Open small popover to set status + notes for a non-nabor deal.
function openDealStatusEditor(propId, key) {
  const dt = DEAL_TYPES.find(x => x.key === key);
  if (!dt || dt.key === 'nabor') return;
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  const cur = (p.deals && p.deals[key]) || {};
  const status = cur.status || 'not_started';

  document.getElementById('deal-editor-prop-id').value = propId;
  document.getElementById('deal-editor-key').value = key;
  document.getElementById('deal-editor-title').textContent = dt.label;
  document.getElementById('deal-editor-notes').value = cur.notes || '';

  // Subtype (only for SZ)
  const subtypeWrap = document.getElementById('deal-editor-subtype-wrap');
  if (dt.hasSubtype) {
    subtypeWrap.style.display = '';
    document.getElementById('deal-editor-subtype').value = cur.subtype || '';
  } else {
    subtypeWrap.style.display = 'none';
  }

  // Status buttons
  document.querySelectorAll('.deal-status-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === status);
  });

  // Files
  _dealEditorFiles = Array.isArray(cur.files) ? cur.files.map(f => ({ ...f })) : [];
  _renderDealEditorFiles();

  // Last updated info
  const info = document.getElementById('deal-editor-info');
  if (cur.updatedAt) {
    info.textContent = 'Posledná zmena: ' + new Date(cur.updatedAt).toLocaleString('sk-SK');
    info.style.display = '';
  } else {
    info.style.display = 'none';
  }

  document.getElementById('deal-editor-modal').style.display = 'flex';
}

function closeDealStatusEditor() {
  document.getElementById('deal-editor-modal').style.display = 'none';
  _dealEditorFiles = [];
  const fi = document.getElementById('deal-editor-file-input');
  if (fi) fi.value = '';
}

function setDealStatusFromEditor(newStatus) {
  document.querySelectorAll('.deal-status-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === newStatus);
  });
}

// File handling — read selected files into base64 data URLs
async function dealAddFiles(event) {
  const files = Array.from(event.target.files || []);
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
  const TOTAL_LIMIT = 10;

  for (const f of files) {
    if (_dealEditorFiles.length >= TOTAL_LIMIT) {
      showToast('Max ' + TOTAL_LIMIT + ' dokumentov na jednu fázu', 'warning');
      break;
    }
    if (f.size > MAX_BYTES) {
      showToast('Súbor "' + f.name + '" je väčší ako 5 MB', 'warning');
      continue;
    }
    try {
      const dataUrl = await _readFileAsDataUrl(f);
      _dealEditorFiles.push({
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('File read failed:', f.name, e);
    }
  }
  event.target.value = '';
  _renderDealEditorFiles();
}

function _readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function _renderDealEditorFiles() {
  const list = document.getElementById('deal-editor-files-list');
  if (!list) return;
  if (_dealEditorFiles.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = _dealEditorFiles.map((f, i) => {
    const sizeStr = _formatFileSize(f.size);
    const icon = _fileIconSvg(f.type, f.name);
    return `<div class="deal-file-item">
      <span class="deal-file-icon">${icon}</span>
      <span class="deal-file-name" onclick="dealOpenFile(${i})" title="Kliknite na otvorenie">${_escHtml(f.name)}</span>
      <span class="deal-file-size">${sizeStr}</span>
      <button class="deal-file-remove" onclick="dealRemoveFile(${i})" title="Odstrániť">&times;</button>
    </div>`;
  }).join('');
}

function dealOpenFile(idx) {
  const f = _dealEditorFiles[idx];
  if (!f) return;
  const isImage = (f.type || '').startsWith('image/');
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (isImage || isPdf) {
    // Open in new tab
    const w = window.open();
    if (!w) return;
    if (isImage) {
      w.document.write('<html><head><title>' + _escHtml(f.name) + '</title></head><body style="margin:0;background:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="' + f.dataUrl + '" style="max-width:100%;max-height:100vh;" /></body></html>');
    } else {
      w.location.href = f.dataUrl;
    }
  } else {
    // Force download for DOCX etc.
    const a = document.createElement('a');
    a.href = f.dataUrl;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function dealRemoveFile(idx) {
  _dealEditorFiles.splice(idx, 1);
  _renderDealEditorFiles();
}

function _formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fileIconSvg(type, name) {
  const isImage = (type || '').startsWith('image/');
  if (isImage) return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';
}

function _escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function saveDealFromEditor() {
  const propId = document.getElementById('deal-editor-prop-id').value;
  const key = document.getElementById('deal-editor-key').value;
  const status = document.querySelector('.deal-status-btn.active')?.dataset.status || 'not_started';
  const notes = document.getElementById('deal-editor-notes').value.trim();
  const dt = DEAL_TYPES.find(x => x.key === key);
  const subtype = (dt && dt.hasSubtype) ? document.getElementById('deal-editor-subtype').value : null;

  const props = getProperties();
  const idx = props.findIndex(x => x.id === propId);
  if (idx === -1) return;
  if (!props[idx].deals) props[idx].deals = {};
  props[idx].deals[key] = {
    ...(props[idx].deals[key] || {}),
    status,
    notes,
    files: _dealEditorFiles.slice(),
    ...(subtype !== null ? { subtype } : {}),
    updatedAt: new Date().toISOString(),
  };
  saveProperties(props);
  closeDealStatusEditor();
  if (typeof renderProperties === 'function') renderProperties();
  showToast('Stav obchodu uložený ✓', 'success');
}

// Legacy status mapping (backward compat)
const PROP_STATUS_MAP = {
  'novy':          { label: 'Nový lead',     color: '#64748B', bg: '#F1F5F9' },
  'kontakt':       { label: 'Prvý kontakt',  color: '#2563EB', bg: '#EFF6FF' },
  'kontaktovany':  { label: 'Prvý kontakt',  color: '#2563EB', bg: '#EFF6FF' },
  'stretnutie':    { label: 'Stretnutie',    color: '#7C3AED', bg: '#F3E8FF' },
  'dohodnute':     { label: 'Stretnutie',    color: '#7C3AED', bg: '#F3E8FF' },
  'nafotenie':     { label: 'Nafotenie',     color: '#D97706', bg: '#FFF7ED' },
  'inzercia':      { label: 'Inzercia',      color: '#0891B2', bg: '#ECFEFF' },
  'rozpracovany':  { label: 'Inzercia',      color: '#0891B2', bg: '#ECFEFF' },
  'obhliadky':     { label: 'Obhliadky',     color: '#9333EA', bg: '#FAF5FF' },
  'rezervacia':    { label: 'Rezervácia',    color: '#EA580C', bg: '#FFF7ED' },
  'predana':       { label: 'Predaná',       color: '#16A34A', bg: '#F0FDF4' },
  'uzavrety':      { label: 'Predaná',       color: '#16A34A', bg: '#F0FDF4' },
  'zamietnuty':    { label: 'Zamietnutý',    color: '#DC2626', bg: '#FEF2F2' },
  'stiahnuta':     { label: 'Stiahnutá',     color: '#DC2626', bg: '#FEF2F2' },
};

function getPipelineIndex(status) {
  const idx = PROP_PIPELINE_KEYS.indexOf(status);
  // Map legacy statuses
  if (idx >= 0) return idx;
  if (status === 'kontaktovany') return 1;
  if (status === 'dohodnute') return 2;
  if (status === 'rozpracovany') return 4;
  if (status === 'uzavrety') return 7;
  return 0;
}

function renderPipelineTracker(status) {
  const currentIdx = getPipelineIndex(status);
  const isTerminal = status === 'zamietnuty' || status === 'stiahnuta';

  return `<div class="prop-pipeline">
    ${PROP_PIPELINE.map((stage, i) => {
      let cls = 'pipe-step';
      if (isTerminal) {
        cls += ' pipe-cancelled';
      } else if (i < currentIdx) {
        cls += ' pipe-done';
      } else if (i === currentIdx) {
        cls += ' pipe-active';
      }
      return `<div class="${cls}" title="${stage.label}">
        <div class="pipe-dot">${i < currentIdx && !isTerminal ? '✓' : stage.icon}</div>
        <div class="pipe-label">${stage.label}</div>
        ${i < PROP_PIPELINE.length - 1 ? '<div class="pipe-line"></div>' : ''}
      </div>`;
    }).join('')}
  </div>`;
}
const PROP_TYPE_MAP = {
  'byt': 'Byt', 'dom': 'Dom', 'pozemok': 'Pozemok', 'komercia': 'Komerčný', 'iny': 'Iný'
};
const PROP_CONDITION_MAP = {
  'novostavba': 'Novostavba',
  'kompletna-rekonstrukcia': 'Kompletná rekonštrukcia',
  'ciastocna-rekonstrukcia': 'Čiastočná rekonštrukcia',
  'povodny-stav': 'Pôvodný stav',
  'rozostavanost': 'Rozostavanosť',
};

// ===================== PROPERTY FORM WIZARD =====================
const PROP_WIZ_TOTAL_STEPS = 3;
const PROP_DRAFT_KEY = 'prop-form-draft';
let prop_preview_portal = 'topreality';
const PROP_PORTAL_LIMITS = {
  topreality:     { name: 'Topreality',         titleMax: 80,  descMax: 3000, descMin: 300 },
  nehnutelnosti:  { name: 'Nehnuteľnosti.sk',   titleMax: 100, descMax: 4000, descMin: 300 },
  bazos:          { name: 'Bazoš',              titleMax: 50,  descMax: 3000, descMin: 200 },
};
let prop_wiz_step = 1;
let prop_wiz_draft_timer = null;
let prop_wiz_is_edit = false;

const PROP_FORM_FIELD_IDS = [
  'prop-title','prop-type','prop-status','prop-address','prop-city','prop-district',
  'prop-price','prop-size','prop-rooms','prop-floor','prop-year','prop-condition',
  'prop-owner','prop-phone','prop-email','prop-url','prop-description','prop-notes',
  'prop-ai-headline'
];

function _propFormReadValues() {
  const v = {};
  PROP_FORM_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) v[id] = el.value;
  });
  // Also collect photo data URLs + categories from preview
  const cards = Array.from(document.querySelectorAll('#prop-photo-preview .pm-card')).slice(0, 10);
  v.photos = cards.map(c => c.querySelector('img')?.src).filter(Boolean);
  v.photoCategories = cards.map(c => c.dataset.category || '');
  return v;
}

function _propFormApplyValues(v) {
  if (!v) return;
  PROP_FORM_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && v[id] !== undefined) el.value = v[id];
  });
  if (Array.isArray(v.photos) && v.photos.length > 0) {
    const preview = document.getElementById('prop-photo-preview');
    preview.innerHTML = '';
    const cats = Array.isArray(v.photoCategories) ? v.photoCategories : [];
    v.photos.forEach((src, i) => preview.appendChild(_pmCreateCard(src, cats[i] || '')));
    if (typeof _pmRefreshUI === 'function') _pmRefreshUI();
  }
}

function _propFormResetValues() {
  PROP_FORM_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'prop-type') el.value = 'byt';
    else if (id === 'prop-status') el.value = 'novy';
    else el.value = '';
  });
  document.getElementById('prop-photo-preview').innerHTML = '';
  const fileInp = document.getElementById('prop-photos');
  if (fileInp) fileInp.value = '';
}

function _propDraftHas() {
  try {
    const raw = localStorage.getItem(PROP_DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // Consider draft empty if no title and no phone
    return !!(d && d.values && (d.values['prop-title'] || d.values['prop-phone']));
  } catch { return false; }
}

function _propDraftLoad() {
  try { return JSON.parse(localStorage.getItem(PROP_DRAFT_KEY) || 'null'); } catch { return null; }
}

function _propDraftSave() {
  if (prop_wiz_is_edit) return; // never auto-save into draft when editing existing record
  const values = _propFormReadValues();
  // Skip empty drafts
  if (!values['prop-title'] && !values['prop-phone'] && !values['prop-price']) return;
  const draft = { values, step: prop_wiz_step, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROP_DRAFT_KEY, JSON.stringify(draft));
    _propDraftIndicator('saved');
  } catch (e) {
    // QuotaExceededError can happen with photos. Strip photos from the draft and retry.
    try {
      draft.values.photos = [];
      localStorage.setItem(PROP_DRAFT_KEY, JSON.stringify(draft));
      _propDraftIndicator('saved');
    } catch {}
  }
}

function _propDraftClear() {
  try { localStorage.removeItem(PROP_DRAFT_KEY); } catch {}
}

function _propDraftScheduleSave() {
  if (prop_wiz_is_edit) return;
  _propDraftIndicator('saving');
  if (prop_wiz_draft_timer) clearTimeout(prop_wiz_draft_timer);
  prop_wiz_draft_timer = setTimeout(_propDraftSave, 800);
}

function _propDraftIndicator(state) {
  const wrap = document.getElementById('wiz-draft-status');
  const txt  = document.getElementById('wiz-draft-status-text');
  if (!wrap || !txt) return;
  wrap.style.display = '';
  wrap.classList.remove('saving','saved');
  if (state === 'saving') { wrap.classList.add('saving'); txt.textContent = 'Ukladám koncept…'; }
  else if (state === 'saved')  { wrap.classList.add('saved');  txt.textContent = '✓ Koncept uložený'; }
}

function _propWizAttachAutoSave() {
  PROP_FORM_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.wizBound) return;
    el.dataset.wizBound = '1';
    const ev = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, _propDraftScheduleSave);
  });
}

function _propWizValidateStep(step) {
  if (step === 1) {
    const title = document.getElementById('prop-title').value.trim();
    const price = document.getElementById('prop-price').value;
    const phone = document.getElementById('prop-phone').value.trim();
    const city  = document.getElementById('prop-city').value.trim();
    const missing = [];
    if (!title) missing.push('Titulok');
    if (!price) missing.push('Cena');
    if (!phone) missing.push('Telefón');
    if (!city)  missing.push('Mesto');
    if (missing.length) {
      alert('Vyplňte povinné polia: ' + missing.join(', '));
      return false;
    }
  }
  return true;
}

// ===================== LISTING PREVIEW =====================
function setPreviewPortal(portal) {
  if (!PROP_PORTAL_LIMITS[portal]) return;
  prop_preview_portal = portal;
  document.querySelectorAll('.lp-portal-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.portal === portal);
  });
  const card = document.getElementById('lp-card');
  if (card) card.setAttribute('data-portal', portal);
  renderListingPreview();
}

function _lpEscape(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function _lpFormatPrice(val) {
  const n = parseFloat(val);
  if (!n || isNaN(n)) return null;
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(n) + ' €';
}

function _lpTypeLabel(type) {
  return ({
    byt: 'Byt', dom: 'Dom', pozemok: 'Pozemok', komercia: 'Komerčný priestor', iny: 'Iný'
  })[type] || 'Nehnuteľnosť';
}

function _lpConditionLabel(cond) {
  return ({
    novostavba: 'Novostavba',
    'kompletna-rekonstrukcia': 'Kompletná rekonštrukcia',
    'ciastocna-rekonstrukcia': 'Čiastočná rekonštrukcia',
    'povodny-stav': 'Pôvodný stav',
    'rozostavanost': 'Rozostavanosť',
  })[cond] || null;
}

function renderListingPreview() {
  const values = _propFormReadValues();
  const portal = PROP_PORTAL_LIMITS[prop_preview_portal];

  const title = (values['prop-ai-headline'] || values['prop-title'] || '').trim();
  const price = values['prop-price'];
  const city = values['prop-city'] || '';
  const district = values['prop-district'] || '';
  const address = values['prop-address'] || '';
  const size = values['prop-size'];
  const rooms = values['prop-rooms'];
  const floor = values['prop-floor'];
  const year = values['prop-year'];
  const type = values['prop-type'];
  const cond = values['prop-condition'];
  const desc = (values['prop-description'] || '').trim();
  const photos = values.photos || [];

  // ---- Cover photo ----
  const cover = document.getElementById('lp-cover');
  if (photos.length > 0) {
    cover.innerHTML = `<img src="${_lpEscape(photos[0])}" alt="cover" />
      <div class="lp-card-badge">${_lpEscape(_lpTypeLabel(type))}</div>
      <div class="lp-card-photo-counter">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        ${photos.length}
      </div>`;
  } else {
    cover.innerHTML = `<span>📷 Žiadna fotka</span>`;
  }

  // ---- Thumb strip ----
  const thumbs = document.getElementById('lp-thumbs');
  if (photos.length > 1) {
    thumbs.style.display = '';
    thumbs.innerHTML = photos.slice(0, 8).map((p, i) =>
      `<img src="${_lpEscape(p)}" alt="thumb${i}" class="${i === 0 ? 'active' : ''}" />`
    ).join('') + (photos.length > 8 ? `<div style="display:flex;align-items:center;padding:0 0.6rem;font-size:0.72rem;color:var(--text-light);white-space:nowrap;">+${photos.length - 8}</div>` : '');
  } else {
    thumbs.style.display = 'none';
  }

  // ---- Price ----
  const priceEl = document.getElementById('lp-price');
  const priceSub = document.getElementById('lp-price-sub');
  const priceFmt = _lpFormatPrice(price);
  priceEl.textContent = priceFmt || '— €';
  if (priceFmt && size) {
    const perM2 = Math.round(parseFloat(price) / parseFloat(size));
    priceSub.textContent = `(${new Intl.NumberFormat('sk-SK').format(perM2)} €/m²)`;
  } else {
    priceSub.textContent = '';
  }

  // ---- Title ----
  const titleEl = document.getElementById('lp-title');
  if (title) {
    titleEl.classList.remove('lp-placeholder');
    titleEl.textContent = title;
  } else {
    titleEl.classList.add('lp-placeholder');
    titleEl.textContent = 'Zadajte titulok inzerátu…';
  }

  // ---- Location ----
  const locParts = [address, city, district].filter(Boolean);
  document.getElementById('lp-location-text').textContent = locParts.length ? locParts.join(', ') : '—';

  // ---- Params ----
  const params = [];
  if (size)   params.push(`<div class="lp-param">📐 ${_lpEscape(size)} m²</div>`);
  if (rooms)  params.push(`<div class="lp-param">🛏 ${_lpEscape(rooms)} ${rooms == 1 ? 'izba' : (rooms < 5 ? 'izby' : 'izieb')}</div>`);
  if (floor)  params.push(`<div class="lp-param">🏢 ${_lpEscape(floor)} p.</div>`);
  if (year)   params.push(`<div class="lp-param">📅 ${_lpEscape(year)}</div>`);
  const condLabel = _lpConditionLabel(cond);
  if (condLabel) params.push(`<div class="lp-param">🔨 ${_lpEscape(condLabel)}</div>`);
  document.getElementById('lp-params').innerHTML = params.join('');

  // ---- Description ----
  const descEl = document.getElementById('lp-description');
  if (desc) {
    descEl.classList.remove('lp-placeholder');
    descEl.textContent = desc;
  } else {
    descEl.classList.add('lp-placeholder');
    descEl.textContent = 'Zadajte popis nehnuteľnosti alebo použite AI generovanie…';
  }

  // ---- Validation checks ----
  _lpRenderChecks({ title, price, city, size, rooms, desc, photos, portal });
}

function _lpRenderChecks({ title, price, city, size, rooms, desc, photos, portal }) {
  const checks = [];
  const addCheck = (state, text, detail) => checks.push({ state, text, detail });

  // Title length
  const titleLen = title.length;
  if (!title) {
    addCheck('err', 'Titulok chýba', null);
  } else if (titleLen > portal.titleMax) {
    addCheck('err', `Titulok je dlhší než limit portálu ${portal.name}`, `${titleLen}/${portal.titleMax}`);
  } else if (titleLen < 20) {
    addCheck('warn', 'Titulok je príliš krátky (menej ako 20 znakov)', `${titleLen}/${portal.titleMax}`);
  } else {
    addCheck('ok', 'Titulok má dobrú dĺžku', `${titleLen}/${portal.titleMax}`);
  }

  // Description length
  const descLen = desc.length;
  if (!desc) {
    addCheck('err', 'Popis chýba', null);
  } else if (descLen > portal.descMax) {
    addCheck('err', `Popis prekračuje limit ${portal.name}`, `${descLen}/${portal.descMax}`);
  } else if (descLen < portal.descMin) {
    addCheck('warn', `Popis je krátky (odporúčame aspoň ${portal.descMin} znakov)`, `${descLen}/${portal.descMax}`);
  } else {
    addCheck('ok', 'Popis má dobrú dĺžku', `${descLen}/${portal.descMax}`);
  }

  // Photos
  if (photos.length === 0) {
    addCheck('err', 'Žiadne fotky — inzerát bez fotiek má nízku mieru zobrazení', null);
  } else if (photos.length < 5) {
    addCheck('warn', `Málo fotiek (${photos.length}) — ideálne je 6–10`, null);
  } else {
    addCheck('ok', `${photos.length} fotografií pripravených`, null);
  }

  // Price
  if (!price) {
    addCheck('err', 'Cena nie je vyplnená', null);
  } else {
    addCheck('ok', 'Cena vyplnená', null);
  }

  // City
  if (!city) addCheck('err', 'Mesto / obec chýba', null);
  else       addCheck('ok', 'Lokalita vyplnená', null);

  // Size
  if (!size) addCheck('warn', 'Výmera nie je vyplnená', null);
  else       addCheck('ok', 'Výmera vyplnená', null);

  // Rooms (only for byt/dom)
  const type = document.getElementById('prop-type')?.value;
  if (type === 'byt' || type === 'dom') {
    if (!rooms) addCheck('warn', 'Počet izieb nie je vyplnený', null);
    else        addCheck('ok', 'Počet izieb vyplnený', null);
  }

  // ---- Render checks ----
  const list = document.getElementById('lp-check-list');
  list.innerHTML = checks.map(c => {
    const icon = c.state === 'ok' ? '✓' : (c.state === 'warn' ? '!' : '✕');
    const detail = c.detail ? ` <span style="color:var(--text-light);font-size:0.7rem;">(${_lpEscape(c.detail)})</span>` : '';
    return `<div class="lp-check-item lp-check-${c.state}">
      <div class="lp-check-icon">${icon}</div>
      <div class="lp-check-text">${_lpEscape(c.text)}${detail}</div>
    </div>`;
  }).join('');

  // ---- Score ----
  const okCount   = checks.filter(c => c.state === 'ok').length;
  const warnCount = checks.filter(c => c.state === 'warn').length;
  const errCount  = checks.filter(c => c.state === 'err').length;
  const total     = checks.length;
  // weighted: ok=1, warn=0.5, err=0
  const score = Math.round(((okCount + warnCount * 0.5) / total) * 100);
  document.getElementById('lp-score').textContent = score + '%';
  document.getElementById('lp-score-bar').style.width = score + '%';
  const scoreSub = document.getElementById('lp-score-sub');
  if (errCount > 0) scoreSub.textContent = `${errCount} ${errCount === 1 ? 'chyba' : (errCount < 5 ? 'chyby' : 'chýb')} na opravu`;
  else if (warnCount > 0) scoreSub.textContent = `${warnCount} ${warnCount === 1 ? 'odporúčanie' : 'odporúčaní'}`;
  else scoreSub.textContent = '✓ Inzerát je pripravený';
}

function goToWizStep(step) {
  if (step < 1) step = 1;
  if (step > PROP_WIZ_TOTAL_STEPS) step = PROP_WIZ_TOTAL_STEPS;

  // Going forward requires valid current step
  if (step > prop_wiz_step) {
    for (let s = prop_wiz_step; s < step; s++) {
      if (!_propWizValidateStep(s)) return;
    }
  }

  prop_wiz_step = step;
  // Update panels
  document.querySelectorAll('#prop-modal .wiz-panel').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.step) === step);
  });
  // Update stepper
  document.querySelectorAll('#prop-modal .wiz-step').forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.toggle('active', s === step);
    el.classList.toggle('completed', s < step);
    el.classList.toggle('disabled', s > step && !prop_wiz_is_edit);
  });
  // Update buttons
  document.getElementById('wiz-btn-back').style.display = step > 1 ? '' : 'none';
  const isLast = step === PROP_WIZ_TOTAL_STEPS;
  document.getElementById('wiz-btn-next').style.display = isLast ? 'none' : '';
  // Save button now visible on ALL steps — user can save any time
  document.getElementById('wiz-btn-save-final').style.display = '';
  // Hide the separate "save draft" button — it did the same as save-final and was confusing
  document.getElementById('wiz-btn-save-draft').style.display = 'none';
  // Render listing preview when entering the last step
  if (step === PROP_WIZ_TOTAL_STEPS) renderListingPreview();
  // Show "Záujemcovia a prehliadky" section only on step 1 in edit mode
  const extras = document.getElementById('prop-extras-section');
  if (extras) {
    extras.style.display = (prop_wiz_is_edit && step === 1) ? '' : 'none';
  }
  // Scroll modal to top
  const modal = document.getElementById('prop-modal');
  if (modal) modal.scrollTop = 0;
  _propDraftScheduleSave();
}

function restorePropertyDraft() {
  const draft = _propDraftLoad();
  if (!draft || !draft.values) return;
  _propFormApplyValues(draft.values);
  document.getElementById('prop-draft-banner').style.display = 'none';
  goToWizStep(draft.step || 1);
}

function discardPropertyDraft() {
  _propDraftClear();
  _propFormResetValues();
  document.getElementById('prop-draft-banner').style.display = 'none';
  goToWizStep(1);
}

function openPropertyForm(editId) {
  const modal = document.getElementById('prop-modal');
  const titleEl = document.getElementById('prop-modal-title');
  document.getElementById('prop-edit-id').value = '';
  _propFormResetValues();

  prop_wiz_is_edit = !!editId;
  prop_wiz_step = 1;

  if (editId) {
    titleEl.textContent = 'Upraviť nehnuteľnosť';
    const props = getProperties();
    const p = props.find(x => x.id === editId);
    if (p) {
      document.getElementById('prop-edit-id').value = p.id;
      document.getElementById('prop-title').value = p.title || '';
      document.getElementById('prop-type').value = p.type || 'byt';
      document.getElementById('prop-status').value = p.status || 'novy';
      document.getElementById('prop-address').value = p.address || '';
      document.getElementById('prop-city').value = p.city || '';
      document.getElementById('prop-district').value = p.district || '';
      document.getElementById('prop-price').value = p.price || '';
      document.getElementById('prop-size').value = p.size || '';
      document.getElementById('prop-rooms').value = p.rooms || '';
      document.getElementById('prop-floor').value = p.floor || '';
      document.getElementById('prop-year').value = p.year || '';
      document.getElementById('prop-condition').value = p.condition || '';
      document.getElementById('prop-owner').value = p.owner || '';
      document.getElementById('prop-phone').value = p.phone || '';
      document.getElementById('prop-email').value = p.email || '';
      document.getElementById('prop-url').value = p.url || '';
      document.getElementById('prop-description').value = p.description || '';
      document.getElementById('prop-notes').value = p.notes || '';
      // Load interested & viewings
      tempInterested = JSON.parse(JSON.stringify(p.interested || []));
      tempViewings = JSON.parse(JSON.stringify(p.viewings || []));
      renderInterestedList();
      renderViewingList();
      updateSubTabCounts();
      // Show existing photos (with categories if available)
      if (p.photos && p.photos.length > 0) {
        const preview = document.getElementById('prop-photo-preview');
        preview.innerHTML = '';
        const cats = Array.isArray(p.photoCategories) ? p.photoCategories : [];
        p.photos.forEach((src, i) => preview.appendChild(_pmCreateCard(src, cats[i] || '')));
        _pmRefreshUI();
      }
    }
    // In edit mode: show extras (interested & viewings) and unlock all steps
    document.getElementById('prop-extras-section').style.display = '';
    document.getElementById('prop-draft-banner').style.display = 'none';
  } else {
    titleEl.textContent = 'Pridať nehnuteľnosť';
    tempInterested = [];
    tempViewings = [];
    renderInterestedList();
    renderViewingList();
    updateSubTabCounts();
    document.getElementById('prop-extras-section').style.display = 'none';
    // Show draft restore banner if a draft exists
    const draft = _propDraftLoad();
    const banner = document.getElementById('prop-draft-banner');
    if (draft && draft.values && (draft.values['prop-title'] || draft.values['prop-phone'])) {
      const info = document.getElementById('prop-draft-banner-info');
      const ts = draft.savedAt ? new Date(draft.savedAt).toLocaleString('sk-SK') : '';
      const lbl = draft.values['prop-title'] || '(bez názvu)';
      info.textContent = `${lbl} • uložené ${ts}`;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }
  // Hide inline forms
  const iaf = document.getElementById('interested-add-form'); if (iaf) iaf.classList.remove('visible');
  const vaf = document.getElementById('viewing-add-form');    if (vaf) vaf.classList.remove('visible');

  // Reset draft status indicator
  const ds = document.getElementById('wiz-draft-status'); if (ds) ds.style.display = 'none';

  modal.style.display = 'block';
  goToWizStep(1);
  _propWizAttachAutoSave();

  // Photo manager: init UI, sortable, dropzone & paste bindings
  if (typeof _pmRefreshUI === 'function') _pmRefreshUI();
  if (typeof _pmInitSortable === 'function') _pmInitSortable();
  if (typeof pmSetupDropzone === 'function') pmSetupDropzone();
  if (typeof pmSetupPaste === 'function') pmSetupPaste();

  // Snapshot initial state for dirty-check on close
  _propFormCaptureInitial();
}

let _propFormInitialSnapshot = null;

// Build a fast fingerprint of the form state for dirty-checking.
// Uses just the first 50 chars of each photo src to avoid megabyte-sized diffs.
function _propFormSnapshot() {
  const v = _propFormReadValues();
  const photos = Array.isArray(v.photos) ? v.photos : [];
  const cats = Array.isArray(v.photoCategories) ? v.photoCategories : [];
  const photosFp = photos.map((s, i) => (s || '').slice(0, 50) + '|' + (cats[i] || '')).join(';');
  delete v.photos;
  delete v.photoCategories;
  return JSON.stringify({
    v,
    photosFp,
    interested: (typeof tempInterested !== 'undefined' && tempInterested) ? tempInterested : [],
    viewings:   (typeof tempViewings   !== 'undefined' && tempViewings)   ? tempViewings   : [],
  });
}

function _propFormCaptureInitial() {
  try { _propFormInitialSnapshot = _propFormSnapshot(); }
  catch (e) { _propFormInitialSnapshot = null; }
}

function _propFormIsDirty() {
  if (_propFormInitialSnapshot === null) return false;
  try { return _propFormSnapshot() !== _propFormInitialSnapshot; }
  catch (e) { return false; }
}

// Silent close — used after successful save and for programmatic close
function _closePropertyFormNow() {
  document.getElementById('prop-modal').style.display = 'none';
  if (prop_wiz_draft_timer) { clearTimeout(prop_wiz_draft_timer); prop_wiz_draft_timer = null; }
  _propFormInitialSnapshot = null;
}

// Public close — asks for confirmation if there are unsaved changes
async function closePropertyForm() {
  if (_propFormIsDirty()) {
    const ok = await secConfirm({
      title: 'Neuložené zmeny',
      message: 'V inzeráte máte neuložené zmeny. Naozaj ich chcete zahodiť?',
      type: 'warning',
      ok: 'Zahodiť zmeny',
      cancel: 'Pokračovať v úpravách',
    });
    if (!ok) return;
  }
  _closePropertyFormNow();
}

function compressImage(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ===================== PHOTO MANAGER =====================
const PM_MAX_PHOTOS = 10;
let pm_sortable = null;

// Photo categories (rooms / views)
const PM_CATEGORIES = [
  { value: '',           label: 'Nezaradené',    icon: '🏷️' },
  { value: 'exterior',   label: 'Exteriér',      icon: '🏠' },
  { value: 'livingroom', label: 'Obývačka',      icon: '🛋️' },
  { value: 'kitchen',    label: 'Kuchyňa',       icon: '🍳' },
  { value: 'bedroom',    label: 'Spálňa',        icon: '🛏️' },
  { value: 'bathroom',   label: 'Kúpeľňa',       icon: '🛁' },
  { value: 'wc',         label: 'WC',            icon: '🚽' },
  { value: 'hall',       label: 'Predsieň',      icon: '🚪' },
  { value: 'balcony',    label: 'Balkón',        icon: '🌇' },
  { value: 'garden',     label: 'Záhrada',       icon: '🌳' },
  { value: 'floorplan',  label: 'Pôdorys',       icon: '📐' },
  { value: 'other',      label: 'Ostatné',       icon: '📷' },
];
function _pmCategoryLabel(val) {
  const c = PM_CATEGORIES.find(x => x.value === (val || ''));
  return c ? c.label : 'Nezaradené';
}
function _pmCategoryIcon(val) {
  const c = PM_CATEGORIES.find(x => x.value === (val || ''));
  return c ? c.icon : '🏷️';
}
function _pmCategoryOptionsHtml(selected) {
  return PM_CATEGORIES.map(c =>
    `<option value="${c.value}" ${c.value === (selected || '') ? 'selected' : ''}>${c.icon} ${c.label}</option>`
  ).join('');
}

function _pmCreateCard(dataUrl, category) {
  const cat = category || '';
  const card = document.createElement('div');
  card.className = 'pm-card';
  card.dataset.category = cat;
  card.innerHTML = `
    <div class="pm-order">1</div>
    <div class="pm-cover-badge">TITULNÁ</div>
    <img src="${dataUrl}" alt="foto" draggable="false" />
    <div class="pm-cat-badge"><span class="pm-cat-icon">${_pmCategoryIcon(cat)}</span><span class="pm-cat-text">${_pmCategoryLabel(cat)}</span></div>
    <div class="pm-actions">
      <button type="button" class="pm-action-btn" title="Otočiť vľavo 90°" onclick="pmRotatePhoto(this, -90)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 006 5.3L3 8"/></svg>
      </button>
      <button type="button" class="pm-action-btn" title="Otočiť vpravo 90°" onclick="pmRotatePhoto(this, 90)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0015-6.7L21 8"/></svg>
      </button>
      <button type="button" class="pm-action-btn" title="Nastaviť ako titulnú" onclick="pmMakeCover(this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <button type="button" class="pm-action-btn danger" title="Odstrániť" onclick="pmRemovePhoto(this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
    <select class="pm-cat-select" onchange="pmSetCategory(this)" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" title="Kategória fotky">
      ${_pmCategoryOptionsHtml(cat)}
    </select>`;
  return card;
}

function pmSetCategory(sel) {
  const card = sel.closest('.pm-card');
  if (!card) return;
  const val = sel.value || '';
  card.dataset.category = val;
  const ic = card.querySelector('.pm-cat-icon');
  const tx = card.querySelector('.pm-cat-text');
  if (ic) ic.textContent = _pmCategoryIcon(val);
  if (tx) tx.textContent = _pmCategoryLabel(val);
  if (typeof _propDraftScheduleSave === 'function') _propDraftScheduleSave();
}

function _pmRefreshUI() {
  const grid = document.getElementById('prop-photo-preview');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.pm-card'));
  cards.forEach((card, i) => {
    card.classList.toggle('cover', i === 0);
    const orderEl = card.querySelector('.pm-order');
    if (orderEl) orderEl.textContent = String(i + 1);
  });
  const countEl = document.getElementById('pm-count');
  if (countEl) {
    countEl.textContent = `${cards.length} / ${PM_MAX_PHOTOS} fotiek`;
    countEl.classList.toggle('limit', cards.length >= PM_MAX_PHOTOS);
  }
  // Trigger autosave (photos changed)
  _propDraftScheduleSave();
}

function _pmInitSortable() {
  const grid = document.getElementById('prop-photo-preview');
  if (!grid || typeof Sortable === 'undefined') return;
  if (pm_sortable) { try { pm_sortable.destroy(); } catch {} pm_sortable = null; }
  pm_sortable = Sortable.create(grid, {
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    forceFallback: false,
    onEnd: _pmRefreshUI,
  });
}

function _pmCurrentCount() {
  return document.querySelectorAll('#prop-photo-preview .pm-card').length;
}

async function _pmAddFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return;
  if (_pmCurrentCount() >= PM_MAX_PHOTOS) {
    alert(`Maximálne ${PM_MAX_PHOTOS} fotiek.`);
    return;
  }
  try {
    const compressed = await compressImage(file, 1600, 0.78);
    const card = _pmCreateCard(compressed);
    document.getElementById('prop-photo-preview').appendChild(card);
    _pmRefreshUI();
  } catch (e) {
    console.error('Failed to process photo', e);
  }
}

async function _pmAddFiles(files) {
  const list = Array.from(files || []);
  for (const f of list) {
    if (_pmCurrentCount() >= PM_MAX_PHOTOS) break;
    await _pmAddFile(f);
  }
}

function pmHandleFileInput(ev) {
  const input = ev.target;
  _pmAddFiles(input.files);
  // Reset the input so selecting the same file again still triggers change
  input.value = '';
}

function pmRemovePhoto(btn) {
  const card = btn.closest('.pm-card');
  if (!card) return;
  card.remove();
  _pmRefreshUI();
}

function pmMakeCover(btn) {
  const card = btn.closest('.pm-card');
  if (!card) return;
  const grid = card.parentElement;
  grid.insertBefore(card, grid.firstChild);
  _pmRefreshUI();
}

function pmRotatePhoto(btn, deg) {
  const card = btn.closest('.pm-card');
  if (!card) return;
  const img = card.querySelector('img');
  if (!img) return;
  const src = img.src;
  const tmp = new Image();
  tmp.onload = function() {
    const canvas = document.createElement('canvas');
    const rad = (deg * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    canvas.width  = Math.round(tmp.height * sin + tmp.width * cos);
    canvas.height = Math.round(tmp.height * cos + tmp.width * sin);
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2);
    img.src = canvas.toDataURL('image/jpeg', 0.82);
    _propDraftScheduleSave();
  };
  tmp.src = src;
}

function pmSetupDropzone() {
  const dz = document.getElementById('pm-dropzone');
  if (!dz || dz.dataset.pmBound) return;
  dz.dataset.pmBound = '1';
  ['dragenter','dragover'].forEach(ev => {
    dz.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('dragover');
    });
  });
  ['dragleave','dragend','drop'].forEach(ev => {
    dz.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('dragover');
    });
  });
  dz.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files) _pmAddFiles(e.dataTransfer.files);
  });
}

function pmSetupPaste() {
  if (window.__pmPasteBound) return;
  window.__pmPasteBound = true;
  document.addEventListener('paste', e => {
    const modal = document.getElementById('prop-modal');
    if (!modal || modal.style.display === 'none') return;
    if (prop_wiz_step !== 3) return;
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) { e.preventDefault(); _pmAddFiles(files); }
  });
}

// Legacy hook name (kept to avoid breaking any external callers)
function previewPropertyPhotos() {
  const input = document.getElementById('prop-photos');
  if (input) _pmAddFiles(input.files);
}

// ===== INTERESTED PARTIES & VIEWINGS =====
let tempInterested = [];
let tempViewings = [];

function switchPropSubTab(tabEl, panel) {
  tabEl.parentElement.querySelectorAll('.prop-sub-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.getElementById('prop-subtab-interested').classList.toggle('active', panel === 'interested');
  document.getElementById('prop-subtab-viewings').classList.toggle('active', panel === 'viewings');
  if (panel === 'viewings') refreshViewingPersonSelect();
}

function updateSubTabCounts() {
  const iiCount = document.getElementById('ii-tab-count');
  const viCount = document.getElementById('vi-tab-count');
  if (iiCount) iiCount.textContent = tempInterested.length ? '(' + tempInterested.length + ')' : '';
  if (viCount) viCount.textContent = tempViewings.length ? '(' + tempViewings.length + ')' : '';
}

function toggleInlineForm(formId) {
  const form = document.getElementById(formId);
  form.classList.toggle('visible');
  // If opening viewing form, refresh person select
  if (formId === 'viewing-add-form' && form.classList.contains('visible')) {
    refreshViewingPersonSelect();
  }
}

function refreshViewingPersonSelect() {
  const sel = document.getElementById('vi-new-person');
  const current = sel.value;
  sel.innerHTML = '<option value="">-- vybrať záujemcu --</option>';
  tempInterested.forEach((p, i) => {
    sel.innerHTML += `<option value="${i}">${p.name}</option>`;
  });
  if (current) sel.value = current;
}

function addInterestedParty() {
  const name = document.getElementById('ii-new-name').value.trim();
  if (!name) { secAlert('Vyplňte meno záujemcu.'); return; }
  tempInterested.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    phone: document.getElementById('ii-new-phone').value.trim(),
    email: document.getElementById('ii-new-email').value.trim(),
    rating: parseInt(document.getElementById('ii-new-rating').value) || 3,
    note: document.getElementById('ii-new-note').value.trim(),
    addedAt: new Date().toISOString()
  });
  // Reset
  ['ii-new-name','ii-new-phone','ii-new-email','ii-new-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ii-new-rating').value = '3';
  renderInterestedList();
  updateSubTabCounts();
  toggleInlineForm('interested-add-form');
}

function removeInterested(idx) {
  tempInterested.splice(idx, 1);
  renderInterestedList();
  updateSubTabCounts();
}

function renderInterestedList() {
  const list = document.getElementById('prop-interested-list');
  if (tempInterested.length === 0) {
    list.innerHTML = `<div class="list-empty-state">
      <div class="list-empty-icon">👥</div>
      <div class="list-empty-text">Zatiaľ žiadni záujemcovia</div>
      <div class="list-empty-sub">Pridajte prvého záujemcu tlačidlom nižšie</div>
    </div>`;
    return;
  }
  list.innerHTML = tempInterested.map((p, i) => {
    const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const stars = Array.from({length: 5}, (_, s) => `<span class="ii-star${s < p.rating ? ' active' : ''}">\u2605</span>`).join('');
    return `<div class="ii-card">
      <div class="ii-avatar">${initials}</div>
      <div class="ii-info">
        <div class="ii-name-row">
          <span class="ii-name">${esc(p.name)}</span>
          <div class="ii-rating">${stars}</div>
        </div>
        <div class="ii-contacts">
          ${p.phone ? `<a href="tel:${esc(p.phone)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${esc(p.phone)}</a>` : ''}
          ${p.email ? `<a href="mailto:${esc(p.email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${esc(p.email)}</a>` : ''}
        </div>
        ${p.note ? `<div class="ii-note">${esc(p.note)}</div>` : ''}
      </div>
      <div class="ii-actions">
        <button class="ii-action-btn move" onclick="openPropPicker(${i},'move','modal')" title="Preniesť na inú nehnuteľnosť">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
        <button class="ii-action-btn copy" onclick="openPropPicker(${i},'copy','modal')" title="Kopírovať na inú nehnuteľnosť">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="ii-action-btn" onclick="removeInterested(${i})" title="Odstrániť">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function addViewing() {
  const dateVal = document.getElementById('vi-new-date').value;
  const personIdx = document.getElementById('vi-new-person').value;
  if (!dateVal) { secAlert('Vyplňte dátum prehliadky.'); return; }
  if (personIdx === '') { secAlert('Vyberte záujemcu.'); return; }
  const person = tempInterested[parseInt(personIdx)];
  tempViewings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    date: dateVal,
    personName: person ? person.name : 'Neznámy',
    personId: person ? person.id : null,
    result: document.getElementById('vi-new-result').value,
    type: document.getElementById('vi-new-type').value,
    feedback: document.getElementById('vi-new-feedback').value.trim(),
    addedAt: new Date().toISOString()
  });
  // Reset
  document.getElementById('vi-new-date').value = '';
  document.getElementById('vi-new-person').value = '';
  document.getElementById('vi-new-result').value = 'planned';
  document.getElementById('vi-new-type').value = 'osobne';
  document.getElementById('vi-new-feedback').value = '';
  renderViewingList();
  updateSubTabCounts();
  toggleInlineForm('viewing-add-form');
}

function removeViewing(idx) {
  tempViewings.splice(idx, 1);
  renderViewingList();
  updateSubTabCounts();
}

const VIEWING_RESULT_MAP = {
  planned: { label: 'Plánovaná', cls: 'neutral' },
  positive: { label: 'Pozitívna', cls: 'positive' },
  neutral: { label: 'Neutrálna', cls: 'neutral' },
  negative: { label: 'Negatívna', cls: 'negative' }
};
const VIEWING_TYPE_MAP = { osobne: 'Osobná', online: 'Online', video: 'Video/Foto' };

function renderViewingList() {
  const list = document.getElementById('prop-viewing-list');
  if (tempViewings.length === 0) {
    list.innerHTML = `<div class="list-empty-state">
      <div class="list-empty-icon">📋</div>
      <div class="list-empty-text">Zatiaľ žiadne prehliadky</div>
      <div class="list-empty-sub">Najprv pridajte záujemcu, potom naplánujte prehliadku</div>
    </div>`;
    return;
  }
  const resultIcons = { planned: '📅', positive: '👍', neutral: '😐', negative: '👎' };
  list.innerHTML = tempViewings.map((v, i) => {
    const r = VIEWING_RESULT_MAP[v.result] || VIEWING_RESULT_MAP.neutral;
    const icon = resultIcons[v.result] || '📅';
    const d = v.date ? new Date(v.date) : null;
    const dateStr = d ? d.toLocaleDateString('sk-SK') : '';
    const timeStr = d ? d.toLocaleTimeString('sk-SK', {hour:'2-digit', minute:'2-digit'}) : '';
    const typeStr = VIEWING_TYPE_MAP[v.type] || v.type;
    return `<div class="vi-card">
      <div class="vi-timeline">
        <div class="vi-timeline-icon ${r.cls}">${icon}</div>
      </div>
      <div class="vi-body">
        <div class="vi-top-row">
          <span class="vi-date">${dateStr}${timeStr ? ' · ' + timeStr : ''}</span>
          <span class="vi-person">${esc(v.personName)}</span>
          <span class="vi-result ${r.cls}">${r.label}</span>
        </div>
        <div class="vi-meta">
          <span class="vi-type-tag">${typeStr}</span>
          ${v.feedback ? `<span class="vi-feedback-text" title="${esc(v.feedback)}">${esc(v.feedback.length > 55 ? v.feedback.slice(0,55) + '...' : v.feedback)}</span>` : ''}
        </div>
      </div>
      <div class="vi-actions">
        <button class="ii-action-btn" onclick="removeViewing(${i})" title="Odstrániť">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ===== QUICK ADD INTERESTED / VIEWING =====
function openQuickInterestModal(propId) {
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;
  document.getElementById('quick-prop-id').value = propId;
  document.getElementById('quick-modal-title').textContent = p.title || 'Nehnuteľnosť';
  // Reset fields
  ['qi-name','qi-phone','qi-email','qi-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('qi-rating').value = '3';
  document.getElementById('qv-date').value = '';
  document.getElementById('qv-result').value = 'planned';
  document.getElementById('qv-type').value = 'osobne';
  document.getElementById('qv-feedback').value = '';
  // Render preview
  renderQuickInterestedPreview(p);
  refreshQuickViewingPersonSelect(p);
  document.getElementById('quick-interest-modal').style.display = 'block';
}

function closeQuickInterestModal() {
  document.getElementById('quick-interest-modal').style.display = 'none';
}

function switchQuickTab(tabEl, panelId) {
  tabEl.parentElement.querySelectorAll('.prop-sub-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  document.getElementById('quick-tab-interested').classList.toggle('active', panelId === 'quick-tab-interested');
  document.getElementById('quick-tab-viewing').classList.toggle('active', panelId === 'quick-tab-viewing');
  if (panelId === 'quick-tab-viewing') {
    const propId = document.getElementById('quick-prop-id').value;
    const p = getProperties().find(x => x.id === propId);
    if (p) refreshQuickViewingPersonSelect(p);
  }
}

function renderQuickInterestedPreview(p) {
  const list = p.interested || [];
  const el = document.getElementById('quick-interested-preview');
  if (list.length === 0) {
    el.innerHTML = '<div style="font-size:0.78rem;color:#C0C8D0;padding:0.5rem 0;text-align:center;">Zatiaľ žiadni záujemcovia</div>';
    return;
  }
  el.innerHTML = list.map((ii, idx) => {
    const initials = ii.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const stars = Array.from({length: 5}, (_, s) => `<span style="font-size:0.5rem;color:${s < (ii.rating||0) ? '#F5A623' : '#E2E8F0'};">\u2605</span>`).join('');
    return `<div style="display:flex;align-items:center;gap:0.55rem;padding:0.4rem 0;border-bottom:1px solid #F5F7FA;">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0B2A3C,#1A7A8A);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.58rem;font-weight:700;flex-shrink:0;">${initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.78rem;font-weight:600;color:#0B2A3C;display:flex;align-items:center;gap:0.3rem;">
          ${esc(ii.name)} <span style="display:inline-flex;gap:1px;">${stars}</span>
        </div>
        ${ii.phone ? `<div style="font-size:0.68rem;color:var(--text-light);">${esc(ii.phone)}</div>` : ''}
      </div>
      <div style="display:flex;gap:3px;flex-shrink:0;">
        <button class="ii-action-btn move" onclick="openPropPicker(${idx},'move','quick')" title="Preniesť" style="width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
        <button class="ii-action-btn copy" onclick="openPropPicker(${idx},'copy','quick')" title="Kopírovať" style="width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function refreshQuickViewingPersonSelect(p) {
  const sel = document.getElementById('qv-person');
  const list = p.interested || [];
  sel.innerHTML = '<option value="">-- vybrať záujemcu --</option>';
  list.forEach((ii, i) => {
    sel.innerHTML += `<option value="${i}">${esc(ii.name)}</option>`;
  });
}

function quickAddInterested() {
  const propId = document.getElementById('quick-prop-id').value;
  const name = document.getElementById('qi-name').value.trim();
  if (!name) { secAlert('Vyplňte meno záujemcu.'); return; }

  const props = getProperties();
  const pIdx = props.findIndex(x => x.id === propId);
  if (pIdx === -1) return;

  if (!props[pIdx].interested) props[pIdx].interested = [];
  props[pIdx].interested.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    phone: document.getElementById('qi-phone').value.trim(),
    email: document.getElementById('qi-email').value.trim(),
    rating: parseInt(document.getElementById('qi-rating').value) || 3,
    note: document.getElementById('qi-note').value.trim(),
    addedAt: new Date().toISOString()
  });
  props[pIdx].updatedAt = new Date().toISOString();
  saveProperties(props);

  // Reset & refresh
  ['qi-name','qi-phone','qi-email','qi-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('qi-rating').value = '3';
  renderQuickInterestedPreview(props[pIdx]);
  refreshQuickViewingPersonSelect(props[pIdx]);
  renderProperties();
}

function quickAddViewing() {
  const propId = document.getElementById('quick-prop-id').value;
  const dateVal = document.getElementById('qv-date').value;
  const personIdx = document.getElementById('qv-person').value;
  if (!dateVal) { secAlert('Vyplňte dátum prehliadky.'); return; }
  if (personIdx === '') { secAlert('Vyberte záujemcu.'); return; }

  const props = getProperties();
  const pIdx = props.findIndex(x => x.id === propId);
  if (pIdx === -1) return;

  const person = (props[pIdx].interested || [])[parseInt(personIdx)];
  if (!props[pIdx].viewings) props[pIdx].viewings = [];
  props[pIdx].viewings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    date: dateVal,
    personName: person ? person.name : 'Neznámy',
    personId: person ? person.id : null,
    result: document.getElementById('qv-result').value,
    type: document.getElementById('qv-type').value,
    feedback: document.getElementById('qv-feedback').value.trim(),
    addedAt: new Date().toISOString()
  });
  props[pIdx].updatedAt = new Date().toISOString();
  saveProperties(props);

  // Reset & refresh
  document.getElementById('qv-date').value = '';
  document.getElementById('qv-person').value = '';
  document.getElementById('qv-feedback').value = '';
  renderProperties();
}

// ===== PROPERTY PICKER (MOVE/COPY INTERESTED) =====
let ppInterestedIdx = null;
let ppMode = 'move';
let ppSourceContext = 'modal'; // 'modal' = full edit modal, 'quick' = quick modal
let ppSourcePropId = null;

function openPropPicker(interestedIdx, mode, sourceContext) {
  ppInterestedIdx = interestedIdx;
  ppMode = mode || 'move';
  ppSourceContext = sourceContext || 'modal';
  setPropPickerMode(ppMode);

  // Determine source property ID
  if (ppSourceContext === 'modal') {
    ppSourcePropId = document.getElementById('prop-edit-id').value;
  } else {
    ppSourcePropId = document.getElementById('quick-prop-id').value;
  }

  // Update title
  document.getElementById('prop-picker-title').textContent = ppMode === 'move' ? 'Preniesť záujemcu' : 'Kopírovať záujemcu';

  // Render property list
  renderPropPickerList();

  document.getElementById('propPickerModal').style.display = 'block';
  document.getElementById('prop-picker-search').value = '';
  document.getElementById('prop-picker-search').focus();
}

function closePropPicker() {
  document.getElementById('propPickerModal').style.display = 'none';
  ppInterestedIdx = null;
  ppSourcePropId = null;
}

function setPropPickerMode(mode) {
  ppMode = mode;
  const moveBtn = document.getElementById('pp-mode-move');
  const copyBtn = document.getElementById('pp-mode-copy');
  if (mode === 'move') {
    moveBtn.style.fontWeight = '600';
    moveBtn.style.background = '#EFF6FF';
    moveBtn.style.color = '#2563EB';
    moveBtn.style.borderColor = '#2563EB';
    copyBtn.style.fontWeight = '';
    copyBtn.style.background = '';
    copyBtn.style.color = '';
    copyBtn.style.borderColor = '';
  } else {
    copyBtn.style.fontWeight = '600';
    copyBtn.style.background = '#E5F5F1';
    copyBtn.style.color = '#1A7A8A';
    copyBtn.style.borderColor = '#1A7A8A';
    moveBtn.style.fontWeight = '';
    moveBtn.style.background = '';
    moveBtn.style.color = '';
    moveBtn.style.borderColor = '';
  }
  document.getElementById('prop-picker-title').textContent = mode === 'move' ? 'Preniesť záujemcu' : 'Kopírovať záujemcu';
}

function filterPropPicker() {
  renderPropPickerList();
}

function renderPropPickerList() {
  const query = (document.getElementById('prop-picker-search').value || '').toLowerCase().trim();
  const props = getProperties();
  const filtered = props.filter(p => {
    if (p.id === ppSourcePropId) return false;
    if (!query) return true;
    const searchStr = ((p.title || '') + ' ' + (p.location || '') + ' ' + (p.type || '')).toLowerCase();
    return searchStr.includes(query);
  });

  const listEl = document.getElementById('prop-picker-list');
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="prop-picker-empty">Žiadne nehnuteľnosti na výber</div>';
    return;
  }

  const TYPE_MAP = { byt: 'Byt', dom: 'Dom', pozemok: 'Pozemok', komercne: 'Komerčné', iny: 'Iné' };
  listEl.innerHTML = filtered.map(p => {
    const typeName = TYPE_MAP[p.type] || p.type || '';
    const thumb = p.images && p.images.length > 0
      ? `<img src="${esc(p.images[0])}" alt="" />`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    return `<div class="prop-picker-item" onclick="transferInterested('${esc(p.id)}')">
      <div class="prop-picker-thumb">${thumb}</div>
      <div class="prop-picker-info">
        <div class="prop-picker-name">${esc(p.title || 'Bez názvu')}</div>
        <div class="prop-picker-meta">${typeName}${p.location ? ' · ' + esc(p.location) : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function transferInterested(targetPropId) {
  if (ppInterestedIdx === null || !ppSourcePropId) return;

  const props = getProperties();
  const srcIdx = props.findIndex(x => x.id === ppSourcePropId);
  const tgtIdx = props.findIndex(x => x.id === targetPropId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const srcList = props[srcIdx].interested || [];
  if (ppInterestedIdx < 0 || ppInterestedIdx >= srcList.length) return;

  const person = JSON.parse(JSON.stringify(srcList[ppInterestedIdx]));
  // Give copy a new ID
  if (ppMode === 'copy') {
    person.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  // Add to target
  if (!props[tgtIdx].interested) props[tgtIdx].interested = [];
  props[tgtIdx].interested.push(person);
  props[tgtIdx].updatedAt = new Date().toISOString();

  // Remove from source if moving
  if (ppMode === 'move') {
    props[srcIdx].interested.splice(ppInterestedIdx, 1);
    props[srcIdx].updatedAt = new Date().toISOString();
  }

  saveProperties(props);

  // Refresh UI depending on context
  if (ppSourceContext === 'modal') {
    tempInterested = JSON.parse(JSON.stringify(props[srcIdx].interested || []));
    renderInterestedList();
    updateSubTabCounts();
  } else {
    renderQuickInterestedPreview(props[srcIdx]);
    refreshQuickViewingPersonSelect(props[srcIdx]);
  }
  renderProperties();

  const targetName = props[tgtIdx].title || 'nehnuteľnosť';
  const actionText = ppMode === 'move' ? 'prenesený' : 'skopírovaný';
  closePropPicker();

  // Brief toast-style feedback
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#0B2A3C;color:#fff;padding:0.65rem 1.25rem;border-radius:10px;font-size:0.82rem;font-weight:500;z-index:10003;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:opacity 0.3s;';
  toast.textContent = `Záujemca ${actionText} do "${targetName}"`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2200);
}

// ===== NÁBOROVÝ LIST =====
function naborChip(el) {
  el.classList.toggle('active');
  if (typeof updateNaborPreview === 'function') updateNaborPreview();
  if (typeof _naborScheduleAutoSave === 'function') _naborScheduleAutoSave();
}

function getActiveChips(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return '';
  return Array.from(el.querySelectorAll('.nabor-chip.active')).map(c => c.textContent.trim()).join(', ');
}

function clearNaborForm(prefix) {
  const modal = document.getElementById(prefix === 'nb' ? 'nabor-form-byt' : 'nabor-form-dom');
  modal.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => el.value = '');
  modal.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  modal.querySelectorAll('.nabor-chip.active').forEach(el => el.classList.remove('active'));
}

// ── Read all field values + active chips for a given form (prefix 'nb' or 'nd') ──
function _naborReadFormData(prefix) {
  const formId = prefix === 'nb' ? 'nabor-form-byt' : 'nabor-form-dom';
  const form = document.getElementById(formId);
  if (!form) return null;
  const fields = {};
  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.id) fields[el.id] = el.value;
  });
  const chips = {};
  form.querySelectorAll('.nabor-chips').forEach(group => {
    if (!group.id) return;
    chips[group.id] = Array.from(group.querySelectorAll('.nabor-chip.active'))
      .map(c => c.textContent.trim());
  });
  return { fields, chips };
}

// ── Apply previously saved data back to form fields + chip selections ──
function _naborApplyFormData(prefix, saved) {
  if (!saved) return;
  const formId = prefix === 'nb' ? 'nabor-form-byt' : 'nabor-form-dom';
  const form = document.getElementById(formId);
  if (!form) return;
  if (saved.fields) {
    Object.entries(saved.fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    });
  }
  if (saved.chips) {
    Object.entries(saved.chips).forEach(([groupId, activeLabels]) => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.nabor-chip').forEach(chip => {
        const isActive = activeLabels.includes(chip.textContent.trim());
        chip.classList.toggle('active', isActive);
      });
    });
  }
}

// ── Save the current nábor form into property.nabor ──
// saveNabor(opts) — opts can include:
//   silent: true     → no toast, just persist (used by auto-save)
//   closeModal: true → close the modal after save (used by "Uložiť" click)
async function saveNabor(opts) {
  opts = opts || {};
  const propId = document.getElementById('nabor-prop-id').value;
  const type = document.getElementById('nabor-type').value;
  if (!propId) return;

  const prefix = type === 'byt' ? 'nb' : 'nd';
  const formData = _naborReadFormData(prefix);
  if (!formData) {
    if (!opts.silent) showToast('Nepodarilo sa prečítať údaje', 'error');
    return;
  }

  const props = getProperties();
  const idx = props.findIndex(x => x.id === propId);
  if (idx === -1) return;

  const existed = !!props[idx].nabor;
  // Preserve any remoteRequest already attached to the property — saveNabor
  // shouldn't wipe the link to a sent / signed request.
  const existingRemote = (props[idx].nabor && props[idx].nabor.remoteRequest) || null;
  props[idx].nabor = {
    type,
    data: formData,
    signatures: {
      seller: _naborSigState && _naborSigState.seller ? _naborSigState.seller : null,
      agent:  _naborSigState && _naborSigState.agent  ? _naborSigState.agent  : null,
    },
    savedAt: new Date().toISOString(),
    ...(existingRemote ? { remoteRequest: existingRemote } : {}),
  };
  saveProperties(props);

  if (opts.silent) {
    // Auto-save — show a small inline "Uložené ✓" indicator instead of a toast
    const info = document.getElementById('nabor-saved-info');
    if (info) {
      const t = new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
      info.innerHTML = '<span style="color:#065F46;">✓</span> Auto-uložené ' + t;
      info.style.display = '';
    }
  } else {
    showToast(existed ? 'Náborový list aktualizovaný ✓' : 'Náborový list uložený ✓', 'success');
  }

  if (typeof renderProperties === 'function') renderProperties();
  if (opts.closeModal) closeNaborModal();
}

// ── Auto-save plumbing ──
let _naborAutoSaveTimer = null;
function _naborScheduleAutoSave() {
  if (_naborAutoSaveTimer) clearTimeout(_naborAutoSaveTimer);
  _naborAutoSaveTimer = setTimeout(() => { saveNabor({ silent: true }); }, 800);
}
function _naborCancelAutoSave() {
  if (_naborAutoSaveTimer) { clearTimeout(_naborAutoSaveTimer); _naborAutoSaveTimer = null; }
}

// Attach input/change listeners to every field in both byt + dom forms so
// changes get auto-saved with debounce.
function _naborAttachAutoSave() {
  const modal = document.getElementById('naborModal');
  if (!modal) return;
  modal.querySelectorAll('#nabor-form-byt input, #nabor-form-byt textarea, #nabor-form-byt select, #nabor-form-dom input, #nabor-form-dom textarea, #nabor-form-dom select').forEach(el => {
    if (el.dataset.naborAutoSaveBound) return;
    el.dataset.naborAutoSaveBound = '1';
    const ev = (el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
    el.addEventListener(ev, _naborScheduleAutoSave);
  });
}

function openNaborModal(propId) {
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  const type = p.type; // 'byt' or 'dom'
  // hasSaved = nabor exists with REAL field/chip data. An empty stub (legacy
  // bug) is treated as "not saved" so the property pre-fill kicks in.
  const _hasRealData = (d) =>
    d && ((d.fields && Object.keys(d.fields).length > 0)
       || (d.chips && Object.keys(d.chips).length > 0));
  const hasSaved = !!(p.nabor && p.nabor.type === type && _hasRealData(p.nabor.data));

  document.getElementById('nabor-prop-id').value = propId;
  document.getElementById('nabor-type').value = type;

  // Show correct form
  document.getElementById('nabor-form-byt').style.display = type === 'byt' ? 'block' : 'none';
  document.getElementById('nabor-form-dom').style.display = type === 'dom' ? 'block' : 'none';
  const titleSuffix = hasSaved ? ' (uložený)' : '';
  document.getElementById('nabor-title').textContent =
    (type === 'byt' ? 'Náborový list - Byt' : 'Náborový list - Rodinný dom') + titleSuffix;

  // Show saved-info banner
  const savedInfo = document.getElementById('nabor-saved-info');
  if (savedInfo) {
    if (hasSaved) {
      const dt = new Date(p.nabor.savedAt);
      savedInfo.innerHTML = '<span style="color:#065F46;">✓ Uložený náborový list</span> – posledná zmena: <b>' +
        dt.toLocaleString('sk-SK') + '</b>';
      savedInfo.style.display = '';
    } else {
      savedInfo.style.display = 'none';
    }
  }

  // Clear forms
  clearNaborForm('nb');
  clearNaborForm('nd');

  if (hasSaved) {
    // Restore saved state — overrides property pre-fill
    _naborApplyFormData(type === 'byt' ? 'nb' : 'nd', p.nabor.data);

    // Pull seller signature from a remotely-signed request if available
    let sellerSig = (p.nabor.signatures && p.nabor.signatures.seller) || null;
    const rr = p.nabor.remoteRequest;
    if (!sellerSig && rr && rr.signedAt && rr.signedSignatureDataUrl) {
      sellerSig = {
        dataUrl: rr.signedSignatureDataUrl,
        signerName: rr.signedByName || rr.signerName || '',
        signedAt: rr.signedAt,
        auditId: rr.token,
        remote: true,
      };
    }
    _naborSigState = {
      seller: sellerSig,
      agent:  (p.nabor.signatures && p.nabor.signatures.agent) || null,
    };
    if (typeof _refreshNaborSigPreview === 'function') {
      _refreshNaborSigPreview('seller');
      _refreshNaborSigPreview('agent');
    }
  } else {
    // Pre-fill from property data
    if (type === 'byt') {
      if (p.address) document.getElementById('nb-adresa').value = (p.address || '') + (p.city ? ', ' + p.city : '');
      if (p.rooms) document.getElementById('nb-izby').value = p.rooms;
      if (p.area) document.getElementById('nb-obytna-plocha').value = p.area;
      if (p.floor) document.getElementById('nb-poschodie').value = p.floor;
      // Property fields are saved as p.owner / p.phone / p.email (not p.ownerName/etc.)
      const ownerName = p.owner || p.ownerName || '';
      const ownerPhone = p.phone || p.ownerPhone || '';
      const ownerEmail = p.email || p.ownerEmail || '';
      if (ownerName) document.getElementById('nb-vlastnik').value = ownerName;
      if (ownerPhone) document.getElementById('nb-tel-vlastnik').value = ownerPhone;
      if (ownerEmail) document.getElementById('nb-email-vlastnik').value = ownerEmail;
      if (p.price) document.getElementById('nb-cena-inzercia-byt').value = p.price + ' €';
      document.getElementById('nb-datum-byt').value = new Date().toISOString().split('T')[0];
      const session = getStoredUser();
      if (session) document.getElementById('nb-makler-byt').value = session.name;
    } else {
      if (p.address) document.getElementById('nd-adresa').value = (p.address || '') + (p.city ? ', ' + p.city : '');
      if (p.rooms) document.getElementById('nd-izby').value = p.rooms;
      if (p.area) document.getElementById('nd-uzitkova').value = p.area;
      const ownerName = p.owner || p.ownerName || '';
      const ownerPhone = p.phone || p.ownerPhone || '';
      const ownerEmail = p.email || p.ownerEmail || '';
      if (ownerName) document.getElementById('nd-vlastnik1').value = ownerName;
      if (ownerPhone && document.getElementById('nd-tel-vlastnik')) document.getElementById('nd-tel-vlastnik').value = ownerPhone;
      if (ownerEmail && document.getElementById('nd-email-vlastnik')) document.getElementById('nd-email-vlastnik').value = ownerEmail;
      if (p.price) document.getElementById('nd-cena-inzercia').value = p.price + ' €';
      document.getElementById('nd-datum').value = new Date().toISOString().split('T')[0];
      const session = getStoredUser();
      if (session) document.getElementById('nd-makler').value = session.name;
    }
    _naborSigState = { seller: null, agent: null };
    if (typeof _refreshNaborSigPreview === 'function') {
      _refreshNaborSigPreview('seller');
      _refreshNaborSigPreview('agent');
    }
  }

  document.getElementById('naborModal').style.display = 'block';
  setTimeout(updateNaborPreview, 50);

  // Lock the form into read-only mode if the client has already signed.
  // The agent shouldn't be editing a finalised, signed document — only
  // viewing or downloading the PDF.
  _applyNaborLockState(p);

  // Attach auto-save listeners to every field — silent debounced save on
  // every input / chip toggle so the agent never loses progress.
  _naborCancelAutoSave();   // cancel any pending save from a previous open
  _naborAttachAutoSave();

  // Show initial name previews under signature boxes
  if (typeof _refreshAllNaborSigNames === 'function') _refreshAllNaborSigNames();
  // Live-update the name previews when the relevant form fields change
  ['nb-vlastnik','nd-vlastnik1','nb-makler-byt','nd-makler'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.naborSigBound) {
      el.addEventListener('input', _refreshAllNaborSigNames);
      el.dataset.naborSigBound = '1';
    }
  });
}

function closeNaborModal() {
  // Flush pending auto-save synchronously so the user can't lose the last
  // few keystrokes when they close mid-edit.
  if (_naborAutoSaveTimer) {
    clearTimeout(_naborAutoSaveTimer);
    _naborAutoSaveTimer = null;
    try { saveNabor({ silent: true }); } catch (e) {}
  }
  document.getElementById('naborModal').style.display = 'none';
  _naborSigState = { seller: null, agent: null };
  _applyNaborLockState(null); // reset lock state on close
}

// Switch the náborový list modal between editable and read-only mode.
//
// In locked mode (client has signed) we replace the entire body with a real
// PDF render — same one that downloads — embedded as an iframe. The agent
// sees exactly what the printed document will look like, including all
// sections and embedded signatures.
// Bridge for the "Editovať znova" footer button — pulls propId from the
// open modal and delegates to unlockNabor.
function unlockNaborFromModal() {
  const propId = document.getElementById('nabor-prop-id')?.value;
  if (!propId) return;
  unlockNabor(propId);
}

// Re-open a signed náborový list for editing. Asks the user to confirm,
// then drops the seller signature + remoteRequest from the property and
// from the KV store, so the document goes back to "rozpracovaný" (red)
// and can be edited and re-sent for signature.
async function unlockNabor(propId) {
  const props = getProperties();
  const idx = props.findIndex(p => p.id === propId);
  if (idx === -1) return;
  const p = props[idx];
  if (!p.nabor) return;

  // Confirm dialog — make consequence very clear
  const confirmed = await secConfirm({
    title: 'Editovať podpísaný dokument?',
    message:
      'Po znovuotvorení tohto náborového listu sa vymaže existujúci podpis ' +
      'klienta a budete musieť dokument klientovi opätovne poslať na podpis.\n\n' +
      'Pokračovať?',
    type: 'warning',
    ok: 'Áno, editovať znova',
    cancel: 'Zrušiť',
  });
  if (!confirmed) return;

  // Best-effort delete the remote KV record (agent's session token required).
  // Failure is non-fatal — the record will expire naturally in 30 days.
  const rr = p.nabor.remoteRequest;
  if (rr && rr.token) {
    try {
      const sessionToken = (typeof getStoredToken === 'function') ? getStoredToken() : null;
      if (sessionToken && typeof secureFetch === 'function') {
        await secureFetch('/api/sign/' + encodeURIComponent(rr.token), {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + sessionToken },
        });
      }
    } catch (e) {
      console.warn('[SecPro] Could not delete remote sign record', e);
    }
  }

  // Clear seller signature + the entire remote-sign attachment.
  // Keep agent's local signature — the maklér's part doesn't need redoing.
  p.nabor.signatures = {
    seller: null,
    agent: (p.nabor.signatures && p.nabor.signatures.agent) || null,
  };
  delete p.nabor.remoteRequest;
  saveProperties(props);

  // Refresh local cache so getDealStatus doesn't still see the request as 'signed'
  if (typeof _remoteSignCache !== 'undefined' && Array.isArray(_remoteSignCache)) {
    _remoteSignCache = _remoteSignCache.filter(s => s.token !== (rr && rr.token));
  }

  // Re-apply lock state on the open modal — now unlocked, form-side reappears.
  // Also re-render property cards so the chip drops back to "Rozpracovaný" (red).
  _applyNaborLockState(p);
  _naborSigState = {
    seller: null,
    agent: (p.nabor.signatures && p.nabor.signatures.agent) || null,
  };
  if (typeof _refreshNaborSigPreview === 'function') {
    _refreshNaborSigPreview('seller');
    _refreshNaborSigPreview('agent');
  }
  if (typeof renderProperties === 'function') renderProperties();

  showToast('Dokument je znova editovateľný. Po úprave odošlite klientovi nový odkaz na podpis.', 'info');
}

function _applyNaborLockState(p) {
  const modal = document.getElementById('naborModal');
  if (!modal) return;
  const locked = !!(p && isNaborClientSigned(p));
  modal.classList.toggle('nabor-locked', locked);

  // Hide both columns of the editing UI when locked
  const splitPane = modal.querySelector('.nabor-split');
  const sigBlock = document.getElementById('nabor-sig-block');
  if (splitPane) splitPane.style.display = locked ? 'none' : '';
  if (sigBlock) sigBlock.style.display = locked ? 'none' : '';

  // Save button hidden in locked mode (cannot save a finalised document)
  const saveBtn = modal.querySelector('.nabor-btn-save');
  if (saveBtn) saveBtn.style.display = locked ? 'none' : '';

  // Re-edit button only appears in locked mode
  const reeditBtn = document.getElementById('nabor-btn-reedit');
  if (reeditBtn) reeditBtn.style.display = locked ? '' : 'none';

  // PDF button: "Generovať PDF" → "Stiahnuť PDF" once finalised
  const pdfBtn = modal.querySelector('.nabor-btn-pdf');
  if (pdfBtn) {
    pdfBtn.innerHTML = locked
      ? '<span style="display:inline-flex;align-items:center;gap:0.4rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Stiahnuť PDF</span>'
      : '<span style="display:inline-flex;align-items:center;gap:0.4rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Generovať PDF</span>';
  }

  // Show / hide the PDF viewer
  let viewer = document.getElementById('nabor-pdf-viewer');
  if (locked) {
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.id = 'nabor-pdf-viewer';
      viewer.className = 'nabor-pdf-viewer';
      // Insert before the signature block (which is hidden anyway), so it
      // sits in the same body region the form normally occupies.
      const anchor = sigBlock || splitPane;
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(viewer, anchor);
      }
    }
    const rr = (p && p.nabor && p.nabor.remoteRequest) || {};
    const dateStr = rr.signedAt
      ? new Date(rr.signedAt).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const signer = rr.signedByName || rr.signerName || '';

    // Render the ribbon + spinner placeholder first; the PDF generation can
    // take a moment if there are many embedded images.
    viewer.innerHTML =
      '<div class="nabor-locked-ribbon">' +
        '<div class="nlr-badge"><span class="nlr-check">✓</span><span>PODPÍSANÝ NÁBOROVÝ LIST</span></div>' +
        '<div class="nlr-meta">' +
          (signer ? '<span class="nlr-signer">' + esc(signer) + '</span>' : '') +
          (signer && dateStr ? '<span class="nlr-sep">·</span>' : '') +
          (dateStr ? '<span class="nlr-date">' + esc(dateStr) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="nabor-pdf-loading">Načítavam PDF…</div>';
    viewer.style.display = '';

    // Generate the PDF asynchronously (next tick) so the spinner can paint
    setTimeout(() => {
      try {
        const dataUri = generateNaborPDF({ mode: 'datauri' });
        // Replace the loading text with the iframe
        const loading = viewer.querySelector('.nabor-pdf-loading');
        if (loading) loading.remove();
        const iframe = document.createElement('iframe');
        iframe.className = 'nabor-pdf-frame';
        iframe.src = dataUri;
        iframe.title = 'Podpísaný náborový list';
        viewer.appendChild(iframe);
      } catch (e) {
        console.error('[SecPro] Failed to render PDF', e);
        const loading = viewer.querySelector('.nabor-pdf-loading');
        if (loading) loading.textContent = 'PDF sa nepodarilo vygenerovať. Skúste tlačidlo "Stiahnuť PDF".';
      }
    }, 50);
  } else if (viewer) {
    viewer.style.display = 'none';
    viewer.innerHTML = '';   // free the iframe + data URI
  }

  // Old preview-injection + ribbon helpers are no longer needed — clean them up
  const oldRibbon = document.getElementById('nabor-locked-ribbon');
  if (oldRibbon && oldRibbon.parentElement && oldRibbon.parentElement.classList.contains('nabor-preview-side')) {
    oldRibbon.remove();
  }
  const oldSignedView = document.getElementById('nabor-signed-view');
  if (oldSignedView) oldSignedView.style.display = 'none';
  const oldBanner = document.getElementById('nabor-locked-banner');
  if (oldBanner) oldBanner.style.display = 'none';
  // Restore the small "Náhľad dokumentu" header in case it was hidden by an
  // earlier locked-state pass (we don't show the HTML preview anymore but
  // it should reappear correctly when modal is reopened in unlocked mode).
  const previewHeader = modal.querySelector('.nabor-preview-header');
  if (previewHeader) previewHeader.style.display = '';
}

// Append a signature panel inside the rendered náborák preview (#naborPreviewContent)
// so that the agent sees the actual signed document, not just a summary.
function _appendSignatureToPreview(p) {
  const content = document.getElementById('naborPreviewContent');
  if (!content) return;
  const rr = p && p.nabor && p.nabor.remoteRequest;
  if (!rr || !rr.signedSignatureDataUrl) return;

  // Remove any previous block so re-renders don't duplicate
  const existing = content.querySelector('.np-signature-block');
  if (existing) existing.remove();

  const block = document.createElement('div');
  block.className = 'np-signature-block';
  const dateStr = rr.signedAt
    ? new Date(rr.signedAt).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const signer = rr.signedByName || rr.signerName || '';
  block.innerHTML =
    '<div class="np-sig-title">PODPISY</div>' +
    '<div class="np-sig-row">' +
      '<div class="np-sig-col">' +
        '<img src="' + rr.signedSignatureDataUrl + '" class="np-sig-img" alt="Podpis predávajúceho"/>' +
        '<div class="np-sig-line"></div>' +
        '<div class="np-sig-name">' + (signer ? esc(signer) : '') + '</div>' +
        '<div class="np-sig-role">Predávajúci · ' + esc(dateStr) + '</div>' +
      '</div>' +
    '</div>';
  content.appendChild(block);
}

// ----- Náborák signatures -----
let _naborSigState = { seller: null, agent: null };

function _refreshNaborSigPreview(role) {
  const s = _naborSigState[role];
  const box = document.getElementById(`nabor-sig-${role}-box`);
  const meta = document.getElementById(`nabor-sig-${role}-meta`);
  const clearBtn = document.getElementById(`nabor-sig-${role}-clear`);
  if (!box) return;
  if (s && s.dataUrl) {
    box.innerHTML = `<img src="${s.dataUrl}" style="max-width:100%;max-height:100px;object-fit:contain;" />`;
    if (meta) { meta.style.display = 'block'; meta.textContent = `${s.signerName} · ${new Date(s.signedAt).toLocaleString('sk-SK')}`; }
    if (clearBtn) clearBtn.style.display = '';
  } else {
    box.innerHTML = '<div class="profile-sig-empty">Bez podpisu</div>';
    if (meta) meta.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  }
  if (typeof _refreshNaborSigName === 'function') _refreshNaborSigName(role);
}

// Updates the small italic name preview under each signature header.
// Pulls the name from the signature itself (if drawn) or from the
// vlastník / maklér field in the active form.
function _refreshNaborSigName(role) {
  const el = document.getElementById(`nabor-sig-${role}-name`);
  if (!el) return;
  const type = document.getElementById('nabor-type')?.value;
  const sig = _naborSigState && _naborSigState[role];
  let name = '';
  if (sig && sig.signerName) {
    name = sig.signerName;
  } else if (role === 'seller') {
    name = (document.getElementById('nb-vlastnik')?.value
         || document.getElementById('nd-vlastnik1')?.value || '').trim();
  } else {
    name = (document.getElementById('nb-makler-byt')?.value
         || document.getElementById('nd-makler')?.value || '').trim();
  }
  if (name) {
    el.textContent = '— ' + name;
    el.style.color = 'var(--text-light)';
  } else {
    const sourceField = role === 'seller'
      ? (type === 'byt' ? '"Vlastník"' : '"Vlastník 1"')
      : '"Maklér"';
    el.textContent = '— vyplňte pole ' + sourceField;
    el.style.color = '#B45309';
  }
}

// Refresh both name previews — call when relevant form fields change
function _refreshAllNaborSigNames() {
  _refreshNaborSigName('seller');
  _refreshNaborSigName('agent');
}

function openNaborSignature(role) {
  const propId = document.getElementById('nabor-prop-id').value;
  const profile = (typeof getProfile === 'function') ? getProfile() : {};
  let signerName = '';
  if (role === 'agent') {
    // Prefer the maklér name from the form (auto-filled from session at modal open)
    signerName = (document.getElementById('nb-makler-byt')?.value
                 || document.getElementById('nd-makler')?.value
                 || profile.name
                 || 'Maklér').trim();
  } else {
    // Pick name from vlastník field in nábor form (byt or dom)
    signerName = (document.getElementById('nb-vlastnik')?.value
                 || document.getElementById('nd-vlastnik1')?.value
                 || document.getElementById('np-vlastnik')?.value
                 || '').trim();
  }
  openSignaturePad({
    title: role === 'agent' ? 'Podpis makléra' : 'Podpis predávajúceho',
    subtitle: role === 'agent' ? 'Váš profesionálny podpis' : 'Podpis predávajúceho/vlastníka nehnuteľnosti',
    signerName,
    signerRole: role === 'agent' ? 'Maklér' : 'Predávajúci',
    documentType: 'nabor',
    documentId: propId,
    docRef: 'Náborový list – ' + (document.getElementById('nb-adresa')?.value || document.getElementById('nd-adresa')?.value || document.getElementById('np-adresa')?.value || 'nehnuteľnosť'),
    allowUseStored: role === 'agent',
    allowSaveToProfile: role === 'agent',
    onConfirm: (dataUrl, entry) => {
      _naborSigState[role] = { dataUrl, signerName: entry.signerName, signedAt: entry.signedAt, auditId: entry.id };
      _refreshNaborSigPreview(role);
    }
  });
}

function clearNaborSignature(role) {
  _naborSigState[role] = null;
  _refreshNaborSigPreview(role);
}

// Slovak diacritics fixer for jsPDF helvetica (global)
// Helvetica (WinAnsiEncoding) SUPPORTS: á,Á,ä,é,É,í,Í,ó,Ó,ô,Ô,ú,Ú,ü,ý,Ý,š,Š,ž,Ž
// Helvetica DOES NOT support: č,Č,ď,Ď,ě,ľ,Ľ,ĺ,Ĺ,ň,Ň,ŕ,Ŕ,ť,Ť
const _diaMap = {
  '\u010d':'c','\u010c':'C',         // č,Č
  '\u010f':'d','\u010e':'D',         // ď,Ď
  '\u011b':'e',                       // ě
  '\u013e':'l','\u013d':'L',         // ľ,Ľ
  '\u013a':'l','\u0139':'L',         // ĺ,Ĺ
  '\u0148':'n','\u0147':'N',         // ň,Ň
  '\u0155':'r','\u0154':'R',         // ŕ,Ŕ
  '\u0165':'t','\u0164':'T',         // ť,Ť
  '\u20ac':'EUR','\u2022':'*','\u2605':'*'
};
function sk(str) {
  if (!str) return '';
  return str.replace(/[\u010c\u010d\u010e\u010f\u011b\u013a\u0139\u013d\u013e\u0147\u0148\u0154\u0155\u0164\u0165\u20ac\u2022\u2605]/g, ch => _diaMap[ch] || ch);
}

// generateNaborPDF(opts) — opts.mode controls what happens with the result:
//   'download' (default) → triggers browser download (existing behaviour)
//   'datauri'            → returns the PDF as a data URI string (for iframe)
//   'blob'               → returns a Blob (for object URLs)
function generateNaborPDF(opts) {
  opts = opts || {};
  const mode = opts.mode || 'download';
  const type = document.getElementById('nabor-type').value;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pw - margin * 2;
  let y = 14;

  function checkPage(needed) {
    if (y + needed > 278) { doc.addPage(); y = 14; }
  }

  // Deferred section title — header is only drawn when the first non-empty
  // row in that section is rendered. Empty sections are silently dropped.
  let _pendingSection = null;
  function _drawSectionTitle(title) {
    checkPage(14);
    y += 1;
    doc.setFillColor(11, 42, 60);
    doc.roundedRect(margin, y, contentW, 7.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(sk(title.toUpperCase()), margin + 4, y + 5.2);
    y += 10.5;
    doc.setTextColor(30, 30, 30);
  }
  function sectionTitle(title) { _pendingSection = title; }
  function _flushSection() {
    if (_pendingSection !== null) {
      _drawSectionTitle(_pendingSection);
      _pendingSection = null;
    }
  }

  function fieldRow(label, value) {
    if (!value) return;
    _flushSection();
    const valText = sk(value);
    const labText = sk(label);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const labW = doc.getTextWidth(labText + ':') + 3;
    const valColX = margin + Math.max(labW + 2, 42);
    const valMaxW = contentW - (valColX - margin) - 2;
    const lines = doc.splitTextToSize(valText, valMaxW);
    const rowH = Math.max(5.5, lines.length * 3.8);
    checkPage(rowH + 1);
    // Light bg stripe
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, rowH, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 80);
    doc.text(labText + ':', margin + 2, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(lines, valColX, y + 3.8);
    y += rowH + 0.8;
  }

  function fieldRow2(l1, v1, l2, v2) {
    if (!v1 && !v2) return;
    _flushSection();
    checkPage(6.5);
    const half = contentW / 2 - 1;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, 5.5, 0.5, 0.5, 'F');
    doc.setFontSize(7.5);
    if (v1) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 80);
      const l1t = sk(l1);
      doc.text(l1t + ':', margin + 2, y + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 20, 20);
      const l1w = doc.getTextWidth(l1t + ':') + 3;
      const v1t = sk(v1);
      const v1x = margin + Math.max(l1w + 2, 30);
      const v1max = half - (v1x - margin);
      doc.text(v1max > 10 ? doc.splitTextToSize(v1t, v1max)[0] : v1t, v1x, y + 3.8);
    }
    if (v2) {
      const col2 = margin + half + 3;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 70, 80);
      const l2t = sk(l2);
      doc.text(l2t + ':', col2, y + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 20, 20);
      const l2w = doc.getTextWidth(l2t + ':') + 3;
      const v2t = sk(v2);
      const v2x = col2 + Math.max(l2w + 2, 30);
      const v2max = (margin + contentW) - v2x - 1;
      doc.text(v2max > 10 ? doc.splitTextToSize(v2t, v2max)[0] : v2t, v2x, y + 3.8);
    }
    y += 6.3;
  }

  function multilineField(label, value) {
    if (!value) return;
    _flushSection();
    const labText = sk(label);
    const valText = sk(value);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(valText, contentW - 8);
    const totalH = 5 + lines.length * 3.8 + 2;
    checkPage(totalH);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentW, totalH, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(70, 70, 80);
    doc.text(labText + ':', margin + 2, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(lines, margin + 4, y + 8);
    y += totalH + 0.8;
  }

  // HEADER
  doc.setFillColor(11, 42, 60);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  const headerText = type === 'byt' ? sk('PRACOVNÝ LIST - BYT') : sk('PRACOVNÝ LIST - RODINNÝ DOM');
  doc.text(headerText, pw / 2, y + 8.5, { align: 'center' });
  y += 17;

  if (type === 'byt') {
    // ---- BYT PDF ----
    const v = (id) => document.getElementById(id)?.value?.trim() || '';
    const c = (id) => getActiveChips(id);

    sectionTitle('Základné údaje');
    fieldRow('Adresa', v('nb-adresa'));
    fieldRow2('Vlastníctvo', c('nb-vlastnictvo'), 'Vlastník', v('nb-vlastnik'));
    fieldRow2('Podiel', v('nb-podiel'), 'Správca bytovky', v('nb-spravca-bytovky'));
    fieldRow('Ťarcha', c('nb-tarcha'));

    sectionTitle('Bytový dom');
    fieldRow2('Vek BD', v('nb-vek-bd'), 'Výťah', c('nb-vytah'));
    fieldRow2('Materiál', c('nb-material-bd'), 'Vstup do BD', c('nb-vstup-bd'));
    fieldRow('Stav BD', c('nb-stav-bd'));
    fieldRow('Rekonštrukcia BD', v('nb-rekon-bd'));
    fieldRow('Parkovanie', c('nb-parkovanie-byt'));

    sectionTitle('Byt');
    fieldRow2('Počet izieb', v('nb-izby'), 'Poschodie', v('nb-poschodie'));
    fieldRow('Obytná plocha', v('nb-obytna-plocha') ? v('nb-obytna-plocha') + ' m²' : '');
    multilineField('Dispozícia', v('nb-dispozicia'));
    fieldRow('Vykurovanie', c('nb-vykurovanie-byt'));
    fieldRow('Ohrev vody', v('nb-ohrev-byt'));
    fieldRow2('Okná', c('nb-okna-byt'), 'Komory/Sklá', v('nb-komory-byt'));
    fieldRow2('Dvere', c('nb-dvere-byt'), 'Stav bytu', c('nb-stav-bytu'));

    sectionTitle('Príslušenstvo');
    fieldRow2('Pivnica', v('nb-pivnica-byt'), 'Terasa', v('nb-terasa-byt'));
    fieldRow2('Balkón', v('nb-balkon-byt'), 'Šatník', v('nb-satnik-byt'));
    fieldRow2('Špajza', v('nb-spajza-byt'), 'Park. miesto', v('nb-park-miesto'));

    sectionTitle('Rekonštrukcia bytu');
    fieldRow2('Rekonštrukcia', c('nb-rekon-byt'), 'Rok', v('nb-rekon-rok-byt'));
    multilineField('Rozpis', v('nb-rekon-rozpis-byt'));

    sectionTitle('Zariadenie');
    fieldRow('Zariadenie', c('nb-zariadenie-byt'));
    multilineField('Rozpis zariadenia', v('nb-zariadenie-rozpis-byt'));

    sectionTitle('Mesačné náklady');
    fieldRow2('Celkom', v('nb-naklady-celkom') ? v('nb-naklady-celkom') + ' €' : '', 'Správca', v('nb-naklady-spravca') ? v('nb-naklady-spravca') + ' €' : '');
    fieldRow2('Elektrika', v('nb-naklady-elektrika-byt') ? v('nb-naklady-elektrika-byt') + ' €' : '', 'Plyn', v('nb-naklady-plyn-byt') ? v('nb-naklady-plyn-byt') + ' €' : '');
    fieldRow2('Zateplenie', v('nb-zateplenie-byt'), 'Stupačky', v('nb-stupacky'));
    fieldRow2('Energ. certifikát', v('nb-ecert-byt'), 'Podlahy', v('nb-podlahy'));
    fieldRow('Ostatné', v('nb-naklady-ostatne-byt'));

    sectionTitle('Ostatné');
    fieldRow2('Internet', c('nb-internet-byt'), 'Poskytovateľ', v('nb-internet-provider-byt'));
    fieldRow('Vysťahovanie', v('nb-vystahovanie'));
    multilineField('Vady / poškodenia', v('nb-vady-byt'));
    multilineField('Poznámky', v('nb-poznamky-byt'));
    fieldRow('Podmienený prevod', v('nb-podmieneny-byt'));
    fieldRow('Kúpa novej - predstava', v('nb-nova-predstava-byt'));
    fieldRow('Financovanie', v('nb-financovanie-byt'));

    sectionTitle('Ceny a záver');
    fieldRow2('Odporúč. cena', v('nb-cena-odporucana-byt'), 'Cena do inzercie', v('nb-cena-inzercia-byt'));
    fieldRow('Provízia pre RK', v('nb-provizia-byt'));
    fieldRow('Nadobúdací doklad', v('nb-nadobudaci-byt'));
    fieldRow2('Telefón vlastníka', v('nb-tel-vlastnik'), 'Email vlastníka', v('nb-email-vlastnik'));
    fieldRow2('Fotenie', v('nb-fotenie-byt'), 'Inzercia', v('nb-inzercia-byt'));
    fieldRow2('Maklér', v('nb-makler-byt'), 'Dátum', v('nb-datum-byt'));

  } else {
    // ---- DOM PDF ----
    const v = (id) => document.getElementById(id)?.value?.trim() || '';
    const c = (id) => getActiveChips(id);

    sectionTitle('Základné údaje');
    fieldRow('Adresa', v('nd-adresa'));
    fieldRow2('Počet podlaží', v('nd-podlazia'), 'Počet izieb', v('nd-izby'));
    fieldRow('Typ RD', c('nd-typ-rd'));
    fieldRow('Stav RD', c('nd-stav-rd'));

    sectionTitle('Rodinný dom');
    fieldRow2('Vek RD', v('nd-vek-rd'), 'Energ. certifikát', v('nd-ecert'));
    fieldRow2('Zastavaná plocha', v('nd-zastavana') ? v('nd-zastavana') + ' m²' : '', 'Úžitková plocha', v('nd-uzitkova') ? v('nd-uzitkova') + ' m²' : '');
    fieldRow('Pozemok celkom', v('nd-pozemok') ? v('nd-pozemok') + ' m²' : '');

    sectionTitle('Inžinierske siete');
    fieldRow2('Elektrika', c('nd-elektrika'), 'Voda', c('nd-voda'));
    fieldRow2('Odpad', c('nd-odpad'), 'Žumpa (m³)', v('nd-zumpa-m3'));
    fieldRow('Plyn', c('nd-plyn'));

    sectionTitle('Konštrukcia');
    fieldRow('Materiál', c('nd-material'));
    fieldRow2('Obvodové murivo', v('nd-murivo'), 'Deliace priečky', v('nd-priecky'));
    fieldRow2('Zateplenie', c('nd-zateplenie'), 'Hrúbka', v('nd-zateplenie-hrubka'));
    fieldRow('Fasáda', v('nd-fasada'));

    sectionTitle('Strecha');
    fieldRow('Typ strechy', c('nd-strecha-typ'));
    fieldRow('Materiál strechy', c('nd-strecha-mat'));
    fieldRow('Izolácia', v('nd-strecha-izolacia'));

    sectionTitle('Okná, dvere, zabezpečenie');
    fieldRow2('Okná', c('nd-okna'), 'Komory/Sklá', v('nd-komory'));
    fieldRow('Žalúzie', c('nd-zaluzie'));
    fieldRow2('Vstupné dvere', c('nd-dvere'), 'Zabezpečenie', c('nd-zabezpecenie'));

    sectionTitle('Vykurovanie a vybavenie');
    fieldRow2('Krb', c('nd-krb'), 'Klimatizácia', c('nd-klima'));
    fieldRow('Vykurovanie', c('nd-vykurovanie'));
    fieldRow('Ohrev vody', v('nd-ohrev'));
    multilineField('Dispozícia RD', v('nd-dispozicia'));

    sectionTitle('Príslušenstvo');
    fieldRow2('Pivnica', v('nd-pivnica'), 'Terasa', v('nd-terasa'));
    fieldRow2('Balkón', v('nd-balkon'), 'Povala', v('nd-povala'));

    sectionTitle('Rekonštrukcia');
    fieldRow2('Rekonštrukcia', c('nd-rekon'), 'Rok', v('nd-rekon-rok'));
    multilineField('Rozpis', v('nd-rekon-rozpis'));

    sectionTitle('Zariadenie');
    fieldRow('Zariadenie', c('nd-zariadenie'));
    multilineField('Rozpis zariadenia', v('nd-zariadenie-rozpis'));

    sectionTitle('Exteriér');
    fieldRow('Parkovanie', c('nd-parkovanie'));
    fieldRow2('Garáž', v('nd-garaz'), 'Altánok', v('nd-altanok'));
    fieldRow2('Bazén', v('nd-bazen'), 'Studňa', v('nd-studna'));
    fieldRow('Iná stavba', v('nd-ina-stavba'));
    multilineField('Rozpis exteriéru', v('nd-ext-rozpis'));

    sectionTitle('Mesačné náklady');
    fieldRow2('Elektrika', v('nd-naklady-elektrika') ? v('nd-naklady-elektrika') + ' €' : '', 'Voda', v('nd-naklady-voda') ? v('nd-naklady-voda') + ' €' : '');
    fieldRow2('Plyn', v('nd-naklady-plyn') ? v('nd-naklady-plyn') + ' €' : '', 'Žumpa', v('nd-naklady-zumpa') ? v('nd-naklady-zumpa') + ' €' : '');
    fieldRow2('Odpad', v('nd-naklady-odpad') ? v('nd-naklady-odpad') + ' €' : '', 'TV', v('nd-naklady-tv') ? v('nd-naklady-tv') + ' €' : '');
    fieldRow('Internet', v('nd-naklady-internet') ? v('nd-naklady-internet') + ' €' : '');
    fieldRow2('Poskytovateľ', v('nd-internet-provider'), 'Typ pripojenia', c('nd-internet-typ'));

    sectionTitle('Ostatné');
    multilineField('Vady / poškodenia', v('nd-vady'));
    multilineField('Poznámky', v('nd-poznamky'));
    fieldRow('Podmienený prevod', v('nd-podmieneny'));

    sectionTitle('Vlastníctvo');
    fieldRow('Vlastníctvo', c('nd-vlastnictvo'));
    fieldRow2('Vlastník 1', v('nd-vlastnik1'), 'Podiel 1', v('nd-podiel1'));
    fieldRow2('Vlastník 2', v('nd-vlastnik2'), 'Podiel 2', v('nd-podiel2'));
    fieldRow('Ťarcha', c('nd-tarcha'));
    fieldRow('Nadobúdací doklad', v('nd-nadobudaci'));
    fieldRow('Dokumenty', v('nd-dokumenty'));

    sectionTitle('Ceny a záver');
    fieldRow2('Odporúč. cena', v('nd-cena-odporucana'), 'Cena do inzercie', v('nd-cena-inzercia'));
    fieldRow('Provízia pre RK', v('nd-provizia'));
    fieldRow2('Fotenie', v('nd-fotenie'), 'Inzercia', v('nd-inzercia'));
    fieldRow2('Maklér', v('nd-makler'), 'Dátum', v('nd-datum'));
  }

  // Signatures block (before footer) — always rendered with names from form
  const sellerSig = _naborSigState && _naborSigState.seller;
  const agentSig = _naborSigState && _naborSigState.agent;
  const formVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const sellerName = (sellerSig && sellerSig.signerName) ||
    (type === 'byt' ? formVal('nb-vlastnik') : formVal('nd-vlastnik1'));
  const agentName = (agentSig && agentSig.signerName) ||
    (type === 'byt' ? formVal('nb-makler-byt') : formVal('nd-makler'));

  if (sellerSig || agentSig || sellerName || agentName) {
    checkPage(55);
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pw - margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(11, 42, 60);
    doc.text(sk('Podpisy'), margin, y);
    y += 4;
    const colW = (contentW - 8) / 2;
    const sigY = y;
    // Seller
    if (sellerSig) {
      try { doc.addImage(sellerSig.dataUrl, 'PNG', margin, sigY, Math.min(colW, 70), 25); } catch (e) {}
    }
    doc.setDrawColor(100, 100, 100);
    doc.line(margin, sigY + 28, margin + colW, sigY + 28);
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(sk('Predávajúci: ' + sellerName), margin, sigY + 32);
    if (sellerSig) doc.text(sk(new Date(sellerSig.signedAt).toLocaleString('sk-SK')), margin, sigY + 36);
    // Agent
    const ax = margin + colW + 8;
    if (agentSig) {
      try { doc.addImage(agentSig.dataUrl, 'PNG', ax, sigY, Math.min(colW, 70), 25); } catch (e) {}
    }
    doc.line(ax, sigY + 28, ax + colW, sigY + 28);
    doc.text(sk('Maklér: ' + agentName), ax, sigY + 32);
    if (agentSig) doc.text(sk(new Date(agentSig.signedAt).toLocaleString('sk-SK')), ax, sigY + 36);
    y = sigY + 40;
  }

  // Footer
  checkPage(15);
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pw - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(sk('Vygenerované v SecPro') + ' | ' + new Date().toLocaleDateString('sk-SK'), pw / 2, y, { align: 'center' });

  const filename = type === 'byt' ? 'Naborovy_list_BYT.pdf' : 'Naborovy_list_DOM.pdf';
  if (mode === 'datauri') return doc.output('datauristring');
  if (mode === 'blob')    return doc.output('blob');
  doc.save(filename);
}

// ===== SIGNATURE PAD =====
const sigPads = {};

function initSignaturePad(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;

  // Set actual canvas resolution
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0B2A3C';
  }
  resize();

  let drawing = false;
  let hasSig = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    wrap.classList.add('signing');
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (!hasSig) {
      hasSig = true;
      wrap.classList.add('has-sig');
    }
  }

  function end(e) {
    if (drawing) {
      drawing = false;
      ctx.closePath();
      wrap.classList.remove('signing');
    }
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  sigPads[canvasId] = {
    canvas, ctx, wrap,
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasSig = false;
      wrap.classList.remove('has-sig');
    },
    isEmpty() { return !hasSig; },
    toDataURL() { return canvas.toDataURL('image/png'); },
    resize
  };
}

function clearSignature(canvasId) {
  if (sigPads[canvasId]) sigPads[canvasId].clear();
}

// ===== PROTOCOL MODAL =====
function openProtocolModal(propId) {
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  document.getElementById('proto-prop-id').value = propId;

  // Fill property info
  const priceStr = p.price ? p.price.toLocaleString('sk-SK') + ' \u20AC' : '\u2014';
  document.getElementById('proto-prop-info').innerHTML = `
    <dt>Názov</dt><dd>${esc(p.title)}</dd>
    <dt>Adresa</dt><dd>${esc([p.address, p.city, p.district].filter(Boolean).join(', ') || '\u2014')}</dd>
    <dt>Cena</dt><dd>${priceStr}</dd>
    <dt>Vlastník</dt><dd>${esc(p.owner || '\u2014')}</dd>
  `;

  // Fill viewing select
  const viewings = p.viewings || [];
  const sel = document.getElementById('proto-viewing-select');
  sel.innerHTML = '<option value="">-- vyberte prehliadku --</option>';
  viewings.forEach((v, i) => {
    const d = v.date ? new Date(v.date) : null;
    const ds = d ? d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'}) : '';
    sel.innerHTML += `<option value="${i}">${ds} \u2014 ${esc(v.personName)}</option>`;
  });
  document.getElementById('proto-viewing-detail').style.display = 'none';

  // Pre-fill broker name from session
  const session = getStoredUser();
  document.getElementById('proto-broker-name').value = session ? session.name : '';
  document.getElementById('proto-client-name').value = '';
  document.getElementById('proto-notes').value = '';

  document.getElementById('protocolModal').style.display = 'block';

  // Init signature pads (after modal visible so canvas has dimensions)
  setTimeout(() => {
    initSignaturePad('sig-broker');
    initSignaturePad('sig-client');
    if (typeof updateProtocolPreview === 'function') updateProtocolPreview();
  }, 50);
}

function closeProtocolModal() {
  document.getElementById('protocolModal').style.display = 'none';
}

function updateProtocolViewing() {
  const propId = document.getElementById('proto-prop-id').value;
  const p = getProperties().find(x => x.id === propId);
  const idx = document.getElementById('proto-viewing-select').value;
  const detail = document.getElementById('proto-viewing-detail');

  if (idx === '' || !p) { detail.style.display = 'none'; return; }

  const v = (p.viewings || [])[parseInt(idx)];
  if (!v) { detail.style.display = 'none'; return; }

  const d = v.date ? new Date(v.date) : null;
  const ds = d ? d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'}) : '\u2014';
  const r = (VIEWING_RESULT_MAP[v.result] || {}).label || v.result;
  const t = VIEWING_TYPE_MAP[v.type] || v.type;

  document.getElementById('proto-viewing-info').innerHTML = `
    <dt>Dátum</dt><dd>${ds}</dd>
    <dt>Záujemca</dt><dd>${esc(v.personName)}</dd>
    <dt>Spôsob</dt><dd>${t}</dd>
    <dt>Výsledok</dt><dd>${r}</dd>
    ${v.feedback ? `<dt>Spätná väzba</dt><dd style="grid-column:1/-1;font-weight:400;color:var(--text-light);font-style:italic;">${esc(v.feedback)}</dd>` : ''}
  `;
  detail.style.display = 'block';

  // Pre-fill client name
  document.getElementById('proto-client-name').value = v.personName || '';
  if (typeof updateProtocolPreview === 'function') updateProtocolPreview();
}

// ===== PROTOCOL PDF =====
function generateProtocolPDF() {
  const propId = document.getElementById('proto-prop-id').value;
  const p = getProperties().find(x => x.id === propId);
  if (!p) return;

  const viewIdx = document.getElementById('proto-viewing-select').value;
  if (viewIdx === '') { secAlert('Vyberte prehliadku.'); return; }
  const v = (p.viewings || [])[parseInt(viewIdx)];
  if (!v) return;

  const brokerName = document.getElementById('proto-broker-name').value.trim();
  const clientName = document.getElementById('proto-client-name').value.trim();
  const notes = document.getElementById('proto-notes').value.trim();

  if (!brokerName) { secAlert('Vyplňte meno makléra.'); return; }
  if (!clientName) { secAlert('Vyplňte meno záujemcu.'); return; }

  const brokerPad = sigPads['sig-broker'];
  const clientPad = sigPads['sig-client'];
  if (!brokerPad || brokerPad.isEmpty()) { secAlert('Chýba podpis makléra.'); return; }
  if (!clientPad || clientPad.isEmpty()) { secAlert('Chýba podpis záujemcu.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();
  const margin = 16;
  const cw = w - margin * 2;

  // Header bar
  doc.setFillColor(11, 42, 60);
  doc.rect(0, 0, w, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(sk('Protokol o prehliadke'), margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sk('nehnuteľnosti'), margin, 26);
  doc.setFontSize(9);
  doc.text('SecPro | ' + new Date().toLocaleDateString('sk-SK'), w - margin, 26, { align: 'right' });

  // Accent line
  doc.setFillColor(46, 196, 212);
  doc.rect(0, 38, w, 1.5, 'F');

  let y = 48;
  doc.setTextColor(0, 0, 0);

  // Section: Property
  doc.setFillColor(240, 249, 247);
  doc.roundedRect(margin, y - 4, cw, 38, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 42, 60);
  doc.text(sk('Informácie o nehnuteľnosti'), margin + 4, y + 2);
  y += 9;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const propInfo = [
    [sk('Názov:'), sk(p.title || '-')],
    [sk('Adresa:'), sk([p.address, p.city, p.district].filter(Boolean).join(', ') || '-')],
    ['Cena:', p.price ? p.price.toLocaleString('sk-SK') + ' EUR' : '-'],
    [sk('Vlastník:'), sk(p.owner || '-')],
  ];
  propInfo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), margin + 30, y);
    y += 5.5;
  });

  y += 6;

  // Section: Viewing
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, y - 4, cw, 28, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 42, 60);
  doc.text(sk('Údaje o prehliadke'), margin + 4, y + 2);
  y += 9;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const d = v.date ? new Date(v.date) : null;
  const ds = d ? d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'}) : '-';
  const viewInfo = [
    [sk('Dátum:'), sk(ds)],
    [sk('Záujemca:'), sk(v.personName || '-')],
    [sk('Spôsob:'), sk(VIEWING_TYPE_MAP[v.type] || v.type)],
  ];
  viewInfo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(val), margin + 30, y);
    y += 5.5;
  });

  y += 6;

  // Section: Notes
  if (notes) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 42, 60);
    doc.text(sk('Poznámky'), margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(sk(notes), cw - 4);
    doc.text(lines, margin + 2, y);
    y += lines.length * 4.5 + 4;
  }

  // Section: Feedback from viewing
  if (v.feedback) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 42, 60);
    doc.text(sk('Spätná väzba z prehliadky'), margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const fbLines = doc.splitTextToSize(sk(v.feedback), cw - 4);
    doc.text(fbLines, margin + 2, y);
    y += fbLines.length * 4.5 + 4;
  }

  // Divider line
  y += 4;
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 10;

  // Signatures section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 42, 60);
  doc.text(sk('Podpisy'), margin, y);
  y += 8;

  const sigW = (cw - 12) / 2;
  const sigH = 28;

  // Broker sig
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text(sk('MAKLÉR'), margin, y);
  y += 3;
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, sigW, sigH, 2, 2);

  const brokerImg = brokerPad.toDataURL();
  doc.addImage(brokerImg, 'PNG', margin + 1, y + 1, sigW - 2, sigH - 2);

  // Client sig
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(sk('ZÁUJEMCA'), margin + sigW + 12, y - 3);
  doc.roundedRect(margin + sigW + 12, y, sigW, sigH, 2, 2);

  const clientImg = clientPad.toDataURL();
  doc.addImage(clientImg, 'PNG', margin + sigW + 13, y + 1, sigW - 2, sigH - 2);

  y += sigH + 4;

  // Names under signatures
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(sk(brokerName), margin + sigW / 2, y, { align: 'center' });
  doc.text(sk(clientName), margin + sigW + 12 + sigW / 2, y, { align: 'center' });
  y += 3;

  // Underlines
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y, margin + sigW - 4, y);
  doc.line(margin + sigW + 16, y, w - margin - 4, y);

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(245, 247, 250);
  doc.rect(0, pageH - 14, w, 14, 'F');
  doc.setFontSize(7);
  doc.setTextColor(160, 170, 180);
  doc.text(sk('Dokument vygenerovaný aplikáciou SecPro') + ' | ' + new Date().toLocaleString('sk-SK'), w / 2, pageH - 6, { align: 'center' });

  doc.save('protokol_prehliadka_' + (p.title || 'nehnutelnost').replace(/\s+/g, '_').slice(0, 25) + '.pdf');
  closeProtocolModal();
}

function generateViewingDocument(propId) {
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;
  const viewings = p.viewings || [];
  const interested = p.interested || [];
  if (viewings.length === 0) { secAlert('Táto nehnuteľnosť nemá žiadne prehliadky.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(11, 42, 60);
  doc.rect(0, 0, w, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(sk('Zápisnica o prehliadkach'), 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sk(p.title || 'Nehnuteľnosť'), 14, 27);
  doc.text(sk('Vygenerované: ') + new Date().toLocaleDateString('sk-SK'), w - 14, 27, { align: 'right' });

  let y = 45;
  doc.setTextColor(0, 0, 0);

  // Property info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(sk('Informácie o nehnuteľnosti'), 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const info = [
    ['Adresa:', sk([p.address, p.city, p.district].filter(Boolean).join(', '))],
    ['Cena:', p.price ? p.price.toLocaleString('sk-SK') + ' EUR' : '-'],
    [sk('Vlastník:'), sk(p.owner || '-')],
    [sk('Telefón:'), sk(p.phone || '-')],
  ];
  info.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 45, y);
    y += 5;
  });

  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(sk('Zoznam prehliadok (') + viewings.length + ')', 14, y);

  y += 4;

  // Viewings table
  const tableHead = [[sk('Dátum'), sk('Záujemca'), sk('Spôsob'), sk('Výsledok'), sk('Spätná väzba')]];
  const tableBody = viewings.map(v => {
    const d = v.date ? new Date(v.date) : null;
    const ds = d ? d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'}) : '';
    const r = sk((VIEWING_RESULT_MAP[v.result] || {}).label || v.result);
    const t = sk(VIEWING_TYPE_MAP[v.type] || v.type);
    return [ds, sk(v.personName || '-'), t, r, sk(v.feedback || '-')];
  });
  doc.autoTable({
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [11, 42, 60], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
    columnStyles: { 4: { cellWidth: 55 } }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Interested parties
  if (interested.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(sk('Záujemcovia (') + interested.length + ')', 14, y);
    y += 4;
    const intHead = [['Meno', sk('Telefón'), 'E-mail', sk('Záujem'), sk('Poznámka')]];
    const intBody = interested.map(p => [
      sk(p.name), sk(p.phone || '-'), sk(p.email || '-'),
      '*'.repeat(p.rating || 0),
      sk(p.note || '-')
    ]);
    doc.autoTable({
      startY: y,
      head: intHead,
      body: intBody,
      theme: 'grid',
      headStyles: { fillColor: [26, 122, 138], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });
  }

  doc.save('prehliadky_' + (p.title || 'nehnutelnost').replace(/\s+/g, '_').slice(0, 30) + '.pdf');
}

async function saveProperty() {
  const title = document.getElementById('prop-title').value.trim();
  const city = document.getElementById('prop-city').value.trim();
  const phone = document.getElementById('prop-phone').value.trim();
  const priceVal = document.getElementById('prop-price').value;

  if (!title) { secAlert('Vyplňte názov nehnuteľnosti'); return; }
  if (!city) { secAlert('Vyplňte mesto / obec'); return; }
  if (!phone) { secAlert('Vyplňte telefónne číslo'); return; }
  if (!priceVal) { secAlert('Vyplňte cenu'); return; }

  // Collect photos + categories from preview (data URLs)
  const photoCards = Array.from(document.querySelectorAll('#prop-photo-preview .pm-card')).slice(0, 10);
  const photos = photoCards.map(c => c.querySelector('img')?.src).filter(Boolean);
  const photoCategories = photoCards.map(c => c.dataset.category || '');

  const prop = {
    id: document.getElementById('prop-edit-id').value || Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    title: title,
    type: document.getElementById('prop-type').value,
    status: document.getElementById('prop-status').value,
    address: document.getElementById('prop-address').value.trim(),
    city: city,
    district: document.getElementById('prop-district').value.trim(),
    price: parseFloat(priceVal) || 0,
    size: parseFloat(document.getElementById('prop-size').value) || null,
    rooms: parseInt(document.getElementById('prop-rooms').value) || null,
    floor: document.getElementById('prop-floor').value.trim(),
    year: parseInt(document.getElementById('prop-year').value) || null,
    condition: document.getElementById('prop-condition').value,
    owner: document.getElementById('prop-owner').value.trim(),
    phone: phone,
    email: document.getElementById('prop-email').value.trim(),
    url: document.getElementById('prop-url').value.trim(),
    description: document.getElementById('prop-description').value.trim(),
    notes: document.getElementById('prop-notes').value.trim(),
    photos: photos,
    photoCategories: photoCategories,
    interested: tempInterested,
    viewings: tempViewings,
    updatedAt: new Date().toISOString(),
  };

  const props = getProperties();
  const existingIdx = props.findIndex(x => x.id === prop.id);
  if (existingIdx >= 0) {
    prop.createdAt = props[existingIdx].createdAt;
    // Preserve geo if address didn't change — otherwise drop so the map view
    // re-geocodes on next visit.
    const prev = props[existingIdx];
    const addressUnchanged = (prev.address === prop.address && prev.city === prop.city);
    if (addressUnchanged && prev.geo) prop.geo = prev.geo;
    // Preserve other meta we don't touch from the form
    if (prev.nabor) prop.nabor = prev.nabor;
    if (prev.deals) prop.deals = prev.deals;
    if (prev.statusHistory) prop.statusHistory = prev.statusHistory;
    if (prev.leonisPublished) prop.leonisPublished = prev.leonisPublished;
    if (prev.leonisPublishedAt) prop.leonisPublishedAt = prev.leonisPublishedAt;
    props[existingIdx] = prop;
  } else {
    prop.createdAt = new Date().toISOString();
    props.unshift(prop);
  }
  // Keep original photos for LEONIS sync (localStorage save may strip them)
  const photosForSync = [...photos];

  try {
    saveProperties(props);
  } catch (e) {
    if (e.name === 'QuotaExceededError' && prop.photos.length > 0) {
      if (await secConfirm({ message: 'Fotografie sú príliš veľké pre úložisko prehliadača.\n\nUložiť nehnuteľnosť bez fotiek?', type: 'warning', ok: 'Uložiť bez fotiek' })) {
        prop.photos = [];
        if (existingIdx >= 0) props[existingIdx] = prop;
        else props[0] = prop;
        saveProperties(props);
      } else {
        return;
      }
    } else {
      throw e;
    }
  }
  // Clear wizard draft on successful save
  _propDraftClear();
  _closePropertyFormNow();
  renderProperties();
  // If already published on LEONES, re-sync updated data (without replacing photos)
  if (prop.leonisPublished) {
    const { photos: _, ...withoutPhotos } = prop;
    syncToLeonis(withoutPhotos);
  }
}

async function deleteProperty(id) {
  if (!await secConfirm({ message: 'Naozaj chcete odstrániť túto nehnuteľnosť?', type: 'danger', ok: 'Odstrániť' })) return;
  const props = getProperties().filter(x => x.id !== id);
  saveProperties(props);
  renderProperties();
}

async function changePropertyStatus(id, newStatus) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;

  // AML gate: warn when advancing to rezervacia or later without approved AML
  const amlGateStages = ['rezervacia', 'predana', 'uzavrety'];
  if (amlGateStages.includes(newStatus) && p.ownerName) {
    const contacts = getContacts();
    const amlRecs = typeof getAmlRecords === 'function' ? getAmlRecords() : [];
    const ownerContact = contacts.find(c => c.name && c.name.toLowerCase() === p.ownerName.toLowerCase());
    const amlApproved = ownerContact && amlRecs.some(a => a.contactId === ownerContact.id && a.status === 'approved');
    if (!amlApproved) {
      if (!await secConfirm({ title: 'AML upozornenie', message: 'AML preverenie klienta "' + p.ownerName + '" nie je schválené.\n\nPodľa zákona 297/2008 Z.z. je potrebné preveriť klienta pred uzavretím obchodu.\n\nChcete napriek tomu pokračovať?', type: 'warning', ok: 'Pokračovať' })) return;
    }
  }

  // Log status change history
  if (!p.statusHistory) p.statusHistory = [];
  p.statusHistory.push({ from: p.status, to: newStatus, at: new Date().toISOString() });
  p.status = newStatus;
  p.updatedAt = new Date().toISOString();
  saveProperties(props);
  renderProperties();
  // Auto-unpublish from LEONES when property is sold or withdrawn
  if (INACTIVE_STATUSES.includes(newStatus) && p.leonisPublished) {
    p.leonisPublished = false;
    saveProperties(props);
    renderProperties();
    removeFromLeonis(p.id);
  }
}

// ─── Property card 3-dot context menu ──────────────────────────────
// Opens a small floating menu anchored to the ⋮ button in the property
// card footer. Holds the destructive actions (Stiahnuť, Zmazať) so the
// card stays clean and accidental clicks are unlikely.
function openCardMenu(btn, propId) {
  closeCardMenu();
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  const isTerminal = (typeof INACTIVE_STATUSES !== 'undefined') && INACTIVE_STATUSES.includes(p.status);
  const isCompleted = p.status === 'predana';

  const items = [];
  // Edit — primary, always visible at the top
  items.push({
    cls: 'card-menu-item card-menu-primary',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    label: 'Upraviť údaje',
    onClick: `closeCardMenu();openPropertyForm('${propId}');`,
  });
  items.push({ divider: true });
  if (!isTerminal && !isCompleted) {
    items.push({
      cls: 'card-menu-item card-menu-warn',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
      label: 'Stiahnuť z ponuky',
      onClick: `closeCardMenu();confirmWithdrawProperty('${propId}');`,
    });
  }
  if (isTerminal) {
    items.push({
      cls: 'card-menu-item',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/></svg>',
      label: 'Obnoviť do aktívnej ponuky',
      onClick: `closeCardMenu();advanceProperty('${propId}', 'novy');`,
    });
  }
  items.push({
    cls: 'card-menu-item card-menu-danger',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    label: 'Zmazať natrvalo',
    onClick: `closeCardMenu();deleteProperty('${propId}');`,
  });

  const menu = document.createElement('div');
  menu.id = '_card-menu-active';
  menu.className = 'card-action-menu';
  menu.innerHTML = items.map(it => {
    if (it.divider) return '<div class="card-menu-divider"></div>';
    return `<button class="${it.cls}" onclick="event.stopPropagation();${it.onClick}">${it.icon}<span>${it.label}</span></button>`;
  }).join('');
  document.body.appendChild(menu);

  // Position the menu — prefer below the button, but flip up if no room
  const rect = btn.getBoundingClientRect();
  const menuW = 230;
  const menuH = 48 * items.filter(i => !i.divider).length + 10;
  let left = rect.right - menuW + window.scrollX;
  if (left < 8) left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  let top = rect.bottom + 6 + window.scrollY;
  if (rect.bottom + 6 + menuH > window.innerHeight) {
    top = rect.top - menuH - 6 + window.scrollY;
  }
  menu.style.position = 'absolute';
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  menu.style.width = menuW + 'px';

  setTimeout(() => {
    document.addEventListener('click', _onCardMenuOutsideClick, { capture: true });
    document.addEventListener('keydown', _onCardMenuKey);
  }, 0);
}

function _onCardMenuOutsideClick(e) {
  const menu = document.getElementById('_card-menu-active');
  if (!menu) return;
  if (!menu.contains(e.target)) closeCardMenu();
}
function _onCardMenuKey(e) {
  if (e.key === 'Escape') closeCardMenu();
}
function closeCardMenu() {
  const menu = document.getElementById('_card-menu-active');
  if (menu) menu.remove();
  document.removeEventListener('click', _onCardMenuOutsideClick, { capture: true });
  document.removeEventListener('keydown', _onCardMenuKey);
}

// Wraps advanceProperty(id, 'stiahnuta') in a clear confirmation prompt so
// the agent doesn't accidentally withdraw a live listing with one click.
async function confirmWithdrawProperty(id) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;
  const titleStr = p.title || 'túto nehnuteľnosť';
  const ok = await secConfirm({
    title: 'Stiahnuť nehnuteľnosť z ponuky?',
    message:
      'Chcete stiahnuť "' + titleStr + '" z aktívnej ponuky?\n\n' +
      '• Status sa zmení na "Stiahnutá"\n' +
      '• Ak je nehnuteľnosť publikovaná na LEONES, automaticky sa odpublikuje\n' +
      '• Záujemcovia ju už neuvidia\n\n' +
      'Neskôr ju môžete obnoviť tlačidlom "Obnoviť" na karte.',
    type: 'warning',
    ok: 'Áno, stiahnuť',
    cancel: 'Zrušiť',
  });
  if (!ok) return;
  advanceProperty(id, 'stiahnuta');
}

function advanceProperty(id, forceTo) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;

  let newStatus;
  if (forceTo) {
    newStatus = forceTo;
  } else {
    const currentIdx = getPipelineIndex(p.status);
    if (currentIdx >= PROP_PIPELINE.length - 1) return;
    newStatus = PROP_PIPELINE[currentIdx + 1].key;
  }

  changePropertyStatus(id, newStatus);
}

function filterProperties() {
  renderProperties();
  // Re-plot map markers if map is the active view
  if (_propView === 'map' && _propertiesMap) {
    plotPropertyMarkers();
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROPERTY MAP VIEW — Leaflet + Nominatim geocoding
// ═══════════════════════════════════════════════════════════════

let _propView = 'grid';            // 'grid' | 'map'
let _propertiesMap = null;          // Leaflet instance
let _propMapMarkers = [];           // active markers
let _propMapCluster = null;         // L.markerClusterGroup
let _propMapLegend = null;          // L.control instance
let _propMapTileLayers = null;      // { light, dark, satellite }
let _propMapActiveStyle = 'light';
let _propMapStyleControl = null;
let _propMapSearchControl = null;
let _propMapSearchMarker = null;
let _propMapPOIControl = null;
let _propMapPOIActive = {};         // { mhd: true, schools: false, ... }
let _propMapPOILayer = null;        // L.layerGroup holding visible POI markers
let _propMapPOICache = {};          // { 'mhd:bbox-key': [poi, poi, ...] }
let _propMapPOIDebounce = null;
let _geocodeInProgress = false;

// POI categories — Overpass tag queries per category, with brand colour + emoji
const POI_CATEGORIES = {
  mhd: {
    label: 'MHD',
    icon: '🚇',
    color: '#2563EB',
    overpass: ['node["highway"="bus_stop"]', 'node["railway"="tram_stop"]', 'node["public_transport"="stop_position"]', 'node["amenity"="bus_station"]'],
  },
  schools: {
    label: 'Školy',
    icon: '🏫',
    color: '#D97706',
    overpass: ['node["amenity"="school"]', 'way["amenity"="school"]', 'node["amenity"="kindergarten"]', 'way["amenity"="kindergarten"]', 'node["amenity"="university"]', 'way["amenity"="university"]'],
  },
  shops: {
    label: 'Obchody',
    icon: '🛒',
    color: '#7C3AED',
    overpass: ['node["shop"="supermarket"]', 'way["shop"="supermarket"]', 'node["shop"="convenience"]', 'node["shop"="mall"]', 'way["shop"="mall"]'],
  },
  health: {
    label: 'Zdravie',
    icon: '🏥',
    color: '#DC2626',
    overpass: ['node["amenity"="hospital"]', 'way["amenity"="hospital"]', 'node["amenity"="clinic"]', 'node["amenity"="doctors"]', 'node["amenity"="pharmacy"]'],
  },
  parks: {
    label: 'Parky',
    icon: '🌳',
    color: '#16A34A',
    overpass: ['way["leisure"="park"]', 'node["leisure"="playground"]', 'way["leisure"="playground"]'],
  },
};

// Toggle a POI category. When turning on, fetch + plot for current bounds;
// when off, clear that category's markers.
function togglePOICategory(key) {
  if (!POI_CATEGORIES[key]) return;
  _propMapPOIActive[key] = !_propMapPOIActive[key];
  // Update button visual state
  document.querySelectorAll('.map-poi-pill').forEach(b => {
    b.classList.toggle('active', !!_propMapPOIActive[b.dataset.poi]);
  });
  // Run refresh immediately on click (skip debounce for immediate user feedback)
  if (_propMapPOIDebounce) clearTimeout(_propMapPOIDebounce);
  _doRefreshPOILayer();
}

// Refresh which POIs are shown — handles both adding new categories and
// removing toggled-off ones. Throttles by debouncing 350ms.
function refreshPOILayer() {
  if (_propMapPOIDebounce) clearTimeout(_propMapPOIDebounce);
  _propMapPOIDebounce = setTimeout(_doRefreshPOILayer, 350);
}

async function _doRefreshPOILayer() {
  if (!_propertiesMap || !_propMapPOILayer) return;
  _propMapPOILayer.clearLayers();

  const activeCats = Object.keys(_propMapPOIActive).filter(k => _propMapPOIActive[k]);
  if (activeCats.length === 0) {
    _hidePOIBusy();
    return;
  }

  // Don't query at low zoom — would return thousands of POIs and freeze
  // the browser. If the user is at country/regional zoom, auto-zoom to a
  // city level so the feature does something useful immediately.
  const zoom = _propertiesMap.getZoom();
  if (zoom < 11) {
    showToast('Priblížil som mapu — POI sa zobrazujú od mestského zoomu.', 'info');
    _propertiesMap.setZoom(13, { animate: true });
    // moveend will trigger another refresh once the zoom settles
    return;
  }

  // Make sure the map has actually computed its size before reading bounds —
  // bounds collapse to a point if the container hasn't been measured.
  if (_propertiesMap.getSize().x === 0) {
    _propertiesMap.invalidateSize(true);
  }

  const b = _propertiesMap.getBounds();
  const sizePx = _propertiesMap.getSize();
  if (sizePx.x === 0 || sizePx.y === 0 || b.getNorth() === b.getSouth()) {
    _showPOIBusy('Mapa sa ešte načítava... skúste znova o chvíľu');
    return;
  }
  // Round bbox so cache hits across small pans
  const roundedKey = (b.getSouth().toFixed(2) + ',' + b.getWest().toFixed(2) + ',' + b.getNorth().toFixed(2) + ',' + b.getEast().toFixed(2));

  for (const cat of activeCats) {
    const cacheKey = cat + ':' + roundedKey;
    let pois = _propMapPOICache[cacheKey];
    if (!pois) {
      _showPOIBusy('Načítavam ' + POI_CATEGORIES[cat].label + ' v okolí...');
      pois = await _fetchPOIsForCategory(cat, b);
      _propMapPOICache[cacheKey] = pois || [];
    }
    if (pois && pois.length) {
      _plotPOIs(cat, pois);
    } else {
      // No results in this area for this category
      console.log('[SecPro POI] No', cat, 'in current view');
    }
  }
  _hidePOIBusy();
}

async function _fetchPOIsForCategory(cat, bounds) {
  const def = POI_CATEGORIES[cat];
  if (!def) return [];
  const south = bounds.getSouth().toFixed(5);
  const west = bounds.getWest().toFixed(5);
  const north = bounds.getNorth().toFixed(5);
  const east = bounds.getEast().toFixed(5);
  const queries = def.overpass.map(sel => sel + '(' + south + ',' + west + ',' + north + ',' + east + ');').join('');
  const ql = '[out:json][timeout:25];(' + queries + ');out center 200;';
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(ql),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!r.ok) {
      console.warn('[SecPro POI] Overpass returned', r.status, 'for', cat);
      showToast('Načítanie POI zlyhalo — skúste o chvíľu znova', 'warning');
      return [];
    }
    const data = await r.json();
    const out = [];
    for (const el of (data.elements || [])) {
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      out.push({
        lat, lng,
        name: (el.tags && (el.tags.name || el.tags['name:sk'])) || POI_CATEGORIES[cat].label,
        kind: (el.tags && (el.tags.amenity || el.tags.shop || el.tags.leisure || el.tags.highway || el.tags.railway)) || cat,
      });
    }
    return out;
  } catch (e) {
    console.warn('[SecPro] POI fetch failed for', cat, e);
    return [];
  }
}

function _plotPOIs(cat, pois) {
  const def = POI_CATEGORIES[cat];
  pois.forEach(poi => {
    const m = L.marker([poi.lat, poi.lng], {
      icon: L.divIcon({
        className: 'poi-pin',
        html: '<div class="poi-pin-bubble" style="background:' + def.color + ';">' + def.icon + '</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11],
      }),
      keyboard: false,
    });
    m.bindPopup('<div class="poi-popup"><span class="poi-popup-icon" style="background:' + def.color + ';">' + def.icon + '</span><div><div class="poi-popup-name">' + esc(poi.name) + '</div><div class="poi-popup-cat">' + esc(def.label) + '</div></div></div>', { maxWidth: 220 });
    _propMapPOILayer.addLayer(m);
  });
}

function _showPOIBusy(text) {
  let el = document.getElementById('poi-busy');
  if (!el) {
    el = document.createElement('div');
    el.id = 'poi-busy';
    el.className = 'poi-busy';
    document.getElementById('prop-map-wrap').appendChild(el);
  }
  el.textContent = text;
  el.style.display = '';
}
function _hidePOIBusy() {
  const el = document.getElementById('poi-busy');
  if (el) el.style.display = 'none';
}

// Switch the basemap tile style — light / dark / satellite. The other layers
// stay loaded (Leaflet caches tiles) so subsequent switches are instant.
function setMapStyle(style) {
  if (!_propertiesMap || !_propMapTileLayers) return;
  if (!_propMapTileLayers[style] || style === _propMapActiveStyle) return;
  _propertiesMap.removeLayer(_propMapTileLayers[_propMapActiveStyle]);
  _propMapTileLayers[style].addTo(_propertiesMap);
  _propMapActiveStyle = style;
  // Toggle button active state
  document.querySelectorAll('.map-style-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.style === style);
  });
  // Toggle a body-ish class for popup theming on dark/satellite
  const wrap = document.getElementById('prop-map');
  if (wrap) {
    wrap.classList.remove('map-style-light', 'map-style-dark', 'map-style-satellite');
    wrap.classList.add('map-style-' + style);
  }
}

// Address search — geocode via Nominatim, fly to result, drop a temporary
// marker so the user can see where the search landed.
async function _doMapSearch(query) {
  query = (query || '').trim();
  if (!query || !_propertiesMap) return;
  // Default to Slovakia bias if no country in the query
  const q = /slovensk|slovakia/i.test(query) ? query : query + ', Slovensko';
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1';
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'sk' } });
    if (!r.ok) { showToast('Adresu sa nepodarilo nájsť', 'warning'); return; }
    const data = await r.json();
    if (!data || !data.length) { showToast('Adresu sa nepodarilo nájsť', 'warning'); return; }
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!isFinite(lat) || !isFinite(lng)) { showToast('Adresu sa nepodarilo nájsť', 'warning'); return; }
    // Make sure Leaflet has the right size before any pan/zoom — flyTo
    // throws "Invalid LatLng (NaN)" if the map container size isn't
    // properly known yet (it does an unproject internally).
    _propertiesMap.invalidateSize();
    _propertiesMap.setView([lat, lng], 14, { animate: true });
    // Drop a temporary marker (gold pin) to mark the search target.
    // Use explicit iconSize — Leaflet's flyTo throws "Invalid LatLng (NaN, NaN)"
    // when the marker bounds can't be computed before the element renders.
    if (_propMapSearchMarker) _propMapSearchMarker.remove();
    _propMapSearchMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'search-pin',
        html: '<div class="search-pin-bubble">📍</div><div class="search-pin-tail"></div>',
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
      }),
      zIndexOffset: 1000,
    }).addTo(_propertiesMap);
    _propMapSearchMarker.bindPopup('<b>' + esc(data[0].display_name || query) + '</b>').openPopup();
  } catch (e) {
    console.error('[SecPro] map search error:', e);
    showToast('Chyba pri vyhľadávaní adresy', 'error');
  }
}

function setPropertyView(view) {
  _propView = view;
  // Toggle buttons
  document.querySelectorAll('#prop-view-toggle .vt-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  // Show / hide containers
  const grid = document.getElementById('prop-grid');
  const mapWrap = document.getElementById('prop-map-wrap');
  const empty = document.getElementById('prop-empty');
  if (view === 'map') {
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (mapWrap) mapWrap.style.display = '';
    initPropertiesMap();
  } else {
    if (grid) grid.style.display = '';
    if (mapWrap) mapWrap.style.display = 'none';
    renderProperties();
  }
}

// Initialize the Leaflet map once, lazy
function initPropertiesMap() {
  const container = document.getElementById('prop-map');
  if (!container || typeof L === 'undefined') return;

  if (!_propertiesMap) {
    // Default: centered on Slovakia
    _propertiesMap = L.map(container, {
      center: [48.66, 19.7],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Build the three tile layers up front so switching is instant
    _propMapTileLayers = {
      light: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }),
    };
    _propMapTileLayers.light.addTo(_propertiesMap);
    _propMapActiveStyle = 'light';

    // Tile-style switcher (top-right control)
    _propMapStyleControl = L.control({ position: 'topright' });
    _propMapStyleControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'map-style-switcher');
      div.innerHTML =
        '<button class="map-style-btn active" data-style="light" title="Svetlá mapa">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
        '</button>' +
        '<button class="map-style-btn" data-style="dark" title="Tmavá mapa">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
        '</button>' +
        '<button class="map-style-btn" data-style="satellite" title="Satelitná mapa">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.5 19.5l-3.4-3.4"/><path d="M14.5 9.5l4-4"/><path d="M9.5 14.5l-4 4"/></svg>' +
        '</button>';
      L.DomEvent.disableClickPropagation(div);
      div.querySelectorAll('.map-style-btn').forEach(btn => {
        btn.addEventListener('click', () => setMapStyle(btn.dataset.style));
      });
      return div;
    };
    _propMapStyleControl.addTo(_propertiesMap);

    // POI overlay layer + control (top-right, below style switcher)
    _propMapPOILayer = L.layerGroup().addTo(_propertiesMap);
    _propMapPOIControl = L.control({ position: 'topright' });
    _propMapPOIControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'map-poi-control');
      const pills = Object.keys(POI_CATEGORIES).map(key => {
        const cat = POI_CATEGORIES[key];
        return '<button class="map-poi-pill" data-poi="' + key + '" title="' + cat.label + '" style="--poi-color:' + cat.color + ';">' +
          '<span class="poi-pill-icon">' + cat.icon + '</span>' +
          '<span class="poi-pill-label">' + cat.label + '</span>' +
        '</button>';
      }).join('');
      div.innerHTML = '<div class="map-poi-title">POI v okolí</div>' + pills;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      div.querySelectorAll('.map-poi-pill').forEach(btn => {
        btn.addEventListener('click', () => togglePOICategory(btn.dataset.poi));
      });
      return div;
    };
    _propMapPOIControl.addTo(_propertiesMap);

    // Re-fetch POIs when the user pans / zooms — only if any category is active
    _propertiesMap.on('moveend', () => {
      const anyActive = Object.values(_propMapPOIActive).some(Boolean);
      if (anyActive) refreshPOILayer();
    });

    // Wire the toolbar search input (lives above the map as a regular form,
    // not a Leaflet control — looks cleaner than stacked under zoom buttons).
    const searchInput = document.getElementById('map-search-input');
    const searchClear = document.getElementById('map-search-clear');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _doMapSearch(searchInput.value); }
        if (e.key === 'Escape') { searchInput.value = ''; searchInput.blur(); }
      });
    }
    if (searchClear && !searchClear.dataset.bound) {
      searchClear.dataset.bound = '1';
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (_propMapSearchMarker) {
          _propMapSearchMarker.remove();
          _propMapSearchMarker = null;
        }
      });
    }

    // Marker clustering — handles 50+ properties in the same area gracefully
    if (typeof L.markerClusterGroup === 'function') {
      _propMapCluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 14,
        maxClusterRadius: 60,
        iconCreateFunction: function(cluster) {
          const n = cluster.getChildCount();
          let cls = 'sm';
          if (n >= 50) cls = 'lg';
          else if (n >= 10) cls = 'md';
          return L.divIcon({
            html: '<div class="map-cluster-bubble map-cluster-' + cls + '"><span>' + n + '</span></div>',
            className: '',
            iconSize: [42, 42],
          });
        },
      });
      _propertiesMap.addLayer(_propMapCluster);
    }

    // Status legend in bottom-left corner
    _propMapLegend = L.control({ position: 'bottomleft' });
    _propMapLegend.onAdd = function() {
      const div = L.DomUtil.create('div', 'map-legend');
      const statuses = ['novy', 'kontakt', 'stretnutie', 'nafotenie', 'inzercia', 'obhliadky', 'rezervacia', 'predana', 'stiahnuta'];
      div.innerHTML = '<div class="map-legend-title">Status nehnuteľnosti</div>' +
        statuses.map(s => {
          const m = PROP_STATUS_MAP[s];
          if (!m) return '';
          return '<div class="map-legend-row"><span class="map-legend-dot" style="background:' + m.color + ';"></span><span class="map-legend-label">' + m.label + '</span></div>';
        }).join('');
      // Don't let map drag through the legend
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };
    _propMapLegend.addTo(_propertiesMap);
  } else {
    // Force a redraw — Leaflet needs this when its container becomes visible
    setTimeout(() => _propertiesMap.invalidateSize(), 50);
  }

  // Kick off geocoding for properties without coords, then plot
  geocodeMissingProperties().finally(plotPropertyMarkers);
}

// ── Nominatim geocoding ──
// Free, no API key, but rate-limited to ~1 req/sec.
async function geocodeAddress(address, city, country) {
  if (!address && !city) return null;
  const q = [address, city, country || 'Slovensko'].filter(Boolean).join(', ');
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1&addressdetails=0';
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'sk' } });
    if (!r.ok) return null;
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      formattedAddress: data[0].display_name || '',
      source: 'nominatim',
      geocodedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[SecPro] Geocoding failed for', q, e);
    return null;
  }
}

// Geocode every property that doesn't have geo yet, throttled to respect
// Nominatim's 1 req/sec rate limit. Updates progress banner as it goes.
async function geocodeMissingProperties() {
  if (_geocodeInProgress) return;
  _geocodeInProgress = true;

  const props = getProperties();
  const missing = props.filter(p => !p.geo && (p.address || p.city));
  const progressEl = document.getElementById('prop-map-progress');
  const progressText = document.getElementById('prop-map-progress-text');

  if (missing.length === 0) {
    if (progressEl) progressEl.style.display = 'none';
    _geocodeInProgress = false;
    return;
  }

  if (progressEl) progressEl.style.display = '';

  for (let i = 0; i < missing.length; i++) {
    const p = missing[i];
    if (progressText) {
      progressText.textContent = 'Lokalizujem nehnuteľnosti... ' + (i + 1) + ' / ' + missing.length;
    }
    const geo = await geocodeAddress(p.address, p.city);
    if (geo) {
      // Re-load + write — another tab may have changed properties meanwhile
      const fresh = getProperties();
      const idx = fresh.findIndex(x => x.id === p.id);
      if (idx !== -1) {
        fresh[idx].geo = geo;
        saveProperties(fresh);
      }
      // Re-plot incrementally so the user sees progress
      plotPropertyMarkers();
    }
    // Throttle to 1.1s between requests (Nominatim policy)
    if (i < missing.length - 1) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  if (progressEl) progressEl.style.display = 'none';
  _geocodeInProgress = false;
}

// Compact price formatter — "250 000 €" → "250k €", "1 500 000 €" → "1,5M €"
function _formatPriceCompact(price) {
  const n = Number(price);
  if (!isFinite(n) || n <= 0) return '— €';
  if (n >= 1000000) {
    const m = n / 1000000;
    const txt = m >= 10 ? Math.round(m).toString() : m.toFixed(1).replace('.', ',').replace(',0', '');
    return txt + 'M €';
  }
  if (n >= 1000) return Math.round(n / 1000) + 'k €';
  return Math.round(n) + ' €';
}

// Build an Airbnb-style price-label pin — the price itself is the marker so
// the agent can read prices straight off the map without clicking.
function _makePropertyMarkerIcon(p) {
  const meta = (typeof PROP_STATUS_MAP !== 'undefined' && PROP_STATUS_MAP[p.status])
    ? PROP_STATUS_MAP[p.status] : { color: '#64748B', bg: '#F1F5F9' };
  const isInactive = (typeof INACTIVE_STATUSES !== 'undefined') && INACTIVE_STATUSES.includes(p.status);
  const priceTxt = _formatPriceCompact(p.price);

  // Estimated bubble width based on text length (avoids Leaflet NaN-bounds bug)
  const estW = Math.max(54, priceTxt.length * 8 + 20);
  return L.divIcon({
    className: 'price-pin' + (isInactive ? ' price-pin-inactive' : ''),
    html:
      '<div class="price-pin-bubble" style="background:' + meta.color + ';">' +
        priceTxt +
      '</div>' +
      '<div class="price-pin-tail" style="border-top-color:' + meta.color + ';"></div>',
    iconSize: [estW, 38],
    iconAnchor: [0, 38],         // anchor at tip of tail
    popupAnchor: [0, -38],
  });
}

// Build the popup HTML shown when a marker is clicked.
function _makePropertyMarkerPopup(p) {
  const meta = (typeof PROP_STATUS_MAP !== 'undefined' && PROP_STATUS_MAP[p.status]) || {};
  const photo = (p.photos && p.photos[0]) || '';
  const price = p.price ? Number(p.price).toLocaleString('sk-SK') + ' €' : 'Bez ceny';
  const hasGeo = !!(p.geo && p.geo.lat && p.geo.lng);
  // Open the location on Google Maps (not directions) — agent can switch to
  // Street View / directions / panorama from there.
  const gmapsUrl = hasGeo
    ? 'https://www.google.com/maps/search/?api=1&query=' + p.geo.lat + ',' + p.geo.lng
    : null;
  // Google Street View URL — opens the panoramic view at the property's location
  const streetUrl = hasGeo
    ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + p.geo.lat + ',' + p.geo.lng
    : null;

  return '<div class="map-popup">' +
    (photo ? '<div class="map-popup-photo" style="background-image:url(' + photo + ');"></div>' : '') +
    '<div class="map-popup-body">' +
      (meta.label ? '<span class="map-popup-status" style="background:' + (meta.bg || '#f0f0f0') + ';color:' + (meta.color || '#444') + ';">' + meta.label + '</span>' : '') +
      '<div class="map-popup-title">' + esc(p.title || 'Bez názvu') + '</div>' +
      '<div class="map-popup-price">' + price + '</div>' +
      (p.address || p.city ? '<div class="map-popup-loc">' + esc([p.address, p.city].filter(Boolean).join(', ')) + '</div>' : '') +
      '<div class="map-popup-actions">' +
        '<button class="map-popup-btn map-popup-btn-primary" onclick="openPropDetail(\'' + p.id + '\');_propertiesMap && _propertiesMap.closePopup();">Otvoriť detail</button>' +
        (gmapsUrl ? '<a class="map-popup-btn map-popup-btn-secondary" href="' + gmapsUrl + '" target="_blank" rel="noopener" title="Otvoriť v Google Maps">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
          'Google Maps' +
        '</a>' : '') +
      '</div>' +
      (streetUrl ? '<a class="map-popup-streetview" href="' + streetUrl + '" target="_blank" rel="noopener" title="Otvoriť Google Street View">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        'Pozrieť okolie (Street View)' +
      '</a>' : '') +
    '</div>' +
  '</div>';
}

// Plot every property's marker on the map, replacing previous ones.
// Auto-zooms to fit all visible pins. Uses marker clustering when
// available, falls back to plain map.addLayer otherwise.
function plotPropertyMarkers() {
  if (!_propertiesMap) return;

  // Clear previous markers from cluster (or directly from map)
  if (_propMapCluster) {
    _propMapCluster.clearLayers();
  } else {
    _propMapMarkers.forEach(m => m.remove());
  }
  _propMapMarkers = [];

  // Use the same filtering as the grid view (search + type + status)
  const all = getProperties();
  const search = (document.getElementById('prop-filter-search')?.value || '').toLowerCase();
  const typeFilters = (typeof msGetValues === 'function') ? msGetValues('ms-prop-type') : [];
  const statusFilters = (typeof msGetValues === 'function') ? msGetValues('ms-prop-status') : [];

  const filtered = all.filter(p => {
    if (!p.geo) return false;
    if (search) {
      const hay = ((p.title || '') + ' ' + (p.address || '') + ' ' + (p.city || '') + ' ' + (p.district || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (typeFilters.length && !typeFilters.includes(p.type)) return false;
    if (statusFilters.length && !statusFilters.includes(p.status)) return false;
    return true;
  });

  if (filtered.length === 0) return;

  const bounds = L.latLngBounds([]);
  filtered.forEach(p => {
    const m = L.marker([p.geo.lat, p.geo.lng], { icon: _makePropertyMarkerIcon(p) })
      .bindPopup(_makePropertyMarkerPopup(p), { maxWidth: 280 });
    if (_propMapCluster) {
      _propMapCluster.addLayer(m);
    } else {
      m.addTo(_propertiesMap);
    }
    _propMapMarkers.push(m);
    bounds.extend([p.geo.lat, p.geo.lng]);
  });

  // Fit map view to show all markers (with reasonable zoom limits)
  if (filtered.length === 1) {
    _propertiesMap.setView([filtered[0].geo.lat, filtered[0].geo.lng], 14);
  } else {
    _propertiesMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }
}

function renderProperties() {
  const props = getProperties();
  const search = (document.getElementById('prop-filter-search')?.value || '').toLowerCase();
  const typeFilters = msGetValues('ms-prop-type');
  const statusFilters = msGetValues('ms-prop-status');

  let filtered = props.filter(p => {
    if (search && !(p.title + ' ' + p.address + ' ' + p.city + ' ' + p.owner + ' ' + p.district).toLowerCase().includes(search)) return false;
    if (typeFilters.length && !typeFilters.includes(p.type)) return false;
    if (statusFilters.length && !statusFilters.includes(p.status)) return false;
    return true;
  });

  const grid = document.getElementById('prop-grid');
  const empty = document.getElementById('prop-empty');
  const countEl = document.getElementById('prop-count');

  if (countEl) countEl.textContent = `${filtered.length} z ${props.length} nehnuteľností`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = props.length === 0 ? 'block' : 'none';
    if (props.length > 0 && filtered.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      empty.querySelector('p').textContent = 'Žiadne nehnuteľnosti nezodpovedajú filtru.';
      empty.querySelector('button').style.display = 'none';
    }
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = filtered.map(p => {
    const st = PROP_STATUS_MAP[p.status] || PROP_STATUS_MAP['novy'];
    const typeName = PROP_TYPE_MAP[p.type] || p.type;
    const condName = PROP_CONDITION_MAP[p.condition] || '';
    const priceStr = p.price ? p.price.toLocaleString('sk-SK') + ' €' : '—';
    const photo = (p.photos && p.photos.length > 0) ? p.photos[0] : '';
    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('sk-SK') : '';
    const currentPipeIdx = getPipelineIndex(p.status);
    const isTerminal = p.status === 'zamietnuty' || p.status === 'stiahnuta';
    const isCompleted = p.status === 'predana' || p.status === 'uzavrety';
    const canAdvance = !isTerminal && !isCompleted && currentPipeIdx < PROP_PIPELINE.length - 1;
    const nextStage = canAdvance ? PROP_PIPELINE[currentPipeIdx + 1] : null;

    const intCount = (p.interested || []).length;
    const viewCount = (p.viewings || []).length;
    const photoCount = (p.photos || []).length;

    return `<div class="prop-card-v2">
      <!-- Photo / Header -->
      <div class="prop-card-hero ${photo ? 'has-photo' : ''}" onclick="openPropDetail('${p.id}')" style="cursor:pointer;">
        ${photo ? `<img src="${photo}" class="prop-card-hero-img" />` : `<div class="prop-card-hero-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`}
        <div class="prop-card-hero-overlay">
          <span class="prop-card-status" style="--st-color:${st.color};--st-bg:${st.bg};">${st.label}</span>
          ${photoCount > 1 ? `<span class="prop-card-photo-count">${photoCount} foto</span>` : ''}
        </div>
      </div>

      <!-- Body -->
      <div class="prop-card-body">
        <!-- Title & Price row -->
        <div class="prop-card-title-row" onclick="openPropDetail('${p.id}')" style="cursor:pointer;">
          <h4 class="prop-card-title">${p.title}</h4>
          <div class="prop-card-price">${priceStr}</div>
        </div>

        <!-- Location -->
        <div class="prop-card-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${p.city}${p.district ? ', ' + p.district : ''}${p.address ? ' — ' + p.address : ''}
        </div>

        <!-- Tags -->
        <div class="prop-card-tags">
          <span class="prop-tag">${typeName}</span>
          ${p.size ? `<span class="prop-tag">${p.size} m\u00B2</span>` : ''}
          ${p.rooms ? `<span class="prop-tag">${p.rooms} izby</span>` : ''}
          ${condName ? `<span class="prop-tag">${condName}</span>` : ''}
        </div>

        <!-- Deal documents tracker (semafor) -->
        ${getDealsRowHtml(p)}

        <!-- Pipeline compact -->
        <div class="prop-card-pipeline">
          ${PROP_PIPELINE.map((stage, i) => {
            let dotCls = 'pcp-dot';
            if (isTerminal) dotCls += ' cancelled';
            else if (i < currentPipeIdx) dotCls += ' done';
            else if (i === currentPipeIdx) dotCls += ' active';
            return `<div class="${dotCls}" title="${stage.label}"></div>`;
          }).join('<div class="pcp-line"></div>')}
        </div>
        ${canAdvance ? `<button class="prop-card-advance-btn" onclick="advanceProperty('${p.id}')">
          ${nextStage.icon} ${nextStage.label}
        </button>` : ''}
        ${isCompleted ? `<div class="prop-card-completed">Nehnuteľnosť predaná</div>` : ''}
        ${isTerminal ? `<button class="prop-card-advance-btn" style="background:#F1F5F9;color:#64748B;" onclick="advanceProperty('${p.id}', 'novy')">Obnoviť</button>` : ''}

        <!-- Owner -->
        ${p.owner || p.phone ? `<div class="prop-card-owner">
          <div class="prop-card-owner-avatar">${p.owner ? p.owner.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'}</div>
          <div class="prop-card-owner-info">
            ${p.owner ? `<div class="prop-card-owner-name">${p.owner}</div>` : ''}
            <div class="prop-card-owner-contacts">
              ${p.phone ? `<a href="tel:${p.phone}">${p.phone}</a>` : ''}
              ${p.email ? `<a href="mailto:${p.email}">${p.email}</a>` : ''}
            </div>
          </div>
        </div>` : ''}

        <!-- Notes -->
        ${p.notes ? `<div class="prop-card-notes">${p.notes}</div>` : ''}

        <!-- Thumbnails -->
        ${photoCount > 1 ? `<div class="prop-card-thumbs">${p.photos.slice(1, 5).map((ph, i) => `<img src="${ph}" class="prop-thumb" onclick="openLightbox(getProperties().find(x=>x.id==='${p.id}').photos, ${i + 1})" style="cursor:pointer;" />`).join('')}${photoCount > 5 ? `<span class="prop-thumb-more" onclick="openLightbox(getProperties().find(x=>x.id==='${p.id}').photos, 5)" style="cursor:pointer;">+${photoCount - 5}</span>` : ''}</div>` : ''}

        <!-- Badges -->
        <div class="prop-card-badge-row">
          ${intCount ? `<span class="prop-card-badge badge-interested" onclick="openQuickInterestModal('${p.id}')">👥 ${intCount}</span>` : ''}
          ${viewCount ? `<span class="prop-card-badge badge-viewings" onclick="openQuickInterestModal('${p.id}')">📋 ${viewCount}</span>` : ''}
          <span class="prop-card-badge" style="background:#F0F9F7;color:#1A7A8A;border:1px dashed rgba(26,122,138,0.3);" onclick="openQuickInterestModal('${p.id}')">+ Záujemca</span>
        </div>
      </div>

      <!-- LEONES publish -->
      <div style="padding:0 16px 8px;">
        ${p.leonisPublished
          ? `<button onclick="event.stopPropagation();unpublishFromLeonis('${p.id}')" class="pca-leones published" title="Stiahnuť z LEONES">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Na LEONES
            </button>`
          : `<button onclick="event.stopPropagation();publishToLeonis('${p.id}')" class="pca-leones publish" title="Publikovať na LEONES">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Publikovať na LEONES
            </button>`
        }
      </div>

      <!-- Footer actions -->
      <div class="prop-card-footer">
        <span class="prop-card-date">${dateStr}</span>
        <div class="prop-card-actions">
          <!-- Náborový list icon button removed — the new "Dokumentácia obchodu"
               section already has [+] add-menu and a card list, which made this
               redundant. -->

          ${viewCount ? `<button onclick="openProtocolModal('${p.id}')" class="pca-btn" style="color:#1A7A8A;" title="Protokol s podpisom"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>` : ''}
          ${viewCount ? `<button onclick="generateViewingDocument('${p.id}')" class="pca-btn pca-doc" title="Zápisnica PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>` : ''}
          ${p.url ? `<a href="${p.url}" target="_blank" class="pca-btn pca-link" title="Inzerát"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
          <button onclick="event.stopPropagation();openCardMenu(this, '${p.id}');" class="pca-btn pca-more" title="Akcie" aria-label="Akcie"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===== PHOTO LIGHTBOX =====
let lightboxPhotos = [];
let lightboxIdx = 0;

function openLightbox(photos, startIdx) {
  lightboxPhotos = photos;
  lightboxIdx = startIdx || 0;
  renderLightbox();
  document.getElementById('lightbox-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function lightboxNav(dir, e) {
  if (e) e.stopPropagation();
  lightboxIdx = (lightboxIdx + dir + lightboxPhotos.length) % lightboxPhotos.length;
  renderLightbox();
}

function lightboxGoTo(idx, e) {
  if (e) e.stopPropagation();
  lightboxIdx = idx;
  renderLightbox();
}

function renderLightbox() {
  document.getElementById('lightbox-img').src = lightboxPhotos[lightboxIdx];
  document.getElementById('lightbox-counter').textContent = `${lightboxIdx + 1} / ${lightboxPhotos.length}`;
  const strip = document.getElementById('lightbox-thumbstrip');
  strip.innerHTML = lightboxPhotos.map((ph, i) =>
    `<img src="${ph}" class="lightbox-thumb ${i === lightboxIdx ? 'active' : ''}" onclick="lightboxGoTo(${i}, event)" />`
  ).join('');
}

document.addEventListener('keydown', function(e) {
  if (!document.getElementById('lightbox-overlay').classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
});

// ===== PROPERTY DETAIL MODAL =====
let detailPhotoIdx = 0;
let detailPhotos = [];

function openPropDetail(id) {
  const props = getProperties();
  const p = props.find(x => x.id === id);
  if (!p) return;

  detailPhotos = p.photos || [];
  detailPhotoIdx = 0;

  const typeName = PROP_TYPE_MAP[p.type] || p.type;
  const condName = PROP_CONDITION_MAP[p.condition] || '';
  const priceStr = p.price ? p.price.toLocaleString('sk-SK') + ' \u20AC' : '\u2014';
  const st = PROP_STATUS_MAP[p.status] || PROP_STATUS_MAP['novy'];
  const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('sk-SK') : '';
  const initials = p.owner ? p.owner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  const galleryHtml = detailPhotos.length > 0
    ? `<div class="prop-detail-gallery" onclick="openLightbox(detailPhotos, detailPhotoIdx)">
        <img id="detail-gallery-img" src="${detailPhotos[0]}" />
        ${detailPhotos.length > 1 ? `
          <button class="prop-detail-gallery-nav prop-detail-gallery-prev" onclick="detailGalleryNav(-1, event)">&#8249;</button>
          <button class="prop-detail-gallery-nav prop-detail-gallery-next" onclick="detailGalleryNav(1, event)">&#8250;</button>
          <div class="prop-detail-gallery-dots" id="detail-gallery-dots">
            ${detailPhotos.map((_, i) => `<button class="prop-detail-gallery-dot ${i === 0 ? 'active' : ''}" onclick="detailGalleryGo(${i}, event)"></button>`).join('')}
          </div>
          <div class="prop-detail-gallery-counter" id="detail-gallery-counter">1 / ${detailPhotos.length}</div>
        ` : ''}
        <button class="prop-detail-close" onclick="closePropDetail(event)">&times;</button>
      </div>`
    : `<div class="prop-detail-gallery" style="height:80px;">
        <button class="prop-detail-close" onclick="closePropDetail(event)">&times;</button>
      </div>`;

  const fields = [];
  if (typeName) fields.push({ label: 'Typ', value: typeName });
  if (p.size) fields.push({ label: 'V\u00fdmera', value: p.size + ' m\u00B2' });
  if (p.rooms) fields.push({ label: 'Izby', value: p.rooms });
  if (p.floor) fields.push({ label: 'Poschodie', value: p.floor });
  if (p.year) fields.push({ label: 'Rok v\u00fdstavby', value: p.year });
  if (condName) fields.push({ label: 'Stav', value: condName });

  const modal = document.getElementById('prop-detail-modal');
  modal.innerHTML = `
    ${galleryHtml}
    <div class="prop-detail-content">
      <div class="prop-detail-header">
        <div>
          <h2 class="prop-detail-title">${p.title}</h2>
          <span class="prop-card-status" style="--st-color:${st.color};--st-bg:${st.bg};margin-top:6px;display:inline-block;">${st.label}</span>
        </div>
        <div class="prop-detail-price">${priceStr}</div>
      </div>

      <div class="prop-detail-location">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${p.city}${p.district ? ', ' + p.district : ''}${p.address ? ' \u2014 ' + p.address : ''}
      </div>

      ${fields.length ? `
        <div class="prop-detail-section">
          <div class="prop-detail-section-title">Parametre</div>
          <div class="prop-detail-grid">
            ${fields.map(f => `<div class="prop-detail-field">
              <div class="prop-detail-field-label">${f.label}</div>
              <div class="prop-detail-field-value">${f.value}</div>
            </div>`).join('')}
          </div>
        </div>
      ` : ''}

      ${p.description ? `
        <div class="prop-detail-section">
          <div class="prop-detail-section-title">Popis</div>
          <div class="prop-detail-desc">${p.description}</div>
        </div>
      ` : ''}

      ${(p.owner || p.phone || p.email) ? `
        <div class="prop-detail-section">
          <div class="prop-detail-section-title">Kontakt na vlastn\u00edka</div>
          <div class="prop-detail-owner-card">
            <div class="prop-detail-owner-avatar">${initials}</div>
            <div>
              ${p.owner ? `<div class="prop-detail-owner-name">${p.owner}</div>` : ''}
              <div class="prop-detail-owner-contacts">
                ${p.phone ? `<a href="tel:${p.phone}">\u260E ${p.phone}</a>` : ''}
                ${p.email ? `<a href="mailto:${p.email}">\u2709 ${p.email}</a>` : ''}
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="prop-detail-section" id="prop-detail-clients-section">
        <div class="prop-detail-section-title" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <span>\ud83d\udc65 Klienti</span>
          <button class="btn btn-primary" style="font-size:0.75rem;padding:5px 12px;" onclick="openClientPicker('${p.id}')">+ Priradi\u0165 klienta</button>
        </div>
        <div id="prop-detail-clients-list" style="margin-top:0.5rem;">${_renderLinkedClientsHtml(p.id)}</div>
      </div>

      ${p.notes ? `
        <div class="prop-detail-section">
          <div class="prop-detail-section-title">Intern\u00e9 pozn\u00e1mky</div>
          <div class="prop-card-notes" style="margin:0;">${p.notes}</div>
        </div>
      ` : ''}

      ${p.url ? `
        <div class="prop-detail-section">
          <div class="prop-detail-section-title">Odkaz na inzer\u00e1t</div>
          <a href="${p.url}" target="_blank" style="color:#1A7A8A;word-break:break-all;">${p.url}</a>
        </div>
      ` : ''}

      <div class="prop-detail-actions">
        <button class="btn btn-primary" onclick="closePropDetail();openPropertyForm('${p.id}')">Upravi\u0165</button>
        <button class="btn" style="background:#f0f0f0;color:#333;" onclick="closePropDetail()">Zavrie\u0165</button>
      </div>
    </div>
  `;

  document.getElementById('prop-detail-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePropDetail(e) {
  if (e) e.stopPropagation();
  document.getElementById('prop-detail-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function detailGalleryNav(dir, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  detailPhotoIdx = (detailPhotoIdx + dir + detailPhotos.length) % detailPhotos.length;
  renderDetailGallery();
}

function detailGalleryGo(idx, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  detailPhotoIdx = idx;
  renderDetailGallery();
}

function renderDetailGallery() {
  document.getElementById('detail-gallery-img').src = detailPhotos[detailPhotoIdx];
  const counter = document.getElementById('detail-gallery-counter');
  if (counter) counter.textContent = `${detailPhotoIdx + 1} / ${detailPhotos.length}`;
  document.querySelectorAll('.prop-detail-gallery-dot').forEach((d, i) => {
    d.classList.toggle('active', i === detailPhotoIdx);
  });
}

function exportPropertiesCSV() {
  const props = getProperties();
  if (!props.length) { secAlert('Žiadne nehnuteľnosti na export'); return; }
  const headers = ['Názov','Typ','Status','Adresa','Mesto','Okres','Cena','Výmera','Izby','Poschodie','Rok','Stav','Vlastník','Telefón','Email','URL','Popis','Poznámky','Dátum'];
  const rows = props.map(p => [
    `"${(p.title||'').replace(/"/g,'""')}"`,
    PROP_TYPE_MAP[p.type] || p.type,
    (PROP_STATUS_MAP[p.status]||{}).label || p.status,
    `"${(p.address||'').replace(/"/g,'""')}"`,
    `"${(p.city||'').replace(/"/g,'""')}"`,
    `"${(p.district||'').replace(/"/g,'""')}"`,
    p.price || '',
    p.size || '',
    p.rooms || '',
    `"${(p.floor||'').replace(/"/g,'""')}"`,
    p.year || '',
    PROP_CONDITION_MAP[p.condition] || '',
    `"${(p.owner||'').replace(/"/g,'""')}"`,
    p.phone || '',
    p.email || '',
    p.url || '',
    `"${(p.description||'').replace(/"/g,'""')}"`,
    `"${(p.notes||'').replace(/"/g,'""')}"`,
    p.createdAt ? new Date(p.createdAt).toLocaleDateString('sk-SK') : '',
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nehnutelnosti_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// Initialize properties view when page loads
document.addEventListener('DOMContentLoaded', () => { renderProperties(); });

// ==================== AI GENERATION ====================

// AI Settings
const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    keyLabel: 'Anthropic API kľúč',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com',
    helpText: 'console.anthropic.com',
    models: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (rýchly, lacný)' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (najrýchlejší)' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (najkvalitnejší)' },
    ],
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    label: 'OpenAI',
    keyLabel: 'OpenAI API kľúč',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpText: 'platform.openai.com',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (odporúčaný)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rýchly, lacný)' },
      { value: 'gpt-4.1', label: 'GPT-4.1 (najnovší)' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (rýchly)' },
      { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (najlacnejší)' },
    ],
    defaultModel: 'gpt-4o',
  },
  google: {
    label: 'Google',
    keyLabel: 'Google AI API kľúč',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
    helpText: 'aistudio.google.com',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (rýchly)' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (najkvalitnejší)' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (lacný)' },
    ],
    defaultModel: 'gemini-2.5-flash',
  },
  groq: {
    label: 'Groq',
    keyLabel: 'Groq API kľúč',
    placeholder: 'gsk_...',
    helpUrl: 'https://console.groq.com/keys',
    helpText: 'console.groq.com',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (odporúčaný)' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (najrýchlejší)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (kvalitný)' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    label: 'OpenRouter',
    keyLabel: 'OpenRouter API kľúč',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpText: 'openrouter.ai',
    models: [
      { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4 (Anthropic)' },
      { value: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (Meta)' },
      { value: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3 (DeepSeek)' },
    ],
    defaultModel: 'anthropic/claude-sonnet-4',
  },
};

function getAiSettings() { return _getCached('ai_settings', {}); }
function saveAiSettingsData(data) { _setCached('ai_settings', data); }

function onAiProviderChange() {
  const provider = document.getElementById('ai-provider').value;
  const cfg = AI_PROVIDERS[provider];
  document.getElementById('ai-key-label').textContent = cfg.keyLabel;
  document.getElementById('ai-api-key').placeholder = cfg.placeholder;
  document.getElementById('ai-key-help').innerHTML =
    `Získajte kľúč na <a href="${cfg.helpUrl}" target="_blank" style="color:var(--primary);">${cfg.helpText}</a>. Kľúč sa ukladá len lokálne vo vašom prehliadači.`;
  const modelSelect = document.getElementById('ai-model');
  modelSelect.innerHTML = cfg.models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  modelSelect.value = cfg.defaultModel;
}

function openAiSettings() {
  const modal = document.getElementById('ai-settings-modal');
  const settings = getAiSettings();
  const provider = settings.provider || 'anthropic';
  document.getElementById('ai-provider').value = provider;
  onAiProviderChange();
  document.getElementById('ai-api-key').value = settings.apiKey || '';
  if (settings.model) document.getElementById('ai-model').value = settings.model;
  document.getElementById('ai-key-status').style.display = 'none';
  modal.style.display = 'block';
}
function closeAiSettings() {
  document.getElementById('ai-settings-modal').style.display = 'none';
}
function saveAiSettings() {
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('ai-api-key').value.trim();
  const model = document.getElementById('ai-model').value;
  saveAiSettingsData({ provider, apiKey, model });
  const statusEl = document.getElementById('ai-key-status');
  statusEl.textContent = apiKey ? '✓ API kľúč uložený' : '⚠ API kľúč nie je nastavený';
  statusEl.style.background = apiKey ? '#F0FDF4' : '#FFF7ED';
  statusEl.style.color = apiKey ? '#16A34A' : '#D97706';
  statusEl.style.display = 'block';
  setTimeout(() => closeAiSettings(), 1200);
}

// ==================== AI SETTINGS PAGE ====================
function renderAiSettingsPage() {
  const settings = getAiSettings();
  // Provider + API key + model
  const provider = settings.provider || 'anthropic';
  document.getElementById('ai-page-provider').value = provider;
  onAiPageProviderChange();
  document.getElementById('ai-page-api-key').value = settings.apiKey || '';
  if (settings.model) document.getElementById('ai-page-model').value = settings.model;
  document.getElementById('ai-page-status').style.display = 'none';

  // Tone chips
  const tones = settings.tones || ['profesionalny'];
  document.querySelectorAll('#ai-tone-chips .ai-chip').forEach(c => {
    c.classList.toggle('selected', tones.includes(c.dataset.val));
  });

  // Length
  const len = settings.length || 'stredny';
  const lenRadio = document.querySelector(`input[name="ai-length"][value="${len}"]`);
  if (lenRadio) lenRadio.checked = true;

  // Style
  const style = settings.style || 'informativny';
  const styleRadio = document.querySelector(`input[name="ai-style"][value="${style}"]`);
  if (styleRadio) styleRadio.checked = true;

  // Toggles
  document.getElementById('ai-opt-formal').checked = settings.formal !== false;
  document.getElementById('ai-opt-emoji').checked = settings.emoji === true;
  document.getElementById('ai-opt-okolie').checked = settings.okolie !== false;
  document.getElementById('ai-opt-cta').checked = settings.cta !== false;
  document.getElementById('ai-opt-photos').checked = settings.usePhotos !== false;

  // Custom instructions
  document.getElementById('ai-custom-instructions').value = settings.customInstructions || '';

  // Sample ads
  renderAiPageSampleAds();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onAiPageProviderChange() {
  const provider = document.getElementById('ai-page-provider').value;
  const cfg = AI_PROVIDERS[provider];
  if (!cfg) return;
  document.getElementById('ai-page-key-label').textContent = cfg.keyLabel;
  document.getElementById('ai-page-api-key').placeholder = cfg.placeholder;
  document.getElementById('ai-page-key-help').innerHTML =
    `Získajte kľúč na <a href="${cfg.helpUrl}" target="_blank" style="color:#7C3AED;">${cfg.helpText}</a>. Kľúč sa ukladá len lokálne.`;
  const modelSelect = document.getElementById('ai-page-model');
  modelSelect.innerHTML = cfg.models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  modelSelect.value = cfg.defaultModel;
}

function toggleAiChip(el) {
  el.classList.toggle('selected');
}

function renderAiPageSampleAds() {
  const ads = getSampleAds();
  const countEl = document.getElementById('ai-page-sample-count');
  if (countEl) countEl.textContent = ads.length + ' vzorov';
  const list = document.getElementById('ai-page-sample-list');
  if (!list) return;
  if (ads.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-light);font-size:0.82rem;">Zatiaľ žiadne vzorové inzeráty.</div>';
    return;
  }
  list.innerHTML = ads.map((ad, i) => `
    <div style="background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.4rem;position:relative;display:flex;gap:0.5rem;">
      <div style="flex:1;font-size:0.78rem;color:var(--text);max-height:50px;overflow:hidden;line-height:1.4;">${ad.replace(/</g,'&lt;').replace(/\n/g,' ')}</div>
      <button onclick="removeAiPageSample(${i})" style="background:none;border:none;color:#DC2626;cursor:pointer;font-size:0.85rem;flex-shrink:0;padding:2px 6px;" title="Odstrániť">✕</button>
    </div>
  `).join('');
}

function addSampleAdFromPage() {
  const textarea = document.getElementById('ai-page-new-sample');
  const text = textarea.value.trim();
  if (!text) { secAlert('Vložte text inzerátu'); return; }
  if (text.length < 50) { secAlert('Text je príliš krátky (min. 50 znakov).'); return; }
  const ads = getSampleAds();
  ads.push(text);
  saveSampleAdsData(ads);
  textarea.value = '';
  renderAiPageSampleAds();
}

function removeAiPageSample(index) {
  const ads = getSampleAds();
  ads.splice(index, 1);
  saveSampleAdsData(ads);
  renderAiPageSampleAds();
}

function saveAiSettingsPage() {
  const provider = document.getElementById('ai-page-provider').value;
  const apiKey = document.getElementById('ai-page-api-key').value.trim();
  const model = document.getElementById('ai-page-model').value;

  // Collect tone chips
  const tones = Array.from(document.querySelectorAll('#ai-tone-chips .ai-chip.selected')).map(c => c.dataset.val);

  // Length + style
  const length = document.querySelector('input[name="ai-length"]:checked')?.value || 'stredny';
  const style = document.querySelector('input[name="ai-style"]:checked')?.value || 'informativny';

  // Toggles
  const formal = document.getElementById('ai-opt-formal').checked;
  const emoji = document.getElementById('ai-opt-emoji').checked;
  const okolie = document.getElementById('ai-opt-okolie').checked;
  const cta = document.getElementById('ai-opt-cta').checked;
  const usePhotos = document.getElementById('ai-opt-photos').checked;

  // Custom instructions
  const customInstructions = document.getElementById('ai-custom-instructions').value.trim();

  saveAiSettingsData({ provider, apiKey, model, tones, length, style, formal, emoji, okolie, cta, usePhotos, customInstructions });

  const statusEl = document.getElementById('ai-page-save-status');
  statusEl.textContent = '✓ Nastavenia uložené';
  statusEl.style.color = '#16A34A';
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 2500);

  // Also sync old modal in case it's used
  document.getElementById('ai-provider').value = provider;
  onAiProviderChange();
  document.getElementById('ai-api-key').value = apiKey;
  if (model) document.getElementById('ai-model').value = model;
}

// Sample Ads (user's style)
function getSampleAds() { return _getCached('sample_ads', []); }
function saveSampleAdsData(ads) { _setCached('sample_ads', ads); }

function openSampleAds() {
  const modal = document.getElementById('sample-ads-modal');
  renderSampleAdsList();
  modal.style.display = 'block';
}
function closeSampleAds() {
  document.getElementById('sample-ads-modal').style.display = 'none';
}

function renderSampleAdsList() {
  const ads = getSampleAds();
  const list = document.getElementById('sample-ads-list');
  const countEl = document.getElementById('sample-ads-count');
  if (countEl) countEl.textContent = ads.length;

  if (ads.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-light);font-size:0.85rem;">Zatiaľ nemáte žiadne vzorové inzeráty.<br>Pridajte aspoň 3-5 pre najlepšie výsledky.</div>';
    return;
  }

  list.innerHTML = ads.map((ad, i) => `
    <div style="background:#FAFAFA;border:1px solid #e0e0e0;border-radius:10px;padding:0.75rem;margin-bottom:0.5rem;position:relative;">
      <div style="font-size:0.72rem;color:var(--text-light);margin-bottom:0.3rem;font-weight:600;">Vzor ${i + 1}</div>
      <div style="font-size:0.82rem;color:var(--dark);max-height:80px;overflow:hidden;line-height:1.4;">${ad.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
      <button onclick="removeSampleAd(${i})" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#DC2626;cursor:pointer;font-size:0.9rem;" title="Odstrániť">✕</button>
    </div>
  `).join('');
}

function addSampleAd() {
  const textarea = document.getElementById('new-sample-ad');
  const text = textarea.value.trim();
  if (!text) { secAlert('Vložte text inzerátu'); return; }
  if (text.length < 50) { secAlert('Text je príliš krátky. Vložte celý text inzerátu (aspoň 50 znakov).'); return; }

  const ads = getSampleAds();
  ads.push(text);
  saveSampleAdsData(ads);
  textarea.value = '';
  renderSampleAdsList();
}

function removeSampleAd(index) {
  const ads = getSampleAds();
  ads.splice(index, 1);
  saveSampleAdsData(ads);
  renderSampleAdsList();
}

// Template-based description (no API needed)
function templateDescription() {
  const type = document.getElementById('prop-type').value;
  const city = document.getElementById('prop-city').value.trim();
  const district = document.getElementById('prop-district').value.trim();
  const address = document.getElementById('prop-address').value.trim();
  const price = document.getElementById('prop-price').value;
  const size = document.getElementById('prop-size').value;
  const rooms = document.getElementById('prop-rooms').value;
  const floor = document.getElementById('prop-floor').value.trim();
  const year = document.getElementById('prop-year').value;
  const condition = document.getElementById('prop-condition').value;

  const typeName = PROP_TYPE_MAP[type] || type;
  const condName = PROP_CONDITION_MAP[condition] || '';
  const locationStr = [city, district].filter(Boolean).join(', ');

  let text = '';

  if (type === 'byt') {
    text = `Ponúkame na predaj ${rooms ? rooms + '-izbový ' : ''}byt`;
    if (size) text += ` o výmere ${size} m²`;
    if (locationStr) text += ` v lokalite ${locationStr}`;
    if (address) text += ` na ulici ${address}`;
    text += '.';
    if (floor) text += ` Byt sa nachádza na ${floor} poschodí.`;
    if (condName) text += ` Nehnuteľnosť je v stave: ${condName.toLowerCase()}.`;
    if (year) text += ` Rok výstavby: ${year}.`;
    text += '\n\nByt je ideálny pre ';
    text += rooms && parseInt(rooms) <= 2 ? 'jednotlivcov alebo páry' : 'rodiny s deťmi';
    text += `. V okolí sa nachádza kompletná občianska vybavenosť vrátane škôl, obchodov a zastávok MHD.`;
    if (price) text += `\n\nCena: ${Number(price).toLocaleString('sk-SK')} €`;
    text += '\n\nV prípade záujmu nás neváhajte kontaktovať pre dohodnutie obhliadky.';
  } else if (type === 'dom') {
    text = `Ponúkame na predaj rodinný dom`;
    if (size) text += ` s úžitkovou plochou ${size} m²`;
    if (locationStr) text += ` v lokalite ${locationStr}`;
    text += '.';
    if (rooms) text += ` Dom disponuje ${rooms} izbami.`;
    if (condName) text += ` Stav: ${condName.toLowerCase()}.`;
    if (year) text += ` Rok výstavby: ${year}.`;
    text += '\n\nNehnuteľnosť sa nachádza v pokojnej lokalite s dobrou dostupnosťou do centra.';
    if (price) text += `\n\nCena: ${Number(price).toLocaleString('sk-SK')} €`;
    text += '\n\nRadi vám poskytneme ďalšie informácie a dohodneme termín obhliadky.';
  } else if (type === 'pozemok') {
    text = `Ponúkame na predaj pozemok`;
    if (size) text += ` o výmere ${size} m²`;
    if (locationStr) text += ` v lokalite ${locationStr}`;
    text += '.';
    text += '\n\nPozemok je vhodný na výstavbu rodinného domu. Inžinierske siete sú dostupné v blízkosti.';
    if (price) text += `\n\nCena: ${Number(price).toLocaleString('sk-SK')} €`;
    text += '\n\nKontaktujte nás pre viac informácií.';
  } else {
    text = `Ponúkame na predaj ${typeName.toLowerCase()}`;
    if (size) text += ` o výmere ${size} m²`;
    if (locationStr) text += ` v lokalite ${locationStr}`;
    text += '.';
    if (condName) text += ` Stav: ${condName.toLowerCase()}.`;
    if (price) text += `\n\nCena: ${Number(price).toLocaleString('sk-SK')} €`;
    text += '\n\nKontaktujte nás pre viac informácií alebo dohodnutie obhliadky.';
  }

  document.getElementById('prop-description').value = text;
}

// Collect current property form data
function getPropertyFormData() {
  return {
    type: PROP_TYPE_MAP[document.getElementById('prop-type').value] || document.getElementById('prop-type').value,
    city: document.getElementById('prop-city').value.trim(),
    district: document.getElementById('prop-district').value.trim(),
    address: document.getElementById('prop-address').value.trim(),
    price: document.getElementById('prop-price').value,
    size: document.getElementById('prop-size').value,
    rooms: document.getElementById('prop-rooms').value,
    floor: document.getElementById('prop-floor').value.trim(),
    year: document.getElementById('prop-year').value,
    condition: PROP_CONDITION_MAP[document.getElementById('prop-condition').value] || document.getElementById('prop-condition').value,
  };
}

// Grab compressed images from property photo preview (max 5)
function getPropertyPhotosBase64(max) {
  const imgs = document.querySelectorAll('#prop-photo-preview img');
  const result = [];
  for (let i = 0; i < Math.min(imgs.length, max || 5); i++) {
    const src = imgs[i].src;
    if (src && src.startsWith('data:image/')) result.push(src);
  }
  return result;
}

// Detects errors that mean the chosen model doesn't support multimodal/vision input
function _isVisionUnsupportedError(raw) {
  if (!raw) return false;
  return /content must be a string|does not support (image|vision|multimodal)|image.*not.*support|unsupported.*(image|vision)|invalid.*(image|content.*type)/i.test(raw);
}

// Translate raw API error into a friendly Slovak message
function _friendlyAiError(status, raw) {
  const s = String(raw || '');
  if (status === 401 || /invalid.*(api|key)|authentication|unauthorized/i.test(s)) {
    return 'API kľúč je neplatný. Skontrolujte ho v AI nastaveniach.';
  }
  if (status === 429 || /rate.?limit|quota|credit/i.test(s)) {
    return 'Prekročený limit API. Skúste o chvíľu znova alebo skontrolujte kredit.';
  }
  if (/model.*not.?found|unknown.*model|does not exist|invalid.*model/i.test(s)) {
    return 'Zvolený AI model nie je dostupný. Vyberte iný v AI nastaveniach.';
  }
  return s || ('Chyba ' + status);
}

// Shared AI API caller with automatic retry without images if model is text-only
async function _callAiGenerate(payload, allowImageRetry) {
  const resp = await fetch('/api/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data; try { data = await resp.json(); } catch (e) { data = {}; }

  if (!resp.ok) {
    const raw = data.error || ('HTTP ' + resp.status);
    // Auto-retry without images if model doesn't support vision
    if (allowImageRetry && payload.images && _isVisionUnsupportedError(raw)) {
      const retryPayload = Object.assign({}, payload, { images: null });
      const retry = await _callAiGenerate(retryPayload, false);
      retry._imagesSkipped = true;
      return retry;
    }
    const friendly = _friendlyAiError(resp.status, raw);
    const err = new Error(friendly);
    err.status = resp.status;
    throw err;
  }

  if (!data.text) {
    throw new Error('AI nevrátilo žiadny text. Skúste znova alebo zmeňte model.');
  }
  return data;
}

// AI Generate Description
async function aiGenerateDescription() {
  const errEl = document.getElementById('ai-gen-error');
  const textEl = document.getElementById('ai-gen-text');
  const spinEl = document.getElementById('ai-gen-spinner');

  const showErr = (msg) => {
    if (errEl) { errEl.innerHTML = msg; errEl.style.display = 'block'; }
  };
  const showInfo = (msg) => {
    if (errEl) {
      errEl.innerHTML = msg;
      errEl.style.color = '#D97706';
      errEl.style.display = 'block';
    }
  };

  const settings = getAiSettings();
  if (!settings.apiKey) {
    showErr('Nemáte nastavený API kľúč pre AI. <a href="javascript:void(0)" onclick="closePropertyForm();showPage(\'ai\');" style="color:#7C3AED;font-weight:600;text-decoration:underline;">Otvoriť AI nastavenia</a>');
    return;
  }

  const property = getPropertyFormData();
  if (!property.city && !property.type) {
    showErr('Vyplňte aspoň typ a mesto pred generovaním.');
    return;
  }

  // Reset error color + show spinner
  if (errEl) { errEl.style.color = ''; errEl.style.display = 'none'; }
  if (textEl) textEl.style.display = 'none';
  if (spinEl) spinEl.style.display = 'inline';

  try {
    const sampleAds = getSampleAds();
    const images = (settings.usePhotos !== false) ? getPropertyPhotosBase64(5) : [];
    const data = await _callAiGenerate({
      provider: settings.provider || 'anthropic',
      apiKey: settings.apiKey,
      model: settings.model || 'claude-sonnet-4-6',
      property,
      sampleAds: sampleAds.length > 0 ? sampleAds : null,
      images: images.length > 0 ? images : null,
      mode: 'description',
      tone: settings.tones || ['profesionalny'],
      length: settings.length || 'stredny',
      style: settings.style || 'informativny',
      formal: settings.formal !== false,
      emoji: settings.emoji === true,
      okolie: settings.okolie !== false,
      cta: settings.cta !== false,
      customInstructions: settings.customInstructions || '',
    }, true);

    const desc = document.getElementById('prop-description');
    if (desc) {
      desc.value = data.text;
      desc.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (data._imagesSkipped) {
      showInfo('Hotovo. Zvolený model nepodporuje obrázky, popis bol vygenerovaný len z textových údajov.');
    } else if (errEl) {
      errEl.style.display = 'none';
    }
  } catch (err) {
    const msg = (err && err.message) ? err.message : 'Neznáma chyba pri generovaní.';
    showErr(msg.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  } finally {
    if (textEl) textEl.style.display = 'inline';
    if (spinEl) spinEl.style.display = 'none';
  }
}

// AI Generate Headline
async function aiGenerateHeadline() {
  const errEl = document.getElementById('ai-gen-error');
  const showErr = (msg) => { if (errEl) { errEl.innerHTML = msg; errEl.style.color = ''; errEl.style.display = 'block'; } };
  const showInfo = (msg) => { if (errEl) { errEl.innerHTML = msg; errEl.style.color = '#D97706'; errEl.style.display = 'block'; } };

  const settings = getAiSettings();
  if (!settings.apiKey) {
    showErr('Nemáte nastavený API kľúč pre AI. <a href="javascript:void(0)" onclick="closePropertyForm();showPage(\'ai\');" style="color:#7C3AED;font-weight:600;text-decoration:underline;">Otvoriť AI nastavenia</a>');
    return;
  }

  const property = getPropertyFormData();
  if (!property.city && !property.type) {
    showErr('Vyplňte aspoň typ a mesto pred generovaním.');
    return;
  }

  try {
    if (errEl) { errEl.style.color = ''; errEl.style.display = 'none'; }
    const sampleAds = getSampleAds();
    const images = (settings.usePhotos !== false) ? getPropertyPhotosBase64(3) : [];
    const data = await _callAiGenerate({
      provider: settings.provider || 'anthropic',
      apiKey: settings.apiKey,
      model: settings.model || 'claude-sonnet-4-6',
      property,
      sampleAds: sampleAds.length > 0 ? sampleAds : null,
      images: images.length > 0 ? images : null,
      mode: 'headline',
      tone: settings.tones || ['profesionalny'],
      formal: settings.formal !== false,
      emoji: settings.emoji === true,
      customInstructions: settings.customInstructions || '',
    }, true);

    const titleEl = document.getElementById('prop-ai-headline');
    if (titleEl) titleEl.value = data.text;
    const mainTitle = document.getElementById('prop-title');
    if (mainTitle && !mainTitle.value.trim()) mainTitle.value = data.text;

    if (data._imagesSkipped) {
      showInfo('Hotovo. Zvolený model nepodporuje obrázky, titulok bol vygenerovaný len z textových údajov.');
    }
  } catch (err) {
    showErr((err && err.message) ? err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Chyba pri generovaní.');
  }
}

// Run default calculations on page load
window.addEventListener('load', () => {
  calcInvestment();
  calcMillion();
  calcRenta();
  calcFinMath();
  calcPilier();
  calcHypoteka();
  calcRezerva();
  calcDividenda();
});

// ===== CONTACTS MODULE =====
const CONTACTS_KEY = 'secpro_contacts';

function getContacts() { return _getCached('contacts', []); }
function saveContacts(arr) { _setCached('contacts', arr); }

// ===================== CLIENTS/CONTACTS (unified) =====================
// Clients are now a derived view over contacts: contacts with role 'seller' or 'buyer'.
// Kept for backward compat (property-detail linked clients, client picker).
const CLIENT_STAGE_LABELS = {
  new:      { label: 'Nový lead',         icon: '🆕', color: '#64748B', bg: '#F1F5F9' },
  viewing:  { label: 'Obhliadka',         icon: '👀', color: '#0891B2', bg: '#ECFEFF' },
  offer:    { label: 'Ponuka',            icon: '💬', color: '#7C3AED', bg: '#F3E8FF' },
  reserved: { label: 'Rezervácia',        icon: '🔒', color: '#D97706', bg: '#FEF3C7' },
  contract: { label: 'Zmluva podpísaná',  icon: '📝', color: '#0D9488', bg: '#CCFBF1' },
  closed:   { label: 'Uzavretý',          icon: '✅', color: '#16A34A', bg: '#DCFCE7' },
  lost:     { label: 'Stratený',          icon: '❌', color: '#DC2626', bg: '#FEE2E2' },
};
const CLIENT_TYPE_LABELS = {
  seller: { label: 'Predávajúci', icon: '🏠', color: '#0D9488' },
  buyer:  { label: 'Kupujúci',    icon: '🔑', color: '#2563EB' },
};
const CLIENT_ACTIVE_STAGES = ['new','viewing','offer','reserved','contract'];
let cli_type_filter = 'all';

// One-time migration: merge legacy clients → contacts, then clear.
// Also normalizes contacts to have a `roles` array.
let _clientsMigrationDone = false;
function migrateClientsIntoContacts() {
  if (_clientsMigrationDone) return;
  _clientsMigrationDone = true;
  try {
    const contacts = _getCached('contacts', []) || [];
    // Normalize every contact to have roles[]
    contacts.forEach(c => {
      if (!Array.isArray(c.roles)) {
        c.roles = c.category ? [c.category] : [];
      }
      if (!c.stage) c.stage = '';
      if (!c.propertyId) c.propertyId = '';
    });
    const legacyClients = _getCached('clients', []) || [];
    if (Array.isArray(legacyClients) && legacyClients.length > 0) {
      legacyClients.forEach(cl => {
        // Try to find matching contact by phone/email/name
        const norm = s => (s || '').toLowerCase().trim();
        let match = null;
        if (cl.phone || cl.email) {
          match = contacts.find(c =>
            (cl.phone && norm(c.phone) === norm(cl.phone)) ||
            (cl.email && norm(c.email) === norm(cl.email))
          );
        }
        if (!match && cl.name) {
          match = contacts.find(c => norm(c.name) === norm(cl.name));
        }
        if (match) {
          if (!match.roles.includes(cl.type)) match.roles.push(cl.type);
          if (!match.stage || match.stage === 'new') match.stage = cl.stage || match.stage || 'new';
          if (!match.propertyId && cl.propertyId) match.propertyId = cl.propertyId;
          if (cl.notes && !match.note) match.note = cl.notes;
          match.updatedAt = new Date().toISOString();
        } else {
          contacts.unshift({
            id: cl.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
            name: cl.name || '',
            phone: cl.phone || '',
            email: cl.email || '',
            company: '',
            roles: [cl.type || 'buyer'],
            category: cl.type || '',
            status: 'aktivny',
            address: '',
            note: cl.notes || '',
            stage: cl.stage || 'new',
            propertyId: cl.propertyId || '',
            createdAt: cl.createdAt || new Date().toISOString(),
            updatedAt: cl.updatedAt || new Date().toISOString(),
          });
        }
      });
      _setCached('contacts', contacts);
      _setCached('clients', []); // clear legacy
    } else {
      _setCached('contacts', contacts);
    }
  } catch (e) {
    console.warn('Client→contact migration failed', e);
  }
}

// Derived client view: returns contact objects shaped as "clients".
function getClients() {
  migrateClientsIntoContacts();
  const contacts = _getCached('contacts', []) || [];
  const result = [];
  contacts.forEach(c => {
    const roles = Array.isArray(c.roles) ? c.roles : (c.category ? [c.category] : []);
    const isSeller = roles.includes('seller');
    const isBuyer = roles.includes('buyer');
    if (!isSeller && !isBuyer) return;
    // Prefer buyer if both (buyer-side is typically more active)
    const type = isBuyer ? 'buyer' : 'seller';
    result.push({
      id: c.id,
      _contactId: c.id,
      type,
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      propertyId: c.propertyId || '',
      stage: c.stage || 'new',
      notes: c.note || '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  });
  return result;
}

// Writes a client-shape array back to contacts (by id).
function saveClients(arr) {
  const contacts = _getCached('contacts', []) || [];
  const byId = new Map(contacts.map(c => [c.id, c]));
  (arr || []).forEach(cl => {
    const c = byId.get(cl.id);
    if (!c) return;
    // Ensure role is present
    if (!Array.isArray(c.roles)) c.roles = c.category ? [c.category] : [];
    if (cl.type && !c.roles.includes(cl.type)) c.roles.push(cl.type);
    c.stage = cl.stage || c.stage || 'new';
    c.propertyId = cl.propertyId || '';
    if (typeof cl.notes === 'string') c.note = cl.notes;
    c.updatedAt = new Date().toISOString();
  });
  _setCached('contacts', contacts);
}

function setClientTypeFilter(t) {
  cli_type_filter = t;
  document.querySelectorAll('#cli-stats .cli-stat').forEach(el => {
    el.classList.toggle('active', el.dataset.type === t);
  });
  renderClients();
}

function _populateClientPropertySelect(selectedId) {
  const sel = document.getElementById('client-property');
  if (!sel) return;
  const props = (typeof getProperties === 'function') ? getProperties() : [];
  sel.innerHTML = '<option value="">— žiadna —</option>' +
    props.map(p => {
      const label = (p.title || 'Bez názvu') + (p.city ? ' · ' + p.city : '');
      return `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

// Legacy: opens the unified contact form. If editing by "client id" (= contact id),
// just opens contact form. When adding new, pre-selects 'buyer' role.
function openClientForm(id, presetType) {
  if (id) {
    openContactForm(id);
  } else {
    openContactForm(null, [presetType || 'buyer']);
  }
}

function closeClientForm() {
  document.getElementById('client-modal').style.display = 'none';
}

function saveClient() {
  const name = document.getElementById('client-name').value.trim();
  if (!name) { alert('Vyplňte meno klienta.'); return; }

  const editId = document.getElementById('client-edit-id').value;
  const clients = getClients();
  const data = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type:  document.querySelector('input[name="client-type"]:checked').value,
    name,
    phone: document.getElementById('client-phone').value.trim(),
    email: document.getElementById('client-email').value.trim(),
    propertyId: document.getElementById('client-property').value || '',
    stage: document.getElementById('client-stage').value,
    notes: document.getElementById('client-notes').value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (editId) {
    const idx = clients.findIndex(c => c.id === editId);
    if (idx !== -1) {
      data.createdAt = clients[idx].createdAt;
      clients[idx] = data;
    }
  } else {
    data.createdAt = data.updatedAt;
    clients.unshift(data);
  }

  saveClients(clients);
  closeClientForm();
  renderClients();
}

async function deleteClient(id, ev) {
  if (ev) ev.stopPropagation();
  const ok = (typeof secConfirm === 'function')
    ? await secConfirm({ message: 'Naozaj chcete odstrániť tohto klienta?', type: 'danger', ok: 'Odstrániť' })
    : confirm('Naozaj chcete odstrániť tohto klienta?');
  if (!ok) return;
  saveClients(getClients().filter(c => c.id !== id));
  renderClients();
}

function advanceClientStage(id, ev) {
  if (ev) ev.stopPropagation();
  const order = ['new','viewing','offer','reserved','contract','closed'];
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === id);
  if (idx === -1) return;
  const cur = clients[idx].stage || 'new';
  const curPos = order.indexOf(cur);
  if (curPos === -1 || curPos === order.length - 1) return;
  clients[idx].stage = order[curPos + 1];
  clients[idx].updatedAt = new Date().toISOString();
  saveClients(clients);
  renderClients();
}

function _clientPropertyLabel(propId) {
  if (!propId) return null;
  const props = (typeof getProperties === 'function') ? getProperties() : [];
  const p = props.find(x => x.id === propId);
  if (!p) return null;
  return (p.title || 'Bez názvu') + (p.city ? ' · ' + p.city : '');
}

function renderClients() {
  const listEl = document.getElementById('cli-list');
  const emptyEl = document.getElementById('cli-empty');
  const countEl = document.getElementById('cli-count');
  if (!listEl) return;

  const all = getClients();
  const search = (document.getElementById('cli-search')?.value || '').toLowerCase();
  const stageFilter = document.getElementById('cli-filter-stage')?.value || '';

  // Update stat counters (from full dataset)
  const statAll = document.getElementById('cli-stat-all');
  const statSeller = document.getElementById('cli-stat-seller');
  const statBuyer = document.getElementById('cli-stat-buyer');
  const statActive = document.getElementById('cli-stat-active');
  if (statAll) statAll.textContent = all.length;
  if (statSeller) statSeller.textContent = all.filter(c => c.type === 'seller').length;
  if (statBuyer) statBuyer.textContent = all.filter(c => c.type === 'buyer').length;
  if (statActive) statActive.textContent = all.filter(c => CLIENT_ACTIVE_STAGES.includes(c.stage || 'new')).length;

  // Apply filters
  const filtered = all.filter(c => {
    if (cli_type_filter === 'seller' && c.type !== 'seller') return false;
    if (cli_type_filter === 'buyer' && c.type !== 'buyer') return false;
    if (cli_type_filter === 'active' && !CLIENT_ACTIVE_STAGES.includes(c.stage || 'new')) return false;
    if (stageFilter && (c.stage || 'new') !== stageFilter) return false;
    if (search) {
      const hay = [c.name, c.phone, c.email, c.notes, _clientPropertyLabel(c.propertyId) || ''].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (countEl) countEl.textContent = filtered.length + ' / ' + all.length + ' klientov';

  if (all.length === 0) {
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = '';

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-light);font-size:0.9rem;">Žiadni klienti nezodpovedajú filtru</div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const type = CLIENT_TYPE_LABELS[c.type] || CLIENT_TYPE_LABELS.seller;
    const stage = CLIENT_STAGE_LABELS[c.stage || 'new'];
    const propLabel = _clientPropertyLabel(c.propertyId);
    const initials = (c.name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const notesPreview = c.notes ? (c.notes.length > 90 ? c.notes.slice(0, 90) + '…' : c.notes) : '';
    const showAdvance = (c.stage || 'new') !== 'closed' && (c.stage || 'new') !== 'lost';
    return `
      <div class="cli-card cli-card-${c.type || 'seller'}" onclick="openClientForm('${c.id}')">
        <div class="cli-card-head">
          <div class="cli-avatar" style="background:${type.color}1a;color:${type.color};">${esc(initials) || '?'}</div>
          <div class="cli-card-head-text">
            <div class="cli-name">${esc(c.name)}</div>
            <div class="cli-type-chip" style="color:${type.color};">${type.icon} ${type.label}</div>
          </div>
          <div class="cli-card-actions">
            <button class="cli-icon-btn" title="Odstrániť" onclick="deleteClient('${c.id}', event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="cli-card-body">
          ${c.phone ? `<div class="cli-row"><span class="cli-row-icon">📞</span><a href="tel:${esc(c.phone)}" onclick="event.stopPropagation()">${esc(c.phone)}</a></div>` : ''}
          ${c.email ? `<div class="cli-row"><span class="cli-row-icon">✉️</span><a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()">${esc(c.email)}</a></div>` : ''}
          ${propLabel ? `<div class="cli-row cli-row-prop"><span class="cli-row-icon">🏡</span><span title="${esc(propLabel)}">${esc(propLabel)}</span></div>` : ''}
          ${notesPreview ? `<div class="cli-notes">${esc(notesPreview)}</div>` : ''}
        </div>

        <div class="cli-card-footer">
          <span class="cli-stage-pill" style="background:${stage.bg};color:${stage.color};">${stage.icon} ${stage.label}</span>
          ${showAdvance ? `<button class="cli-advance-btn" onclick="advanceClientStage('${c.id}', event)" title="Posunúť do ďalšej fázy">Ďalšia fáza →</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => { try { renderClients(); } catch {} });

// ===================== CLIENT ↔ PROPERTY LINKING =====================

function _renderLinkedClientsHtml(propId) {
  const linked = getClients().filter(c => c.propertyId === propId);
  if (linked.length === 0) {
    return '<div style="padding:0.9rem;background:#F8FAFC;border:1px dashed var(--border);border-radius:8px;color:var(--text-light);font-size:0.82rem;text-align:center;">Zatiaľ žiadni priradení klienti</div>';
  }
  return `<div class="pdc-list">` + linked.map(c => {
    const type = CLIENT_TYPE_LABELS[c.type] || CLIENT_TYPE_LABELS.seller;
    const stage = CLIENT_STAGE_LABELS[c.stage || 'new'];
    return `
      <div class="pdc-item pdc-item-${c.type || 'seller'}">
        <div class="pdc-item-main">
          <div class="pdc-item-head">
            <span class="pdc-type" style="color:${type.color};">${type.icon} ${esc(type.label)}</span>
            <span class="pdc-name">${esc(c.name)}</span>
          </div>
          <div class="pdc-item-sub">
            ${c.phone ? `<a href="tel:${esc(c.phone)}" onclick="event.stopPropagation()">📞 ${esc(c.phone)}</a>` : ''}
            ${c.email ? `<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()">✉️ ${esc(c.email)}</a>` : ''}
          </div>
        </div>
        <span class="cli-stage-pill" style="background:${stage.bg};color:${stage.color};">${stage.icon} ${esc(stage.label)}</span>
        <button class="pdc-unlink" onclick="unlinkClientFromProperty('${c.id}', '${propId}', event)" title="Odpojiť od nehnuteľnosti">×</button>
      </div>`;
  }).join('') + `</div>`;
}

function _refreshLinkedClientsInDetail(propId) {
  const el = document.getElementById('prop-detail-clients-list');
  if (el) el.innerHTML = _renderLinkedClientsHtml(propId);
}

function unlinkClientFromProperty(clientId, propId, ev) {
  if (ev) ev.stopPropagation();
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return;
  clients[idx].propertyId = '';
  clients[idx].updatedAt = new Date().toISOString();
  saveClients(clients);
  _refreshLinkedClientsInDetail(propId);
}

let _clientPickerPropId = null;

function openClientPicker(propId) {
  _clientPickerPropId = propId;
  const modal = document.getElementById('client-picker-modal');
  if (!modal) return;
  document.getElementById('client-picker-search').value = '';
  renderClientPickerList();
  modal.style.display = 'block';
}

function closeClientPicker() {
  const modal = document.getElementById('client-picker-modal');
  if (modal) modal.style.display = 'none';
  _clientPickerPropId = null;
}

function renderClientPickerList() {
  const listEl = document.getElementById('client-picker-list');
  if (!listEl) return;
  const search = (document.getElementById('client-picker-search')?.value || '').toLowerCase();
  const all = getClients();
  // Exclude those already linked to this property
  const candidates = all.filter(c => c.propertyId !== _clientPickerPropId);
  const filtered = candidates.filter(c => {
    if (!search) return true;
    const hay = [c.name, c.phone, c.email, c.notes].join(' ').toLowerCase();
    return hay.includes(search);
  });

  if (all.length === 0) {
    listEl.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-light);font-size:0.85rem;">
      Zatiaľ nemáte žiadnych klientov.<br>
      <button class="btn btn-primary" style="margin-top:0.75rem;" onclick="closeClientPicker();showPage('clients');setTimeout(()=>openClientForm(),120);">Pridať prvého klienta</button>
    </div>`;
    return;
  }
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:1.25rem;text-align:center;color:var(--text-light);font-size:0.85rem;">Nikto nezodpovedá hľadaniu</div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const type = CLIENT_TYPE_LABELS[c.type] || CLIENT_TYPE_LABELS.seller;
    const stage = CLIENT_STAGE_LABELS[c.stage || 'new'];
    const alreadyLinked = c.propertyId && c.propertyId !== _clientPickerPropId;
    const linkedPropLabel = alreadyLinked ? _clientPropertyLabel(c.propertyId) : null;
    return `
      <div class="cp-item" onclick="linkClientToProperty('${c.id}')">
        <div class="cp-item-main">
          <div class="cp-item-row1">
            <span style="color:${type.color};font-weight:700;">${type.icon}</span>
            <span class="cp-item-name">${esc(c.name)}</span>
            <span class="cli-stage-pill" style="background:${stage.bg};color:${stage.color};margin-left:auto;">${stage.icon} ${esc(stage.label)}</span>
          </div>
          <div class="cp-item-row2">
            ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
            ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
            ${linkedPropLabel ? `<span class="cp-warn" title="Aktuálne priradený k: ${esc(linkedPropLabel)}">⚠️ už priradený</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function linkClientToProperty(clientId) {
  if (!_clientPickerPropId) return;
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx === -1) return;
  clients[idx].propertyId = _clientPickerPropId;
  clients[idx].updatedAt = new Date().toISOString();
  saveClients(clients);
  const propId = _clientPickerPropId;
  closeClientPicker();
  _refreshLinkedClientsInDetail(propId);
}

const CONTACT_CATEGORY_LABELS = {
  klient: 'Klient',
  potencialny: 'Potenciálny klient',
  makler: 'Makléř / Partner',
  developer: 'Developer',
  pravnik: 'Právnik / Notár',
  banka: 'Banka / Hypotéky',
  iny: 'Iný',
  seller: 'Predávajúci',
  buyer: 'Kupujúci'
};
const CONTACT_ROLE_META = {
  seller:      { label: 'Predávajúci',    icon: '🏠', color: '#0D9488', bg: '#CCFBF1' },
  buyer:       { label: 'Kupujúci',       icon: '🔑', color: '#2563EB', bg: '#DBEAFE' },
  potencialny: { label: 'Potenciálny',    icon: '💡', color: '#D97706', bg: '#FEF3C7' },
  klient:      { label: 'Klient',         icon: '⭐', color: '#7C3AED', bg: '#F3E8FF' },
  makler:      { label: 'Maklér',         icon: '🤝', color: '#0891B2', bg: '#ECFEFF' },
  developer:   { label: 'Developer',      icon: '🏗️', color: '#475569', bg: '#F1F5F9' },
  pravnik:     { label: 'Právnik',        icon: '⚖️', color: '#6366F1', bg: '#EEF2FF' },
  banka:       { label: 'Banka',          icon: '🏦', color: '#059669', bg: '#D1FAE5' },
  iny:         { label: 'Iný',            icon: '📇', color: '#64748B', bg: '#F1F5F9' },
};
const CONTACT_STATUS_LABELS = {
  aktivny: { label: 'Aktívny', color: '#7ED4C8', bg: '#E5F5F1' },
  neaktivny: { label: 'Neaktívny', color: '#999', bg: '#f0f0f0' },
  vip: { label: 'VIP', color: '#F5A623', bg: '#FFF8EC' }
};

function _populateContactPropertySelect(selectedId) {
  const sel = document.getElementById('contact-property');
  if (!sel) return;
  const props = (typeof getProperties === 'function') ? getProperties() : [];
  sel.innerHTML = '<option value="">— žiadna —</option>' +
    props.map(p => {
      const label = (p.title || 'Bez názvu') + (p.city ? ' · ' + p.city : '');
      return `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

function _refreshContactDealSection() {
  const sec = document.getElementById('contact-deal-section');
  if (!sec) return;
  const roles = Array.from(document.querySelectorAll('#contact-roles input[type="checkbox"]:checked')).map(cb => cb.value);
  const showDeal = roles.includes('seller') || roles.includes('buyer');
  sec.style.display = showDeal ? 'block' : 'none';
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.matches && e.target.matches('#contact-roles input[type="checkbox"]')) {
    _refreshContactDealSection();
  }
});

function openContactForm(id, presetRoles) {
  document.getElementById('contact-edit-id').value = id || '';
  document.getElementById('contact-modal-title').textContent = id ? 'Upraviť kontakt' : 'Pridať kontakt';
  let roles = [];
  let stage = 'new';
  let propertyId = '';
  if (id) {
    const c = getContacts().find(x => x.id === id);
    if (c) {
      document.getElementById('contact-name').value = c.name || '';
      document.getElementById('contact-phone').value = c.phone || '';
      document.getElementById('contact-email').value = c.email || '';
      document.getElementById('contact-company').value = c.company || '';
      document.getElementById('contact-status').value = c.status || 'aktivny';
      document.getElementById('contact-address').value = c.address || '';
      document.getElementById('contact-note').value = c.note || '';
      roles = Array.isArray(c.roles) ? c.roles.slice() : (c.category ? [c.category] : []);
      stage = c.stage || 'new';
      propertyId = c.propertyId || '';
    }
  } else {
    document.getElementById('contact-name').value = '';
    document.getElementById('contact-phone').value = '';
    document.getElementById('contact-email').value = '';
    document.getElementById('contact-company').value = '';
    document.getElementById('contact-status').value = 'aktivny';
    document.getElementById('contact-address').value = '';
    document.getElementById('contact-note').value = '';
    roles = Array.isArray(presetRoles) ? presetRoles.slice() : [];
    stage = 'new';
    propertyId = '';
  }
  // Apply roles to checkboxes
  document.querySelectorAll('#contact-roles input[type="checkbox"]').forEach(cb => {
    cb.checked = roles.includes(cb.value);
  });
  document.getElementById('contact-stage').value = stage;
  _populateContactPropertySelect(propertyId);
  _refreshContactDealSection();
  document.getElementById('contact-modal').style.display = 'block';
}

function closeContactForm() {
  document.getElementById('contact-modal').style.display = 'none';
}

function saveContact() {
  const name = document.getElementById('contact-name').value.trim();
  if (!name) { secAlert('Vyplňte meno kontaktu.'); return; }

  const editId = document.getElementById('contact-edit-id').value;
  const contacts = getContacts();
  const roles = Array.from(document.querySelectorAll('#contact-roles input[type="checkbox"]:checked')).map(cb => cb.value);
  const hasDeal = roles.includes('seller') || roles.includes('buyer');
  const data = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    phone: document.getElementById('contact-phone').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    company: document.getElementById('contact-company').value.trim(),
    roles,
    category: roles[0] || '', // legacy
    status: document.getElementById('contact-status').value,
    address: document.getElementById('contact-address').value.trim(),
    note: document.getElementById('contact-note').value.trim(),
    stage: hasDeal ? (document.getElementById('contact-stage').value || 'new') : '',
    propertyId: hasDeal ? (document.getElementById('contact-property').value || '') : '',
    updatedAt: new Date().toISOString()
  };

  if (editId) {
    const idx = contacts.findIndex(c => c.id === editId);
    if (idx !== -1) {
      data.createdAt = contacts[idx].createdAt;
      contacts[idx] = data;
    }
  } else {
    data.createdAt = data.updatedAt;
    contacts.unshift(data);
  }

  saveContacts(contacts);
  closeContactForm();
  renderContacts();
}

async function deleteContact(id) {
  if (!await secConfirm({ message: 'Naozaj chcete odstrániť tento kontakt?', type: 'danger', ok: 'Odstrániť' })) return;
  const contacts = getContacts().filter(c => c.id !== id);
  saveContacts(contacts);
  renderContacts();
}

function filterContacts() {
  renderContacts();
}

function renderContacts() {
  migrateClientsIntoContacts();
  const contacts = getContacts();
  const search = (document.getElementById('contact-filter-search').value || '').toLowerCase();
  const roleFilters = msGetValues('ms-contact-category');
  const statusFilters = msGetValues('ms-contact-status');

  const filtered = contacts.filter(c => {
    const roles = Array.isArray(c.roles) ? c.roles : (c.category ? [c.category] : []);
    if (roleFilters.length && !roles.some(r => roleFilters.includes(r))) return false;
    if (statusFilters.length && !statusFilters.includes(c.status)) return false;
    if (search) {
      const haystack = [c.name, c.phone, c.email, c.company, c.note].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const tbody = document.getElementById('contact-tbody');
  const empty = document.getElementById('contact-empty');
  const tableWrap = document.getElementById('contact-table-wrap');
  const countEl = document.getElementById('contact-count');

  countEl.textContent = filtered.length + ' / ' + contacts.length + ' kontaktov';

  if (filtered.length === 0) {
    tableWrap.style.display = 'none';
    empty.style.display = contacts.length === 0 ? 'block' : 'none';
    if (contacts.length > 0 && filtered.length === 0) {
      tableWrap.style.display = 'none';
      empty.style.display = 'block';
      empty.querySelector('p').textContent = 'Žiadne kontakty nezodpovedajú filtru';
      empty.querySelector('button').style.display = 'none';
    }
  } else {
    tableWrap.style.display = 'block';
    empty.style.display = 'none';
    // Reset empty state text
    const emptyP = empty.querySelector('p');
    if (emptyP) emptyP.textContent = 'Zatiaľ nemáte žiadne kontakty';
    const emptyBtn = empty.querySelector('button');
    if (emptyBtn) emptyBtn.style.display = '';
  }

  const amlAll = typeof getAmlRecords === 'function' ? getAmlRecords() : [];
  tbody.innerHTML = filtered.map(c => {
    const roles = Array.isArray(c.roles) ? c.roles : (c.category ? [c.category] : []);
    const roleChips = roles.map(r => {
      const meta = CONTACT_ROLE_META[r] || { label: r, icon: '', color: '#64748B', bg: '#F1F5F9' };
      return `<span style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.68rem;font-weight:600;background:${meta.bg};color:${meta.color};margin:1px 2px 1px 0;white-space:nowrap;">${meta.icon} ${esc(meta.label)}</span>`;
    }).join('') || '<span style="font-size:0.7rem;color:var(--text-light);">—</span>';
    const st = CONTACT_STATUS_LABELS[c.status] || { label: c.status, color: '#999', bg: '#f0f0f0' };
    const note = c.note ? (c.note.length > 40 ? c.note.slice(0, 40) + '...' : c.note) : '-';
    const amlRec = amlAll.find(a => a.contactId === c.id);
    const amlBadge = amlRec
      ? (amlRec.status === 'approved' ? '<span class="aml-badge approved" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Overený</span>'
        : amlRec.status === 'rejected' ? '<span class="aml-badge rejected" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Zamietnutý</span>'
        : amlRec.status === 'flagged' ? '<span class="aml-badge flagged" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Flagged</span>'
        : '<span class="aml-badge pending" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Čaká</span>')
      : '<span style="font-size:0.7rem;color:var(--text-light);">-</span>';
    // Stage pill if seller/buyer
    const hasDeal = roles.includes('seller') || roles.includes('buyer');
    const stg = hasDeal ? (CLIENT_STAGE_LABELS[c.stage || 'new'] || CLIENT_STAGE_LABELS.new) : null;
    const stageHtml = stg
      ? `<span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:10px;font-size:0.68rem;font-weight:600;background:${stg.bg};color:${stg.color};">${stg.icon} ${esc(stg.label)}</span>`
      : '<span style="font-size:0.7rem;color:var(--text-light);">—</span>';
    return `<tr>
      <td style="text-align:left;padding-left:1rem;font-weight:600;color:#0B2A3C;">
        ${esc(c.name)}${c.company ? '<br><span style="font-weight:400;font-size:0.75rem;color:var(--text-light);">' + esc(c.company) + '</span>' : ''}
      </td>
      <td style="text-align:left;">${c.phone ? '<a href="tel:' + esc(c.phone) + '" style="color:#1A7A8A;text-decoration:none;">' + esc(c.phone) + '</a>' : '-'}</td>
      <td style="text-align:left;">${c.email ? '<a href="mailto:' + esc(c.email) + '" style="color:#1A7A8A;text-decoration:none;">' + esc(c.email) + '</a>' : '-'}</td>
      <td style="text-align:left;">${roleChips}</td>
      <td style="text-align:left;">${stageHtml}</td>
      <td style="text-align:left;"><span style="display:inline-block;padding:0.2rem 0.55rem;border-radius:12px;font-size:0.72rem;font-weight:600;background:${st.bg};color:${st.color};">${esc(st.label)}</span></td>
      <td style="text-align:center;">${amlBadge}</td>
      <td style="text-align:left;font-size:0.8rem;color:var(--text-light);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(c.note || '')}">${esc(note)}</td>
      <td style="text-align:center;">
        <button onclick="openContactForm('${c.id}')" style="background:none;border:none;cursor:pointer;color:#1A7A8A;padding:4px;" title="Upraviť"><i data-lucide="pencil" style="width:15px;height:15px;"></i></button>
        <button onclick="deleteContact('${c.id}')" style="background:none;border:none;cursor:pointer;color:#E8734A;padding:4px;" title="Odstrániť"><i data-lucide="trash-2" style="width:15px;height:15px;"></i></button>
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function exportContactsCSV() {
  const contacts = getContacts();
  if (contacts.length === 0) { secAlert('Žiadne kontakty na export.'); return; }
  const headers = ['Meno','Telefón','E-mail','Firma','Kategória','Status','Adresa','Poznámka','Vytvorený'];
  const rows = contacts.map(c => [
    c.name, c.phone, c.email, c.company,
    CONTACT_CATEGORY_LABELS[c.category] || c.category,
    (CONTACT_STATUS_LABELS[c.status] || {}).label || c.status,
    c.address, c.note,
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('sk-SK') : ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => '"' + (v || '').replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kontakty_secpro_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Init contacts on page load
document.addEventListener('DOMContentLoaded', () => { renderContacts(); });

// ===== AUTH SYSTEM (Server-side with Upstash Redis) =====
const AUTH_TOKEN_KEY = 'secpro_auth_token';
const AUTH_USER_KEY = 'secpro_auth_user';

function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || null;
}
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY))
      || JSON.parse(sessionStorage.getItem(AUTH_USER_KEY));
  } catch { return null; }
}
function saveAuthLocal(token, user, remember) {
  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}
function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem('secpro_session');
  sessionStorage.removeItem('secpro_session');
  // Clear data cache on logout
  Object.keys(_dataCache).forEach(k => delete _dataCache[k]);
  _dataSynced = false;
}

// ===== DATA CACHE & SERVER SYNC =====
const _dataCache = {};
let _dataSynced = false;

const _LS_MAP = {
  properties: 'secpro_properties',
  contacts: 'secpro_contacts',
  clients: 'secpro_clients',
  profile: 'secpro_profile',
  signatures: 'secpro_signatures',
  saved_leads: 'secpro_saved_leads',
  aml: 'secpro_aml',
  history: 'finio-history',
  ai_settings: 'secpro_ai_settings',
  sample_ads: 'secpro_sample_ads',
  lead_statuses: 'secpro_lead_statuses',
};

function _getCached(collection, defaultVal) {
  if (_dataCache[collection] !== undefined) return _dataCache[collection];
  const lsKey = _LS_MAP[collection];
  if (!lsKey) return defaultVal;
  try {
    const raw = localStorage.getItem(lsKey);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch { return defaultVal; }
}

function _setCached(collection, data) {
  _dataCache[collection] = data;
  const lsKey = _LS_MAP[collection];
  if (lsKey) {
    try { localStorage.setItem(lsKey, JSON.stringify(data)); }
    catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[SecPro] localStorage full for', collection);
      }
    }
  }
  _saveToServer(collection, data);
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'error') {
  const colors = { error: '#EF4444', warning: '#F59E0B', success: '#22C55E' };
  const accent = colors[type] || colors.error;
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: 1.25rem; right: 1.25rem; z-index: 100000;
    background: #1E293B; color: #F8FAFC; padding: 0.85rem 1.25rem;
    border-radius: 0.625rem; font-family: 'Inter', sans-serif; font-size: 0.875rem;
    font-weight: 500; box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    border-left: 4px solid ${accent}; max-width: 380px;
    opacity: 0; transform: translateX(20px); transition: all 0.3s ease;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ===== CUSTOM CONFIRM DIALOG =====
// Replaces native confirm() with SecPro branded modal.
// Usage: const ok = await secConfirm('Message');
//        const ok = await secConfirm({ title: 'Title', message: 'Msg', type: 'danger', ok: 'Vymazať' });
function secConfirm(opts) {
  if (typeof opts === 'string') opts = { message: opts };
  const type = opts.type || 'info'; // info, danger, warning
  const title = opts.title || (type === 'danger' ? 'Potvrdenie' : type === 'warning' ? 'Upozornenie' : 'Potvrdenie');
  const message = opts.message || '';
  const okText = opts.ok || (type === 'danger' ? 'Odstrániť' : 'Potvrdiť');
  const cancelText = opts.cancel || 'Zrušiť';

  // SVG icons per type
  const icons = {
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    danger: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  return new Promise(function(resolve) {
    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'sec-confirm-overlay';
    overlay.innerHTML =
      '<div class="sec-confirm-box">' +
        '<div class="sec-confirm-header sec-type-' + type + '">' +
          '<div class="sec-confirm-icon">' + (icons[type] || icons.info) + '</div>' +
          '<div class="sec-confirm-title">' + title + '</div>' +
        '</div>' +
        '<div class="sec-confirm-body">' +
          '<div class="sec-confirm-message">' + message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '</div>' +
        '<div class="sec-confirm-footer">' +
          '<button class="sec-confirm-btn sec-confirm-cancel">' + cancelText + '</button>' +
          '<button class="sec-confirm-btn sec-confirm-ok sec-btn-' + type + '">' + okText + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() { overlay.classList.add('sec-confirm-visible'); });

    // Focus OK button
    var okBtn = overlay.querySelector('.sec-confirm-ok');
    var cancelBtn = overlay.querySelector('.sec-confirm-cancel');
    setTimeout(function() { okBtn.focus(); }, 100);

    function close(result) {
      overlay.classList.remove('sec-confirm-visible');
      setTimeout(function() { overlay.remove(); }, 300);
      resolve(result);
    }

    okBtn.addEventListener('click', function() { close(true); });
    cancelBtn.addEventListener('click', function() { close(false); });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close(false);
    });
    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
      if (e.key === 'Enter') { document.removeEventListener('keydown', onKey); close(true); }
    }
    document.addEventListener('keydown', onKey);
  });
}

// ===== CUSTOM ALERT DIALOG =====
// Replaces native alert() with SecPro branded modal (single OK button).
// Usage: secAlert('Message');  or  secAlert({ title: 'Chyba', message: 'Msg', type: 'warning' });
function secAlert(opts) {
  if (typeof opts === 'string') opts = { message: opts };
  const type = opts.type || 'info';
  const title = opts.title || (type === 'danger' ? 'Chyba' : type === 'warning' ? 'Upozornenie' : 'Informácia');
  const message = opts.message || '';
  const okText = opts.ok || 'OK';

  const icons = {
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    danger: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'sec-confirm-overlay';
    overlay.innerHTML =
      '<div class="sec-confirm-box">' +
        '<div class="sec-confirm-header sec-type-' + type + '">' +
          '<div class="sec-confirm-icon">' + (icons[type] || icons.info) + '</div>' +
          '<div class="sec-confirm-title">' + title + '</div>' +
        '</div>' +
        '<div class="sec-confirm-body">' +
          '<div class="sec-confirm-message">' + message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
        '</div>' +
        '<div class="sec-confirm-footer">' +
          '<button class="sec-confirm-btn sec-confirm-ok sec-btn-' + type + '">' + okText + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('sec-confirm-visible'); });

    var okBtn = overlay.querySelector('.sec-confirm-ok');
    setTimeout(function() { okBtn.focus(); }, 100);

    function close() {
      overlay.classList.remove('sec-confirm-visible');
      setTimeout(function() { overlay.remove(); }, 300);
      resolve(true);
    }

    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { document.removeEventListener('keydown', onKey); close(); }
    }
    document.addEventListener('keydown', onKey);
  });
}

// ===== SECURE FETCH WRAPPER (401 detection) =====
let _redirectingToLogin = false;

async function secureFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401 && !_redirectingToLogin) {
    _redirectingToLogin = true;
    clearSession();
    document.getElementById('loginOverlay').classList.remove('hidden');
    showToast('Relácia vypršala. Prihláste sa znova.', 'warning');
    setTimeout(() => { _redirectingToLogin = false; }, 3000);
  }
  return res;
}

let _saveQueue = {};
let _saveTimer = null;

function _saveToServer(collection, data) {
  _saveQueue[collection] = data;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSaves, 500);
}

async function _flushSaves() {
  const queue = _saveQueue;
  _saveQueue = {};
  _saveTimer = null;
  const token = getStoredToken();
  if (!token) return;
  for (const [collection, data] of Object.entries(queue)) {
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await secureFetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ action: 'set', collection, data }),
        });
        if (res.status === 401) { success = true; break; } // handled by secureFetch
        if (res.ok) { success = true; break; }
      } catch (err) {
        console.warn('[SecPro] Server save attempt', attempt + 1, 'failed:', collection, err.message);
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
    if (!success) {
      showToast('Ukladanie zlyhalo. Dáta sú uložené lokálne.', 'warning');
    }
  }
}

async function loadAllData() {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await secureFetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ action: 'get-all' }),
    });
    if (!res.ok) return false;
    const result = await res.json();
    if (result.data) {
      for (const [col, val] of Object.entries(result.data)) {
        if (val !== null && val !== undefined) {
          _dataCache[col] = val;
          const lsKey = _LS_MAP[col];
          if (lsKey) {
            try { localStorage.setItem(lsKey, JSON.stringify(val)); } catch {}
          }
        }
      }
    }
    _dataSynced = true;
    return true;
  } catch (err) {
    console.warn('[SecPro] Failed to load data:', err.message);
    return false;
  }
}

async function migrateLocalData() {
  const token = getStoredToken();
  if (!token) return;

  const collections = {};
  let hasData = false;
  for (const [col, lsKey] of Object.entries(_LS_MAP)) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0)) {
          collections[col] = parsed;
          hasData = true;
        }
      }
    } catch {}
  }

  if (!hasData) return;

  try {
    const res = await secureFetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ action: 'migrate', collections }),
    });
    if (res.ok) console.log('[SecPro] Local data migrated to server');
  } catch (err) {
    console.warn('[SecPro] Migration failed:', err.message);
  }
}

function _reRenderAll() {
  try { renderDashboard(); } catch {}
  try { renderProperties(); } catch {}
  try { renderContacts(); } catch {}
  try { renderAmlList(); } catch {}
  try { updateNavLeadCount(); } catch {}
}

// Validate session token against server
async function validateSession() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'session', token }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const data = await res.json();
    return data.user || null;
  } catch {
    // Offline fallback — trust local cache
    return getStoredUser();
  }
}

function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
  if (tab === 'login') {
    document.querySelectorAll('.login-tab')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else if (tab === 'register') {
    document.querySelectorAll('.login-tab')[1].classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  } else if (tab === 'forgot') {
    document.getElementById('forgotForm').classList.add('active');
  } else if (tab === 'forgotVerify') {
    document.getElementById('forgotVerifyForm').classList.add('active');
  }
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginSuccess').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('loginSuccess').style.display = 'none';
}

function showLoginSuccess(msg) {
  const el = document.getElementById('loginSuccess');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('loginError').style.display = 'none';
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pass = document.getElementById('regPassword').value;
  const pass2 = document.getElementById('regPassword2').value;

  if (pass !== pass2) { showLoginError('Heslá sa nezhodujú.'); return; }
  if (pass.length < 6) { showLoginError('Heslo musí mať aspoň 6 znakov.'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrujem...'; }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', name, email, password: pass }),
    });
    const data = await res.json();

    if (!res.ok) {
      showLoginError(data.error || 'Registrácia zlyhala.');
      return;
    }

    document.getElementById('registerForm').reset();
    showLoginSuccess(data.message || 'Ak účet neexistoval, bol vytvorený. Prihláste sa.');
    setTimeout(() => switchLoginTab('login'), 2000);
  } catch (err) {
    showLoginError('Chyba pripojenia k serveru.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrovať sa'; }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;
  const remember = document.getElementById('rememberMe').checked;

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Prihlasujem...'; }

  try {
    // Retrieve stored userRecord for this email
    const records = JSON.parse(localStorage.getItem('secpro_user_records') || '{}');
    const userRecord = records[email] || null;

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password: pass, userRecord }),
    });
    const data = await res.json();

    if (!res.ok) {
      showLoginError(data.error || 'Prihlásenie zlyhalo.');
      return;
    }

    saveAuthLocal(data.token, data.user, remember);
    enterApp(data.user, true);
    // Migrate local data then load server data
    await migrateLocalData();
    await loadAllData();
    _reRenderAll();
  } catch (err) {
    showLoginError('Chyba pripojenia k serveru.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Prihlásiť sa'; }
  }
}

let resetToken = null;
let resetEmail = null;

async function handleForgotSendCode(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  const btn = document.getElementById('forgotSendBtn');

  btn.textContent = 'Odosielam...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-reset-code', email }),
    });
    const data = await res.json();

    if (!res.ok) {
      showLoginError((data.error || 'Nepodarilo sa odoslať kód.') + (data.detail ? ' (' + data.detail + ')' : ''));
      btn.textContent = 'Odoslať kód';
      btn.disabled = false;
      return;
    }

    resetToken = data.token;
    resetEmail = email;
    showLoginSuccess('Kód bol odoslaný na ' + email);
    setTimeout(() => switchLoginTab('forgotVerify'), 1000);
  } catch (err) {
    showLoginError('Chyba pripojenia k serveru.');
  }
  btn.textContent = 'Odoslať kód';
  btn.disabled = false;
}

async function handleForgotVerify(e) {
  e.preventDefault();
  const code = document.getElementById('forgotCode').value.trim();
  const pass = document.getElementById('forgotPassword').value;
  const pass2 = document.getElementById('forgotPassword2').value;

  if (pass !== pass2) { showLoginError('Heslá sa nezhodujú.'); return; }
  if (pass.length < 6) { showLoginError('Heslo musí mať aspoň 6 znakov.'); return; }
  if (!resetToken) { showLoginError('Najprv si vyžiadajte kód.'); return; }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify-reset-code', token: resetToken, code, newPassword: pass }),
    });
    const data = await res.json();

    if (!res.ok) {
      showLoginError(data.error || 'Overenie zlyhalo.');
      return;
    }

    resetToken = null;
    resetEmail = null;
    document.getElementById('forgotVerifyForm').reset();
    showLoginSuccess('Heslo bolo zmenené! Teraz sa môžete prihlásiť.');
    setTimeout(() => switchLoginTab('login'), 1500);
  } catch (err) {
    showLoginError('Chyba pripojenia k serveru.');
  }
}

function handleLogout() {
  const token = getStoredToken();
  // Invalidate server session (fire-and-forget)
  if (token) {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', token }),
    }).catch(() => {});
  }
  clearSession();
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginSuccess').style.display = 'none';
}

function enterApp(user, skipDataLoad) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerUserName').textContent = user.name;
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('headerUserAvatar').textContent = initials;
  if (!skipDataLoad && !_dataSynced) {
    migrateLocalData().then(() => loadAllData()).then(() => { _reRenderAll(); applyProfileToHeader(); });
  } else {
    applyProfileToHeader();
  }
}

// ==================== USER PROFILE ====================
function getProfile() { return _getCached('profile', {}) || {}; }
function saveProfileData(p) { _setCached('profile', p); }

function applyProfileToHeader() {
  const p = getProfile();
  const nameEl = document.getElementById('headerUserName');
  const avEl = document.getElementById('headerUserAvatar');
  if (!nameEl || !avEl) return;
  const displayName = (p.name && p.name.trim()) || (nameEl.textContent || '').trim() || 'Používateľ';
  nameEl.textContent = displayName;
  if (p.avatar) {
    avEl.textContent = '';
    avEl.style.backgroundImage = `url('${p.avatar}')`;
  } else {
    avEl.style.backgroundImage = '';
    const initials = displayName.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
    avEl.textContent = initials || '?';
  }
}

let _profileAvatarTemp = null;

function openProfileModal() {
  const p = getProfile();
  const storedUser = (typeof getStoredUser === 'function') ? (getStoredUser() || {}) : {};
  _profileAvatarTemp = p.avatar || null;
  document.getElementById('profile-name').value = p.name || storedUser.name || '';
  document.getElementById('profile-title').value = p.title || 'Realitný maklér';
  document.getElementById('profile-bio').value = p.bio || '';
  document.getElementById('profile-phone').value = p.phone || '';
  document.getElementById('profile-phone-office').value = p.phoneOffice || '';
  document.getElementById('profile-email').value = p.email || storedUser.email || '';
  document.getElementById('profile-website').value = p.website || '';
  document.getElementById('profile-company').value = p.company || '';
  document.getElementById('profile-ico').value = p.ico || '';
  document.getElementById('profile-dic').value = p.dic || '';
  document.getElementById('profile-address').value = p.address || '';
  document.getElementById('profile-license').value = p.license || '';
  document.getElementById('profile-experience').value = p.experience || '';
  document.getElementById('profile-languages').value = p.languages || '';
  document.getElementById('profile-region').value = p.region || '';
  document.getElementById('profile-linkedin').value = p.linkedin || '';
  document.getElementById('profile-facebook').value = p.facebook || '';
  document.getElementById('profile-instagram').value = p.instagram || '';
  const specs = Array.isArray(p.specializations) ? p.specializations : [];
  document.querySelectorAll('#profile-specializations input[type="checkbox"]').forEach(cb => {
    cb.checked = specs.includes(cb.value);
  });
  _refreshProfileAvatarPreview();
  _refreshProfileSignaturePreview();
  document.getElementById('profile-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

let _profileSignatureTemp = null;
function _refreshProfileSignaturePreview() {
  const box = document.getElementById('profile-sig-box');
  const removeBtn = document.getElementById('profile-sig-remove');
  if (!box) return;
  const profile = getProfile();
  const sig = _profileSignatureTemp !== null ? _profileSignatureTemp : (profile.signature || '');
  if (sig) {
    box.innerHTML = `<img src="${sig}" alt="Podpis" />`;
    if (removeBtn) removeBtn.style.display = '';
  } else {
    box.innerHTML = '<div class="profile-sig-empty">Zatiaľ nemáte uložený podpis. Po nakreslení sa bude automaticky používať v dokumentoch, AML a náborovom liste.</div>';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function openProfileSignaturePad() {
  const name = document.getElementById('profile-name').value.trim() || 'Maklér';
  openSignaturePad({
    title: 'Môj podpis do profilu',
    subtitle: 'Tento podpis sa použije v dokumentoch, AML a náborovom liste',
    signerName: name,
    signerRole: 'Maklér',
    documentType: 'profile',
    documentRef: 'Profilový podpis',
    allowSaveToProfile: false,
    allowUseStored: false,
    onConfirm: (dataUrl) => {
      _profileSignatureTemp = dataUrl;
      _refreshProfileSignaturePreview();
      // Also persist immediately so it's available right away in other modals
      const prof = getProfile();
      prof.signature = dataUrl;
      prof.updatedAt = new Date().toISOString();
      saveProfileData(prof);
    }
  });
}

function removeProfileSignature() {
  _profileSignatureTemp = '';
  _refreshProfileSignaturePreview();
  const prof = getProfile();
  delete prof.signature;
  prof.updatedAt = new Date().toISOString();
  saveProfileData(prof);
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
  document.body.style.overflow = '';
  _profileAvatarTemp = null;
  _profileSignatureTemp = null;
}

function _refreshProfileAvatarPreview() {
  const prev = document.getElementById('profile-avatar-preview');
  const removeBtn = document.getElementById('profile-avatar-remove');
  const nameInput = document.getElementById('profile-name');
  const titleInput = document.getElementById('profile-title');
  const headerName = document.getElementById('profile-header-name');
  const headerTitle = document.getElementById('profile-header-title');
  const name = (nameInput && nameInput.value.trim()) || 'Nový používateľ';
  headerName.textContent = name;
  headerTitle.textContent = (titleInput && titleInput.value.trim()) || 'Realitný maklér';
  if (_profileAvatarTemp) {
    prev.style.backgroundImage = `url('${_profileAvatarTemp}')`;
    prev.style.backgroundSize = 'cover';
    prev.style.backgroundPosition = 'center';
    prev.textContent = '';
    if (removeBtn) removeBtn.style.display = 'inline';
  } else {
    prev.style.backgroundImage = '';
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
    prev.textContent = initials || '?';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function handleProfileAvatarUpload(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  try {
    const dataUrl = (typeof compressImage === 'function')
      ? await compressImage(file, 400, 400, 0.85)
      : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    _profileAvatarTemp = dataUrl;
    _refreshProfileAvatarPreview();
  } catch (e) {
    console.error('Avatar upload failed', e);
    if (typeof showToast === 'function') showToast('Nepodarilo sa načítať fotku', 'error');
  }
  ev.target.value = '';
}

function removeProfileAvatar() {
  _profileAvatarTemp = null;
  _refreshProfileAvatarPreview();
}

function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  if (!name) {
    if (typeof showToast === 'function') showToast('Zadajte celé meno', 'error');
    else alert('Zadajte celé meno');
    return;
  }
  const specs = Array.from(document.querySelectorAll('#profile-specializations input[type="checkbox"]:checked')).map(cb => cb.value);
  const profile = {
    name,
    title: document.getElementById('profile-title').value.trim(),
    bio: document.getElementById('profile-bio').value.trim(),
    phone: document.getElementById('profile-phone').value.trim(),
    phoneOffice: document.getElementById('profile-phone-office').value.trim(),
    email: document.getElementById('profile-email').value.trim(),
    website: document.getElementById('profile-website').value.trim(),
    company: document.getElementById('profile-company').value.trim(),
    ico: document.getElementById('profile-ico').value.trim(),
    dic: document.getElementById('profile-dic').value.trim(),
    address: document.getElementById('profile-address').value.trim(),
    license: document.getElementById('profile-license').value.trim(),
    experience: document.getElementById('profile-experience').value.trim(),
    languages: document.getElementById('profile-languages').value.trim(),
    region: document.getElementById('profile-region').value.trim(),
    linkedin: document.getElementById('profile-linkedin').value.trim(),
    facebook: document.getElementById('profile-facebook').value.trim(),
    instagram: document.getElementById('profile-instagram').value.trim(),
    specializations: specs,
    avatar: _profileAvatarTemp || null,
    signature: (_profileSignatureTemp !== null && _profileSignatureTemp !== '') ? _profileSignatureTemp : (getProfile().signature || null),
    updatedAt: new Date().toISOString(),
  };
  if (_profileSignatureTemp === '') delete profile.signature;
  saveProfileData(profile);
  applyProfileToHeader();
  closeProfileModal();
  if (typeof showToast === 'function') showToast('Profil uložený', 'success');
}

// Live-update header preview as user types
document.addEventListener('input', (e) => {
  if (e.target && (e.target.id === 'profile-name' || e.target.id === 'profile-title')) {
    _refreshProfileAvatarPreview();
  }
});

// ==================== AML ====================
const AML_KEY = 'secpro_aml';
function getAmlRecords() { return _getCached('aml', []); }
function saveAmlRecords(arr) { _setCached('aml', arr); }

const AML_STATUS_MAP = {
  pending:  { label: 'Čaká', color: '#64748B', bg: '#F1F5F9' },
  approved: { label: 'Schválený', color: '#16A34A', bg: '#F0FDF4' },
  flagged:  { label: 'Pozornosť', color: '#D97706', bg: '#FFF7ED' },
  rejected: { label: 'Zamietnutý', color: '#DC2626', bg: '#FEF2F2' }
};
const AML_RISK_MAP = {
  low:    { label: 'Nízke', color: '#16A34A' },
  medium: { label: 'Stredné', color: '#D97706' },
  high:   { label: 'Vysoké', color: '#DC2626' }
};
const AML_SOURCE_LABELS = {
  employment: 'Zamestnanie', business: 'Podnikanie', property: 'Predaj majetku',
  inheritance: 'Dedičstvo / Dar', savings: 'Úspory', loan: 'Úver / Hypotéka',
  investment: 'Investície', other: 'Iné'
};
const AML_DOC_LABELS = { op: 'Občiansky preukaz', pas: 'Cestovný pas', pobyt: 'Povolenie na pobyt' };
const AML_PURPOSE_LABELS = { buy: 'Kúpa nehnuteľnosti', sell: 'Predaj nehnuteľnosti', rent: 'Prenájom', other: 'Iné' };
const AML_BUY_PURPOSE_LABELS = { byvanie: 'Bývanie', investicia: 'Investícia', podnikanie: 'Podnikanie', ine: 'Iné' };
const AML_FINANCING_LABELS = { hypo: 'Hypotéka', vlastne: 'Vlastné prostriedky', hotovost: 'Hotovosť', uver: 'Úver', kombinacia: 'Kombinácia' };
const AML_REPRESENTATION_LABELS = { vlastne: 'Vo vlastnom mene', zastupenie: 'Na základe zastúpenia' };

function openAmlForm(editId) {
  document.getElementById('aml-edit-id').value = editId || '';
  document.getElementById('aml-modal-title').textContent = editId ? 'Upraviť AML preverenie' : 'Nové AML preverenie';
  // Populate contacts dropdown
  const sel = document.getElementById('aml-contact-id');
  const contacts = getContacts();
  sel.innerHTML = '<option value="">-- Bez prepojenia --</option>' +
    contacts.map(c => '<option value="' + c.id + '">' + esc(c.name) + (c.phone ? ' (' + esc(c.phone) + ')' : '') + '</option>').join('');

  if (editId) {
    const r = getAmlRecords().find(x => x.id === editId);
    if (r) {
      sel.value = r.contactId || '';
      document.querySelector('input[name="aml-client-type"][value="' + r.clientType + '"]').checked = true;
      amlToggleClientType();
      if (r.clientType === 'fo') {
        document.getElementById('aml-fo-firstname').value = r.firstName || '';
        document.getElementById('aml-fo-lastname').value = r.lastName || '';
        document.getElementById('aml-fo-birthnum').value = r.birthNumber || '';
        document.getElementById('aml-fo-dob').value = r.dateOfBirth || '';
        document.getElementById('aml-fo-nationality').value = r.nationality || 'Slovenská republika';
        document.getElementById('aml-fo-address').value = r.permanentAddress || '';
        document.getElementById('aml-fo-doctype').value = r.idDocType || 'op';
        document.getElementById('aml-fo-docnum').value = r.idDocNumber || '';
        document.getElementById('aml-fo-docexpiry').value = r.idDocExpiry || '';
      } else {
        document.getElementById('aml-po-name').value = r.companyName || '';
        document.getElementById('aml-po-ico').value = r.ico || '';
        document.getElementById('aml-po-form').value = r.legalForm || 'sro';
        document.getElementById('aml-po-address').value = r.registeredOffice || '';
        document.getElementById('aml-po-statname').value = r.statutoryRepName || '';
        document.getElementById('aml-po-statdoc').value = r.statutoryRepDoc || '';
        document.getElementById('aml-po-uboname').value = r.uboName || '';
        document.getElementById('aml-po-ubopct').value = r.uboOwnershipPct || '';
        document.getElementById('aml-po-ubobirth').value = r.uboBirthNumber || '';
        document.getElementById('aml-po-uboaddr').value = r.uboAddress || '';
      }
      const pepVal = r.pepStatus || 'no';
      document.querySelector('input[name="aml-pep"][value="' + pepVal + '"]').checked = true;
      amlTogglePep();
      document.getElementById('aml-pep-note').value = r.pepDetails || '';
      // Sources
      document.querySelectorAll('#aml-source-grid .aml-source-chip').forEach(c => {
        c.classList.toggle('selected', (r.sourceOfFunds || []).includes(c.dataset.val));
      });
      document.getElementById('aml-source-detail').value = r.sourceOfFundsDetail || '';
      // Register verification
      document.getElementById('aml-sanctions-result').value = r.sanctionsResult || 'pending';
      document.getElementById('aml-sanctions-date').value = r.sanctionsDate || '';
      document.getElementById('aml-register-result').value = r.registerResult || 'pending';
      document.getElementById('aml-register-date').value = r.registerDate || '';
      document.getElementById('aml-register-note').value = r.registerNote || '';
      // Transaction
      document.getElementById('aml-tx-purpose').value = r.transactionPurpose || 'buy';
      document.getElementById('aml-tx-buy-purpose').value = r.transactionBuyPurpose || 'byvanie';
      document.getElementById('aml-tx-financing').value = r.transactionFinancing || 'hypo';
      document.getElementById('aml-tx-representation').value = r.transactionRepresentation || 'vlastne';
      document.getElementById('aml-tx-cash50k').value = r.transactionCash50k || 'nie';
      document.getElementById('aml-tx-idcopy').value = r.transactionIdCopy || 'ano';
      document.getElementById('aml-tx-value').value = r.transactionValue || '';
      document.getElementById('aml-notes').value = r.notes || '';
      // Show existing doc names
      document.getElementById('aml-doc-id-preview').textContent = r.docIdName ? 'Uložené: ' + r.docIdName : '';
      document.getElementById('aml-doc-funds-preview').textContent = r.docFundsName ? 'Uložené: ' + r.docFundsName : '';
      document.getElementById('aml-doc-preview').innerHTML = (r.docsOtherNames || []).map(n =>
        '<div style="padding:4px 10px;background:#F1F5F9;border-radius:6px;font-size:0.75rem;color:var(--text-light);">' + esc(n) + '</div>'
      ).join('');
      _amlSigTemp = r.signature ? { dataUrl: r.signature.dataUrl, signerName: r.signature.signerName, signedAt: r.signature.signedAt, auditId: r.signature.auditId } : null;
    }
  } else {
    _amlSigTemp = null;
    // Reset form
    document.querySelector('input[name="aml-client-type"][value="fo"]').checked = true;
    amlToggleClientType();
    ['aml-fo-firstname','aml-fo-lastname','aml-fo-birthnum','aml-fo-dob','aml-fo-address','aml-fo-docnum','aml-fo-docexpiry',
     'aml-po-name','aml-po-ico','aml-po-address','aml-po-statname','aml-po-statdoc','aml-po-uboname','aml-po-ubopct','aml-po-ubobirth','aml-po-uboaddr',
     'aml-pep-note','aml-source-detail','aml-tx-value','aml-notes','aml-sanctions-date','aml-register-date','aml-register-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('aml-fo-nationality').value = 'Slovenská republika';
    document.getElementById('aml-fo-doctype').value = 'op';
    document.getElementById('aml-po-form').value = 'sro';
    document.getElementById('aml-tx-purpose').value = 'buy';
    document.getElementById('aml-tx-buy-purpose').value = 'byvanie';
    document.getElementById('aml-tx-financing').value = 'hypo';
    document.getElementById('aml-tx-representation').value = 'vlastne';
    document.getElementById('aml-tx-cash50k').value = 'nie';
    document.getElementById('aml-tx-idcopy').value = 'ano';
    document.getElementById('aml-sanctions-result').value = 'pending';
    document.getElementById('aml-register-result').value = 'pending';
    document.querySelector('input[name="aml-pep"][value="no"]').checked = true;
    amlTogglePep();
    document.querySelectorAll('#aml-source-grid .aml-source-chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('aml-doc-preview').innerHTML = '';
    document.getElementById('aml-doc-id-preview').textContent = '';
    document.getElementById('aml-doc-funds-preview').textContent = '';
  }
  // Always reset auto-check UI when opening form
  document.getElementById('aml-check-status').style.display = 'none';
  document.getElementById('aml-check-status').innerHTML = '';
  document.getElementById('aml-check-matches').style.display = 'none';
  document.getElementById('aml-check-matches').innerHTML = '';
  _refreshAmlSignaturePreview();
  document.getElementById('aml-modal').style.display = 'block';
}
function closeAmlForm() {
  document.getElementById('aml-modal').style.display = 'none';
  _amlSigTemp = null;
}

// ----- AML signature helpers -----
let _amlSigTemp = null; // { dataUrl, signerName, signedAt }
function _refreshAmlSignaturePreview() {
  const box = document.getElementById('aml-sig-preview');
  const meta = document.getElementById('aml-sig-meta');
  const clearBtn = document.getElementById('aml-sig-clear');
  if (!box) return;
  if (_amlSigTemp && _amlSigTemp.dataUrl) {
    box.innerHTML = `<img src="${_amlSigTemp.dataUrl}" style="max-width:280px;max-height:100px;object-fit:contain;background:#fff;border-radius:6px;border:1px solid var(--border);padding:4px;" />`;
    meta.style.display = 'block';
    meta.textContent = `Podpísal: ${_amlSigTemp.signerName} · ${new Date(_amlSigTemp.signedAt).toLocaleString('sk-SK')}`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    box.innerHTML = '<span style="color:var(--text-light);font-size:0.82rem;">Zatiaľ bez podpisu preverovanej osoby</span>';
    meta.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function openAmlSignature() {
  const clientType = document.querySelector('input[name="aml-client-type"]:checked').value;
  const name = clientType === 'fo'
    ? ((document.getElementById('aml-fo-firstname').value.trim() + ' ' + document.getElementById('aml-fo-lastname').value.trim()).trim())
    : document.getElementById('aml-po-statname').value.trim() || document.getElementById('aml-po-name').value.trim();
  const editId = document.getElementById('aml-edit-id').value || ('aml-draft-' + Date.now());
  openSignaturePad({
    title: 'Podpis preverovanej osoby (AML)',
    subtitle: 'Podpisom potvrdzujete správnosť poskytnutých údajov',
    signerName: name,
    signerRole: 'Preverovaná osoba',
    documentType: 'aml',
    documentId: editId,
    docRef: 'AML preverenie – ' + (name || 'bez mena'),
    docPayload: JSON.stringify({
      name,
      clientType,
      sources: Array.from(document.querySelectorAll('#aml-source-grid .aml-source-chip.selected')).map(c => c.dataset.val),
      pep: document.querySelector('input[name="aml-pep"]:checked').value,
    }),
    allowUseStored: false, // signer is client, not agent
    onConfirm: (dataUrl, entry) => {
      _amlSigTemp = { dataUrl, signerName: entry.signerName, signedAt: entry.signedAt, auditId: entry.id };
      _refreshAmlSignaturePreview();
    }
  });
}

function clearAmlSignature() {
  _amlSigTemp = null;
  _refreshAmlSignaturePreview();
}

function amlToggleClientType() {
  const isFo = document.querySelector('input[name="aml-client-type"]:checked').value === 'fo';
  document.getElementById('aml-fo-fields').style.display = isFo ? '' : 'none';
  document.getElementById('aml-po-fields').style.display = isFo ? 'none' : '';
  document.getElementById('aml-type-fo-label').style.borderColor = isFo ? 'var(--primary-light)' : 'var(--border)';
  document.getElementById('aml-type-po-label').style.borderColor = isFo ? 'var(--border)' : 'var(--primary-light)';
}
function amlTogglePep() {
  const v = document.querySelector('input[name="aml-pep"]:checked').value;
  document.getElementById('aml-pep-detail').style.display = v === 'no' ? 'none' : '';
}
function amlToggleSource(el) { el.classList.toggle('selected'); }
function amlPrefillFromContact() {
  const cid = document.getElementById('aml-contact-id').value;
  if (!cid) return;
  const c = getContacts().find(x => x.id === cid);
  if (!c) return;
  const nameParts = (c.name || '').split(' ');
  document.getElementById('aml-fo-firstname').value = nameParts[0] || '';
  document.getElementById('aml-fo-lastname').value = nameParts.slice(1).join(' ') || '';
  if (c.phone) document.getElementById('aml-fo-address').value = document.getElementById('aml-fo-address').value || (c.address || '');
}
function amlPreviewDocs() {
  const files = document.getElementById('aml-docs').files;
  const preview = document.getElementById('aml-doc-preview');
  preview.innerHTML = '';
  Array.from(files).forEach(f => {
    preview.innerHTML += '<div style="padding:4px 10px;background:#F1F5F9;border-radius:6px;font-size:0.75rem;color:var(--text-light);">' + esc(f.name) + '</div>';
  });
}
async function amlAutoCheck() {
  // Determine client name from form
  const isFo = document.querySelector('input[name="aml-client-type"]:checked').value === 'fo';
  let name, birthDate;
  if (isFo) {
    const fn = document.getElementById('aml-fo-firstname').value.trim();
    const ln = document.getElementById('aml-fo-lastname').value.trim();
    name = (fn + ' ' + ln).trim();
    birthDate = document.getElementById('aml-fo-dob').value;
  } else {
    name = document.getElementById('aml-po-name').value.trim();
  }

  if (!name || name.length < 2) {
    secAlert('Najprv vyplňte meno klienta.');
    return;
  }

  const statusEl = document.getElementById('aml-check-status');
  const matchesEl = document.getElementById('aml-check-matches');
  const btn = document.getElementById('aml-auto-check-btn');

  // Loading state
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span> Overujem...';
  statusEl.style.display = 'block';
  statusEl.className = 'aml-check-loading';
  statusEl.innerHTML = 'Prebieha automatické overenie v sankčných zoznamoch a PEP databázach pre: <strong>' + esc(name) + '</strong>...';
  matchesEl.style.display = 'none';
  matchesEl.innerHTML = '';

  try {
    const resp = await fetch('/api/aml-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthDate, nationality: isFo ? document.getElementById('aml-fo-nationality').value : '' })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + resp.status);
    }

    const data = await resp.json();
    const today = new Date().toISOString().slice(0, 10);

    // Fill sanctions result
    document.getElementById('aml-sanctions-result').value = data.sanctions.status === 'review' ? 'review' : data.sanctions.status;
    document.getElementById('aml-sanctions-date').value = today;

    // Fill PEP result
    document.getElementById('aml-register-result').value = data.pep.status === 'review' ? 'review' : data.pep.status;
    document.getElementById('aml-register-date').value = today;

    // Build note
    const note = 'Automatické overenie ' + today + ' cez ' + data.source +
      ' | Sankcie: ' + data.sanctions.status.toUpperCase() + ' (' + data.sanctions.total + ' výsl.)' +
      ' | PEP: ' + data.pep.status.toUpperCase() + ' (' + data.pep.total + ' výsl.)';
    document.getElementById('aml-register-note').value = note;

    // Store autocheck data on existing record if editing
    const editId = document.getElementById('aml-edit-id').value;
    if (editId) {
      const recs = getAmlRecords();
      const ri = recs.findIndex(x => x.id === editId);
      if (ri >= 0) {
        recs[ri].autoCheckData = data;
        recs[ri].sanctionsResult = data.sanctions.status;
        recs[ri].sanctionsDate = today;
        recs[ri].registerResult = data.pep.status;
        recs[ri].registerDate = today;
        recs[ri].registerNote = note;
        saveAmlRecords(recs);
      }
    }

    // Show overall status
    const overallStatus = (data.sanctions.status === 'hit' || data.pep.status === 'hit') ? 'hit'
      : (data.sanctions.status === 'review' || data.pep.status === 'review') ? 'review' : 'clear';

    const statusMessages = {
      clear: '<strong>Bez nálezu</strong> — Klient nebol nájdený v žiadnom sankčnom zozname ani PEP databáze.',
      review: '<strong>Na posúdenie</strong> — Boli nájdené možné zhody. Skontrolujte nižšie a rozhodnite manuálne.',
      hit: '<strong>ZHODA NÁJDENÁ</strong> — Klient má zhodu v sankčných zoznamoch alebo PEP databáze. Vyžaduje sa zvýšená starostlivosť!'
    };
    statusEl.className = 'aml-check-' + overallStatus;
    statusEl.innerHTML = statusMessages[overallStatus] +
      '<div style="margin-top:0.35rem;font-size:0.72rem;opacity:0.8;">Zdroj: ' + esc(data.source) + ' | Dopyt: "' + esc(data.query) + '" | ' + today + '</div>';

    // Show matches if any
    const allMatches = [
      ...data.sanctions.matches.map(m => ({ ...m, type: 'Sankcie' })),
      ...data.pep.matches.map(m => ({ ...m, type: 'PEP' }))
    ];

    if (allMatches.length > 0) {
      matchesEl.style.display = 'block';
      matchesEl.innerHTML = '<div style="font-size:0.78rem;font-weight:700;color:var(--primary-dark);margin-bottom:0.5rem;">Nájdené záznamy (' + allMatches.length + '):</div>' +
        allMatches.map(m => {
          const scoreColor = m.score >= 0.85 ? '#EF4444' : m.score >= 0.6 ? '#F59E0B' : '#64748B';
          const scorePct = Math.round(m.score * 100);
          return '<div class="aml-match-card">' +
            '<div class="aml-match-card-header">' +
              '<span class="aml-match-name">' + esc(m.name) + '</span>' +
              '<span class="aml-match-score" style="color:' + scoreColor + ';">' + scorePct + '% zhoda | ' + esc(m.type) + '</span>' +
            '</div>' +
            '<div class="aml-match-meta">' +
              (m.datasets ? 'Zdroj: ' + esc(m.datasets) : '') +
              (m.countries ? ' | Krajina: ' + esc(m.countries) : '') +
              (m.position ? ' | Pozícia: ' + esc(m.position) : '') +
              (m.birthDates && m.birthDates.length ? ' | Nar.: ' + m.birthDates.join(', ') : '') +
            '</div>' +
          '</div>';
        }).join('');
    }

  } catch (err) {
    statusEl.className = 'aml-check-error';
    statusEl.innerHTML = '<strong>Chyba</strong> — ' + esc(err.message) + '. Skúste znova alebo vyplňte manuálne.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="shield-check" style="width:16px;height:16px;"></i> Automaticky overiť klienta';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function amlPreviewDocCategory(cat) {
  const input = document.getElementById('aml-doc-' + cat);
  const preview = document.getElementById('aml-doc-' + cat + '-preview');
  if (input.files[0]) {
    preview.textContent = 'Vybrané: ' + input.files[0].name;
    preview.style.color = '#1A7A8A';
  } else {
    preview.textContent = '';
  }
}

// --- Risk scoring ---
function amlCalcRisk(record) {
  let score = 0;
  const factors = [];

  // Client type
  if (record.clientType === 'po') { score += 2; factors.push({ f: 'Právnická osoba', s: 2 }); }
  else { score += 1; factors.push({ f: 'Fyzická osoba', s: 1 }); }

  // PEP
  if (record.pepStatus === 'yes') { score += 8; factors.push({ f: 'PEP - priamo', s: 8 }); }
  else if (record.pepStatus === 'family') { score += 5; factors.push({ f: 'PEP - rodinný príslušník', s: 5 }); }
  else if (record.pepStatus === 'associate') { score += 4; factors.push({ f: 'PEP - blízka osoba', s: 4 }); }
  else { factors.push({ f: 'PEP - nie', s: 0 }); }

  // Nationality
  const nat = (record.nationality || record.registeredOffice || '').toLowerCase();
  const highRiskCountries = ['irán', 'iran', 'severná kórea', 'north korea', 'mjanmarsko', 'myanmar', 'jemen', 'yemen', 'sýria', 'syria', 'afganistan', 'afghanistan'];
  if (highRiskCountries.some(c => nat.includes(c))) { score += 6; factors.push({ f: 'Vysokoriziková krajina', s: 6 }); }
  else if (!nat.includes('slovensk') && !nat.includes('česk') && nat.length > 2) { score += 2; factors.push({ f: 'Zahraničný klient', s: 2 }); }
  else { factors.push({ f: 'Tuzemský klient', s: 0 }); }

  // Transaction value
  const val = Number(record.transactionValue) || 0;
  if (val > 500000) { score += 4; factors.push({ f: 'Hodnota > 500 000 €', s: 4 }); }
  else if (val > 200000) { score += 2; factors.push({ f: 'Hodnota 200-500k €', s: 2 }); }
  else if (val > 0) { score += 1; factors.push({ f: 'Hodnota < 200 000 €', s: 1 }); }

  // Source of funds
  const src = record.sourceOfFunds || [];
  if (src.length === 0) { score += 3; factors.push({ f: 'Pôvod prostriedkov neuvedený', s: 3 }); }
  else if (src.includes('other') && src.length === 1) { score += 2; factors.push({ f: 'Pôvod prostriedkov - iné', s: 2 }); }
  else { factors.push({ f: 'Pôvod prostriedkov uvedený', s: 0 }); }

  // UBO for PO
  if (record.clientType === 'po' && !record.uboName) { score += 3; factors.push({ f: 'UBO neidentifikovaný', s: 3 }); }

  // Sanctions/register check
  if (record.sanctionsResult === 'hit') { score += 10; factors.push({ f: 'Zhoda v sankčných zoznamoch', s: 10 }); }
  else if (record.sanctionsResult === 'review') { score += 4; factors.push({ f: 'Sankčné zoznamy - možná zhoda', s: 4 }); }
  else if (record.sanctionsResult === 'pending') { score += 2; factors.push({ f: 'Sankčné zoznamy neoverené', s: 2 }); }
  else { factors.push({ f: 'Sankčné zoznamy - bez nálezu', s: 0 }); }

  if (record.registerResult === 'hit') { score += 3; factors.push({ f: 'Zhoda v registri PEP', s: 3 }); }
  else if (record.registerResult === 'review') { score += 2; factors.push({ f: 'PEP - možná zhoda', s: 2 }); }
  else if (record.registerResult === 'pending') { score += 1; factors.push({ f: 'Registre neoverené', s: 1 }); }

  let category = 'low';
  if (score >= 10) category = 'high';
  else if (score >= 5) category = 'medium';

  let ddLevel = 'simplified';
  if (category === 'high') ddLevel = 'enhanced';
  else if (category === 'medium') ddLevel = 'basic';

  return { score, category, factors, ddLevel };
}

function saveAml() {
  const editId = document.getElementById('aml-edit-id').value;
  const clientType = document.querySelector('input[name="aml-client-type"]:checked').value;

  // Validate required fields
  if (clientType === 'fo') {
    if (!document.getElementById('aml-fo-firstname').value.trim() || !document.getElementById('aml-fo-lastname').value.trim()) {
      secAlert('Meno a priezvisko sú povinné.'); return;
    }
  } else {
    if (!document.getElementById('aml-po-name').value.trim()) {
      secAlert('Obchodné meno je povinné.'); return;
    }
  }

  const sources = Array.from(document.querySelectorAll('#aml-source-grid .aml-source-chip.selected')).map(c => c.dataset.val);

  const record = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    contactId: document.getElementById('aml-contact-id').value || '',
    clientType,
    // FO
    firstName: document.getElementById('aml-fo-firstname').value.trim(),
    lastName: document.getElementById('aml-fo-lastname').value.trim(),
    birthNumber: document.getElementById('aml-fo-birthnum').value.trim(),
    dateOfBirth: document.getElementById('aml-fo-dob').value,
    nationality: document.getElementById('aml-fo-nationality').value.trim(),
    permanentAddress: document.getElementById('aml-fo-address').value.trim(),
    idDocType: document.getElementById('aml-fo-doctype').value,
    idDocNumber: document.getElementById('aml-fo-docnum').value.trim(),
    idDocExpiry: document.getElementById('aml-fo-docexpiry').value,
    // PO
    companyName: document.getElementById('aml-po-name').value.trim(),
    ico: document.getElementById('aml-po-ico').value.trim(),
    legalForm: document.getElementById('aml-po-form').value,
    registeredOffice: document.getElementById('aml-po-address').value.trim(),
    statutoryRepName: document.getElementById('aml-po-statname').value.trim(),
    statutoryRepDoc: document.getElementById('aml-po-statdoc').value.trim(),
    uboName: document.getElementById('aml-po-uboname').value.trim(),
    uboOwnershipPct: document.getElementById('aml-po-ubopct').value,
    uboBirthNumber: document.getElementById('aml-po-ubobirth').value.trim(),
    uboAddress: document.getElementById('aml-po-uboaddr').value.trim(),
    // Common
    pepStatus: document.querySelector('input[name="aml-pep"]:checked').value,
    pepDetails: document.getElementById('aml-pep-note').value.trim(),
    // Register verification
    sanctionsResult: document.getElementById('aml-sanctions-result').value,
    sanctionsDate: document.getElementById('aml-sanctions-date').value,
    registerResult: document.getElementById('aml-register-result').value,
    registerDate: document.getElementById('aml-register-date').value,
    registerNote: document.getElementById('aml-register-note').value.trim(),
    // Funds
    sourceOfFunds: sources,
    sourceOfFundsDetail: document.getElementById('aml-source-detail').value.trim(),
    transactionPurpose: document.getElementById('aml-tx-purpose').value,
    transactionBuyPurpose: document.getElementById('aml-tx-buy-purpose').value,
    transactionFinancing: document.getElementById('aml-tx-financing').value,
    transactionRepresentation: document.getElementById('aml-tx-representation').value,
    transactionCash50k: document.getElementById('aml-tx-cash50k').value,
    transactionIdCopy: document.getElementById('aml-tx-idcopy').value,
    transactionValue: document.getElementById('aml-tx-value').value,
    notes: document.getElementById('aml-notes').value.trim(),
    signature: _amlSigTemp ? { dataUrl: _amlSigTemp.dataUrl, signerName: _amlSigTemp.signerName, signedAt: _amlSigTemp.signedAt, auditId: _amlSigTemp.auditId } : null,
    updatedAt: new Date().toISOString()
  };

  // Document file names (stored as metadata — actual files stay on user's device)
  const idDocFile = document.getElementById('aml-doc-id').files[0];
  const fundsDocFile = document.getElementById('aml-doc-funds').files[0];
  const existingRecords = getAmlRecords();
  const existingRec = existingRecords.find(x => x.id === record.id);
  record.docIdName = idDocFile ? idDocFile.name : (existingRec ? existingRec.docIdName : null);
  record.docFundsName = fundsDocFile ? fundsDocFile.name : (existingRec ? existingRec.docFundsName : null);
  record.autoCheckData = existingRec ? existingRec.autoCheckData : null;
  const otherDocs = document.getElementById('aml-docs').files;
  if (otherDocs.length > 0) {
    record.docsOtherNames = Array.from(otherDocs).map(f => f.name);
  } else {
    record.docsOtherNames = existingRec ? existingRec.docsOtherNames : [];
  }

  // Calculate risk
  const risk = amlCalcRisk(record);
  record.riskScore = risk.score;
  record.riskCategory = risk.category;
  record.riskFactors = risk.factors;
  record.dueDiligenceLevel = risk.ddLevel;

  const records = getAmlRecords();
  const idx = records.findIndex(x => x.id === record.id);
  if (idx >= 0) {
    record.status = records[idx].status || 'pending';
    record.createdAt = records[idx].createdAt;
    record.verifiedBy = records[idx].verifiedBy;
    record.verifiedAt = records[idx].verifiedAt;
    records[idx] = record;
  } else {
    record.status = risk.category === 'high' ? 'flagged' : 'pending';
    record.createdAt = new Date().toISOString();
    records.push(record);
  }

  // Update contact's AML status
  if (record.contactId) {
    const contacts = getContacts();
    const ci = contacts.findIndex(c => c.id === record.contactId);
    if (ci >= 0) {
      contacts[ci].amlStatus = record.status;
      contacts[ci].amlRisk = record.riskCategory;
      contacts[ci].amlDate = record.updatedAt;
      saveContacts(contacts);
    }
  }

  saveAmlRecords(records);
  closeAmlForm();
  renderAmlList();
}

function getAmlDisplayName(r) {
  return r.clientType === 'fo' ? ((r.firstName || '') + ' ' + (r.lastName || '')).trim() || 'Bez mena' : r.companyName || 'Bez názvu';
}

function renderAmlList() {
  const records = getAmlRecords();
  const search = (document.getElementById('aml-filter-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('aml-filter-status')?.value || '';
  const riskF = document.getElementById('aml-filter-risk')?.value || '';

  let filtered = records.filter(r => {
    if (search) {
      const haystack = (getAmlDisplayName(r) + ' ' + (r.ico || '') + ' ' + (r.birthNumber || '')).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (statusF && r.status !== statusF) return false;
    if (riskF && r.riskCategory !== riskF) return false;
    return true;
  });

  filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const grid = document.getElementById('aml-grid');
  const empty = document.getElementById('aml-empty');
  const countEl = document.getElementById('aml-count');
  if (countEl) countEl.textContent = filtered.length + ' z ' + records.length + ' preverení';

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.style.display = records.length === 0 ? 'block' : 'block';
    if (records.length > 0) empty.querySelector('p').textContent = 'Žiadne preverenia nezodpovedajú filtru.';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(r => {
    const name = esc(getAmlDisplayName(r));
    const st = AML_STATUS_MAP[r.status] || AML_STATUS_MAP.pending;
    const risk = AML_RISK_MAP[r.riskCategory] || AML_RISK_MAP.low;
    const typeLabel = r.clientType === 'fo' ? 'FO' : 'PO';
    const dateStr = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const riskSegs = ['low','medium','high'].map((lvl, i) => {
      const active = (r.riskCategory === 'low' && i === 0) || (r.riskCategory === 'medium' && i <= 1) || (r.riskCategory === 'high');
      return '<div class="aml-risk-seg' + (active ? ' active-' + (i === 0 ? 'low' : i === 1 ? 'med' : 'high') : '') + '"></div>';
    }).join('');

    return '<div class="aml-card" onclick="openAmlDetail(\'' + r.id + '\')">' +
      '<div class="aml-card-header">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;">' +
          '<span class="aml-card-name">' + name + '</span>' +
          '<span class="aml-card-type">' + typeLabel + '</span>' +
        '</div>' +
        '<span class="aml-badge ' + r.status + '">' + st.label + '</span>' +
      '</div>' +
      '<div class="aml-card-meta">' +
        '<span>' + dateStr + '</span>' +
        (r.ico ? '<span>IČO: ' + esc(r.ico) + '</span>' : '') +
        (r.transactionValue ? '<span>' + Number(r.transactionValue).toLocaleString('sk-SK') + ' €</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;">' +
          '<div class="aml-risk-bar">' + riskSegs + '</div>' +
          '<span style="font-size:0.72rem;font-weight:600;color:' + risk.color + ';">' + risk.label + ' riziko</span>' +
        '</div>' +
        '<span style="font-size:0.68rem;color:var(--text-light);">Skóre: ' + (r.riskScore || 0) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

let amlDetailId = null;
function openAmlDetail(id) {
  amlDetailId = id;
  const r = getAmlRecords().find(x => x.id === id);
  if (!r) return;
  const name = esc(getAmlDisplayName(r));
  const st = AML_STATUS_MAP[r.status] || AML_STATUS_MAP.pending;
  const risk = AML_RISK_MAP[r.riskCategory] || AML_RISK_MAP.low;
  const ddLabels = { simplified: 'Zjednodušená', basic: 'Základná', enhanced: 'Zvýšená' };

  let html = '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">' +
    '<div style="font-size:1.2rem;font-weight:800;color:var(--primary-dark);">' + name + '</div>' +
    '<span class="aml-badge ' + r.status + '">' + st.label + '</span>' +
    '<span class="aml-badge ' + r.riskCategory + '">' + risk.label + ' riziko</span>' +
  '</div>';

  // Identification
  html += '<div class="aml-form-section"><div class="aml-form-section-title">Identifikácia</div><div class="aml-detail-grid">';
  if (r.clientType === 'fo') {
    html += amlDR('Meno', r.firstName + ' ' + r.lastName);
    html += amlDR('Rodné číslo', r.birthNumber || '—');
    html += amlDR('Dátum narodenia', r.dateOfBirth || '—');
    html += amlDR('Štátna príslušnosť', r.nationality || '—');
    html += amlDR('Adresa', r.permanentAddress || '—');
    html += amlDR('Doklad', (AML_DOC_LABELS[r.idDocType] || r.idDocType || '—') + ' ' + (r.idDocNumber || ''));
    html += amlDR('Platnosť do', r.idDocExpiry || '—');
  } else {
    html += amlDR('Obchodné meno', r.companyName || '—');
    html += amlDR('IČO', r.ico || '—');
    html += amlDR('Právna forma', r.legalForm || '—');
    html += amlDR('Sídlo', r.registeredOffice || '—');
    html += amlDR('Štatutár', r.statutoryRepName || '—');
    html += amlDR('UBO', (r.uboName || '—') + (r.uboOwnershipPct ? ' (' + r.uboOwnershipPct + '%)' : ''));
  }
  html += '</div></div>';

  // PEP
  const pepLabels = { no: 'Nie', yes: 'Áno - priamo', family: 'Rodinný príslušník', associate: 'Blízka osoba' };
  html += '<div class="aml-form-section"><div class="aml-form-section-title">PEP Status</div><div class="aml-detail-grid">';
  html += amlDR('PEP', pepLabels[r.pepStatus] || 'Nie');
  if (r.pepDetails) html += amlDR('Detaily', r.pepDetails);
  html += '</div></div>';

  // Register verification
  const sanctLabels = { clear: 'Bez nálezu', hit: 'Nájdená zhoda', review: 'Na posúdenie', pending: 'Neoverené' };
  html += '<div class="aml-form-section"><div class="aml-form-section-title">Overenie v registroch</div><div class="aml-detail-grid">';
  const sanctResult = r.sanctionsResult || 'pending';
  const sanctColor = sanctResult === 'clear' ? '#10B981' : (sanctResult === 'hit' ? '#EF4444' : (sanctResult === 'review' ? '#F59E0B' : '#94A3B8'));
  html += amlDR('Sankčné zoznamy (EÚ, OSN, OFAC)', '<span style="color:' + sanctColor + ';font-weight:600;">' + (sanctLabels[sanctResult] || '—') + '</span>');
  html += amlDR('Dátum overenia (sankcie)', r.sanctionsDate || '—');
  const regResult = r.registerResult || 'pending';
  const regColor = regResult === 'clear' ? '#10B981' : (regResult === 'hit' ? '#EF4444' : (regResult === 'review' ? '#F59E0B' : '#94A3B8'));
  html += amlDR('Register PEP', '<span style="color:' + regColor + ';font-weight:600;">' + (sanctLabels[regResult] || '—') + '</span>');
  html += amlDR('Dátum overenia (registre)', r.registerDate || '—');
  if (r.registerNote) html += amlDR('Zdroj / poznámka', r.registerNote);
  html += '</div>';

  // Show auto-check matches if stored
  if (r.autoCheckData) {
    const allAutoMatches = [
      ...(r.autoCheckData.sanctions?.matches || []).map(m => ({ ...m, type: 'Sankcie' })),
      ...(r.autoCheckData.pep?.matches || []).map(m => ({ ...m, type: 'PEP' }))
    ];
    if (allAutoMatches.length > 0) {
      html += '<div style="margin-top:0.5rem;font-size:0.78rem;font-weight:600;color:var(--primary-dark);margin-bottom:0.35rem;">Nájdené záznamy z automatického overenia:</div>';
      allAutoMatches.forEach(m => {
        const scoreColor = m.score >= 0.85 ? '#EF4444' : m.score >= 0.6 ? '#F59E0B' : '#64748B';
        html += '<div class="aml-match-card"><div class="aml-match-card-header">' +
          '<span class="aml-match-name">' + esc(m.name) + '</span>' +
          '<span class="aml-match-score" style="color:' + scoreColor + ';">' + Math.round(m.score * 100) + '% | ' + esc(m.type) + '</span>' +
        '</div><div class="aml-match-meta">' +
          (m.datasets ? 'Zdroj: ' + esc(m.datasets) : '') +
          (m.countries ? ' | Krajina: ' + esc(m.countries) : '') +
          (m.position ? ' | Pozícia: ' + esc(m.position) : '') +
        '</div></div>';
      });
    }
    html += '<div style="font-size:0.68rem;color:var(--text-light);margin-top:0.25rem;">Zdroj: ' + esc(r.autoCheckData.source || 'OpenSanctions.org') + '</div>';
  }
  html += '</div>';

  // Source + Transaction
  html += '<div class="aml-form-section"><div class="aml-form-section-title">Transakcia & Prostriedky</div><div class="aml-detail-grid">';
  html += amlDR('Účel obchodu', AML_PURPOSE_LABELS[r.transactionPurpose] || '—');
  html += amlDR('Účel nadobúdania', AML_BUY_PURPOSE_LABELS[r.transactionBuyPurpose] || '—');
  html += amlDR('Hodnota', r.transactionValue ? Number(r.transactionValue).toLocaleString('sk-SK') + ' €' : '—');
  html += amlDR('Spôsob financovania', AML_FINANCING_LABELS[r.transactionFinancing] || '—');
  html += amlDR('Zastúpenie', AML_REPRESENTATION_LABELS[r.transactionRepresentation] || '—');
  html += amlDR('Hotovosť > 50 000 €', r.transactionCash50k === 'ano' ? '<span style="color:#EF4444;font-weight:600;">ÁNO</span>' : 'Nie');
  html += amlDR('Kópia dokladu vyhotovená', r.transactionIdCopy === 'ano' ? 'Áno' : '<span style="color:#F59E0B;">Nie</span>');
  html += amlDR('Pôvod prostriedkov', (r.sourceOfFunds || []).map(s => AML_SOURCE_LABELS[s] || s).join(', ') || '—');
  if (r.sourceOfFundsDetail) html += amlDR('Detail', r.sourceOfFundsDetail);
  html += '</div></div>';

  // Documents
  html += '<div class="aml-form-section"><div class="aml-form-section-title">Priložené doklady</div><div class="aml-detail-grid">';
  html += amlDR('Doklad totožnosti (OP/pas)', r.docIdName ? '<span style="color:#1A7A8A;">' + esc(r.docIdName) + '</span>' : '<span style="color:#F59E0B;">Nepriložený</span>');
  html += amlDR('Doklad o pôvode prostriedkov', r.docFundsName ? '<span style="color:#1A7A8A;">' + esc(r.docFundsName) + '</span>' : '<span style="color:#F59E0B;">Nepriložený</span>');
  if (r.docsOtherNames && r.docsOtherNames.length) html += amlDR('Ďalšie doklady', r.docsOtherNames.map(n => esc(n)).join(', '));
  html += '</div></div>';

  // Risk
  html += '<div class="aml-form-section"><div class="aml-form-section-title">Hodnotenie rizika</div>';
  html += '<div class="aml-detail-grid">';
  html += amlDR('Skóre', r.riskScore || 0);
  html += amlDR('Kategória', '<span style="color:' + risk.color + ';font-weight:700;">' + risk.label + '</span>');
  html += amlDR('Due diligence', ddLabels[r.dueDiligenceLevel] || '—');
  html += '</div>';
  if (r.riskFactors && r.riskFactors.length) {
    html += '<div class="aml-risk-summary">';
    r.riskFactors.forEach(f => {
      html += '<div class="aml-risk-factor"><span class="aml-risk-factor-label">' + esc(f.f) + '</span><span class="aml-risk-factor-score">+' + f.s + '</span></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // Notes
  if (r.notes) {
    html += '<div class="aml-form-section"><div class="aml-form-section-title">Poznámky</div><p style="font-size:0.85rem;color:var(--text-light);">' + esc(r.notes) + '</p></div>';
  }

  // Audit
  html += '<div style="font-size:0.72rem;color:var(--text-light);margin-top:0.5rem;">';
  html += 'Vytvorené: ' + (r.createdAt ? new Date(r.createdAt).toLocaleString('sk-SK') : '—');
  if (r.verifiedBy) html += ' | Schválil: ' + esc(r.verifiedBy) + ' (' + new Date(r.verifiedAt).toLocaleString('sk-SK') + ')';
  html += '</div>';

  document.getElementById('aml-detail-content').innerHTML = html;
  // Show/hide approve button
  document.getElementById('aml-detail-approve-btn').style.display = (r.status === 'pending' || r.status === 'flagged') ? '' : 'none';
  document.getElementById('aml-detail-modal').style.display = 'block';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function amlDR(label, value) {
  return '<div class="aml-detail-row"><span class="aml-detail-label">' + label + '</span><span class="aml-detail-value">' + value + '</span></div>';
}
function closeAmlDetail() { document.getElementById('aml-detail-modal').style.display = 'none'; amlDetailId = null; }
function editAmlFromDetail() { const id = amlDetailId; if (id) { closeAmlDetail(); openAmlForm(id); } }
async function deleteAmlFromDetail() {
  if (!amlDetailId) return;
  if (!await secConfirm({ message: 'Naozaj vymazať toto AML preverenie?', type: 'danger', ok: 'Vymazať' })) return;
  const records = getAmlRecords().filter(x => x.id !== amlDetailId);
  saveAmlRecords(records);
  closeAmlDetail();
  renderAmlList();
}
function approveAml() {
  if (!amlDetailId) return;
  const records = getAmlRecords();
  const r = records.find(x => x.id === amlDetailId);
  if (!r) return;
  const currentUser = getStoredUser();
  r.status = 'approved';
  r.verifiedBy = (currentUser && currentUser.name) || 'Neznámy';
  r.verifiedAt = new Date().toISOString();
  // Update linked contact
  if (r.contactId) {
    const contacts = getContacts();
    const ci = contacts.findIndex(c => c.id === r.contactId);
    if (ci >= 0) { contacts[ci].amlStatus = 'approved'; contacts[ci].amlDate = r.verifiedAt; saveContacts(contacts); }
  }
  saveAmlRecords(records);
  closeAmlDetail();
  renderAmlList();
}

function exportAmlCSV() {
  const records = getAmlRecords();
  if (!records.length) { secAlert('Žiadne záznamy na export.'); return; }
  const headers = ['Meno/Názov','Typ','IČO','Status','Riziko','Skóre','PEP','Účel','Hodnota','Pôvod prostriedkov','Dátum'];
  const rows = records.map(r => [
    '"' + getAmlDisplayName(r).replace(/"/g,'""') + '"',
    r.clientType === 'fo' ? 'FO' : 'PO',
    r.ico || '',
    (AML_STATUS_MAP[r.status] || {}).label || r.status,
    (AML_RISK_MAP[r.riskCategory] || {}).label || '',
    r.riskScore || 0,
    r.pepStatus || 'no',
    AML_PURPOSE_LABELS[r.transactionPurpose] || '',
    r.transactionValue || '',
    (r.sourceOfFunds || []).join(';'),
    r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('sk-SK') : ''
  ].join(','));
  const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aml-preverenia.csv'; a.click();
}

// --- AML PDF ---
function generateAmlPdf() {
  const r = getAmlRecords().find(x => x.id === amlDetailId);
  if (!r) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const mg = 15;
  const cw = pw - 2 * mg;
  let y = mg;

  // Strip diacritics for jsPDF (no custom font needed)
  function sd(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  // Header
  doc.setFillColor(11, 42, 60);
  doc.rect(0, 0, pw, 32, 'F');
  doc.setFillColor(26, 122, 138);
  doc.rect(0, 32, pw, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text(sd('SecPro - AML Preverenie klienta'), mg, 14);
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(sd('Zákon 297/2008 Z.z. | Dátum: ' + new Date().toLocaleDateString('sk-SK')), mg, 22);
  doc.text('Dokument ID: ' + r.id, mg, 28);
  y = 40;

  function secTitle(title) {
    if (y > 265) { doc.addPage(); y = mg; }
    doc.setFillColor(240, 242, 245);
    doc.roundedRect(mg, y, cw, 8, 2, 2, 'F');
    doc.setTextColor(11, 42, 60); doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text(sd(title), mg + 4, y + 5.5);
    y += 12;
  }
  function row(label, value) {
    if (y > 275) { doc.addPage(); y = mg; }
    doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.text(sd(label), mg + 2, y);
    doc.setTextColor(26, 26, 46); doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text(sd(String(value || '—')), mg + 58, y);
    y += 6;
  }

  const name = getAmlDisplayName(r);
  const st = AML_STATUS_MAP[r.status] || AML_STATUS_MAP.pending;
  const risk = AML_RISK_MAP[r.riskCategory] || AML_RISK_MAP.low;
  const ddLabels = { simplified: 'Zjednodušená', basic: 'Základná', enhanced: 'Zvýšená' };
  const pepLabels = { no: 'Nie', yes: 'Áno - priamo', family: 'Rodinný príslušník', associate: 'Blízka osoba' };

  // Summary
  secTitle('SÚHRN');
  row('Klient', name);
  row('Typ', r.clientType === 'fo' ? 'Fyzická osoba' : 'Právnická osoba');
  row('Stav', st.label);
  row('Riziko', risk.label + ' (skóre: ' + (r.riskScore || 0) + ')');
  row('Stupeň starostlivosti', ddLabels[r.dueDiligenceLevel] || '');
  y += 4;

  // Identification
  secTitle('IDENTIFIKÁCIA KLIENTA (§7)');
  if (r.clientType === 'fo') {
    row('Meno a priezvisko', r.firstName + ' ' + r.lastName);
    row('Rodné číslo', r.birthNumber || '');
    row('Dátum narodenia', r.dateOfBirth || '');
    row('Štátna príslušnosť', r.nationality || '');
    row('Trvalý pobyt', r.permanentAddress || '');
    row('Doklad totožnosti', (AML_DOC_LABELS[r.idDocType] || '') + ' č. ' + (r.idDocNumber || ''));
    row('Platnosť dokladu do', r.idDocExpiry || '');
    row('Kópia dokladu vyhotovená', r.transactionIdCopy === 'ano' ? 'Áno' : 'Nie');
  } else {
    row('Obchodné meno', r.companyName || '');
    row('IČO', r.ico || '');
    row('Právna forma', r.legalForm || '');
    row('Sídlo', r.registeredOffice || '');
    row('Štatutárny orgán', r.statutoryRepName || '');
    row('Konečný užívateľ výhod', (r.uboName || '') + (r.uboOwnershipPct ? ' (' + r.uboOwnershipPct + '%)' : ''));
  }
  y += 4;

  // PEP
  secTitle('PEP STATUS (§6)');
  row('Politicky exponovaná osoba', pepLabels[r.pepStatus] || 'Nie');
  if (r.pepDetails) row('Detaily PEP', r.pepDetails);
  y += 4;

  // Register verification
  secTitle('OVERENIE V REGISTROCH A SANKČNÝCH ZOZNAMOCH');
  const sanctLabelsP = { clear: 'Bez nálezu', hit: 'NÁJDENÁ ZHODA', review: 'Na posúdenie', pending: 'Neoverené' };
  row('Sankčné zoznamy (EÚ, OSN, OFAC)', sanctLabelsP[r.sanctionsResult] || 'Neoverené');
  row('Dátum overenia sankcií', r.sanctionsDate || 'Nevykonané');
  row('Register PEP', sanctLabelsP[r.registerResult] || 'Neoverené');
  row('Dátum overenia registrov', r.registerDate || 'Nevykonané');
  if (r.registerNote) row('Zdroj / poznámka', r.registerNote);
  // Auto-check matches
  if (r.autoCheckData) {
    const autoMatches = [
      ...(r.autoCheckData.sanctions?.matches || []).map(am => ({ ...am, type: 'Sankcie' })),
      ...(r.autoCheckData.pep?.matches || []).map(am => ({ ...am, type: 'PEP' }))
    ];
    if (autoMatches.length > 0) {
      y += 2;
      row('Počet nájdených záznamov', autoMatches.length);
      autoMatches.slice(0, 5).forEach((am, i) => {
        row('Záznam ' + (i + 1), am.name + ' (' + Math.round(am.score * 100) + '% zhoda, ' + am.type + ')');
      });
    }
    row('Zdroj overenia', r.autoCheckData.source || 'OFAC SDN + UN Security Council');
  }
  y += 4;

  // Transaction
  secTitle('OBCHOD / TRANSAKCIA (§10)');
  row('Účel obchodu', AML_PURPOSE_LABELS[r.transactionPurpose] || '');
  row('Účel nadobúdania', AML_BUY_PURPOSE_LABELS[r.transactionBuyPurpose] || '');
  row('Hodnota obchodu', r.transactionValue ? Number(r.transactionValue).toLocaleString('sk-SK') + ' EUR' : '');
  row('Spôsob financovania', AML_FINANCING_LABELS[r.transactionFinancing] || '');
  row('Zastúpenie', AML_REPRESENTATION_LABELS[r.transactionRepresentation] || '');
  row('Hotovosť nad 50 000 EUR', r.transactionCash50k === 'ano' ? 'ÁNO' : 'Nie');
  row('Pôvod prostriedkov', (r.sourceOfFunds || []).map(s => AML_SOURCE_LABELS[s] || s).join(', '));
  if (r.sourceOfFundsDetail) row('Detail pôvodu', r.sourceOfFundsDetail);
  y += 4;

  // Documents evidence
  secTitle('PRILOŽENÉ DOKLADY');
  row('Doklad totožnosti (OP/pas)', r.docIdName || 'NEPRILOŽENÝ');
  row('Doklad o pôvode prostriedkov', r.docFundsName || 'NEPRILOŽENÝ');
  if (r.docsOtherNames && r.docsOtherNames.length) row('Ďalšie doklady', r.docsOtherNames.join(', '));
  y += 4;

  // Risk factors
  if (r.riskFactors && r.riskFactors.length) {
    secTitle('RIZIKOVÉ FAKTORY');
    r.riskFactors.forEach(f => row(f.f, '+' + f.s));
    y += 2;
    row('CELKOVÉ SKÓRE', r.riskScore || 0);
    row('KATEGÓRIA RIZIKA', risk.label);
    row('STUPEŇ STAROSTLIVOSTI', ddLabels[r.dueDiligenceLevel] || '');
  }

  // Signature lines
  y += 10;
  if (y > 250) { doc.addPage(); y = mg; }
  doc.setDrawColor(180);
  doc.line(mg, y, mg + 70, y);
  doc.line(pw - mg - 70, y, pw - mg, y);
  y += 5;
  doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont(undefined, 'normal');
  doc.text(sd('Podpis klienta'), mg, y);
  doc.text(sd('Podpis makléra / povinnej osoby'), pw - mg - 70, y);
  y += 3;
  doc.text(sd('Dátum: ............................'), mg, y);
  doc.text(sd('Dátum: ............................'), pw - mg - 70, y);

  // Audit trail
  y += 10;
  doc.setDrawColor(200); doc.line(mg, y, pw - mg, y); y += 6;
  doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont(undefined, 'normal');
  doc.text(sd('Vytvorené: ' + (r.createdAt ? new Date(r.createdAt).toLocaleString('sk-SK') : '')), mg, y);
  if (r.verifiedBy) {
    y += 4;
    doc.text(sd('Schválil: ' + r.verifiedBy + ' | ' + new Date(r.verifiedAt).toLocaleString('sk-SK')), mg, y);
  }
  y += 6;
  doc.setFontSize(6.5);
  doc.text(sd('Tento dokument bol vygenerovaný systémom SecPro pre účely plnenia povinností podľa zákona č. 297/2008 Z.z.'), mg, y);
  y += 3.5;
  doc.text(sd('o ochrane pred legalizáciou príjmov z trestnej činnosti a o ochrane pred financovaním terorizmu.'), mg, y);
  y += 3.5;
  doc.text(sd('Upozornenie: K tomuto záznamu musia byť fyzicky priložené kópie dokladov (OP, doklad o pôvode prostriedkov).'), mg, y);

  doc.save('AML-' + sd(name).replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
}

// ==================== SAVED LEADS ====================
const SAVED_LEADS_KEY = 'secpro_saved_leads';
function getSavedLeads() { return _getCached('saved_leads', []); }
function saveSavedLeads(arr) { _setCached('saved_leads', arr); }

const LEAD_PIPELINE = [
  { key: 'novy', label: 'Nový', color: '#3B82F6' },
  { key: 'kontaktovany', label: 'Kontaktovaný', color: '#F59E0B' },
  { key: 'stretnutie', label: 'Stretnutie', color: '#8B5CF6' },
  { key: 'ponuka', label: 'Ponuka', color: '#06B6D4' },
  { key: 'ziskany', label: 'Získaný', color: '#10B981' },
  { key: 'strateny', label: 'Stratený', color: '#EF4444' },
];

const LEAD_STATUS_MAP = {};
LEAD_PIPELINE.forEach(s => { LEAD_STATUS_MAP[s.key] = s; });

function saveLead(lead) {
  const leads = getSavedLeads();
  if (leads.some(l => l.url === lead.url)) return;
  const score = computeLeadScore(lead);
  const meta = (getLeadStatuses() || {})[lead.url];
  const searchToPipeline = {
    na_spracovanie: 'novy',
    prevzaty: 'kontaktovany',
    nedovolany: 'kontaktovany',
    nechce_rk: 'strateny',
    predane: 'strateny',
  };
  const mappedStatus = (meta && meta.status && searchToPipeline[meta.status]) || 'novy';
  leads.push({
    id: crypto.randomUUID(),
    title: lead.title || '',
    location: lead.location || '',
    price: lead.price || 0,
    priceText: lead.priceText || '',
    size: lead.size || 0,
    source: lead.source || '',
    url: lead.url || '',
    phone: lead.phone || '',
    status: mappedStatus,
    score,
    notes: (meta && meta.notes) || '',
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contactedAt: null,
    tags: [],
    priceHistory: [{ price: lead.price || 0, priceText: lead.priceText || '', date: new Date().toISOString(), source: lead.source || '' }],
  });
  saveSavedLeads(leads);
  updateNavLeadCount();
}

function unsaveLead(url) {
  const leads = getSavedLeads();
  const idx = leads.findIndex(l => l.url === url);
  if (idx === -1) return;
  leads.splice(idx, 1);
  saveSavedLeads(leads);
  showToast('Lead odstr\u00E1nen\u00FD z ulo\u017Een\u00FDch.', 'success');
}

function formatPriceChangeBadge(priceHistory) {
  if (!priceHistory || priceHistory.length < 2) return '';
  const latest = priceHistory[priceHistory.length - 1];
  const prev = priceHistory[priceHistory.length - 2];
  const oldPrice = Number(prev.price) || 0;
  const newPrice = Number(latest.price) || 0;
  if (oldPrice === 0 || newPrice === oldPrice) return '';
  const delta = newPrice - oldPrice;
  const pct = ((delta / oldPrice) * 100).toFixed(1);
  const isUp = delta > 0;
  const arrow = isUp ? '\u2191' : '\u2193';
  const sign = isUp ? '+' : '';
  const cls = isUp ? 'lc-price-up' : 'lc-price-down';
  return '<span class="lc-price-change ' + cls + '">' + arrow + ' ' + sign + delta.toLocaleString('sk-SK') + ' \u20AC (' + sign + pct + '%)</span>';
}

function checkPriceUpdates(searchResults) {
  if (!searchResults || !searchResults.length) return;
  const leads = getSavedLeads();
  if (!leads.length) return;
  let changed = false;
  for (const result of searchResults) {
    const resultPrice = Number(result.price) || 0;
    if (!resultPrice) continue;
    const match = leads.find(function(l) {
      if (l.url && result.url && l.url === result.url) return true;
      if (l.phone && result.phone && l.phone === result.phone) return true;
      return false;
    });
    if (!match) continue;
    const savedPrice = Number(match.price) || 0;
    if (savedPrice === resultPrice) continue;
    // Price has changed
    if (!match.priceHistory) match.priceHistory = [{ price: savedPrice, priceText: match.priceText || '', date: match.savedAt || new Date().toISOString(), source: match.source || '' }];
    match.priceHistory.push({ price: resultPrice, priceText: result.priceText || '', date: new Date().toISOString(), source: result.source || '' });
    var oldPriceText = match.priceText || (savedPrice.toLocaleString('sk-SK') + ' \u20AC');
    var newPriceText = result.priceText || (resultPrice.toLocaleString('sk-SK') + ' \u20AC');
    match.price = resultPrice;
    match.priceText = result.priceText || match.priceText;
    match.updatedAt = new Date().toISOString();
    changed = true;
    showToast('Zmena ceny: ' + (match.title || 'Lead') + ' - ' + oldPriceText + ' \u2192 ' + newPriceText);
  }
  if (changed) saveSavedLeads(leads);
}

function computeLeadScore(lead) {
  let score = 50;
  if (lead.price && lead.price > 0) score += 10;
  if (lead.phone) score += 15;
  if (lead.size && lead.size > 0) score += 5;
  if (lead.location) score += 10;
  const trustedSources = ['nehnutelnosti', 'topreality', 'realitysk'];
  if (trustedSources.some(s => (lead.source || '').toLowerCase().includes(s))) score += 10;
  return Math.min(100, Math.max(0, score));
}

function updateNavLeadCount() {
  const leads = getSavedLeads();
  const newCount = leads.filter(l => l.status === 'novy').length;
  const badge = document.getElementById('nav-lead-count');
  if (badge) {
    if (newCount > 0) {
      badge.textContent = newCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function changeLeadStatus(id, newStatus) {
  const leads = getSavedLeads();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.status = newStatus;
  lead.updatedAt = new Date().toISOString();
  if (newStatus === 'kontaktovany' && !lead.contactedAt) {
    lead.contactedAt = new Date().toISOString();
  }
  saveSavedLeads(leads);
  renderSavedLeads();
  updateNavLeadCount();
}

function updateLeadNotes(id, notes) {
  const leads = getSavedLeads();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  lead.notes = notes;
  lead.updatedAt = new Date().toISOString();
  saveSavedLeads(leads);
}

async function deleteSavedLead(id) {
  if (!await secConfirm({ message: 'Naozaj chcete odstrániť tento lead?', type: 'danger', ok: 'Odstrániť' })) return;
  const leads = getSavedLeads().filter(l => l.id !== id);
  saveSavedLeads(leads);
  renderSavedLeads();
  updateNavLeadCount();
}

function convertLeadToProperty(id) {
  const leads = getSavedLeads();
  const lead = leads.find(l => l.id === id);
  if (!lead) return;

  showPage('myproperties');
  setTimeout(() => {
    openPropertyForm();
    setTimeout(() => {
      const titleField = document.getElementById('prop-title');
      const cityField = document.getElementById('prop-city');
      const priceField = document.getElementById('prop-price');
      const sizeField = document.getElementById('prop-size');
      const phoneField = document.getElementById('prop-phone');
      const urlField = document.getElementById('prop-url');
      if (titleField) titleField.value = lead.title || '';
      if (cityField) cityField.value = lead.location || '';
      if (priceField) priceField.value = lead.price || '';
      if (sizeField) sizeField.value = lead.size || '';
      if (phoneField) phoneField.value = lead.phone || '';
      if (urlField) urlField.value = lead.url || '';
    }, 100);
  }, 100);

  lead.status = 'ziskany';
  lead.updatedAt = new Date().toISOString();
  saveSavedLeads(leads);
}

function renderSavedLeads() {
  const leads = getSavedLeads();
  const grid = document.getElementById('saved-leads-grid');
  const empty = document.getElementById('saved-leads-empty');
  const countEl = document.getElementById('saved-leads-count');

  const newLeads = leads.filter(l => l.status === 'novy').length;
  const contacted = leads.filter(l => l.status === 'kontaktovany' || l.status === 'stretnutie' || l.status === 'ponuka').length;
  const won = leads.filter(l => l.status === 'ziskany').length;
  const total = leads.filter(l => l.status !== 'strateny').length;
  const conversion = total > 0 ? Math.round((won / total) * 100) : 0;

  document.getElementById('lead-stat-new').textContent = newLeads;
  document.getElementById('lead-stat-contacted').textContent = contacted;
  document.getElementById('lead-stat-won').textContent = won;
  document.getElementById('lead-stat-conversion').textContent = conversion + '%';

  if (countEl) countEl.textContent = leads.length + ' leadov celkom';

  const funnelEl = document.getElementById('lead-pipeline-funnel');
  if (funnelEl) {
    const counts = {};
    LEAD_PIPELINE.forEach(s => { counts[s.key] = 0; });
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    funnelEl.innerHTML = LEAD_PIPELINE.map(s => {
      const c = counts[s.key] || 0;
      return '<div class="dash-funnel-stage" style="background:' + s.color + '0A;color:' + s.color + ';" title="' + s.label + ': ' + c + '">' +
        '<div class="dash-funnel-dot" style="background:' + s.color + ';"></div>' +
        '<div class="dash-funnel-count" style="color:' + s.color + ';">' + c + '</div>' +
        '<div class="dash-funnel-label">' + s.label + '</div>' +
      '</div>';
    }).join('');
  }

  if (leads.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';

  const sorted = [...leads].sort((a, b) => {
    const statusOrder = { novy: 0, kontaktovany: 1, stretnutie: 2, ponuka: 3, ziskany: 4, strateny: 5 };
    const aDone = (a.status === 'ziskany' || a.status === 'strateny') ? 1 : 0;
    const bDone = (b.status === 'ziskany' || b.status === 'strateny') ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.status !== b.status) return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    return (b.score || 0) - (a.score || 0);
  });

  // Build phone-based duplicate map for saved leads
  const savedDupPhoneMap = new Map();
  leads.forEach(l => {
    if (!l.phone) return;
    const ph = l.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (ph.length < 5) return;
    if (!savedDupPhoneMap.has(ph)) savedDupPhoneMap.set(ph, []);
    savedDupPhoneMap.get(ph).push(l);
  });

  grid.innerHTML = sorted.map(lead => {
    const st = LEAD_STATUS_MAP[lead.status] || LEAD_PIPELINE[0];
    const scoreColor = lead.score >= 80 ? '#10B981' : lead.score >= 60 ? '#F59E0B' : lead.score >= 40 ? '#F97316' : '#EF4444';
    const priceStr = lead.price ? Number(lead.price).toLocaleString('sk-SK') + ' \u20AC' : lead.priceText || '\u2014';
    const dateStr = new Date(lead.savedAt).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' });
    const isDone = lead.status === 'ziskany' || lead.status === 'strateny';

    // Check if this saved lead has duplicates (same phone, different lead)
    let savedDupCount = 0;
    if (lead.phone) {
      const ph = lead.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      const group = savedDupPhoneMap.get(ph);
      if (group && group.length > 1) savedDupCount = group.length - 1;
    }

    const statusOptions = LEAD_PIPELINE
      .filter(s => s.key !== lead.status)
      .map(s => '<option value="' + s.key + '">' + s.label + '</option>')
      .join('');

    // Price change badge for saved leads
    var savedPriceChangeBadge = formatPriceChangeBadge(lead.priceHistory || []);

    // Price history expandable section
    var priceHistoryHtml = '';
    if (lead.priceHistory && lead.priceHistory.length > 1) {
      var histItems = lead.priceHistory.slice().reverse().map(function(entry, idx, arr) {
        var d = new Date(entry.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' });
        var pStr = entry.price ? Number(entry.price).toLocaleString('sk-SK') + ' \u20AC' : entry.priceText || '\u2014';
        var deltaHtml = '';
        if (idx < arr.length - 1) {
          var prevEntry = arr[idx + 1];
          var diff = Number(entry.price) - Number(prevEntry.price);
          if (diff !== 0) {
            var pct = ((diff / Number(prevEntry.price)) * 100).toFixed(1);
            var isUp = diff > 0;
            deltaHtml = '<span class="ph-delta ' + (isUp ? 'up' : 'down') + '">' + (isUp ? '\u2191 +' : '\u2193 ') + diff.toLocaleString('sk-SK') + ' \u20AC (' + (isUp ? '+' : '') + pct + '%)</span>';
          }
        }
        return '<div class="lc-price-hist-item">' +
          '<span class="ph-date">' + d + '</span>' +
          '<span class="ph-price">' + pStr + '</span>' +
          deltaHtml +
        '</div>';
      }).join('');
      priceHistoryHtml = '<span class="lc-price-history-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.textContent=this.nextElementSibling.style.display===\'none\'?\'\u25BE Cenov\u00E1 hist\u00F3ria\':\'\u25B4 Skry\u0165 hist\u00F3riu\';">\u25BE Cenov\u00E1 hist\u00F3ria</span>' +
        '<div class="lc-price-history" style="display:none;">' + histItems + '</div>';
    }

    return '<div class="card" style="padding:1rem;' + (isDone ? 'opacity:0.6;' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.92rem;font-weight:600;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(lead.title) + '">' + esc(lead.title || 'Bez n\u00E1zvu') + '</div>' +
          '<div style="font-size:0.78rem;color:var(--text-light);margin-top:0.2rem;">' + esc(lead.location || '') + (lead.source ? ' \u00B7 ' + esc(lead.source) : '') + (savedDupCount > 0 ? ' <span class="sec-tooltip-wrap"><span class="lc-dup-badge" style="cursor:default;">Dup ' + savedDupCount + 'x</span><span class="sec-tooltip">' + savedDupCount + ' \u010Falš\u00EDch leadov s rovnak\u00FDm telef\u00F3nom</span></span>' : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-left:0.5rem;flex-shrink:0;">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:' + scoreColor + '15;color:' + scoreColor + ';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;" title="Lead score: ' + lead.score + '">' + lead.score + '</div>' +
          '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:600;background:' + st.color + '15;color:' + st.color + ';">' + st.label + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:1rem;margin-bottom:0.5rem;font-size:0.82rem;flex-wrap:wrap;align-items:center;">' +
        '<span style="font-weight:600;color:var(--dark);">' + priceStr + '</span>' +
        savedPriceChangeBadge +
        (lead.size ? '<span style="color:var(--text-light);">' + lead.size + ' m\u00B2</span>' : '') +
        '<span style="color:var(--text-light);">' + dateStr + '</span>' +
      '</div>' +
      priceHistoryHtml +
      (lead.phone ? '<div style="margin-bottom:0.5rem;font-size:0.82rem;"><a href="tel:' + lead.phone + '" style="color:#1A7A8A;font-weight:600;text-decoration:none;"><i data-lucide="phone" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px;"></i>' + esc(lead.phone) + '</a></div>' : '') +
      '<textarea style="width:100%;font-size:0.78rem;border:1px solid #E5E7EB;border-radius:8px;padding:0.5rem;resize:vertical;min-height:36px;font-family:Inter,sans-serif;margin-bottom:0.5rem;" placeholder="Pozn\u00E1mky..." oninput="updateLeadNotes(\'' + lead.id + '\', this.value)">' + esc(lead.notes || '') + '</textarea>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">' +
        '<select style="font-size:0.75rem;padding:4px 8px;border-radius:8px;border:1px solid #E5E7EB;background:white;cursor:pointer;" onchange="changeLeadStatus(\'' + lead.id + '\', this.value); this.value=\'\';">' +
          '<option value="">Zmeni\u0165 stav...</option>' +
          statusOptions +
        '</select>' +
        '<a href="' + esc(lead.url) + '" target="_blank" rel="noopener" class="btn" style="font-size:0.72rem;padding:4px 10px;background:#F0F9FF;color:#0891B2;text-decoration:none;">Otvori\u0165</a>' +
        '<button class="btn" style="font-size:0.72rem;padding:4px 10px;background:#EFF8F6;color:#1A7A8A;" onclick="convertLeadToProperty(\'' + lead.id + '\')">→ Nehnute\u013Enos\u0165</button>' +
        '<button class="btn" style="font-size:0.72rem;padding:4px 10px;background:#FEF2F2;color:#EF4444;" onclick="deleteSavedLead(\'' + lead.id + '\')">Odstr\u00E1ni\u0165</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function exportSavedLeadsCSV() {
  const leads = getSavedLeads();
  if (!leads.length) return;
  const headers = ['N\u00E1zov', 'Lokalita', 'Cena', 'm\u00B2', 'Zdroj', 'Stav', 'Sk\u00F3re', 'Telef\u00F3n', 'Pozn\u00E1mky', 'Ulo\u017Een\u00E9', 'URL'];
  const rows = leads.map(l => [
    '"' + (l.title || '').replace(/"/g, '""') + '"',
    '"' + (l.location || '').replace(/"/g, '""') + '"',
    l.price || '',
    l.size || '',
    l.source || '',
    (LEAD_STATUS_MAP[l.status] || {}).label || l.status,
    l.score || '',
    l.phone || '',
    '"' + (l.notes || '').replace(/"/g, '""') + '"',
    l.savedAt || '',
    l.url || '',
  ]);
  const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leady_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const props = getProperties();
  const contacts = getContacts();

  // --- KPI Metrics ---
  const terminalStatuses = ['zamietnuty', 'stiahnuta'];
  const activeProps = props.filter(p => !terminalStatuses.includes(p.status) && p.status !== 'predana' && p.status !== 'uzavrety');
  const soldProps = props.filter(p => p.status === 'predana' || p.status === 'uzavrety');
  const totalViewings = props.reduce((sum, p) => sum + ((p.viewings || []).length), 0);
  const portfolioValue = activeProps.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  document.getElementById('dash-active-count').textContent = activeProps.length;
  document.getElementById('dash-portfolio-value').textContent = portfolioValue > 0
    ? (portfolioValue >= 1000000
      ? (portfolioValue / 1000000).toFixed(1).replace('.', ',') + ' M\u20AC'
      : portfolioValue.toLocaleString('sk-SK') + ' \u20AC')
    : '0 \u20AC';
  document.getElementById('dash-viewings-count').textContent = totalViewings;
  document.getElementById('dash-sold-count').textContent = soldProps.length;

  // --- AML KPI ---
  const amlRecords = typeof getAmlRecords === 'function' ? getAmlRecords() : [];
  const amlPending = amlRecords.filter(r => r.status === 'pending' || r.status === 'flagged').length;
  document.getElementById('dash-aml-pending').textContent = amlPending;

  // --- Pipeline Funnel ---
  renderDashPipeline(props);

  // --- Charts ---
  renderDashCharts(props);

  // --- Lead Metrics ---
  renderDashLeadMetrics();

  // --- Activity Feed ---
  renderDashActivityFeed(props, contacts);

  // --- Recent Properties ---
  renderDashRecentProps(props);

  // --- Recent Contacts ---
  renderDashRecentContacts(contacts);

  // Reinitialize lucide icons for new DOM
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderDashLeadMetrics() {
  const leads = typeof getSavedLeads === 'function' ? getSavedLeads() : [];
  const newLeads = leads.filter(l => l.status === 'novy').length;
  const activeLeads = leads.filter(l => ['kontaktovany', 'stretnutie', 'ponuka'].includes(l.status)).length;
  const wonLeads = leads.filter(l => l.status === 'ziskany').length;
  const hotLeads = leads.filter(l => l.score >= 80 && l.status !== 'ziskany' && l.status !== 'strateny').length;

  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('dash-lead-new', newLeads);
  el('dash-lead-active', activeLeads);
  el('dash-lead-won', wonLeads);
  el('dash-lead-hot', hotLeads);
}

function renderDashActivityFeed(props, contacts) {
  const feed = document.getElementById('dash-activity-feed');
  if (!feed) return;

  const events = [];

  // Property events
  props.forEach(p => {
    if (p.createdAt) events.push({ type: 'property_add', date: p.createdAt, text: 'Pridaná nehnuteľnosť: ' + (p.title || 'Bez názvu'), icon: 'home', color: '#1A7A8A' });
    if (p.leonisPublishedAt) events.push({ type: 'property_publish', date: p.leonisPublishedAt, text: 'Publikovaná na LEONES: ' + (p.title || 'Bez názvu'), icon: 'globe', color: '#10B981' });
    (p.statusHistory || []).forEach(sh => {
      events.push({ type: 'status_change', date: sh.date || sh.changedAt, text: (p.title || 'Bez názvu') + ' → ' + (sh.to || sh.status || ''), icon: 'git-branch', color: '#8B5CF6' });
    });
    (p.viewings || []).forEach(v => {
      events.push({ type: 'viewing', date: v.date, text: 'Obhliadka: ' + (p.title || 'Bez názvu'), icon: 'eye', color: '#F59E0B' });
    });
  });

  // Contact events
  contacts.forEach(c => {
    if (c.createdAt) events.push({ type: 'contact_add', date: c.createdAt, text: 'Nový kontakt: ' + (c.name || ''), icon: 'user-plus', color: '#0369A1' });
  });

  // Lead events
  const leads = typeof getSavedLeads === 'function' ? getSavedLeads() : [];
  leads.forEach(l => {
    if (l.savedAt) events.push({ type: 'lead_saved', date: l.savedAt, text: 'Uložený lead: ' + (l.title || 'Bez názvu'), icon: 'bookmark', color: '#3B82F6' });
    if (l.contactedAt) events.push({ type: 'lead_contacted', date: l.contactedAt, text: 'Kontaktovaný lead: ' + (l.title || ''), icon: 'phone', color: '#F59E0B' });
  });

  // Sort by date desc, take last 10
  events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const recent = events.slice(0, 10);

  if (recent.length === 0) {
    feed.innerHTML = '<div class="dash-empty-state">Zatiaľ žiadna aktivita</div>';
    return;
  }

  feed.innerHTML = recent.map(ev => {
    const d = ev.date ? new Date(ev.date) : null;
    const dateStr = d ? d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }) : '';
    return '<div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid #F3F4F6;">' +
      '<div style="width:28px;height:28px;border-radius:50%;background:' + ev.color + '12;color:' + ev.color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="' + ev.icon + '" style="width:14px;height:14px;"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.82rem;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(ev.text) + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-light);">' + dateStr + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderDashPipeline(props) {
  const container = document.getElementById('dash-funnel');
  const counts = {};
  PROP_PIPELINE.forEach(stage => { counts[stage.key] = 0; });

  props.forEach(p => {
    const idx = getPipelineIndex(p.status);
    const key = PROP_PIPELINE[idx] ? PROP_PIPELINE[idx].key : 'novy';
    counts[key] = (counts[key] || 0) + 1;
  });

  container.innerHTML = PROP_PIPELINE.map(stage => {
    const count = counts[stage.key] || 0;
    return '<div class="dash-funnel-stage" style="background:' + stage.color + '0A;color:' + stage.color + ';" onclick="dashFilterByStatus(\'' + stage.key + '\')" title="' + stage.label + ': ' + count + '">' +
      '<div class="dash-funnel-dot" style="background:' + stage.color + ';"></div>' +
      '<div class="dash-funnel-count" style="color:' + stage.color + ';">' + count + '</div>' +
      '<div class="dash-funnel-label">' + stage.label + '</div>' +
    '</div>';
  }).join('');
}

function dashFilterByStatus(status) {
  showPage('myproperties');
  setTimeout(() => {
    const ms = document.getElementById('ms-prop-status');
    if (!ms) return;
    // Deselect all
    ms.querySelectorAll('.multi-select-option.selected').forEach(opt => opt.classList.remove('selected'));
    // Select target status
    const targetOpt = ms.querySelector('.multi-select-option[data-value="' + status + '"]');
    if (targetOpt) {
      targetOpt.classList.add('selected');
      msUpdateTrigger(ms);
    }
    filterProperties();
  }, 50);
}

function renderDashCharts(props) {
  const active = props.filter(p => p.status !== 'zamietnuty' && p.status !== 'stiahnuta');

  // --- Doughnut: Property type distribution ---
  const typeCounts = {};
  active.forEach(p => {
    const label = PROP_TYPE_MAP[p.type] || p.type || 'Iný';
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  });
  const typeLabels = Object.keys(typeCounts);
  const typeData = Object.values(typeCounts);
  const typeColors = ['#0891B2', '#2563EB', '#7C3AED', '#D97706', '#16A34A', '#EA580C'];

  const typeCanvas = document.getElementById('dash-chart-type');
  if (typeLabels.length > 0 && typeCanvas) {
    getOrCreateChart('dash-chart-type', {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{ data: typeData, backgroundColor: typeColors.slice(0, typeLabels.length), borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11, weight: 600 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } }
        },
        cutout: '65%'
      }
    });
  } else if (typeCanvas) {
    typeCanvas.parentElement.innerHTML = '<div class="dash-empty-state">Pridajte nehnuteľnosti pre zobrazenie grafu</div>';
  }

  // --- Bar: Price distribution ---
  const brackets = [
    { label: '< 100k', min: 0, max: 100000 },
    { label: '100-200k', min: 100000, max: 200000 },
    { label: '200-350k', min: 200000, max: 350000 },
    { label: '350-500k', min: 350000, max: 500000 },
    { label: '> 500k', min: 500000, max: Infinity }
  ];
  const priceData = brackets.map(b => active.filter(p => (Number(p.price) || 0) >= b.min && (Number(p.price) || 0) < b.max).length);
  const hasPrice = active.some(p => Number(p.price) > 0);

  const priceCanvas = document.getElementById('dash-chart-price');
  if (hasPrice && priceCanvas) {
    getOrCreateChart('dash-chart-price', {
      type: 'bar',
      data: {
        labels: brackets.map(b => b.label),
        datasets: [{ data: priceData, backgroundColor: 'rgba(46,196,212,0.6)', borderColor: 'rgba(46,196,212,1)', borderWidth: 1, borderRadius: 6, barPercentage: 0.7 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { ticks: { font: { family: 'Inter', size: 11 } }, grid: { display: false } }
        }
      }
    });
  } else if (priceCanvas) {
    priceCanvas.parentElement.innerHTML = '<div class="dash-empty-state">Pridajte nehnuteľnosti s cenou pre zobrazenie grafu</div>';
  }
}

function renderDashRecentProps(props) {
  const container = document.getElementById('dash-recent-props-list');
  if (!container) return;

  const sorted = [...props]
    .sort((a, b) => new Date(b.lastModified || b.createdAt || 0) - new Date(a.lastModified || a.createdAt || 0))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="dash-empty-state">Zatiaľ žiadne nehnuteľnosti.<br><span class="dash-section-link" onclick="showPage(\'myproperties\'); setTimeout(()=>openPropertyForm(), 100);">Pridajte prvú</span></div>';
    return;
  }

  container.innerHTML = sorted.map(p => {
    const st = PROP_STATUS_MAP[p.status] || PROP_STATUS_MAP['novy'];
    const priceStr = p.price ? Number(p.price).toLocaleString('sk-SK') + ' \u20AC' : '\u2014';
    const photo = (p.photos && p.photos.length > 0) ? p.photos[0] : '';
    const dateStr = p.lastModified
      ? new Date(p.lastModified).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' })
      : '';
    const typeName = PROP_TYPE_MAP[p.type] || p.type || '';

    return '<div class="dash-recent-item" onclick="showPage(\'myproperties\'); setTimeout(()=>openPropDetail(\'' + p.id + '\'), 100);">' +
      '<div class="dash-recent-thumb">' +
        (photo ? '<img src="' + photo + '" />' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>') +
      '</div>' +
      '<div class="dash-recent-info">' +
        '<div class="dash-recent-name">' + esc(p.title || 'Bez názvu') + '</div>' +
        '<div class="dash-recent-meta">' +
          '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:600;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' +
          (typeName ? '<span>' + esc(typeName) + '</span>' : '') +
          (p.city ? '<span>' + esc(p.city) + '</span>' : '') +
          (dateStr ? '<span>' + dateStr + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="dash-recent-price">' + priceStr + '</div>' +
    '</div>';
  }).join('');
}

function renderDashRecentContacts(contacts) {
  const container = document.getElementById('dash-recent-contacts-list');
  if (!container) return;

  const sorted = [...contacts]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="dash-empty-state">Zatiaľ žiadne kontakty.<br><span class="dash-section-link" onclick="showPage(\'contacts\'); setTimeout(()=>openContactForm(), 100);">Pridajte prvý</span></div>';
    return;
  }

  container.innerHTML = sorted.map(c => {
    const initials = c.name ? c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
    const cat = CONTACT_CATEGORY_LABELS[c.category] || c.category || '';
    const st = CONTACT_STATUS_LABELS[c.status] || { label: c.status || '', color: '#999', bg: '#f0f0f0' };

    return '<div class="dash-contact-item" onclick="showPage(\'contacts\'); setTimeout(()=>openContactForm(\'' + c.id + '\'), 100);">' +
      '<div class="dash-contact-avatar">' + initials + '</div>' +
      '<div class="dash-contact-info">' +
        '<div class="dash-contact-name">' + esc(c.name) + '</div>' +
        '<div class="dash-contact-detail">' + esc(cat) + (c.company ? ' \u00B7 ' + esc(c.company) : '') + '</div>' +
      '</div>' +
      '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:600;background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' +
    '</div>';
  }).join('');
}

// Check session on page load
(async function checkAuth() {
  // Immediately show cached user for fast UX
  const cachedUser = getStoredUser();
  if (cachedUser && cachedUser.name) {
    enterApp(cachedUser, true); // skip data load, we'll do it after validation
  }
  // Render with localStorage data immediately for fast UX
  renderDashboard();
  updateNavLeadCount();
  // Then validate against server in background
  const token = getStoredToken();
  if (token) {
    const validUser = await validateSession();
    if (!validUser) {
      clearSession();
      document.getElementById('loginOverlay').classList.remove('hidden');
    } else {
      // Migrate local data (if any) then load from server
      await migrateLocalData();
      await loadAllData();
      _reRenderAll();
    }
  }
})();

// ===== MOBILE SIDEBAR =====
function toggleMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mobileHeader = sidebar.querySelector('.sidebar-mobile-header');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('active');
  if (mobileHeader) mobileHeader.style.display = sidebar.classList.contains('mobile-open') ? 'flex' : 'none';
  document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}
function closeMobileSidebar() {
  const sidebar = document.getElementById('mobileSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mobileHeader = sidebar ? sidebar.querySelector('.sidebar-mobile-header') : null;
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
  if (mobileHeader) mobileHeader.style.display = 'none';
  document.body.style.overflow = '';
}
// Swipe to close sidebar
(function() {
  let touchStartX = 0;
  document.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function(e) {
    const sidebar = document.getElementById('mobileSidebar');
    if (!sidebar || !sidebar.classList.contains('mobile-open')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -60) closeMobileSidebar();
  }, { passive: true });
})();

// ==================== OBCHODNÝ REGISTER SR ====================

function switchOrsrTab(tab) {
  document.querySelectorAll('.orsr-tab').forEach(t => {
    t.style.color = 'var(--text-light)';
    t.style.borderBottomColor = 'transparent';
  });
  const active = document.querySelector(`.orsr-tab[data-tab="${tab}"]`);
  if (active) {
    active.style.color = '#0B2A3C';
    active.style.borderBottomColor = '#1A7A8A';
  }
  document.querySelectorAll('.orsr-form').forEach(f => f.style.display = 'none');
  const form = document.getElementById('orsr-form-' + tab);
  if (form) form.style.display = 'block';
}

async function orsrSearch(type) {
  const loadingEl = document.getElementById('orsr-loading');
  const errorEl = document.getElementById('orsr-error');
  const resultsEl = document.getElementById('orsr-results');
  const detailEl = document.getElementById('orsr-detail');
  const emptyEl = document.getElementById('orsr-empty');

  errorEl.style.display = 'none';
  resultsEl.style.display = 'none';
  detailEl.style.display = 'none';
  emptyEl.style.display = 'none';
  loadingEl.style.display = 'block';

  let body = {};
  if (type === 'ico') {
    const ico = document.getElementById('orsr-ico').value.trim();
    if (!ico) { orsrShowError('Zadajte IČO'); return; }
    body = { action: 'searchICO', ico };
  } else if (type === 'name') {
    const name = document.getElementById('orsr-name').value.trim();
    if (!name || name.length < 2) { orsrShowError('Zadajte aspoň 2 znaky'); return; }
    body = { action: 'searchName', name };
  } else if (type === 'person') {
    const surname = document.getElementById('orsr-surname').value.trim();
    if (!surname || surname.length < 2) { orsrShowError('Zadajte priezvisko (min 2 znaky)'); return; }
    const firstname = document.getElementById('orsr-firstname').value.trim();
    body = { action: 'searchPerson', surname, firstname };
  }

  try {
    const res = await fetch('/api/orsr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    loadingEl.style.display = 'none';

    if (!res.ok) {
      orsrShowError(data.error || 'Chyba pri vyhľadávaní');
      return;
    }

    if (!data.results || data.results.length === 0) {
      orsrShowError('Žiadne výsledky. Skúste upraviť hľadaný výraz.');
      return;
    }

    // If ICO search returns exactly 1 result, go directly to detail
    if (type === 'ico' && data.results.length === 1) {
      orsrLoadDetail(data.results[0].id, data.results[0].sid, data.results[0].name);
      return;
    }

    orsrShowResults(data.results);
  } catch (err) {
    loadingEl.style.display = 'none';
    orsrShowError('Chyba pripojenia k serveru. Skúste to znova.');
  }
}

function orsrShowError(msg) {
  document.getElementById('orsr-loading').style.display = 'none';
  const el = document.getElementById('orsr-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function orsrShowResults(results) {
  const el = document.getElementById('orsr-results');
  const listEl = document.getElementById('orsr-results-list');
  const countEl = document.getElementById('orsr-results-count');

  countEl.textContent = results.length + ' výsledkov';
  listEl.innerHTML = results.map(r => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:0.85rem 1.1rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(46,196,212,0.4)';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'" onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'" onclick="orsrLoadDetail('${r.id}','${r.sid}','${r.name.replace(/'/g, "\\'")}')">
      <div>
        <div style="font-weight:600;font-size:0.92rem;color:var(--dark);">${r.name}</div>
        <div style="font-size:0.75rem;color:#94A3B8;margin-top:2px;">ID: ${r.id} | Súd: ${r.sid}</div>
      </div>
      <i data-lucide="chevron-right" style="width:18px;height:18px;color:#94A3B8;flex-shrink:0;"></i>
    </div>
  `).join('');

  el.style.display = 'block';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function orsrLoadDetail(id, sid, name) {
  const loadingEl = document.getElementById('orsr-loading');
  const errorEl = document.getElementById('orsr-error');
  const resultsEl = document.getElementById('orsr-results');
  const detailEl = document.getElementById('orsr-detail');
  const emptyEl = document.getElementById('orsr-empty');

  errorEl.style.display = 'none';
  resultsEl.style.display = 'none';
  emptyEl.style.display = 'none';
  loadingEl.style.display = 'block';

  try {
    const res = await fetch('/api/orsr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'detail', id, sid }),
    });
    const data = await res.json();
    loadingEl.style.display = 'none';

    if (!res.ok) {
      orsrShowError(data.error || 'Chyba pri načítaní detailu');
      return;
    }

    orsrRenderDetail(data.detail || {}, name);
  } catch (err) {
    loadingEl.style.display = 'none';
    orsrShowError('Chyba pripojenia k serveru.');
  }
}

function orsrRenderDetail(d, fallbackName) {
  const detailEl = document.getElementById('orsr-detail');
  const contentEl = document.getElementById('orsr-detail-content');

  const companyName = d.obchodne_meno || fallbackName || 'Neznámy subjekt';
  const ico = d.ico || '—';

  let statusBadge = '<span style="font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:6px;background:#F0FDF4;color:#16A34A;font-weight:600;">Aktívny</span>';
  if (d.den_vymazu) {
    statusBadge = '<span style="font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:6px;background:#FEF2F2;color:#DC2626;font-weight:600;">Vymazaný</span>';
  }

  function row(label, value, icon) {
    if (!value) return '';
    const val = Array.isArray(value) ? value.join('<br>') : value;
    return `<div style="display:flex;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid #F1F5F9;">
      <div style="width:36px;height:36px;border-radius:8px;background:#F0F9F7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i data-lucide="${icon}" style="width:16px;height:16px;color:var(--primary-light);"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.72rem;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</div>
        <div style="font-size:0.88rem;color:var(--dark);margin-top:2px;line-height:1.5;">${val}</div>
      </div>
    </div>`;
  }

  let activitiesHtml = '';
  if (d.predmet_cinnosti && Array.isArray(d.predmet_cinnosti) && d.predmet_cinnosti.length) {
    activitiesHtml = `<div class="card" style="margin-top:1rem;">
      <div style="font-weight:700;font-size:0.88rem;color:var(--dark);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="list" style="width:16px;height:16px;color:var(--primary-light);"></i>
        Predmet činnosti (${d.predmet_cinnosti.length})
      </div>
      <div style="max-height:300px;overflow-y:auto;">
        ${d.predmet_cinnosti.map((a, i) => `<div style="padding:0.4rem 0;border-bottom:1px solid #F8FAFC;font-size:0.82rem;color:var(--text);display:flex;gap:0.5rem;">
          <span style="color:#94A3B8;font-size:0.75rem;min-width:20px;">${i+1}.</span> ${a}
        </div>`).join('')}
      </div>
    </div>`;
  }

  let statutoryHtml = '';
  if (d.statutarny_organ && Array.isArray(d.statutarny_organ) && d.statutarny_organ.length) {
    statutoryHtml = `<div class="card" style="margin-top:1rem;">
      <div style="font-weight:700;font-size:0.88rem;color:var(--dark);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="users" style="width:16px;height:16px;color:var(--primary-light);"></i>
        Štatutárny orgán
      </div>
      ${d.statutarny_organ.map(s => `<div style="padding:0.5rem 0;border-bottom:1px solid #F8FAFC;font-size:0.85rem;color:var(--text);">${s}</div>`).join('')}
    </div>`;
  }

  let partnersHtml = '';
  if (d.spolocnici && Array.isArray(d.spolocnici) && d.spolocnici.length) {
    partnersHtml = `<div class="card" style="margin-top:1rem;">
      <div style="font-weight:700;font-size:0.88rem;color:var(--dark);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="user-check" style="width:16px;height:16px;color:var(--primary-light);"></i>
        Spoločníci
      </div>
      ${d.spolocnici.map(s => `<div style="padding:0.5rem 0;border-bottom:1px solid #F8FAFC;font-size:0.85rem;color:var(--text);">${s}</div>`).join('')}
    </div>`;
  }

  let dozornaRadaHtml = '';
  if (d.dozorna_rada && Array.isArray(d.dozorna_rada) && d.dozorna_rada.length) {
    dozornaRadaHtml = `<div class="card" style="margin-top:1rem;">
      <div style="font-weight:700;font-size:0.88rem;color:var(--dark);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="eye" style="width:16px;height:16px;color:var(--primary-light);"></i>
        Dozorná rada
      </div>
      ${d.dozorna_rada.map(s => `<div style="padding:0.5rem 0;border-bottom:1px solid #F8FAFC;font-size:0.85rem;color:var(--text);">${s}</div>`).join('')}
    </div>`;
  }

  contentEl.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">
        <div>
          <h2 style="font-size:1.15rem;color:var(--dark);margin:0;">${companyName}</h2>
          <div style="font-size:0.85rem;color:#64748B;margin-top:0.25rem;">IČO: <strong>${ico}</strong></div>
        </div>
        ${statusBadge}
      </div>
      ${row('Príslušný súd', d.prislusny_sud, 'landmark')}
      ${row('Oddiel / Vložka', (d.oddiel && d.vlozka) ? d.oddiel + ' / ' + d.vlozka : (d.oddiel || d.vlozka), 'file-text')}
      ${row('Sídlo', d.sidlo, 'map-pin')}
      ${row('Právna forma', d.pravna_forma, 'briefcase')}
      ${row('Deň zápisu', d.den_zapisu, 'calendar-plus')}
      ${d.den_vymazu ? row('Deň výmazu', d.den_vymazu, 'calendar-x') : ''}
      ${d.dovod_vymazu ? row('Dôvod výmazu', d.dovod_vymazu, 'alert-triangle') : ''}
      ${d.spolocnost_zrusena ? row('Spoločnosť zrušená', d.spolocnost_zrusena, 'x-circle') : ''}
      ${row('Základné imanie', d.zakladne_imanie, 'coins')}
      ${d.vyska_vkladu ? row('Výška vkladu', d.vyska_vkladu, 'wallet') : ''}
      ${d.akcie ? row('Akcie', d.akcie, 'ticket') : ''}
      ${row('Konanie', d.konanie, 'scale')}
      ${d.zastupovanie ? row('Zastupovanie', d.zastupovanie, 'handshake') : ''}
      ${d.bydlisko ? row('Bydlisko', d.bydlisko, 'home') : ''}
      ${d.miesto_podnikania ? row('Miesto podnikania', d.miesto_podnikania, 'store') : ''}
      ${d.likvidacia ? row('Likvidácia', d.likvidacia, 'alert-octagon') : ''}
      ${d.likvidator ? row('Likvidátor', d.likvidator, 'user-x') : ''}
      ${d.vyhlasenie_konkurzu ? row('Vyhlásenie konkurzu', d.vyhlasenie_konkurzu, 'gavel') : ''}
      ${d.spravca_konkurznej_podstaty ? row('Správca konkurznej podstaty', d.spravca_konkurznej_podstaty, 'shield') : ''}
      ${d.pravny_nastupca ? row('Právny nástupca', d.pravny_nastupca, 'arrow-right-circle') : ''}
      ${d.zlucenie_splynutie ? row('Zlúčenie/splynutie', d.zlucenie_splynutie, 'merge') : ''}
      ${row('Dátum aktualizácie', d.datum_aktualizacie, 'refresh-cw')}
    </div>
    ${statutoryHtml}
    ${partnersHtml}
    ${dozornaRadaHtml}
    ${activitiesHtml}
    <div style="text-align:center;margin-top:1.25rem;">
      <a href="${d.srcUrl ? 'https://www.orsr.sk/' + d.srcUrl : '#'}" target="_blank" rel="noopener" style="font-size:0.82rem;color:var(--primary-light);text-decoration:none;">
        Zobraziť originálny výpis na orsr.sk <i data-lucide="external-link" style="width:12px;height:12px;"></i>
      </a>
    </div>
  `;

  detailEl.style.display = 'block';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==================== DOCUMENT LIVE PREVIEW ====================

function _npRow(label, value) {
  if (!value) return '';
  return `<div class="np-row"><div class="np-label">${label}:</div><div class="np-value">${value}</div></div>`;
}
function _npRow2(l1, v1, l2, v2) {
  if (!v1 && !v2) return '';
  return `<div class="np-row np-row2"><div>${v1 ? `<div class="np-row"><div class="np-label">${l1}:</div><div class="np-value">${v1}</div></div>` : ''}</div><div>${v2 ? `<div class="np-row"><div class="np-label">${l2}:</div><div class="np-value">${v2}</div></div>` : ''}</div></div>`;
}
function _npMulti(label, value) {
  if (!value) return '';
  return `<div class="np-row" style="flex-direction:column;"><div class="np-label">${label}:</div><div class="np-multi">${value}</div></div>`;
}
function _npSection(title) {
  return `<div class="np-section">${title}</div>`;
}

/* ─── DOKUMENTY ─── */
const DOCS_DATA = [
  // Sprostredkovateľské zmluvy
  { file:'nova-sz.docx', name:'Sprostredkovateľská zmluva (nová)', cat:'zmluvy' },
  { file:'nevyhradna-sz-2025-jeden-klient.docx', name:'Nevýhradná SZ - jeden klient (2025)', cat:'zmluvy' },
  { file:'nevyhradna-sz-viaceri-klienti.docx', name:'Nevýhradná SZ - viacerí klienti', cat:'zmluvy' },
  { file:'sz-najom.docx', name:'Sprostredkovateľská zmluva - nájom', cat:'zmluvy' },
  { file:'pp-predaj.docx', name:'Plná moc - predaj', cat:'zmluvy' },
  // Nájomné zmluvy
  { file:'najomna-zmluva-obciansky-zakonnik.docx', name:'Nájomná zmluva (Občiansky zákonník)', cat:'najom' },
  { file:'najomna-zmluva-rodinny-dom.docx', name:'Nájomná zmluva - rodinný dom', cat:'najom' },
  { file:'vzor-najomna-zmluva.doc', name:'Vzor nájomnej zmluvy', cat:'najom' },
  { file:'nz-dodatok.doc', name:'Dodatok k nájomnej zmluve', cat:'najom' },
  { file:'nz-nebyt-dodatok.docx', name:'Dodatok - nebytový priestor', cat:'najom' },
  { file:'ukoncenie-najmu-dohoda.docx', name:'Ukončenie nájmu dohodou', cat:'najom' },
  // Náborové listy
  { file:'nabor-byt-ak.docx', name:'Náborový list - byt (AK)', cat:'nabor' },
  { file:'nabor-dom-ak.docx', name:'Náborový list - dom (AK)', cat:'nabor' },
  // Preberacie protokoly
  { file:'preb.-protokol-najom.docx', name:'Preberací protokol - nájom', cat:'nabor' },
  // Kataster / Vecné bremená
  { file:'vb-vklad.docx', name:'Vecné bremeno - vklad', cat:'kataster' },
  { file:'vb-zriadenie.docx', name:'Vecné bremeno - zriadenie', cat:'kataster' },
  { file:'vklad-zrusenie-vb-do-kn.docx', name:'Vklad / zrušenie VB do katastra', cat:'kataster' },
  { file:'zrusenie-vb.docx', name:'Zrušenie vecného bremena', cat:'kataster' },
  // Finančné
  { file:'zlozenie-zalohy-moderny-makler.docx', name:'Zloženie zálohy', cat:'financne' },
  { file:'vratenie-financnej-zabezpeky-2025.docx', name:'Vrátenie finančnej zabezpeky (2025)', cat:'financne' },
  // GDPR / Súhlasy
  { file:'gdpr-zamestnanec.docx', name:'GDPR - zamestnanec', cat:'gdpr' },
  { file:'suhlas.-uchadzac-o-zamestnaniedocx.docx', name:'Súhlas - uchádzač o zamestnanie', cat:'gdpr' },
  { file:'suhlas_marketingovy-ucel_potencialny-klient.docx', name:'Súhlas - marketing (potenciálny klient)', cat:'gdpr' },
  { file:'informovanie-dotknutej-osoby-klient.docx', name:'Informovanie dotknutej osoby - klient', cat:'gdpr' },
  { file:'informovanie-dotknutej-osoby-potencialny-klient-marketingovy-ucel.docx', name:'Informovanie DO - potenciálny klient (marketing)', cat:'gdpr' },
  { file:'informovanie-dotknutej-osoby-staly-klient-marketingovy-ucel.docx', name:'Informovanie DO - stály klient (marketing)', cat:'gdpr' },
  { file:'informovanie-dotknutej-osoby-uchadzac-o-zamestnanie.docx', name:'Informovanie DO - uchádzač o zamestnanie', cat:'gdpr' },
  { file:'informovanie-dotknutej-osoby-zaujemca-o-cenovu-ponuku.docx', name:'Informovanie DO - záujemca o cenovú ponuku', cat:'gdpr' },
  { file:'informovanie-dotknutych-osob-webova-stranka.docx', name:'Informovanie DO - webová stránka', cat:'gdpr' },
  { file:'poucenie-o-povereni-opravnenej-osoby-zamestnanec.docx', name:'Poučenie oprávnenej osoby - zamestnanec', cat:'gdpr' },
  { file:'pouzitie-dokumentacie.docx', name:'Použitie dokumentácie', cat:'gdpr' },
  { file:'zoznam-osob.docx', name:'Zoznam osôb', cat:'gdpr' },
  // Spracúvanie osobných údajov
  { file:'zmluva-o-spracuvani-osobnych-udajov-bozp.docx', name:'Zmluva o spracúvaní OU - BOZP', cat:'spracuvanie' },
  { file:'zmluva-o-spracuvani-osobnych-udajov-ekonom-uctovnik.docx', name:'Zmluva o spracúvaní OU - ekonóm/účtovník', cat:'spracuvanie' },
  { file:'zmluva-o-spracuvani-osobnych-udajov-pzs.docx', name:'Zmluva o spracúvaní OU - PZS', cat:'spracuvanie' },
  { file:'zmluva-o-spracuvani-osobnych-udajov-szco.docx', name:'Zmluva o spracúvaní OU - SZČO', cat:'spracuvanie' },
  // Ostatné
  { file:'b.-smernica-o-bezpecnostnych-opatreniach-prevadzkovatela.docx', name:'Smernica o bezpečnostných opatreniach', cat:'ostatne' },
  { file:'cestne-vyhlasenie-o-poskytnuti-ubytovania.docx', name:'Čestné vyhlásenie o poskytnutí ubytovania', cat:'ostatne' },
  { file:'informacna-povinnost-dotknuta-osoba_kamery.docx', name:'Informačná povinnosť - kamery', cat:'ostatne' },
];

const DOCS_CAT_NAMES = {
  zmluvy: 'Sprostredkovateľské zmluvy',
  najom: 'Nájomné zmluvy',
  nabor: 'Náborové listy a protokoly',
  kataster: 'Kataster / Vecné bremená',
  financne: 'Finančné dokumenty',
  gdpr: 'GDPR / Súhlasy a informovanie',
  spracuvanie: 'Zmluvy o spracúvaní osobných údajov',
  ostatne: 'Ostatné dokumenty'
};

const DOCS_CAT_ICONS = {
  zmluvy: 'file-signature',
  najom: 'key',
  nabor: 'clipboard-list',
  kataster: 'landmark',
  financne: 'banknote',
  gdpr: 'shield',
  spracuvanie: 'lock',
  ostatne: 'folder'
};

let _docsActiveCategory = 'all';

function renderDocs() {
  const search = (document.getElementById('docs-search')?.value || '').toLowerCase();
  const container = document.getElementById('docs-container');
  if (!container) return;

  const cats = ['zmluvy','najom','nabor','kataster','financne','gdpr','spracuvanie','ostatne'];
  let html = '';

  for (const cat of cats) {
    if (_docsActiveCategory !== 'all' && _docsActiveCategory !== cat) continue;
    const items = DOCS_DATA.filter(d => d.cat === cat && (!search || d.name.toLowerCase().includes(search) || d.file.toLowerCase().includes(search)));
    if (!items.length) continue;

    const icon = DOCS_CAT_ICONS[cat] || 'folder';
    html += `<div class="docs-category" data-cat="${cat}">`;
    html += `<div class="docs-category-title"><i data-lucide="${icon}"></i> ${DOCS_CAT_NAMES[cat]} <span class="docs-category-count">(${items.length})</span></div>`;
    html += `<div class="docs-grid">`;
    for (const d of items) {
      const ext = d.file.endsWith('.doc') ? 'doc' : 'docx';
      const hasForm = DOC_FORMS[d.file] !== undefined && DOC_FORMS[d.file] !== null;
      html += `<div class="doc-card" style="cursor:default;">`;
      html += `<div class="doc-icon ${ext}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>`;
      html += `<div class="doc-info"><div class="doc-name">${d.name}</div><div class="doc-meta">.${ext} | ${DOCS_CAT_NAMES[d.cat]}</div></div>`;
      html += `<div style="display:flex;gap:0.35rem;">`;
      if (hasForm) {
        html += `<div class="doc-dl-btn" style="background:#E8F5E9;color:#2E7D32;" onclick="event.stopPropagation();openDocForm('${d.file}')" title="Vyplniť formulár"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>`;
      }
      html += `<div class="doc-dl-btn" onclick="event.stopPropagation();downloadDoc('${d.file}')" title="Stiahnuť šablónu"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>`;
      html += `</div></div>`;
    }
    html += `</div></div>`;
  }

  if (!html) {
    html = `<div style="text-align:center;padding:3rem;color:var(--text-light);font-size:0.9rem;">Žiadne dokumenty nezodpovedajú vyhľadávaniu</div>`;
  }
  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterDocs() { renderDocs(); }

function filterDocsCategory(cat, el) {
  _docsActiveCategory = cat;
  document.querySelectorAll('.docs-filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderDocs();
}

function downloadDoc(filename) {
  const a = document.createElement('a');
  a.href = '/templates/' + filename;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ═══════════════════════════════════════════════════════
   DOCUMENT FORM SYSTEM - DOCX filler for all templates
   ═══════════════════════════════════════════════════════ */

function _escXml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Field helpers - return arrays of [id, label, type?, fullWidth?]
function _fPerson(pfx, lbl) {
  return [
    { title: lbl, fields: [
      [pfx+'meno','Meno a priezvisko'],
      [pfx+'rod','Rodné priezvisko'],
      [pfx+'nar','Dátum narodenia','date'],
      [pfx+'rc','Rodné číslo'],
      [pfx+'adresa','Adresa trvalého pobytu','text',true],
      [pfx+'obcianstvo','Štátna príslušnosť'],
      [pfx+'email','E-mail','email'],
      [pfx+'tel','Telefón','tel'],
      [pfx+'iban','IBAN'],
    ]}
  ];
}

function _fPersonBasic(pfx, lbl) {
  return [
    { title: lbl, fields: [
      [pfx+'meno','Meno a priezvisko'],
      [pfx+'nar','Dátum narodenia','date'],
      [pfx+'rc','Rodné číslo'],
      [pfx+'adresa','Adresa trvalého pobytu','text',true],
      [pfx+'email','E-mail','email'],
      [pfx+'tel','Telefón','tel'],
    ]}
  ];
}

function _fPersonFull(pfx, lbl) {
  return [
    { title: lbl, fields: [
      [pfx+'meno','Meno a priezvisko / Názov spoločnosti','text',true],
      [pfx+'nar','Dátum narodenia / IČO'],
      [pfx+'dic','DIČ'],
      [pfx+'adresa','Trvalý pobyt / Sídlo spoločnosti','text',true],
      [pfx+'email','E-mail','email'],
      [pfx+'tel','Telefón','tel'],
    ]}
  ];
}

function _fProperty() {
  return [
    { title: 'Nehnuteľnosť', fields: [
      ['n_lv','List vlastníctva č.'],
      ['n_kataster','Katastrálne územie'],
      ['n_okres','Okres'],
      ['n_obec','Obec'],
      ['n_parcela','Parcela č.'],
      ['n_vymera','Výmera (m²)'],
      ['n_byt','Byt č.'],
      ['n_poschodie','Poschodie'],
      ['n_vchod','Vchod č.'],
      ['n_ulica','Ulica','text',true],
      ['n_supisne','Súpisné číslo'],
      ['n_podiel','Spoluvlastnícky podiel'],
    ]}
  ];
}

function _fPropertyShort() {
  return [
    { title: 'Nehnuteľnosť', fields: [
      ['n_lv','List vlastníctva č.'],
      ['n_kataster','Katastrálne územie'],
      ['n_okres','Okres'],
      ['n_obec','Obec'],
      ['n_parcela','Parcela č.'],
      ['n_ulica','Ulica','text',true],
      ['n_supisne','Súpisné číslo'],
    ]}
  ];
}

function _fSignature() {
  return [
    { title: 'Podpis', fields: [
      ['p_miesto','Miesto podpisu'],
      ['p_datum','Dátum podpisu','date'],
    ]}
  ];
}

// All document form definitions
// Each doc has: title, sections (UI form), repl (DOCX replacement rules)
// repl format: ['fieldId', 'labelContext'] - finds label in XML, replaces next dot/underscore sequence
// Special: ['fieldId', 'labelContext', 'bullet'] for [ • ] markers
// Special: ['fieldId', 'labelContext', 'XX'] for XX markers
// Special: ['fieldId', 'exactText', 'exact'] for exact string replacement
const DOC_FORMS = {
  // ─── SPROSTREDKOVATEĽSKÉ ZMLUVY ───
  'nova-sz.docx': {
    title: 'Zmluva o výhradnom poskytovaní realitných služieb',
    sections: [
      ..._fPerson('z1_','Záujemca 1'),
      ..._fPerson('z2_','Záujemca 2'),
      ..._fProperty(),
      { title: 'Zmluvné podmienky', fields: [
        ['f_kupna_cena','Kúpna cena (EUR)','number'],
        ['f_kupna_slovom','Kúpna cena slovom','text',true],
        ['f_lehota','Lehota na podpis rezervačnej zmluvy'],
        ['f_doba','Doba trvania zmluvy'],
        ['f_typ','Typ nehnuteľnosti','select:Byt|Rodinný dom|Pozemok|Iné'],
      ]},
      ..._fSignature(),
    ],
    pattern: 'bullets', // uses [ • ] markers, replaced in order
    bulletOrder: [
      'z1_meno','z1_adresa','z1_nar','z1_podiel','z1_email','z1_tel',
      'z2_meno','z2_adresa','z2_nar','z2_podiel','z2_email','z2_tel',
      'n_parcela','n_vymera','n_typ_stavby','n_lv','n_kataster','n_okres','n_obec','n_okresny_urad',
      'f_kupna_cena','f_kupna_slovom','f_lehota',null,null,null,'f_kupna_cena2','f_kupna_datum',
    ],
    repl: [
      ['f_doba', '_________', 'exact'],
      ['n_lv','LV č.'],['n_okres','okres:'],['n_obec','obec:'],['n_kataster','územie:'],
      ['p_meno','Meno a priezvisko:'],['p_datum','Dátum:'],
    ]
  },
  'nevyhradna-sz-2025-jeden-klient.docx': {
    title: 'Nevýhradná SZ - jeden klient (2025)',
    sections: [
      ..._fPerson('z1_','Záujemca'),
      ..._fPropertyShort(),
      { title: 'Zmluvné podmienky', fields: [
        ['f_kupna_cena','Kúpna cena (EUR)','number'],
        ['f_kupna_slovom','Kúpna cena slovom','text',true],
        ['f_provizia','Výška provízie'],
        ['f_platna_do','Zmluva platná do','date'],
        ['f_typ','Typ nehnuteľnosti','select:Byt|Rodinný dom|Pozemok|Iné'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['f_kupna_cena','je ','dots',' EUR'],['f_kupna_slovom','slovom '],['f_provizia',''],
      ['f_platna_do','do '],
      ['n_lv','LV č'],['n_okres','okres:'],['n_obec','obec:'],['n_kataster','územie:'],
      ['p_meno','Meno a priezvisko:'],['p_datum','Dátum:'],
      ['f_sprostredkovatelia','spoločnostiam '],
    ]
  },
  'nevyhradna-sz-viaceri-klienti.docx': {
    title: 'Nevýhradná SZ - viacerí klienti',
    sections: [
      ..._fPerson('z1_','Záujemca 1'),
      ..._fPerson('z2_','Záujemca 2'),
      ..._fPropertyShort(),
      { title: 'Zmluvné podmienky', fields: [
        ['f_kupna_cena','Kúpna cena (EUR)','number'],
        ['f_kupna_slovom','Kúpna cena slovom','text',true],
        ['f_provizia','Výška provízie'],
        ['f_platna_do','Zmluva platná do','date'],
        ['f_typ','Typ nehnuteľnosti','select:Byt|Rodinný dom|Pozemok|Iné'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['f_kupna_cena','je ','dots',' EUR'],['f_kupna_slovom','slovom '],['f_provizia',''],
      ['f_platna_do','do '],
      ['n_lv','LV č'],['n_okres','okres:'],['n_obec','obec:'],['n_kataster','územie:'],
      ['p_meno','Meno a priezvisko:'],['p_datum','Dátum:'],
    ]
  },
  'sz-najom.docx': {
    title: 'Sprostredkovateľská zmluva - nájom',
    sections: [
      ..._fPerson('z1_','Záujemca (prenajímateľ)'),
      ..._fProperty(),
      { title: 'Podmienky nájmu', fields: [
        ['f_cislo_zmluvy','Číslo zmluvy'],
        ['f_cena_najmu','Cena nájmu (EUR)','number'],
        ['f_najom_slovom','Cena nájmu slovom','text',true],
        ['f_poplatky','Poplatky za energie (EUR)','number'],
        ['f_provizia','Provízia (EUR)','number'],
        ['f_doba_od','Doba trvania od','date'],
        ['f_doba_do','Doba trvania do','date'],
      ]},
      ..._fSignature(),
    ],
    pattern: 'mixed',
    repl: [
      ['f_cislo_zmluvy','_________','exact'],
      ['n_lv','LV č'],['n_kataster','územie'],['n_okres','okres'],['n_obec','obec'],
      ['n_okresny_urad','úrad'],['n_byt','Byt č'],['n_poschodie','poschodí'],
      ['n_supisne','súpisné'],['n_typ_stavby','stavby'],['n_popis','Popis'],
      ['n_vchod','Vchod'],['n_parcela','parc'],['n_druh','pozemku'],['n_vymera','Výmera'],
      ['n_podiel','podiel'],
      ['f_provizia','Províz'],['f_cena_najmu','nájmu'],['f_najom_slovom','slovom'],
      ['f_poplatky','výške'],['f_doba_od','obdobie od'],['f_doba_do','do '],
      ['p_meno','Meno a priezvisko:'],['p_datum','Dátum:'],
    ]
  },
  'pp-predaj.docx': {
    title: 'Preberací protokol - predaj',
    sections: [
      ..._fPersonFull('od_','Odovzdávajúci'),
      ..._fPersonFull('pr_','Preberajúci'),
      ..._fProperty(),
      { title: 'Stav a merania', fields: [
        ['m_vady','Vady zistené pri preberaní','text',true],
        ['m_elektromer','Elektromer č. / stav'],
        ['m_vodomer_tepla','Vodomer teplá voda č. / stav'],
        ['m_vodomer_studena','Vodomer studená voda č. / stav'],
        ['m_plynomer','Plynomer č. / stav'],
        ['m_teplo','Merače tepla / stav'],
      ]},
      { title: 'Kľúče', fields: [
        ['k_byt','Kľúče od bytu (počet)','number'],
        ['k_vchod','Kľúče od vchodu (počet)','number'],
        ['k_pivnica','Kľúče od pivnice (počet)','number'],
        ['k_garaz','Kľúče od garáže (počet)','number'],
        ['k_schranka','Kľúče od schránky (počet)','number'],
      ]},
      { title: 'Zariadenie bytu', fields: [
        ['z_kuchyna','Kuchyňa','text',true],
        ['z_kupelna','Kúpeľňa a WC','text',true],
        ['z_ine','Iné','text',true],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['m_vady','Vady'],['m_elektromer','Elektromer'],
      ['m_vodomer_tepla','teplá voda'],['m_vodomer_studena','studená voda'],
      ['m_plynomer','Plynomer'],
    ]
  },

  // ─── NÁJOMNÉ ZMLUVY ───
  'najomna-zmluva-obciansky-zakonnik.docx': {
    title: 'Sprostredkovateľská zmluva - nájom bytu (OZ)',
    sections: [
      ..._fPersonBasic('z1_','Záujemca (vlastník)'),
      ..._fProperty(),
      { title: 'Podmienky', fields: [
        ['f_najomne','Cena nájomného (EUR)','number'],
        ['f_najomne_slovom','Cena nájomného slovom','text',true],
        ['f_provizia','Výška provízie (EUR)','number'],
        ['f_provizia_slovom','Výška provízie slovom','text',true],
        ['f_platna_do','Zmluva platná do','date'],
        ['f_parking_lv','LV č. parkovacie státie'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['n_lv','LV č.'],['f_najomne','je '],['f_najomne_slovom','slovom '],
      ['f_provizia','výške '],['f_provizia_slovom','slovom '],
      ['f_platna_do','do '],
      ['n_lv','LV č'],['n_okres','okres:'],['n_obec','obec:'],['n_kataster','územie:'],
      ['p_meno','Meno a priezvisko:'],['p_datum','Dátum:'],
    ]
  },
  'najomna-zmluva-rodinny-dom.docx': {
    title: 'Nájomná zmluva - rodinný dom',
    sections: [
      ..._fPerson('p1_','Prenajímateľ 1'),
      ..._fPerson('p2_','Prenajímateľ 2'),
      { title: 'Bankové spojenie prenajímateľov', fields: [
        ['pb_iban','IBAN'],
      ]},
      ..._fPerson('n1_','Nájomca 1'),
      ..._fPerson('n2_','Nájomca 2'),
      ..._fProperty(),
      { title: 'Podmienky nájmu', fields: [
        ['f_najomne','Mesačné nájomné (EUR)','number'],
        ['f_energie','Záloha za energie (EUR)','number'],
        ['f_zabezpeka','Peňažná zabezpeka (EUR)','number'],
        ['f_doba_od','Doba nájmu od','date'],
        ['f_doba_do','Doba nájmu do','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['n_lv','LV č'],
    ]
  },
  'vzor-najomna-zmluva.doc': {
    title: 'Nájomná zmluva - krátkodobý nájom bytu',
    sections: [
      ..._fPerson('pr_','Prenajímateľ'),
      ..._fPerson('na_','Nájomca'),
      ..._fProperty(),
      { title: 'Podmienky nájmu', fields: [
        ['f_plocha','Celková podlahová plocha (m²)','number'],
        ['f_pocet_osob','Počet osôb','number'],
        ['f_doba_od','Nájom od','date'],
        ['f_doba_do','Nájom do','date'],
        ['f_najomne','Mesačné nájomné (EUR)','number'],
        ['f_najomne_slovom','Nájomné slovom','text',true],
        ['f_kaucia','Kaucia (EUR)','number'],
        ['f_kaucia_slovom','Kaucia slovom'],
        ['f_elektrina','Elektrická energia (EUR)','number'],
        ['f_voda','Vodné a stočné (EUR)','number'],
        ['f_celkovo','Celkovo (EUR)','number'],
      ]},
      ..._fSignature(),
    ]
  },
  'nz-dodatok.doc': {
    title: 'Dodatok č. 1 k nájomnej zmluve',
    sections: [
      ..._fPerson('pr_','Prenajímateľ'),
      ..._fPerson('na_','Nájomca'),
      { title: 'Dodatok', fields: [
        ['d_povodna_zmluva','Dátum pôvodnej zmluvy','date'],
        ['d_predlzenie_do','Predĺženie nájmu do','date'],
        ['d_nove_najomne','Nové nájomné (EUR)','number'],
      ]},
      ..._fSignature(),
    ],
    repl: [] // .doc format - no DOCX replacement available
  },
  'nz-nebyt-dodatok.docx': {
    title: 'Dodatok - nebytový priestor',
    sections: [
      ..._fPersonBasic('pr_','Prenajímateľ'),
      ..._fPersonBasic('na_','Nájomca'),
      ..._fProperty(),
      { title: 'Dodatok', fields: [
        ['d_povodna_zmluva','Dátum pôvodnej zmluvy','date'],
        ['d_nazov_zmluvy','Názov pôvodnej zmluvy','text',true],
        ['d_np_druh','Druh nebytového priestoru'],
        ['d_np_podiel','Podiel priestoru'],
        ['d_najomne_parking','Nájomné za park. státie (EUR)','number'],
        ['d_najomne_byt','Pôvodné nájomné za byt (EUR)','number'],
        ['d_celkove_najomne','Nová celková výška nájomného (EUR)','number'],
      ]},
      ..._fSignature(),
    ],
    repl: [['d_povodna_zmluva','dňa'],['p_datum','dňa']]
  },
  'ukoncenie-najmu-dohoda.docx': {
    title: 'Dohoda o skončení nájmu bytu',
    sections: [
      ..._fPersonBasic('pr_','Prenajímateľ'),
      ..._fPersonBasic('na_','Nájomca'),
      { title: 'Ukončenie', fields: [
        ['u_povodna_zmluva','Dátum pôvodnej zmluvy','date'],
        ['u_datum_ukoncenia','Dátum skončenia nájmu','date'],
        ['u_iban','IBAN nájomcu (na vrátenie depozitu)'],
      ]},
      { title: 'Stav meračov', fields: [
        ['m_studena','Studená voda (m³)'],
        ['m_tepla','Teplá voda (m³)'],
        ['m_elektrika','Elektrika (kWh)'],
        ['m_teplo','Teplo'],
        ['m_kluceOdovzdane','Počet odovzdaných kľúčov'],
      ]},
      { title: 'Stav bytu', fields: [
        ['u_stav','Stav bytu','text',true],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['u_povodna_zmluva','zo dňa'],['u_datum_ukoncenia','ku dňu'],
      ['u_iban','IBAN'],
      ['m_studena','studenej vody'],['m_tepla','teplej vody'],
      ['m_elektrika','elektriky'],['m_teplo','tepla stav'],
      ['m_kluceOdovzdane','kľúčov'],
    ]
  },

  // ─── NÁBOROVÉ LISTY ───
  'nabor-byt-ak.docx': {
    title: 'Náborový list - byt',
    sections: [
      { title: 'Základné údaje', fields: [
        ['b_lokalita','Lokalita','text',true],
        ['b_izby','Počet izieb','number'],
        ['b_poschodie','Poschodie z/poschodí'],
        ['b_cena','Cena (EUR)','number'],
        ['b_vah','Výťah','select:Áno|Nie'],
        ['b_vek','Vek','select:Starý|Novostavba'],
      ]},
      { title: 'Plochy a parametre', fields: [
        ['b_plocha','Obytná plocha (m²)','number'],
        ['b_material','Materiál domu','select:Panel|Tehla|Železobetón|Iné'],
        ['b_orientacia','Orientácia (svetové strany)'],
        ['b_vstup','Vstup do domu','select:Voľný|Zámok|Zvonček|Vrátnik'],
        ['b_parkovanie','Parkovanie','select:Garáž|Garáž. státie|Parkovisko|Iné'],
        ['b_balkon','Balkón (m²)'],
        ['b_terasa','Terasa (m²)'],
        ['b_pivnica','Pivnica','select:Áno|Nie'],
      ]},
      { title: 'Stav a vybavenie', fields: [
        ['b_stav','Stav bytu','select:Pôvodný|Čiastočne rekonštr.|Kompletne rekonštr.|Novostavba'],
        ['b_kupelna','Kúpeľňa'],
        ['b_wc','WC','select:Samostatné|Spoločné'],
        ['b_okna','Okná'],
        ['b_dvere','Vchodové dvere','select:Pôvodné|Bezpečnostné'],
        ['b_tv','TV a internet','select:Optika|Bezdrôtový|ADSL'],
      ]},
      { title: 'Ďalšie informácie', fields: [
        ['b_financovanie','Financovanie','select:Hotovosť|Hypotéka + ŠFRB'],
        ['b_popis','Ďalší popis nehnuteľnosti','text',true],
        ['b_rekonstrukcie_domu','Rekonštrukcie byt. domu','text',true],
        ['b_rekonstrukcie_bytu','Rekonštrukcie bytu','text',true],
        ['b_podmienky_prevod','Prevod podmienený','text',true],
        ['b_podmienky_prenajom','Prenájom podmienený','text',true],
        ['b_poznamky','Iné poznámky','text',true],
        ['b_uvery','Úverové a záložné zmluvy','text',true],
      ]},
    ],
    repl: [['b_balkon','balkón'],['b_terasa','terasa']]
  },
  'nabor-dom-ak.docx': {
    title: 'Náborový list - dom',
    sections: [
      { title: 'Základné údaje', fields: [
        ['d_lokalita','Lokalita','text',true],
        ['d_izby','Počet izieb','number'],
        ['d_poschodia','Počet poschodí','number'],
        ['d_cena','Cena (EUR)','number'],
        ['d_vek','Vek (rok kolaudácie)'],
        ['d_rekonstruovany','Rekonštruovaný (rok)'],
      ]},
      { title: 'Plochy a parametre', fields: [
        ['d_plocha','Úžitková plocha (m²)','number'],
        ['d_pozemok','Pozemok (m²)','number'],
        ['d_material','Materiál domu','select:Panel|Tehla|Železobetón|Iné'],
        ['d_orientacia','Orientácia domu (svetové strany)'],
        ['d_orientacia_zahrada','Orientácia záhrady'],
        ['d_zateplenie','Zateplenie'],
        ['d_typ','Typ domu','select:Samostatný|Rohový|Radový|Dvojdom|Trojdom'],
      ]},
      { title: 'Vybavenie', fields: [
        ['d_parkovanie','Parkovanie','select:Garáž|Státie|Prístrešok|Parkovisko|Iné'],
        ['d_balkon','Balkón'],
        ['d_terasa','Terasa'],
        ['d_pivnica','Pivnica'],
        ['d_stav','Stav domu','select:Pôvodný|Čiastočne rekonštr.|Kompletne rekonštr.|Novostavba'],
        ['d_kurenie','Kúrenie','select:Centrálne|Lokálne|Elektrické|Tuhé palivo|Plyn|Iné'],
        ['d_okna','Okná'],
        ['d_dvere','Vchodové dvere','select:Pôvodné|Bezpečnostné'],
        ['d_strecha','Materiál strechy'],
        ['d_tv','TV a internet','select:Optika|Bezdrôtový|ADSL'],
      ]},
      { title: 'Ďalšie informácie', fields: [
        ['d_financovanie','Financovanie','select:Hotovosť|Hypotéka + ŠFRB'],
        ['d_popis','Ďalší popis nehnuteľnosti','text',true],
        ['d_zahrada','Vybavenie záhrady','text',true],
        ['d_podmienky_prevod','Prevod podmienený','text',true],
        ['d_podmienky_kupa','Kúpa podmienená','text',true],
        ['d_poznamky','Iné poznámky','text',true],
        ['d_uvery','Úverové a záložné zmluvy','text',true],
      ]},
    ],
    repl: []
  },

  // ─── PREBERACIE PROTOKOLY ───
  'preb.-protokol-najom.docx': {
    title: 'Preberací protokol - nájom',
    sections: [
      ..._fPersonFull('od_','Odovzdávajúci'),
      ..._fPersonFull('pr_','Preberajúci'),
      { title: 'Nehnuteľnosť', fields: [
        ['n_popis','Popis nehnuteľnosti','text',true],
      ]},
      { title: 'Zariadenie a vybavenie', fields: [
        ['z_kuchyna','Kuchyňa','text',true],
        ['z_kupelna','Kúpeľňa a WC','text',true],
        ['z_ine','Iné','text',true],
      ]},
      { title: 'Stav bytu', fields: [
        ['s_stav','Stav bytu','text',true],
        ['s_vady','Vady zistené pri preberaní','text',true],
      ]},
      { title: 'Stav meračov', fields: [
        ['m_elektromer','Elektromer č. / stav'],
        ['m_vodomer_tepla','Vodomer teplá voda č. / stav'],
        ['m_vodomer_studena','Vodomer studená voda č. / stav'],
        ['m_plynomer','Plynomer č. / stav'],
        ['m_teplo1','Merač tepla - izba 1'],['m_teplo2','Merač tepla - izba 2'],
        ['m_teplo3','Merač tepla - izba 3'],['m_teplo4','Merač tepla - kuchyňa'],
      ]},
      { title: 'Kľúče', fields: [
        ['k_byt','Od bytu (počet)','number'],['k_vchod','Od vchodu (počet)','number'],
        ['k_pivnica','Od pivnice (počet)','number'],['k_garaz','Od garáže (počet)','number'],
        ['k_schranka','Od schránky (počet)','number'],
      ]},
      { title: 'Kontakt na správcu', fields: [
        ['sp_meno','Meno správcu'],['sp_kontakt','Kontakt na správcu'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['m_elektromer','Elektromer'],['m_vodomer_tepla','teplá voda'],
      ['m_vodomer_studena','studená voda'],['m_plynomer','Plynomer'],
    ]
  },

  // ─── VECNÉ BREMENÁ ───
  'vb-vklad.docx': {
    title: 'Návrh na vklad vecného bremena do katastra',
    sections: [
      ..._fPerson('pov_','Povinný z vecného bremena'),
      ..._fPerson('opr_','Oprávnený z vecného bremena'),
      ..._fProperty(),
      { title: 'Okresný úrad', fields: [
        ['ou_nazov','Názov okresného úradu','text',true],
        ['ou_adresa','Adresa okresného úradu','text',true],
      ]},
      ..._fSignature(),
    ],
    repl: []
  },
  'vb-zriadenie.docx': {
    title: 'Zmluva o zriadení vecného bremena',
    sections: [
      ..._fPerson('pov_','Povinný z vecného bremena'),
      ..._fPerson('opr_','Oprávnený z vecného bremena'),
      ..._fProperty(),
      ..._fSignature(),
    ],
    repl: []
  },
  'vklad-zrusenie-vb-do-kn.docx': {
    title: 'Návrh na zrušenie vecného bremena v katastri',
    sections: [
      ..._fPerson('pov_','Povinný z vecného bremena'),
      ..._fPerson('opr_','Oprávnený z vecného bremena'),
      ..._fProperty(),
      { title: 'Referencia', fields: [
        ['r_z_cislo','Z-číslo (pôvodná evidencia)'],
        ['r_z_datum','Dátum pôvodnej evidencie','date'],
      ]},
      { title: 'Okresný úrad', fields: [
        ['ou_nazov','Názov okresného úradu','text',true],
        ['ou_adresa','Adresa okresného úradu','text',true],
      ]},
      ..._fSignature(),
    ],
    repl: []
  },
  'zrusenie-vb.docx': {
    title: 'Zmluva o zrušení vecného bremena',
    sections: [
      ..._fPerson('pov_','Povinný z vecného bremena'),
      ..._fPerson('opr_','Oprávnený z vecného bremena'),
      ..._fProperty(),
      { title: 'Referencia', fields: [
        ['r_z_cislo','Z-číslo (pôvodná evidencia)'],
        ['r_z_datum','Dátum pôvodnej evidencie','date'],
      ]},
      ..._fSignature(),
    ],
    repl: []
  },

  // ─── FINANČNÉ ───
  'zlozenie-zalohy-moderny-makler.docx': {
    title: 'Vyhlásenie o zložení finančnej zabezpeky',
    sections: [
      ..._fPerson('z1_','Záujemca - nájomca'),
      ..._fProperty(),
      { title: 'Finančné údaje', fields: [
        ['f_najomne','Výška nájomného (EUR)','number'],
        ['f_zaloha','Záloha za služby (EUR)','number'],
        ['f_zabezpeka','Finančná zabezpeka (EUR)','number'],
        ['f_deadline','Najneskôr do (podpis NZ)','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['n_ulica','na ulici'],['n_supisne','súpisné č.'],['n_lv','LV č'],
      ['n_byt','priestor č.'],['n_parking','státie č.'],
    ]
  },
  'vratenie-financnej-zabezpeky-2025.docx': {
    title: 'Vyhlásenie o vrátení finančnej zabezpeky',
    sections: [
      ..._fPerson('z1_','Záujemca - nájomca'),
      ..._fProperty(),
      { title: 'Finančné údaje', fields: [
        ['f_datum_nz','Dátum podpisu nájomnej zmluvy','date'],
        ['f_suma','Výška vrátenej zabezpeky (EUR)','number'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['n_byt','č.'],['n_ulica','ulici'],['n_supisne','súpisné č.'],['n_lv','LV č'],
      ['f_datum_nz','dňa'],['f_suma','výške'],
    ]
  },

  // ─── GDPR - jednoduché ───
  'gdpr-zamestnanec.docx': {
    title: 'GDPR informovanie - zamestnanec',
    sections: [
      { title: 'Dotknutá osoba', fields: [['do_meno','Meno a priezvisko','text',true]] },
      ..._fSignature(),
    ],
    repl: [['do_meno','preserve">.']] // first large dots = name
  },
  'informovanie-dotknutej-osoby-klient.docx': {
    title: 'GDPR informovanie - klient',
    sections: [
      { title: 'Dotknutá osoba', fields: [['do_meno','Meno a priezvisko dotknutej osoby','text',true]] },
      ..._fSignature(),
    ],
    repl: [['do_meno','preserve">.']]
  },
  'informovanie-dotknutej-osoby-uchadzac-o-zamestnanie.docx': {
    title: 'GDPR informovanie - uchádzač o zamestnanie',
    sections: [
      { title: 'Dotknutá osoba', fields: [['do_meno','Meno a priezvisko dotknutej osoby','text',true]] },
      ..._fSignature(),
    ],
    repl: [['do_meno','preserve">.']]
  },
  'informovanie-dotknutej-osoby-zaujemca-o-cenovu-ponuku.docx': {
    title: 'GDPR informovanie - záujemca o cenovú ponuku',
    sections: [
      { title: 'Dotknutá osoba', fields: [['do_meno','Meno a priezvisko dotknutej osoby','text',true]] },
      ..._fSignature(),
    ],
    repl: [['do_meno','preserve">.']]
  },
  'informovanie-dotknutej-osoby-potencialny-klient-marketingovy-ucel.docx': {
    title: 'GDPR informovanie - potenciálny klient (marketing)',
    sections: [ ..._fSignature() ],
    repl: []
  },
  'informovanie-dotknutej-osoby-staly-klient-marketingovy-ucel.docx': {
    title: 'GDPR informovanie - stály klient (marketing)',
    sections: [ ..._fSignature() ],
    repl: []
  },

  // ─── GDPR - súhlasy ───
  'suhlas.-uchadzac-o-zamestnaniedocx.docx': {
    title: 'Súhlas - uchádzač o zamestnanie',
    sections: [
      { title: 'Dotknutá osoba', fields: [
        ['do_meno','Meno a priezvisko'],
        ['do_adresa','Adresa pobytu','text',true],
        ['do_nar','Dátum narodenia','date'],
        ['do_email','E-mail','email'],
      ]},
      ..._fSignature(),
    ],
    // 4 dot sequences = name, address, DOB, email (in order)
    repl: []
  },
  'suhlas_marketingovy-ucel_potencialny-klient.docx': {
    title: 'Súhlas - marketingový účel (potenciálny klient)',
    sections: [
      { title: 'Dotknutá osoba', fields: [
        ['do_meno','Meno a priezvisko'],
        ['do_adresa','Adresa pobytu','text',true],
        ['do_nar','Dátum narodenia','date'],
        ['do_email','E-mail','email'],
      ]},
      ..._fSignature(),
    ],
    repl: []
  },

  // ─── GDPR - poučenie ───
  'poucenie-o-povereni-opravnenej-osoby-zamestnanec.docx': {
    title: 'Poučenie oprávnenej osoby - zamestnanec',
    sections: [
      { title: 'Oprávnená osoba', fields: [
        ['oo_meno','Titul, meno, priezvisko'],
        ['oo_pozicia','Pracovná pozícia'],
      ]},
      { title: 'Poučujúca osoba', fields: [
        ['po_meno','Titul, meno, priezvisko'],
      ]},
      { title: 'Dátum', fields: [
        ['p_datum','Dátum poučenia','date'],
      ]},
    ],
    repl: [
      ['oo_meno','meno, priezvisko:'],['oo_pozicia','pozícia:'],
    ]
  },

  // ─── ZMLUVY O SPRACÚVANÍ OÚ ───
  'zmluva-o-spracuvani-osobnych-udajov-bozp.docx': {
    title: 'Zmluva o spracúvaní OÚ - BOZP',
    sections: [
      { title: 'Sprostredkovateľ', fields: [
        ['sp_nazov','Názov spoločnosti','text',true],
        ['sp_pravna','Právna forma'],
        ['sp_sidlo','Sídlo','text',true],
        ['sp_ico','IČO'],
        ['sp_sud','Okresný súd'],
        ['sp_oddiel','Oddiel'],
        ['sp_vlozka','Vložka číslo'],
        ['sp_konatel','V mene koho koná'],
      ]},
      { title: 'Hlavná zmluva', fields: [
        ['hz_nazov','Názov zmluvy','text',true],
        ['hz_datum','Dátum zmluvy','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['sp_nazov','Názov:'],['sp_pravna','Právna forma:'],['sp_sidlo','Sídlo:'],
      ['sp_ico','IČO:'],['sp_sud','súdu '],['sp_oddiel','Oddiel:'],
      ['sp_vlozka','Vložka číslo:'],['sp_konatel','koná:'],
    ]
  },
  'zmluva-o-spracuvani-osobnych-udajov-ekonom-uctovnik.docx': {
    title: 'Zmluva o spracúvaní OÚ - ekonóm/účtovník',
    sections: [
      { title: 'Sprostredkovateľ', fields: [
        ['sp_nazov','Názov spoločnosti','text',true],['sp_pravna','Právna forma'],
        ['sp_sidlo','Sídlo','text',true],['sp_ico','IČO'],
        ['sp_sud','Okresný súd'],['sp_oddiel','Oddiel'],['sp_vlozka','Vložka číslo'],
        ['sp_konatel','V mene koho koná'],
      ]},
      { title: 'Hlavná zmluva', fields: [
        ['hz_nazov','Názov zmluvy','text',true],['hz_datum','Dátum zmluvy','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['sp_nazov','Názov:'],['sp_pravna','Právna forma:'],['sp_sidlo','Sídlo:'],
      ['sp_ico','IČO:'],['sp_sud','súdu '],['sp_oddiel','Oddiel:'],
      ['sp_vlozka','Vložka číslo:'],['sp_konatel','koná:'],
    ]
  },
  'zmluva-o-spracuvani-osobnych-udajov-pzs.docx': {
    title: 'Zmluva o spracúvaní OÚ - PZS',
    sections: [
      { title: 'Sprostredkovateľ', fields: [
        ['sp_nazov','Názov spoločnosti','text',true],['sp_pravna','Právna forma'],
        ['sp_sidlo','Sídlo','text',true],['sp_ico','IČO'],
        ['sp_sud','Okresný súd'],['sp_oddiel','Oddiel'],['sp_vlozka','Vložka číslo'],
        ['sp_konatel','V mene koho koná'],
      ]},
      { title: 'Hlavná zmluva', fields: [
        ['hz_nazov','Názov zmluvy','text',true],['hz_datum','Dátum zmluvy','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['sp_nazov','Názov:'],['sp_pravna','Právna forma:'],['sp_sidlo','Sídlo:'],
      ['sp_ico','IČO:'],['sp_sud','súdu '],['sp_oddiel','Oddiel:'],
      ['sp_vlozka','Vložka číslo:'],['sp_konatel','koná:'],
    ]
  },
  'zmluva-o-spracuvani-osobnych-udajov-szco.docx': {
    title: 'Zmluva o spracúvaní OÚ - SZČO',
    sections: [
      { title: 'Sprostredkovateľ', fields: [
        ['sp_nazov','Názov spoločnosti','text',true],['sp_pravna','Právna forma'],
        ['sp_sidlo','Sídlo','text',true],['sp_ico','IČO'],
        ['sp_sud','Okresný súd'],['sp_oddiel','Oddiel'],['sp_vlozka','Vložka číslo'],
        ['sp_konatel','V mene koho koná'],
      ]},
      { title: 'Hlavná zmluva', fields: [
        ['hz_nazov','Názov zmluvy','text',true],['hz_datum','Dátum zmluvy','date'],
      ]},
      ..._fSignature(),
    ],
    repl: [
      ['sp_nazov','Názov:'],['sp_pravna','Právna forma:'],['sp_sidlo','Sídlo:'],
      ['sp_ico','IČO:'],['sp_sud','súdu '],['sp_oddiel','Oddiel:'],
      ['sp_vlozka','Vložka číslo:'],['sp_konatel','koná:'],
    ]
  },

  // ─── OSTATNÉ ───
  'cestne-vyhlasenie-o-poskytnuti-ubytovania.docx': {
    title: 'Čestné vyhlásenie o poskytnutí ubytovania',
    sections: [
      ..._fPersonBasic('pr_','Prenajímateľ'),
      ..._fProperty(),
      { title: 'Obdobie a hosť', fields: [
        ['h_od','Ubytovanie od','date'],['h_do','Ubytovanie do','date'],
        ['h_meno','Meno a priezvisko hosťa'],
        ['h_adresa','Trvalý pobyt hosťa','text',true],
        ['h_nar','Dátum narodenia hosťa','date'],
        ['h_rc','Rodné číslo hosťa'],
        ['h_pas','Číslo pasu'],
      ]},
      ..._fSignature(),
    ],
    repl: [] // yellow highlighted fields - handled via ordered dots
  },
  'informacna-povinnost-dotknuta-osoba_kamery.docx': {
    title: 'Informačná povinnosť - kamery',
    sections: [
      { title: 'Nastavenie', fields: [['k_dni','Doba uchovávania záznamov (počet dní)','number']] },
    ],
    repl: []
  },
  'b.-smernica-o-bezpecnostnych-opatreniach-prevadzkovatela.docx': {
    title: 'Smernica o bezpečnostných opatreniach',
    sections: [
      { title: 'Základné údaje', fields: [['s_datum','Dátum prijatia smernice','date']] },
    ],
    repl: []
  },
  'zoznam-osob.docx': {
    title: 'Zoznam osôb oprávnených užívať byt',
    sections: [
      { title: 'Osoba 1', fields: [
        ['o1_meno','Meno a priezvisko'],['o1_rod','Rodné priezvisko'],
        ['o1_nar','Dátum narodenia','date'],['o1_rc','Rodné číslo'],
        ['o1_adresa','Adresa trvalého pobytu','text',true],
      ]},
      { title: 'Osoba 2', fields: [
        ['o2_meno','Meno a priezvisko'],['o2_rod','Rodné priezvisko'],
        ['o2_nar','Dátum narodenia','date'],['o2_rc','Rodné číslo'],
        ['o2_adresa','Adresa trvalého pobytu','text',true],
      ]},
      { title: 'Osoba 3', fields: [
        ['o3_meno','Meno a priezvisko'],['o3_rod','Rodné priezvisko'],
        ['o3_nar','Dátum narodenia','date'],['o3_rc','Rodné číslo'],
        ['o3_adresa','Adresa trvalého pobytu','text',true],
      ]},
    ],
    repl: []
  },

  // ─── STATICKÉ ───
  'informovanie-dotknutych-osob-webova-stranka.docx': null,
  'pouzitie-dokumentacie.docx': null,
};

let _currentDocFile = null;

function openDocForm(filename) {
  const formDef = DOC_FORMS[filename];
  if (!formDef) { downloadDoc(filename); return; }
  _currentDocFile = filename;
  document.getElementById('docform-title').textContent = formDef.title;
  const body = document.getElementById('docform-body');
  let html = '';
  for (const section of formDef.sections) {
    html += '<div class="docform-section">';
    html += '<div class="docform-section-title">' + section.title + '</div>';
    html += '<div class="docform-grid">';
    for (const f of section.fields) {
      const [id, label, type, full] = f;
      const cls = full ? ' full' : '';
      html += '<div class="docform-field' + cls + '">';
      html += '<label for="df_' + id + '">' + label + '</label>';
      if (type && type.startsWith('select:')) {
        const opts = type.substring(7).split('|');
        html += '<select id="df_' + id + '"><option value="">-- vyberte --</option>';
        for (const o of opts) html += '<option value="' + o + '">' + o + '</option>';
        html += '</select>';
      } else {
        html += '<input type="' + (type || 'text') + '" id="df_' + id + '" />';
      }
      html += '</div>';
    }
    html += '</div></div>';
  }
  body.innerHTML = html;
  document.getElementById('docFormOverlay').style.display = 'block';
}

function closeDocForm() {
  document.getElementById('docFormOverlay').style.display = 'none';
  _currentDocFile = null;
}

function _getDocFormValues() {
  if (!_currentDocFile) return {};
  const formDef = DOC_FORMS[_currentDocFile];
  if (!formDef) return {};
  const vals = {};
  for (const section of formDef.sections) {
    for (const f of section.fields) {
      const el = document.getElementById('df_' + f[0]);
      vals[f[0]] = el ? el.value : '';
    }
  }
  return vals;
}

// ─── DOCX FILLER ENGINE ───
async function generateFilledDocx() {
  if (!_currentDocFile) return;
  const formDef = DOC_FORMS[_currentDocFile];
  if (!formDef) return;

  const file = _currentDocFile;
  // .doc files can't be processed - just download template
  if (file.endsWith('.doc') && !file.endsWith('.docx')) {
    secAlert({title: 'Formát .doc', message: 'Tento formát (.doc) nepodporuje automatické vyplnenie. Stiahne sa šablóna.', type: 'warning'});
    downloadDoc(file);
    return;
  }

  const vals = _getDocFormValues();
  const btn = document.querySelector('.docform-btn-pdf');
  if (btn) { btn.disabled = true; btn.textContent = 'Generujem...'; }

  try {
    const resp = await fetch('/templates/' + file);
    if (!resp.ok) throw new Error('Šablóna nenájdená');
    const buf = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    let xml = await zip.file('word/document.xml').async('string');

    // 1) Apply contextual replacements (label-based)
    if (formDef.repl && formDef.repl.length) {
      for (const r of formDef.repl) {
        const val = vals[r[0]];
        if (!val) continue;
        const safeVal = _escXml(val);

        if (r[2] === 'exact') {
          // Exact string replacement
          xml = xml.split(r[1]).join(safeVal);
        } else {
          // Find label context, replace the next dot/underscore sequence after it
          const labelEsc = r[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp('(' + labelEsc + '[^<]*?)([\\.]{3,}|[_]{5,})');
          xml = xml.replace(regex, '$1' + safeVal);
        }
      }
    }

    // 2) For bullet-pattern documents (nova-sz), replace [ • ] in order
    if (formDef.pattern === 'bullets' && formDef.bulletOrder) {
      let bIdx = 0;
      xml = xml.replace(/\[\s*[•·]\s*\]/g, (match) => {
        if (bIdx < formDef.bulletOrder.length) {
          const fieldId = formDef.bulletOrder[bIdx];
          bIdx++;
          if (fieldId && vals[fieldId]) return _escXml(vals[fieldId]);
        }
        return match;
      });
    }

    // 3) For ordered dot replacement on simple docs (GDPR suhlas etc.)
    // If doc has no repl rules but has sections, do ordered dot replacement
    if ((!formDef.repl || formDef.repl.length === 0) && formDef.sections.length > 0) {
      const allFields = formDef.sections.flatMap(s => s.fields.map(f => f[0]));
      const filledFields = allFields.filter(id => vals[id]);
      if (filledFields.length > 0) {
        let fIdx = 0;
        xml = xml.replace(/\.{4,}/g, (match) => {
          if (fIdx < filledFields.length) {
            const val = vals[filledFields[fIdx]];
            if (val) { fIdx++; return _escXml(val); }
          }
          return match;
        });
      }
    }

    // Save modified XML back
    zip.file('word/document.xml', xml);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.replace(/\.docx$/, '_vyplnene.docx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    secAlert({title: 'Chyba', message: 'Chyba pri generovaní: ' + err.message, type: 'danger'});
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Vygenerovať DOCX'; }
  }
}

let _naborPreviewTimer = null;

function updateNaborPreview() {
  if (_naborPreviewTimer) clearTimeout(_naborPreviewTimer);
  _naborPreviewTimer = setTimeout(_doNaborPreview, 150);
}

function _doNaborPreview() {
  const type = document.getElementById('nabor-type')?.value;
  const el = document.getElementById('naborPreviewContent');
  if (!el || !type) return;

  const v = (id) => document.getElementById(id)?.value?.trim() || '';
  const c = (id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return '';
    return [...wrap.querySelectorAll('.nabor-chip.active')].map(x => x.textContent.trim()).join(', ');
  };

  let html = '';
  const titleText = type === 'byt' ? 'PRACOVNÝ LIST - BYT' : 'PRACOVNÝ LIST - RODINNÝ DOM';
  html += `<div class="np-title-bar">${titleText}</div>`;

  // Deferred-section helpers — section header is only rendered if at least one
  // non-empty row follows it. Sections with no content are dropped entirely.
  let pendingSection = null;
  const sec = (title) => { pendingSection = title; };
  const flushSec = () => {
    if (pendingSection !== null) {
      html += _npSection(pendingSection);
      pendingSection = null;
    }
  };
  const row = (label, value) => {
    const r = _npRow(label, value);
    if (r) { flushSec(); html += r; }
  };
  const row2 = (l1, v1, l2, v2) => {
    const r = _npRow2(l1, v1, l2, v2);
    if (r) { flushSec(); html += r; }
  };
  const multi = (label, value) => {
    const r = _npMulti(label, value);
    if (r) { flushSec(); html += r; }
  };

  if (type === 'byt') {
    sec('Základné údaje');
    row('Adresa', v('nb-adresa'));
    row2('Vlastníctvo', c('nb-vlastnictvo'), 'Vlastník', v('nb-vlastnik'));
    row2('Podiel', v('nb-podiel'), 'Správca bytovky', v('nb-spravca-bytovky'));
    row('Ťarcha', c('nb-tarcha'));

    sec('Bytový dom');
    row2('Vek BD', v('nb-vek-bd'), 'Výťah', c('nb-vytah'));
    row2('Materiál', c('nb-material-bd'), 'Vstup do BD', c('nb-vstup-bd'));
    row('Stav BD', c('nb-stav-bd'));
    row('Rekonštrukcia BD', v('nb-rekon-bd'));
    row('Parkovanie', c('nb-parkovanie-byt'));

    sec('Byt');
    row2('Počet izieb', v('nb-izby'), 'Poschodie', v('nb-poschodie'));
    row('Obytná plocha', v('nb-obytna-plocha') ? v('nb-obytna-plocha') + ' m²' : '');
    multi('Dispozícia', v('nb-dispozicia'));
    row('Vykurovanie', c('nb-vykurovanie-byt'));
    row('Ohrev vody', v('nb-ohrev-byt'));
    row2('Okná', c('nb-okna-byt'), 'Komory/Sklá', v('nb-komory-byt'));
    row2('Dvere', c('nb-dvere-byt'), 'Stav bytu', c('nb-stav-bytu'));

    sec('Príslušenstvo');
    row2('Pivnica', v('nb-pivnica-byt'), 'Terasa', v('nb-terasa-byt'));
    row2('Balkón', v('nb-balkon-byt'), 'Šatník', v('nb-satnik-byt'));
    row2('Špajza', v('nb-spajza-byt'), 'Park. miesto', v('nb-park-miesto'));

    sec('Rekonštrukcia bytu');
    row2('Rekonštrukcia', c('nb-rekon-byt'), 'Rok', v('nb-rekon-rok-byt'));
    multi('Rozpis', v('nb-rekon-rozpis-byt'));

    sec('Zariadenie');
    row('Zariadenie', c('nb-zariadenie-byt'));
    multi('Rozpis zariadenia', v('nb-zariadenie-rozpis-byt'));

    sec('Mesačné náklady');
    row2('Celkom', v('nb-naklady-celkom') ? v('nb-naklady-celkom') + ' €' : '', 'Správca', v('nb-naklady-spravca') ? v('nb-naklady-spravca') + ' €' : '');
    row2('Elektrika', v('nb-naklady-elektrika-byt') ? v('nb-naklady-elektrika-byt') + ' €' : '', 'Plyn', v('nb-naklady-plyn-byt') ? v('nb-naklady-plyn-byt') + ' €' : '');
    row2('Zateplenie', v('nb-zateplenie-byt'), 'Stupačky', v('nb-stupacky'));
    row2('Energ. certifikát', v('nb-ecert-byt'), 'Podlahy', v('nb-podlahy'));
    row('Ostatné', v('nb-naklady-ostatne-byt'));

    sec('Ostatné');
    row2('Internet', c('nb-internet-byt'), 'Poskytovateľ', v('nb-internet-provider-byt'));
    row('Vysťahovanie', v('nb-vystahovanie'));
    multi('Vady / poškodenia', v('nb-vady-byt'));
    multi('Poznámky', v('nb-poznamky-byt'));
    row('Podmienený prevod', v('nb-podmieneny-byt'));
    row('Kúpa novej - predstava', v('nb-nova-predstava-byt'));
    row('Financovanie', v('nb-financovanie-byt'));

    sec('Ceny a záver');
    row2('Odporúč. cena', v('nb-cena-odporucana-byt'), 'Cena do inzercie', v('nb-cena-inzercia-byt'));
    row('Provízia pre RK', v('nb-provizia-byt'));
    row('Nadobúdací doklad', v('nb-nadobudaci-byt'));
    row2('Telefón vlastníka', v('nb-tel-vlastnik'), 'Email vlastníka', v('nb-email-vlastnik'));
    row2('Fotenie', v('nb-fotenie-byt'), 'Inzercia', v('nb-inzercia-byt'));
    row2('Maklér', v('nb-makler-byt'), 'Dátum', v('nb-datum-byt'));

  } else {
    sec('Základné údaje');
    row('Adresa', v('nd-adresa'));
    row2('Počet podlaží', v('nd-podlazia'), 'Počet izieb', v('nd-izby'));
    row('Typ RD', c('nd-typ-rd'));
    row('Stav RD', c('nd-stav-rd'));

    sec('Rodinný dom');
    row2('Vek RD', v('nd-vek-rd'), 'Energ. certifikát', v('nd-ecert'));
    row2('Zastavaná plocha', v('nd-zastavana') ? v('nd-zastavana') + ' m²' : '', 'Úžitková plocha', v('nd-uzitkova') ? v('nd-uzitkova') + ' m²' : '');
    row('Pozemok celkom', v('nd-pozemok') ? v('nd-pozemok') + ' m²' : '');

    sec('Inžinierske siete');
    row2('Elektrika', c('nd-elektrika'), 'Voda', c('nd-voda'));
    row2('Odpad', c('nd-odpad'), 'Žumpa (m³)', v('nd-zumpa-m3'));
    row('Plyn', c('nd-plyn'));

    sec('Konštrukcia');
    row('Materiál', c('nd-material'));
    row2('Obvodové murivo', v('nd-murivo'), 'Deliace priečky', v('nd-priecky'));
    row2('Zateplenie', c('nd-zateplenie'), 'Hrúbka', v('nd-zateplenie-hrubka'));
    row('Fasáda', v('nd-fasada'));

    sec('Strecha');
    row('Typ strechy', c('nd-strecha-typ'));
    row('Materiál strechy', c('nd-strecha-mat'));
    row('Izolácia', v('nd-strecha-izolacia'));

    sec('Okná, dvere, zabezpečenie');
    row2('Okná', c('nd-okna'), 'Komory/Sklá', v('nd-komory'));
    row('Žalúzie', c('nd-zaluzie'));
    row2('Vstupné dvere', c('nd-dvere'), 'Zabezpečenie', c('nd-zabezpecenie'));

    sec('Vykurovanie a vybavenie');
    row2('Krb', c('nd-krb'), 'Klimatizácia', c('nd-klima'));
    row('Vykurovanie', c('nd-vykurovanie'));
    row('Ohrev vody', v('nd-ohrev'));
    multi('Dispozícia RD', v('nd-dispozicia'));

    sec('Príslušenstvo');
    row2('Pivnica', v('nd-pivnica'), 'Terasa', v('nd-terasa'));
    row2('Balkón', v('nd-balkon'), 'Povala', v('nd-povala'));

    sec('Rekonštrukcia');
    row2('Rekonštrukcia', c('nd-rekon'), 'Rok', v('nd-rekon-rok'));
    multi('Rozpis', v('nd-rekon-rozpis'));

    sec('Zariadenie');
    row('Zariadenie', c('nd-zariadenie'));
    multi('Rozpis zariadenia', v('nd-zariadenie-rozpis'));

    sec('Exteriér');
    row('Parkovanie', c('nd-parkovanie'));
    row2('Garáž', v('nd-garaz'), 'Altánok', v('nd-altanok'));
    row2('Bazén', v('nd-bazen'), 'Studňa', v('nd-studna'));
    row('Iná stavba', v('nd-ina-stavba'));
    multi('Rozpis exteriéru', v('nd-ext-rozpis'));

    sec('Mesačné náklady');
    row2('Elektrika', v('nd-naklady-elektrika') ? v('nd-naklady-elektrika') + ' €' : '', 'Voda', v('nd-naklady-voda') ? v('nd-naklady-voda') + ' €' : '');
    row2('Plyn', v('nd-naklady-plyn') ? v('nd-naklady-plyn') + ' €' : '', 'Žumpa', v('nd-naklady-zumpa') ? v('nd-naklady-zumpa') + ' €' : '');
    row2('Odpad', v('nd-naklady-odpad') ? v('nd-naklady-odpad') + ' €' : '', 'TV', v('nd-naklady-tv') ? v('nd-naklady-tv') + ' €' : '');
    row('Internet', v('nd-naklady-internet') ? v('nd-naklady-internet') + ' €' : '');
    row2('Poskytovateľ', v('nd-internet-provider'), 'Typ pripojenia', c('nd-internet-typ'));

    sec('Ostatné');
    multi('Vady / poškodenia', v('nd-vady'));
    multi('Poznámky', v('nd-poznamky'));
    row('Podmienený prevod', v('nd-podmieneny'));

    sec('Vlastníctvo');
    row('Vlastníctvo', c('nd-vlastnictvo'));
    row2('Vlastník 1', v('nd-vlastnik1'), 'Podiel 1', v('nd-podiel1'));
    row2('Vlastník 2', v('nd-vlastnik2'), 'Podiel 2', v('nd-podiel2'));
    row('Ťarcha', c('nd-tarcha'));
    row('Nadobúdací doklad', v('nd-nadobudaci'));
    row('Dokumenty', v('nd-dokumenty'));

    sec('Ceny a záver');
    row2('Odporúč. cena', v('nd-cena-odporucana'), 'Cena do inzercie', v('nd-cena-inzercia'));
    row('Provízia pre RK', v('nd-provizia'));
    row2('Fotenie', v('nd-fotenie'), 'Inzercia', v('nd-inzercia'));
    row2('Maklér', v('nd-makler'), 'Dátum', v('nd-datum'));
  }

  html += `<div class="np-footer">Vygenerované v SecPro | ${new Date().toLocaleDateString('sk-SK')}</div>`;
  el.innerHTML = html;
}

// ==================== PROTOCOL LIVE PREVIEW ====================

let _protoPreviewTimer = null;

function updateProtocolPreview() {
  if (_protoPreviewTimer) clearTimeout(_protoPreviewTimer);
  _protoPreviewTimer = setTimeout(_doProtocolPreview, 150);
}

function _doProtocolPreview() {
  const el = document.getElementById('protocolPreviewContent');
  if (!el) return;

  const propId = document.getElementById('proto-prop-id')?.value;
  const props = typeof getProperties === 'function' ? getProperties() : [];
  const p = props.find(x => x.id === propId);

  const viewIdx = document.getElementById('proto-viewing-select')?.value;
  const v = (p && viewIdx !== '' && p.viewings) ? p.viewings[parseInt(viewIdx)] : null;

  const brokerName = document.getElementById('proto-broker-name')?.value?.trim() || '';
  const clientName = document.getElementById('proto-client-name')?.value?.trim() || '';
  const notes = document.getElementById('proto-notes')?.value?.trim() || '';

  const em = (val) => val || '<span class="np-empty">\u2014</span>';

  let html = '';

  // Header
  html += `<div style="background:#0B2A3C;color:white;padding:0.8rem 1rem;border-radius:6px;margin-bottom:0.8rem;">
    <div style="font-size:16px;font-weight:700;">Protokol o prehliadke</div>
    <div style="font-size:10px;opacity:0.7;margin-top:2px;">nehnuteľnosti</div>
    <div style="font-size:9px;opacity:0.5;text-align:right;margin-top:-14px;">SecPro | ${new Date().toLocaleDateString('sk-SK')}</div>
  </div>`;
  html += `<div style="height:3px;background:linear-gradient(90deg,#2EC4D4,#1A7A8A);border-radius:2px;margin-bottom:1rem;"></div>`;

  // Property info
  html += `<div style="background:#F0F9F7;border-radius:6px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;">
    <div style="font-weight:700;font-size:11px;color:#0B2A3C;margin-bottom:0.4rem;">Informácie o nehnuteľnosti</div>`;
  if (p) {
    html += _npRow('Názov', em(p.title));
    html += _npRow('Adresa', em([p.address, p.city, p.district].filter(Boolean).join(', ')));
    html += _npRow('Cena', p.price ? p.price.toLocaleString('sk-SK') + ' EUR' : em(''));
    html += _npRow('Vlastník', em(p.ownerName || p.owner));
  } else {
    html += `<div class="np-empty" style="padding:0.3rem 0;">Nehnuteľnosť nebola nájdená</div>`;
  }
  html += `</div>`;

  // Viewing info
  if (v) {
    const d = v.date ? new Date(v.date) : null;
    const ds = d ? d.toLocaleDateString('sk-SK') + ' ' + d.toLocaleTimeString('sk-SK', {hour:'2-digit',minute:'2-digit'}) : '\u2014';
    html += `<div style="background:#EFF6FF;border-radius:6px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;">
      <div style="font-weight:700;font-size:11px;color:#0B2A3C;margin-bottom:0.4rem;">Prehliadka</div>`;
    html += _npRow('Dátum', ds);
    html += _npRow('Záujemca', em(v.personName));
    html += _npRow('Spôsob', v.type || '\u2014');
    html += _npRow('Výsledok', v.result || '\u2014');
    if (v.feedback) html += _npRow('Spätná väzba', v.feedback);
    html += `</div>`;
  } else {
    html += `<div style="background:#EFF6FF;border-radius:6px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;">
      <div class="np-empty" style="font-size:10px;">Vyberte prehliadku z rozbaľovacieho zoznamu</div>
    </div>`;
  }

  // Notes
  if (notes) {
    html += `<div style="margin-bottom:0.8rem;">
      <div style="font-weight:700;font-size:11px;color:#0B2A3C;margin-bottom:0.3rem;">Poznámky</div>
      <div class="np-multi">${notes.replace(/\n/g, '<br>')}</div>
    </div>`;
  }

  // Signatures
  html += `<div style="display:flex;gap:1rem;margin-top:0.8rem;">
    <div style="flex:1;text-align:center;">
      <div style="font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.3rem;">Maklér</div>
      <div style="font-weight:600;font-size:11px;min-height:16px;">${em(brokerName)}</div>
      <div style="border:1px dashed #CBD5E1;border-radius:4px;height:50px;margin-top:0.3rem;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:9px;color:#CBD5E1;">podpis</span>
      </div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.3rem;">Záujemca</div>
      <div style="font-weight:600;font-size:11px;min-height:16px;">${em(clientName)}</div>
      <div style="border:1px dashed #CBD5E1;border-radius:4px;height:50px;margin-top:0.3rem;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:9px;color:#CBD5E1;">podpis</span>
      </div>
    </div>
  </div>`;

  html += `<div class="np-footer">Vygenerované v SecPro | ${new Date().toLocaleDateString('sk-SK')}</div>`;
  el.innerHTML = html;
}

// Wire up live preview listeners on both modals
(function() {
  function wireListeners() {
    const naborModal = document.getElementById('naborModal');
    if (naborModal) {
      naborModal.addEventListener('input', updateNaborPreview);
      naborModal.addEventListener('change', updateNaborPreview);
    }
    const protoModal = document.getElementById('protocolModal');
    if (protoModal) {
      protoModal.addEventListener('input', updateProtocolPreview);
      protoModal.addEventListener('change', updateProtocolPreview);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireListeners);
  } else {
    wireListeners();
  }
})();

// ==================== E-SIGNATURE ====================
// Reusable signature pad + audit trail.

function getSignatures() { return _getCached('signatures', []) || []; }
function saveSignatures(arr) { _setCached('signatures', arr); }

// SHA-256 hash helper (async, returns hex string)
async function sha256Hex(str) {
  try {
    const buf = new TextEncoder().encode(str || '');
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}

let _sigPadState = null; // { ctx, drawing, hasInk, onConfirm, context }

function openSignaturePad(opts) {
  // opts: { title, subtitle, signerName, signerRole, documentType, documentId, docRef, docPayload, allowSaveToProfile, onConfirm }
  const modal = document.getElementById('signature-modal');
  if (!modal) return;
  document.getElementById('sig-title').textContent = opts.title || 'Elektronický podpis';
  document.getElementById('sig-subtitle').textContent = opts.subtitle || 'Podpíšte sa v rámčeku nižšie';
  document.getElementById('sig-signer-name').value = opts.signerName || '';
  document.getElementById('sig-save-to-profile').checked = false;
  document.getElementById('sig-save-to-profile-wrap').style.display = (opts.allowSaveToProfile === false) ? 'none' : '';

  const profile = (typeof getProfile === 'function') ? getProfile() : {};
  const storedRow = document.getElementById('sig-stored-row');
  if (profile && profile.signature && opts.allowUseStored !== false) {
    storedRow.style.display = 'flex';
  } else {
    storedRow.style.display = 'none';
  }

  const canvas = document.getElementById('sig-canvas');
  // Fit internal resolution to displayed size for crisp lines
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(600, Math.floor(rect.width * (window.devicePixelRatio || 1)));
  canvas.height = Math.floor(220 * (window.devicePixelRatio || 1));
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0B2A3C';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  document.getElementById('sig-placeholder').style.display = 'flex';

  _sigPadState = {
    ctx, canvas, drawing: false, hasInk: false,
    onConfirm: opts.onConfirm || (() => {}),
    context: {
      documentType: opts.documentType || 'other',
      documentId: opts.documentId || '',
      docRef: opts.docRef || '',
      docPayload: opts.docPayload || '',
      signerRole: opts.signerRole || '',
    }
  };

  _attachSigPadEvents();
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeSignaturePad(confirmed) {
  const modal = document.getElementById('signature-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  _detachSigPadEvents();
  if (!confirmed) _sigPadState = null;
}

function clearSignatureCanvas() {
  if (!_sigPadState) return;
  const { ctx, canvas } = _sigPadState;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  _sigPadState.hasInk = false;
  document.getElementById('sig-placeholder').style.display = 'flex';
}

function useStoredSignature() {
  const profile = (typeof getProfile === 'function') ? getProfile() : {};
  if (!profile.signature || !_sigPadState) return;
  const { ctx, canvas } = _sigPadState;
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Fit image centered inside canvas display size
    const dispW = canvas.width / (window.devicePixelRatio || 1);
    const dispH = canvas.height / (window.devicePixelRatio || 1);
    const ratio = Math.min(dispW / img.width, dispH / img.height) * 0.85;
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, (dispW - w) / 2, (dispH - h) / 2, w, h);
    _sigPadState.hasInk = true;
    document.getElementById('sig-placeholder').style.display = 'none';
  };
  img.src = profile.signature;
  if (profile.name && !document.getElementById('sig-signer-name').value.trim()) {
    document.getElementById('sig-signer-name').value = profile.name;
  }
}

function _sigPointerPos(ev) {
  const canvas = _sigPadState.canvas;
  const rect = canvas.getBoundingClientRect();
  const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
  const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
  return { x: cx, y: cy };
}

function _sigStart(ev) {
  if (!_sigPadState) return;
  ev.preventDefault();
  _sigPadState.drawing = true;
  const p = _sigPointerPos(ev);
  const { ctx } = _sigPadState;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  _sigPadState.hasInk = true;
  document.getElementById('sig-placeholder').style.display = 'none';
}

function _sigMove(ev) {
  if (!_sigPadState || !_sigPadState.drawing) return;
  ev.preventDefault();
  const p = _sigPointerPos(ev);
  const { ctx } = _sigPadState;
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function _sigEnd() {
  if (!_sigPadState) return;
  _sigPadState.drawing = false;
}

function _attachSigPadEvents() {
  if (!_sigPadState) return;
  const c = _sigPadState.canvas;
  c.addEventListener('mousedown', _sigStart);
  c.addEventListener('mousemove', _sigMove);
  window.addEventListener('mouseup', _sigEnd);
  c.addEventListener('touchstart', _sigStart, { passive: false });
  c.addEventListener('touchmove', _sigMove, { passive: false });
  c.addEventListener('touchend', _sigEnd);
}

function _detachSigPadEvents() {
  if (!_sigPadState) return;
  const c = _sigPadState.canvas;
  c.removeEventListener('mousedown', _sigStart);
  c.removeEventListener('mousemove', _sigMove);
  window.removeEventListener('mouseup', _sigEnd);
  c.removeEventListener('touchstart', _sigStart);
  c.removeEventListener('touchmove', _sigMove);
  c.removeEventListener('touchend', _sigEnd);
}

async function confirmSignaturePad() {
  if (!_sigPadState) return;
  const name = document.getElementById('sig-signer-name').value.trim();
  if (!name) { alert('Zadajte meno podpisujúceho.'); return; }
  if (!_sigPadState.hasInk) { alert('Najprv sa podpíšte.'); return; }
  const dataUrl = _sigPadState.canvas.toDataURL('image/png');
  const saveToProfile = document.getElementById('sig-save-to-profile').checked;
  const ctx = _sigPadState.context;

  // Record audit entry
  const docHash = await sha256Hex((ctx.docPayload || '') + '|' + (ctx.docRef || ''));
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    documentType: ctx.documentType,
    documentId: ctx.documentId,
    documentRef: ctx.docRef,
    signerName: name,
    signerRole: ctx.signerRole || '',
    signatureDataUrl: dataUrl,
    docHash,
    signedAt: new Date().toISOString(),
  };
  const list = getSignatures();
  list.unshift(entry);
  saveSignatures(list);

  // Optionally store signature in profile for reuse
  if (saveToProfile && typeof getProfile === 'function') {
    const prof = getProfile();
    prof.signature = dataUrl;
    prof.updatedAt = new Date().toISOString();
    if (typeof saveProfileData === 'function') saveProfileData(prof);
  }

  const onConfirm = _sigPadState.onConfirm;
  closeSignaturePad(true);
  _sigPadState = null;
  try { onConfirm(dataUrl, entry); } catch (e) { console.error(e); }
  if (typeof showToast === 'function') showToast('Podpis zaznamenaný', 'success');
}

// ==================== SIGNATURES HISTORY PAGE ====================
const SIG_DOC_TYPE_LABELS = {
  profile: { label: 'Profilový podpis', icon: '👤', color: '#7C3AED' },
  aml: { label: 'AML preverenie', icon: '🛡️', color: '#0891B2' },
  nabor: { label: 'Náborový list', icon: '📋', color: '#0D9488' },
  document: { label: 'Dokument', icon: '📄', color: '#2563EB' },
  protocol: { label: 'Protokol o prehliadke', icon: '🔍', color: '#D97706' },
  other: { label: 'Iný dokument', icon: '✍️', color: '#64748B' },
};

function renderSignatures() {
  const listEl = document.getElementById('sig-list');
  const emptyEl = document.getElementById('sig-empty');
  const countEl = document.getElementById('sig-count');
  if (!listEl) return;
  const sigs = getSignatures();
  if (countEl) countEl.textContent = sigs.length + ' ' + (sigs.length === 1 ? 'podpis' : (sigs.length >= 2 && sigs.length <= 4 ? 'podpisy' : 'podpisov'));
  if (sigs.length === 0) {
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = '';
  listEl.innerHTML = sigs.map(s => {
    const meta = SIG_DOC_TYPE_LABELS[s.documentType] || SIG_DOC_TYPE_LABELS.other;
    const dt = new Date(s.signedAt);
    const date = dt.toLocaleDateString('sk-SK') + ' ' + dt.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="sig-card">
        <div class="sig-card-head">
          <span class="sig-type-chip" style="background:${meta.color}1a;color:${meta.color};">${meta.icon} ${meta.label}</span>
          <span class="sig-date">${date}</span>
        </div>
        <div class="sig-card-body">
          <div class="sig-meta">
            <div><span class="sig-label">Podpísal:</span> <b>${esc(s.signerName)}</b>${s.signerRole ? ' <span style="color:var(--text-light);font-size:0.75rem;">(' + esc(s.signerRole) + ')</span>' : ''}</div>
            ${s.documentRef ? `<div><span class="sig-label">Dokument:</span> ${esc(s.documentRef)}</div>` : ''}
            ${s.docHash ? `<div class="sig-hash"><span class="sig-label">Hash:</span> <code>${esc(s.docHash.slice(0,16))}…</code></div>` : ''}
          </div>
          <img class="sig-img" src="${s.signatureDataUrl}" alt="Podpis" />
        </div>
        <div class="sig-card-footer">
          <button class="sig-btn-view" onclick="viewSignatureEntry('${s.id}')">Zobraziť</button>
          <button class="sig-btn-delete" onclick="deleteSignatureEntry('${s.id}')">Vymazať</button>
        </div>
      </div>
    `;
  }).join('');
}

function viewSignatureEntry(id) {
  const s = getSignatures().find(x => x.id === id);
  if (!s) return;
  const w = window.open('', '_blank', 'width=640,height=520');
  if (!w) return;
  const meta = SIG_DOC_TYPE_LABELS[s.documentType] || SIG_DOC_TYPE_LABELS.other;
  w.document.write(`
    <html><head><title>Podpis - ${esc(s.signerName)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;background:#F8FAFC;color:#0B2A3C;} .box{background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:580px;margin:auto;} img{max-width:100%;border:1px solid #E2E8F0;border-radius:8px;background:#fff;} h2{margin:0 0 1rem;} .row{margin:0.4rem 0;font-size:0.9rem;} code{background:#F1F5F9;padding:2px 6px;border-radius:4px;font-size:0.8rem;}</style>
    </head><body><div class="box">
    <h2>${meta.icon} ${meta.label}</h2>
    <div class="row"><b>Podpísal:</b> ${esc(s.signerName)}${s.signerRole ? ' (' + esc(s.signerRole) + ')' : ''}</div>
    <div class="row"><b>Čas podpisu:</b> ${new Date(s.signedAt).toLocaleString('sk-SK')}</div>
    ${s.documentRef ? `<div class="row"><b>Dokument:</b> ${esc(s.documentRef)}</div>` : ''}
    ${s.docHash ? `<div class="row"><b>SHA-256 hash:</b> <code>${esc(s.docHash)}</code></div>` : ''}
    <div class="row" style="margin-top:1rem;"><b>Podpis:</b></div>
    <img src="${s.signatureDataUrl}" />
    </div></body></html>
  `);
}

async function deleteSignatureEntry(id) {
  const ok = (typeof secConfirm === 'function')
    ? await secConfirm({ message: 'Naozaj chcete vymazať tento záznam podpisu? Audit stopa bude stratená.', type: 'danger', ok: 'Vymazať' })
    : confirm('Vymazať tento podpis?');
  if (!ok) return;
  saveSignatures(getSignatures().filter(s => s.id !== id));
  renderSignatures();
}

// ═══════════════════════════════════════════════════════════════
//  REMOTE SIGNATURES — send link to client, track status
// ═══════════════════════════════════════════════════════════════

const RS_STATUS_LABELS = {
  pending: { label: 'Čaká na podpis', cls: 'rs-status-pending' },
  signed:  { label: 'Podpísané',      cls: 'rs-status-signed'  },
  expired: { label: 'Vypršané',       cls: 'rs-status-expired' },
};

function switchSigTab(tab) {
  document.getElementById('sig-tab-remote').classList.toggle('active', tab === 'remote');
  document.getElementById('sig-tab-local').classList.toggle('active', tab === 'local');
  document.getElementById('sig-panel-remote').style.display = tab === 'remote' ? '' : 'none';
  document.getElementById('sig-panel-local').style.display = tab === 'local' ? '' : 'none';
  if (tab === 'remote') refreshRemoteSignatures();
  if (tab === 'local') renderSignatures();
}

let _remoteSignCache = null;
let _remoteSignLastFetch = 0;

async function refreshRemoteSignatures() {
  const token = getStoredToken();
  if (!token) { renderRemoteSignatures([]); return; }

  // Cache for 15 seconds to avoid spamming
  const now = Date.now();
  if (_remoteSignCache && (now - _remoteSignLastFetch) < 15000) {
    renderRemoteSignatures(_remoteSignCache);
    return;
  }

  try {
    const r = await secureFetch('/api/sign/list', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!r.ok) { renderRemoteSignatures([]); return; }
    const data = await r.json();
    _remoteSignCache = data.items || [];
    _remoteSignLastFetch = now;
    renderRemoteSignatures(_remoteSignCache);
    // Sync property.nabor.remoteRequest signed-status from the freshly fetched list
    _syncSignedStatusToProperties(_remoteSignCache);
  } catch (e) {
    console.warn('[SecPro] Failed to fetch remote signatures:', e);
    renderRemoteSignatures(_remoteSignCache || []);
  }
}

// Walk all properties with a pending remote request and persist signed-state +
// fetch the full record (signature image) for any that have been signed since
// last refresh. Triggers a re-render of the property cards if anything changed.
async function _syncSignedStatusToProperties(remoteList) {
  if (!Array.isArray(remoteList) || remoteList.length === 0) return;
  const props = getProperties();
  let changed = false;

  for (const p of props) {
    const rr = p.nabor && p.nabor.remoteRequest;
    if (!rr || !rr.token) continue;
    if (rr.signedAt) continue;            // already synced as signed
    const match = remoteList.find(s => s.token === rr.token);
    if (!match) continue;
    if (match.status !== 'signed') continue;

    // Pull the full record (with signatureDataUrl) so we can display it
    rr.signedAt = match.signedAt || new Date().toISOString();
    rr.signedByName = match.signedByName || rr.signerName;
    try {
      const sToken = getStoredToken();
      if (sToken) {
        const r = await secureFetch('/api/sign/list?detail=' + rr.token, {
          headers: { 'Authorization': 'Bearer ' + sToken },
        });
        if (r.ok) {
          const data = await r.json();
          const rec = data.record || {};
          if (rec.signatureDataUrl) {
            rr.signedSignatureDataUrl = rec.signatureDataUrl;
            rr.signedByIp = rec.signedByIp || null;
          }
        }
      }
    } catch (e) {
      console.warn('[SecPro] Failed to fetch full signed record for token', rr.token);
    }
    changed = true;
  }

  if (changed) {
    saveProperties(props);
    if (typeof renderProperties === 'function') renderProperties();
  }
}

function renderRemoteSignatures(items) {
  const listEl = document.getElementById('remote-sig-list');
  const emptyEl = document.getElementById('remote-sig-empty');
  const countEl = document.getElementById('remote-sig-count');
  if (!listEl) return;

  if (!items || items.length === 0) {
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    if (countEl) countEl.textContent = '0 žiadostí';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = '';
  if (countEl) {
    const n = items.length;
    countEl.textContent = n + ' ' + (n === 1 ? 'žiadosť' : (n >= 2 && n <= 4 ? 'žiadosti' : 'žiadostí'));
  }

  const host = window.location.origin;
  listEl.innerHTML = items.map(item => {
    const st = RS_STATUS_LABELS[item.status] || RS_STATUS_LABELS.pending;
    const created = new Date(item.createdAt);
    const dateStr = created.toLocaleDateString('sk-SK') + ' ' + created.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
    const signUrl = host + '/sign.html?token=' + item.token;
    const signedRow = item.signedAt
      ? `<div style="margin-top:4px;font-size:0.75rem;color:#065F46;">Podpísané: ${new Date(item.signedAt).toLocaleString('sk-SK')}</div>`
      : '';
    const linkRow = item.status === 'pending'
      ? `<div class="rs-link-row"><input value="${esc(signUrl)}" readonly onclick="this.select()"><button onclick="copyText('${esc(signUrl)}')">Kopírovať</button></div>`
      : '';

    return `
      <div class="sig-card">
        <div class="sig-card-head">
          <span class="rs-status ${st.cls}">${st.label}</span>
          <span class="sig-date">${dateStr}</span>
        </div>
        <div class="sig-card-body">
          <div class="sig-meta">
            <div><span class="sig-label">Dokument:</span> <b>${esc(item.documentRef)}</b></div>
            <div><span class="sig-label">Podpisujúci:</span> ${esc(item.signerName)}</div>
            ${signedRow}
          </div>
        </div>
        <div class="sig-card-footer">
          ${item.status === 'signed' ? `<button class="sig-btn-view" onclick="viewRemoteSignature('${item.token}')">Zobraziť podpis</button>` : ''}
          ${item.status === 'pending' ? `<button class="sig-btn-view" onclick="copyText('${esc(signUrl)}')">Kopírovať link</button>` : ''}
          ${linkRow}
        </div>
      </div>
    `;
  }).join('');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link skopírovaný do schránky!', 'success');
  }).catch(() => {
    // Fallback
    const inp = document.createElement('input');
    inp.value = text;
    document.body.appendChild(inp);
    inp.select();
    document.execCommand('copy');
    document.body.removeChild(inp);
    showToast('Link skopírovaný!', 'success');
  });
}

async function viewRemoteSignature(token) {
  const sessionToken = getStoredToken();
  if (!sessionToken) return;
  try {
    const r = await secureFetch('/api/sign/list?detail=' + token, {
      headers: { 'Authorization': 'Bearer ' + sessionToken },
    });
    if (!r.ok) { showToast('Nepodarilo sa načítať podpis', 'error'); return; }
    const data = await r.json();
    const rec = data.record;
    if (!rec) return;

    const w = window.open('', '_blank', 'width=640,height=560');
    if (!w) return;
    w.document.write(`<html><head><title>Vzdialený podpis - ${esc(rec.signedByName || rec.signerName)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;background:#F8FAFC;color:#0B2A3C;}
      .box{background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:580px;margin:auto;}
      img{max-width:100%;border:1px solid #E2E8F0;border-radius:8px;background:#fff;}
      h2{margin:0 0 1rem;} .row{margin:0.4rem 0;font-size:0.9rem;}</style>
    </head><body><div class="box">
      <h2>Vzdialený podpis</h2>
      <div class="row"><b>Dokument:</b> ${esc(rec.documentRef)}</div>
      <div class="row"><b>Podpísal:</b> ${esc(rec.signedByName || rec.signerName)}${rec.signerRole ? ' (' + esc(rec.signerRole) + ')' : ''}</div>
      <div class="row"><b>Čas podpisu:</b> ${rec.signedAt ? new Date(rec.signedAt).toLocaleString('sk-SK') : '—'}</div>
      <div class="row"><b>IP adresa:</b> ${esc(rec.signedByIp || '—')}</div>
      <div class="row"><b>Stav:</b> ${esc(rec.status)}</div>
      ${rec.signatureDataUrl ? '<div class="row" style="margin-top:1rem;"><b>Podpis:</b></div><img src="' + rec.signatureDataUrl + '" />' : ''}
    </div></body></html>`);
  } catch (e) {
    showToast('Chyba pri načítaní', 'error');
  }
}

// ── Remote sign request modal ──
// Auto-defaults based on document type
const RS_DOC_DEFAULTS = {
  nabor:    { prefix: 'Náborový list',          role: 'Predávajúci' },
  aml:      { prefix: 'AML preverenie',         role: 'Preverovaná osoba' },
  zmluva:   { prefix: 'Zmluva',                 role: 'Zmluvná strana' },
  protokol: { prefix: 'Odovzdávací protokol',   role: 'Preberajúci' },
  other:    { prefix: 'Dokument',               role: '' },
};

function updateRsDefaults() {
  // Just updates hidden role when type changes
  const t = document.getElementById('rs-doc-type').value;
  const def = RS_DOC_DEFAULTS[t] || RS_DOC_DEFAULTS.other;
  document.getElementById('rs-signer-role').value = def.role;
}

function openRemoteSignModal(presets) {
  const p = presets || {};
  document.getElementById('rs-doc-type').value = p.documentType || 'nabor';
  document.getElementById('rs-doc-detail').value = p.docDetail || '';
  document.getElementById('rs-signer-name').value = p.signerName || '';
  document.getElementById('rs-signer-role').value = p.signerRole || '';
  document.getElementById('rs-signer-email').value = p.signerEmail || '';
  document.getElementById('rs-signer-phone').value = p.signerPhone || '';
  document.getElementById('rs-message').value = '';
  const msgText = document.getElementById('rs-message-text');
  if (msgText) msgText.value = p.message || '';
  const expSel = document.getElementById('rs-expires-select');
  if (expSel) expSel.value = '48';
  document.getElementById('rs-submit-btn').disabled = false;
  document.getElementById('rs-submit-btn').textContent = 'Pokračovať na email →';
  document.getElementById('remote-sign-modal').style.display = 'block';
  if (!p.signerRole) updateRsDefaults();
}

function closeRemoteSignModal() {
  document.getElementById('remote-sign-modal').style.display = 'none';
}

async function submitRemoteSignRequest() {
  const btn = document.getElementById('rs-submit-btn');
  const docType = document.getElementById('rs-doc-type').value;
  const detail = document.getElementById('rs-doc-detail').value.trim();
  const signerName = document.getElementById('rs-signer-name').value.trim();

  if (!signerName) {
    showToast('Vyplňte meno klienta', 'warning');
    return;
  }

  // Auto-build reference from type + detail
  const def = RS_DOC_DEFAULTS[docType] || RS_DOC_DEFAULTS.other;
  const docRef = detail ? def.prefix + ' – ' + detail : def.prefix;
  const signerRole = document.getElementById('rs-signer-role').value || def.role;
  const message = (document.getElementById('rs-message-text')?.value || '').trim();
  const expiresInHours = parseInt((document.getElementById('rs-expires-select')?.value) || '48');

  const token = getStoredToken();
  if (!token) { showToast('Nie ste prihlásený', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Vytváram...';

  try {
    const r = await secureFetch('/api/sign/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ documentType: docType, documentRef: docRef, signerName, signerRole, message, expiresInHours }),
    });
    const data = await r.json();
    if (data.ok) {
      // Stash the URL on the (now-hidden) link modal — for the secondary "copy link only" flow
      document.getElementById('rs-link-url').value = data.signUrl;
      document.getElementById('rs-link-expires').textContent = 'Platnosť do: ' + new Date(data.expiresAt).toLocaleString('sk-SK');

      closeRemoteSignModal();
      _remoteSignCache = null;
      refreshRemoteSignatures();

      // Skip the intermediate "Link pripravený!" modal — go straight to email composer.
      // The user can still fall back to "iba skopírovať odkaz" from inside the composer.
      openEmailComposer({
        documentType: docType,
        documentRef: docRef,
        signerName,
        signerEmail: document.getElementById('rs-signer-email')?.value?.trim() || '',
        signerPhone: document.getElementById('rs-signer-phone')?.value?.trim() || '',
        signUrl: data.signUrl,
        expiresAt: data.expiresAt,
      });
    } else {
      showToast(data.error || 'Chyba pri vytváraní', 'error');
      btn.disabled = false;
      btn.textContent = 'Pokračovať na email →';
    }
  } catch (e) {
    showToast('Chyba pripojenia k serveru', 'error');
    btn.disabled = false;
    btn.textContent = 'Pokračovať na email →';
  }
}

function copyRemoteSignLink() {
  const url = document.getElementById('rs-link-url').value;
  copyText(url);
  const btn = document.getElementById('rs-copy-btn');
  btn.textContent = 'Skopírované!';
  setTimeout(() => { btn.textContent = 'Kopírovať link'; }, 2000);
}

function closeRemoteSignLinkModal() {
  document.getElementById('remote-sign-link-modal').style.display = 'none';
}

// ── Quick send from Náborák ──
async function sendNaborForRemoteSign(role) {
  // Pull values from the active náborák form (byt or dom variant)
  const vlastnik = (document.getElementById('nb-vlastnik')?.value
                || document.getElementById('nd-vlastnik1')?.value || '').trim();
  const address = (document.getElementById('nb-adresa')?.value
               || document.getElementById('nd-adresa')?.value || '').trim();
  const ownerEmail = (document.getElementById('nb-email-vlastnik')?.value
                  || document.getElementById('nd-email-vlastnik')?.value || '').trim();
  const ownerPhone = (document.getElementById('nb-tel-vlastnik')?.value
                  || document.getElementById('nd-tel-vlastnik')?.value || '').trim();
  const propertyId = document.getElementById('nabor-prop-id')?.value || null;

  // Auto-save the current náborový list state so:
  //  • the user doesn't lose what they typed if the modal closes
  //  • _attachRemoteRequestToProperty has a real p.nabor record to attach to
  //  • when the client signs, the signed PDF reflects the real form data
  if (propertyId) {
    try { await saveNabor({ silent: true }); } catch (e) { console.warn('Auto-save before send failed:', e); }
  }

  // Open the unified composer directly — no intermediate "Nová žiadosť" form
  openEmailComposer({
    propertyId,
    documentType: 'nabor',
    docDetail: address,
    signerName: role === 'seller' ? vlastnik : (getProfile()?.name || ''),
    signerEmail: role === 'seller' ? ownerEmail : (getProfile()?.email || ''),
    signerPhone: role === 'seller' ? ownerPhone : (getProfile()?.phone || ''),
  });
}

// ═══════════════════════════════════════════════════════════════
//  EMAIL COMPOSER — prepare a ready-to-send email with signing link
// ═══════════════════════════════════════════════════════════════

// ── Gender detection from Slovak name ──
// Reliable suffixes for Slovak women's surnames + small dictionary
// of ambiguous first names. Returns 'F', 'M', or null (unknown).
const _AMBIGUOUS_FEMALE_FIRST = new Set([
  'andrea','bara','daniela','denisa','dominika','ela','emília','eva','gabriela',
  'hana','iveta','jana','janka','júlia','julia','katarína','katarina','klára','klara',
  'lenka','lucia','ľubica','lubica','magdaléna','magdalena','mária','maria','martina',
  'michaela','monika','natália','natalia','nikola','petra','sandra','silvia','simona',
  'soňa','sona','stela','tatiana','tereza','viera','viktória','viktoria','zuzana','zoe',
  'alžbeta','alzbeta','alica','barbora','beáta','beata','dáša','dasa','dora','elena',
  'erika','helena','irena','katka','kvetoslava','linda','marta','milena','natasha',
  'natasa','nina','oľga','olga','renáta','renata','romana','ružena','ruzena','sára','sara',
  'slávka','slavka','svetlana','táňa','tana','viola','vlasta','zita','žofia','zofia'
]);
const _AMBIGUOUS_MALE_FIRST = new Set([
  'adam','adrián','adrian','aleš','ales','alexander','andrej','anton','arpád','arpad',
  'boris','branislav','dalibor','daniel','david','dávid','denis','dominik','dušan','dusan',
  'erik','filip','frantisek','františek','gabriel','gejza','imrich','ivan','jakub',
  'ján','jan','jaroslav','jozef','juraj','karol','kristián','kristian','ladislav','lukáš',
  'lukas','marek','marián','marian','martin','matej','matúš','matus','michal','milan',
  'miloš','milos','miroslav','norbert','oliver','ondrej','pavol','peter','radoslav',
  'rastislav','richard','robert','robo','roman','samuel','sebastián','sebastian','silvester',
  'slavomír','slavomir','stanislav','stefan','štefan','tibor','tomáš','tomas','vladimír',
  'vladimir','vincent','vladislav','zdeno','zoltán','zoltan'
]);

function detectGenderFromName(fullName) {
  if (!fullName) return null;
  const parts = String(fullName).trim().toLowerCase().split(/\s+/);
  if (parts.length === 0) return null;

  // 1) Last name with feminine Slovak suffix → very strong female signal
  const last = parts[parts.length - 1];
  if (/(ová|cká|ská|ňá|ská|žá|chá|řá)$/.test(last)) return 'F';
  if (last.endsWith('ová')) return 'F';

  // 2) Try first name dictionaries
  const first = parts[0].replace(/[.,]/g, '');
  if (_AMBIGUOUS_FEMALE_FIRST.has(first)) return 'F';
  if (_AMBIGUOUS_MALE_FIRST.has(first)) return 'M';

  // 3) Heuristic on first-name suffix (Slovak feminine endings)
  if (/(a|ia|na|ka|la|ra|sa|ta|va|za|ša|ža)$/.test(first)) return 'F';

  // 4) Default — assume male if surname doesn't have ová suffix
  return 'M';
}

// Salutation helper — returns "pán" / "pani" or null
function genderSalutation(g) {
  if (g === 'F') return 'pani';
  if (g === 'M') return 'pán';
  return null;
}

// Formal honorific — gender-correct adjective + title
function genderHonorific(g) {
  if (g === 'F') return 'Vážená pani';
  if (g === 'M') return 'Vážený pán';
  return 'Vážený/á';
}

// Split full name into first / last (Slovak convention: "Krstné Priezvisko")
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// Visual separator used to frame the call-to-action block in plain-text emails.
// Box-drawing chars render correctly in Gmail, Outlook, Apple Mail, and most
// modern email clients.
const _EMAIL_SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

// ── Built-in email templates: 5 doc types × 3 tonalities ──
const EMAIL_TEMPLATES = {
  nabor: {
    label: 'Náborový list',
    priatelsky: {
      label: 'Priateľský',
      subject: 'Náborový list k podpisu – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

posielam Vám náborový list k nehnuteľnosti na adrese
{{property.address}}, ktorý čaká na Váš elektronický podpis.

${_EMAIL_SEP}

   PODPÍSAŤ DOKUMENT

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

Odkaz Vás zavedie na zabezpečenú stránku SecPro, kde si dokument
môžete prečítať a podpísať prstom alebo myšou. Žiadna registrácia
nie je potrebná.

V prípade akýchkoľvek otázok ma neváhajte kontaktovať.

S pozdravom,

{{agent.signature}}`
    },
    formalny: {
      label: 'Formálny',
      subject: 'Náborový list na elektronický podpis – {{property.address}}',
      body:
`{{honorific}} {{client.lastName}},

obraciam sa na Vás s prosbou o elektronický podpis náborového
listu k nehnuteľnosti na adrese {{property.address}}.

${_EMAIL_SEP}

   PODPÍSAŤ DOKUMENT

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

Odkaz Vás zavedie na zabezpečenú stránku SecPro určenú na
elektronické podpisovanie dokumentov.

Som k dispozícii pre akékoľvek otázky alebo doplnenia.

S úctou,

{{agent.signature}}`
    },
    urgentny: {
      label: 'Urgentný / pripomienka',
      subject: 'Pripomienka: Náborový list čaká na Váš podpis – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

dovoľte mi Vás zdvorilo upozorniť, že náborový list k nehnuteľnosti
na adrese {{property.address}} ešte čaká na Váš elektronický podpis.

${_EMAIL_SEP}

   PODPÍSAŤ TERAZ

   {{signing_link}}

   Odkaz expiruje: {{expires_at}}

${_EMAIL_SEP}

Po expirácii budete potrebovať nový odkaz. Samotný podpis trvá
menej ako minútu.

V prípade akýchkoľvek otázok ma neváhajte kontaktovať.

S pozdravom,

{{agent.signature}}`
    }
  },
  sz: {
    label: 'Sprostredkovateľská zmluva',
    priatelsky: {
      label: 'Priateľský',
      subject: 'Sprostredkovateľská zmluva k podpisu – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

posielam Vám sprostredkovateľskú zmluvu k nehnuteľnosti na adrese
{{property.address}}, ktorá čaká na Váš elektronický podpis.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

V prípade otázok som k dispozícii.

S pozdravom,

{{agent.signature}}`
    },
    formalny: {
      label: 'Formálny',
      subject: 'Sprostredkovateľská zmluva – elektronický podpis',
      body:
`{{honorific}} {{client.lastName}},

predkladám Vám na elektronický podpis sprostredkovateľskú zmluvu
týkajúcu sa nehnuteľnosti na adrese {{property.address}}.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

S úctou,

{{agent.signature}}`
    },
    urgentny: {
      label: 'Urgentný',
      subject: 'Pripomienka: Sprostredkovateľská zmluva – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

sprostredkovateľská zmluva k nehnuteľnosti na adrese
{{property.address}} ešte čaká na Váš podpis.

${_EMAIL_SEP}

   PODPÍSAŤ TERAZ

   {{signing_link}}

   Odkaz expiruje: {{expires_at}}

${_EMAIL_SEP}

S pozdravom,

{{agent.signature}}`
    }
  },
  rezerv: {
    label: 'Rezervačná zmluva',
    priatelsky: {
      label: 'Priateľský',
      subject: 'Rezervačná zmluva – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

posielam Vám rezervačnú zmluvu k nehnuteľnosti na adrese
{{property.address}}. Po podpise zmluvy budete vyzvaní k úhrade
rezervačného poplatku.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

V prípade otázok ma neváhajte kontaktovať.

S pozdravom,

{{agent.signature}}`
    },
    formalny: {
      label: 'Formálny',
      subject: 'Rezervačná zmluva na elektronický podpis – {{property.address}}',
      body:
`{{honorific}} {{client.lastName}},

predkladám Vám na elektronický podpis rezervačnú zmluvu
k nehnuteľnosti na adrese {{property.address}}.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

Po obojstrannom podpise Vás budem informovať o ďalších krokoch
k úhrade rezervačného poplatku.

S úctou,

{{agent.signature}}`
    },
    urgentny: {
      label: 'Urgentný',
      subject: 'URGENTNÉ: Rezervačná zmluva čaká na podpis',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

rezervačná zmluva k nehnuteľnosti na adrese {{property.address}}
ešte čaká na Váš elektronický podpis. Bez podpisu nemôžeme
rezerváciu finalizovať.

${_EMAIL_SEP}

   PODPÍSAŤ TERAZ

   {{signing_link}}

   Odkaz expiruje: {{expires_at}}

${_EMAIL_SEP}

S pozdravom,

{{agent.signature}}`
    }
  },
  kupna: {
    label: 'Kúpna zmluva',
    priatelsky: {
      label: 'Priateľský',
      subject: 'Kúpna zmluva – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

posielam Vám na elektronický podpis kúpnu zmluvu
k nehnuteľnosti na adrese {{property.address}}.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

S pozdravom,

{{agent.signature}}`
    },
    formalny: {
      label: 'Formálny',
      subject: 'Kúpna zmluva na elektronický podpis – {{property.address}}',
      body:
`{{honorific}} {{client.lastName}},

predkladám Vám na elektronický podpis kúpnu zmluvu
k nehnuteľnosti na adrese {{property.address}}.

${_EMAIL_SEP}

   PODPÍSAŤ ZMLUVU

   {{signing_link}}

   Platnosť odkazu: do {{expires_at}}

${_EMAIL_SEP}

S úctou,

{{agent.signature}}`
    },
    urgentny: {
      label: 'Urgentný',
      subject: 'Pripomienka: Kúpna zmluva čaká na podpis',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

kúpna zmluva k nehnuteľnosti na adrese {{property.address}}
ešte čaká na Váš elektronický podpis.

${_EMAIL_SEP}

   PODPÍSAŤ TERAZ

   {{signing_link}}

   Odkaz expiruje: {{expires_at}}

${_EMAIL_SEP}

S pozdravom,

{{agent.signature}}`
    }
  },
  faktura: {
    label: 'Faktúra / Fakturácia',
    priatelsky: {
      label: 'Priateľský',
      subject: 'Faktúra k úhrade – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

posielam Vám faktúru k nehnuteľnosti na adrese {{property.address}}.

V prípade otázok ma neváhajte kontaktovať.

S pozdravom,

{{agent.signature}}`
    },
    formalny: {
      label: 'Formálny',
      subject: 'Faktúra – {{property.address}}',
      body:
`{{honorific}} {{client.lastName}},

zasielam Vám faktúru týkajúcu sa nehnuteľnosti na adrese
{{property.address}}.

S úctou,

{{agent.signature}}`
    },
    urgentny: {
      label: 'Urgentný / pripomienka úhrady',
      subject: 'Pripomienka úhrady faktúry – {{property.address}}',
      body:
`Dobrý deň {{salutation}} {{client.lastName}},

dovoľte mi Vás zdvorilo upozorniť, že faktúra k nehnuteľnosti
na adrese {{property.address}} ešte čaká na úhradu.

V prípade, že úhrada už prebehla, prosím ignorujte túto správu.

S pozdravom,

{{agent.signature}}`
    }
  }
};

// Build agent's plain-text signature from profile fields.
// Dropped emoji icons (📞 ✉️ 🌐) — they render as pixelated images in
// Gmail and look unprofessional. Replaced with aligned text labels.
function buildAgentSignature() {
  const p = (typeof getProfile === 'function') ? getProfile() : {};
  const lines = [];
  if (p.name) lines.push(p.name);
  const titleLine = [p.title || '', p.company || ''].filter(Boolean).join(' | ');
  if (titleLine) lines.push(titleLine);
  // Blank line before contact block
  if (p.phone || p.email || p.website) lines.push('');
  if (p.phone)   lines.push('Tel:    ' + p.phone);
  if (p.email)   lines.push('Email:  ' + p.email);
  if (p.website) lines.push('Web:    ' + p.website.replace(/^https?:\/\//, ''));
  return lines.join('\n');
}

// Check if profile has all the fields needed for a credible email signature.
// Returns { ok, missing: [], optional: [] }
function checkProfileCompleteness() {
  const p = (typeof getProfile === 'function') ? getProfile() : {};
  const requiredFields = [
    { key: 'name',  label: 'Meno' },
    { key: 'email', label: 'Email' },
  ];
  const recommendedFields = [
    { key: 'phone',   label: 'Telefón' },
    { key: 'title',   label: 'Pozícia (napr. Realitný maklér)' },
    { key: 'company', label: 'Agentúra / firma' },
  ];
  const missing = requiredFields.filter(f => !p[f.key] || !String(p[f.key]).trim());
  const optional = recommendedFields.filter(f => !p[f.key] || !String(p[f.key]).trim());
  return { ok: missing.length === 0, missing, optional, profile: p };
}

// Replace {{tokens}} in a template
function _renderTemplate(tpl, ctx) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.');
    let v = ctx;
    for (const p of parts) {
      if (v == null) return '';
      v = v[p];
    }
    return v == null ? '' : String(v);
  });
}

// Module state for the open email composer
let _emailComposerCtx = null;

// Open the email composer for a remote-sign request that was just created.
// opts: { signerName, signerEmail, documentRef, documentType, signUrl, expiresAt, propertyId? }
// Sentinel placeholder URL used while the user is editing — replaced with the
// real signing URL right before opening Gmail/Outlook/etc.
const _EC_PLACEHOLDER_URL = 'https://secpro-app.vercel.app/podpis/[odkaz-sa-vygeneruje-pri-odoslaní]';

function openEmailComposer(opts) {
  opts = opts || {};
  // Profile completeness check
  const check = checkProfileCompleteness();
  if (!check.ok) {
    _showProfileIncompleteWarning(check, () => openEmailComposer(opts));
    return;
  }

  const profile = check.profile || {};

  _emailComposerCtx = {
    propertyId: opts.propertyId || null,    // for back-linking the request to a property
    docType: opts.documentType || 'nabor',
    docDetail: opts.docDetail || (opts.documentRef ? opts.documentRef.replace(/^.+? – /, '') : ''),
    tonality: 'priatelsky',
    detectedGender: detectGenderFromName(opts.signerName || ''),
    overrideGender: null,
    expiresInHours: opts.expiresInHours || 48,
    signUrl: _EC_PLACEHOLDER_URL,    // placeholder until send click
    realLinkCreated: false,
    agent: {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      signature: buildAgentSignature(),
    },
  };

  // Populate the document + client form fields
  document.getElementById('ec-doc-type').value = _emailComposerCtx.docType;
  document.getElementById('ec-doc-detail').value = _emailComposerCtx.docDetail;
  document.getElementById('ec-client-name').value = opts.signerName || '';
  document.getElementById('ec-client-email').value = opts.signerEmail || '';
  document.getElementById('ec-client-phone').value = opts.signerPhone || '';
  document.getElementById('ec-expires').value = String(_emailComposerCtx.expiresInHours);
  document.getElementById('ec-loading').style.display = 'none';

  // Populate tonality + gender + email body
  _renderEmailComposerTonalityPills();
  _renderEmailComposerGenderToggle();
  _renderEmailComposerPreview();

  document.getElementById('email-composer-modal').style.display = 'flex';
}

function closeEmailComposer() {
  document.getElementById('email-composer-modal').style.display = 'none';
  _emailComposerCtx = null;
}

// Called when the user changes the document type or address — re-render the body
function emailComposerOnDocChange() {
  if (!_emailComposerCtx) return;
  _emailComposerCtx.docType = document.getElementById('ec-doc-type').value;
  _emailComposerCtx.docDetail = document.getElementById('ec-doc-detail').value.trim();
  _renderEmailComposerTonalityPills();    // tonality labels can vary by doc type
  _renderEmailComposerPreview();
}

// Called when the user changes the client name — re-detect gender + re-render
function emailComposerOnClientChange() {
  if (!_emailComposerCtx) return;
  const name = document.getElementById('ec-client-name').value.trim();
  _emailComposerCtx.detectedGender = detectGenderFromName(name);
  // Reset manual override only if the new name has a clear detection
  if (_emailComposerCtx.detectedGender) _emailComposerCtx.overrideGender = null;
  _renderEmailComposerGenderToggle();
  _renderEmailComposerPreview();
}

function _showProfileIncompleteWarning(check, onContinue) {
  const list = (arr, css) => arr.map(f => `<li style="${css}">${f.label}</li>`).join('');
  const required = check.missing.length
    ? `<div style="margin-bottom:0.5rem;"><b style="color:#B91C1C;">Chýbajúce povinné polia:</b><ul style="margin:0.3rem 0 0 1.2rem;">${list(check.missing, 'color:#B91C1C;')}</ul></div>`
    : '';
  const optional = check.optional.length
    ? `<div><b style="color:#92400E;">Odporúčané polia (pre kompletný podpis):</b><ul style="margin:0.3rem 0 0 1.2rem;">${list(check.optional, 'color:#92400E;')}</ul></div>`
    : '';
  const html = (required + optional) || '<div>Profil je kompletný.</div>';

  const overlay = document.createElement('div');
  overlay.className = 'sec-confirm-overlay sec-confirm-visible';
  overlay.innerHTML =
    `<div class="sec-confirm-box" style="max-width:480px;">
      <div class="sec-confirm-header sec-type-warning">
        <div class="sec-confirm-icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <div class="sec-confirm-title">Neúplný profil maklera</div>
      </div>
      <div class="sec-confirm-body">
        <div class="sec-confirm-message" style="text-align:left;">${html}</div>
      </div>
      <div class="sec-confirm-footer" style="gap:6px;">
        <button class="sec-confirm-btn sec-confirm-cancel">Pokračovať aj tak</button>
        <button class="sec-confirm-btn sec-confirm-ok sec-btn-warning">Doplniť profil</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const okBtn = overlay.querySelector('.sec-confirm-ok');
  const cancelBtn = overlay.querySelector('.sec-confirm-cancel');
  okBtn.addEventListener('click', () => { overlay.remove(); if (typeof openProfileModal === 'function') openProfileModal(); });
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    // Allow continuation even with incomplete profile (only if required fields missing, skip the warning gate)
    // Force re-open by stubbing checkProfileCompleteness to ok
    const orig = checkProfileCompleteness;
    window.checkProfileCompleteness = () => ({ ok: true, missing: [], optional: [], profile: orig().profile });
    onContinue();
    window.checkProfileCompleteness = orig;
  });
}

function _renderEmailComposerTonalityPills() {
  const wrap = document.getElementById('email-composer-tonality');
  if (!wrap) return;
  const tpls = EMAIL_TEMPLATES[_emailComposerCtx.docType] || EMAIL_TEMPLATES.nabor;
  const keys = ['priatelsky', 'formalny', 'urgentny'];
  wrap.innerHTML = keys.map(k => {
    const tpl = tpls[k];
    const active = _emailComposerCtx.tonality === k;
    return `<button class="email-tonality-pill ${active ? 'active' : ''}" onclick="setEmailComposerTonality('${k}')">${tpl.label}</button>`;
  }).join('');
}

function setEmailComposerTonality(t) {
  if (!_emailComposerCtx) return;
  _emailComposerCtx.tonality = t;
  _renderEmailComposerTonalityPills();
  _renderEmailComposerPreview();
}

function _renderEmailComposerGenderToggle() {
  const wrap = document.getElementById('email-composer-gender');
  if (!wrap) return;
  const eff = _emailComposerCtx.overrideGender || _emailComposerCtx.detectedGender;
  const detectedLabel = _emailComposerCtx.detectedGender
    ? (_emailComposerCtx.detectedGender === 'F' ? 'pani' : 'pán')
    : 'neznáme';
  wrap.innerHTML = `
    <span style="font-size:0.78rem;color:var(--text-light);">Oslovenie:</span>
    <button class="email-gender-pill ${eff === 'M' ? 'active' : ''}" onclick="setEmailComposerGender('M')">pán</button>
    <button class="email-gender-pill ${eff === 'F' ? 'active' : ''}" onclick="setEmailComposerGender('F')">pani</button>
    <span style="font-size:0.7rem;color:var(--text-light);font-style:italic;">(detekované: ${detectedLabel})</span>
  `;
}

function setEmailComposerGender(g) {
  if (!_emailComposerCtx) return;
  _emailComposerCtx.overrideGender = g;
  _renderEmailComposerGenderToggle();
  _renderEmailComposerPreview();
}

function _renderEmailComposerPreview() {
  if (!_emailComposerCtx) return;
  const ctx = _emailComposerCtx;
  const tpls = EMAIL_TEMPLATES[ctx.docType] || EMAIL_TEMPLATES.nabor;
  const tpl = tpls[ctx.tonality] || tpls.priatelsky;

  const eff = ctx.overrideGender || ctx.detectedGender;
  const salutation = genderSalutation(eff) || '';
  const honorific = genderHonorific(eff);

  // Pull live values from the form (so changes to name/address update the body)
  const fullName = document.getElementById('ec-client-name')?.value.trim() || '';
  const { firstName, lastName } = splitName(fullName);
  const docDetail = document.getElementById('ec-doc-detail')?.value.trim() || '';
  const expiresHours = parseInt(document.getElementById('ec-expires')?.value || '48');
  const expiresStr = new Date(Date.now() + expiresHours * 3600 * 1000).toLocaleString('sk-SK', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const renderCtx = {
    salutation,
    honorific,
    client: {
      firstName,
      lastName: lastName || firstName,
      fullName,
    },
    property: { address: docDetail },
    signing_link: ctx.signUrl,    // placeholder URL during editing; replaced on send
    expires_at: expiresStr,
    agent: { signature: ctx.agent.signature },
  };

  const subj = _renderTemplate(tpl.subject, renderCtx);
  const body = _renderTemplate(tpl.body, renderCtx);

  document.getElementById('email-composer-subject').value = subj;
  document.getElementById('email-composer-body').value = body;
}

// Create the real signing link via the API (called once, lazy on first send-action)
async function _emailComposerEnsureLink() {
  if (!_emailComposerCtx) return null;
  if (_emailComposerCtx.realLinkCreated && _emailComposerCtx.signUrl !== _EC_PLACEHOLDER_URL) {
    return _emailComposerCtx.signUrl;
  }

  const token = (typeof getStoredToken === 'function') ? getStoredToken() : null;
  if (!token) {
    showToast('Nie ste prihlásený', 'error');
    return null;
  }

  const docType = document.getElementById('ec-doc-type').value;
  const docDetail = document.getElementById('ec-doc-detail').value.trim();
  const signerName = document.getElementById('ec-client-name').value.trim();
  const signerEmail = document.getElementById('ec-client-email').value.trim();
  const signerPhone = document.getElementById('ec-client-phone').value.trim();
  const expiresInHours = parseInt(document.getElementById('ec-expires').value);

  if (!signerName) {
    showToast('Vyplňte meno klienta', 'warning');
    return null;
  }

  // Build doc reference: "<Prefix> – <detail>"
  const docDef = (typeof RS_DOC_DEFAULTS !== 'undefined' && RS_DOC_DEFAULTS[docType])
    ? RS_DOC_DEFAULTS[docType] : { prefix: 'Dokument', role: '' };
  const documentRef = docDetail ? docDef.prefix + ' – ' + docDetail : docDef.prefix;
  const signerRole = docDef.role || '';

  // Capture document content so the client can READ what they're signing.
  // Without this the signing page would just show a name field + signature
  // canvas — that's not legally valid: §40 OZ requires the signer be able to
  // read the document. For nabor we grab the rendered HTML preview from the
  // open náborák modal.
  let documentHtml = null;
  if (docType === 'nabor') {
    const naborModal = document.getElementById('naborModal');
    if (naborModal && naborModal.style.display !== 'none') {
      const previewContent = document.getElementById('naborPreviewContent');
      if (previewContent && previewContent.innerHTML.trim().length > 0) {
        documentHtml = previewContent.innerHTML;
      }
    }
  }

  document.getElementById('ec-loading').style.display = '';

  try {
    const r = await secureFetch('/api/sign/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ documentType: docType, documentRef, signerName, signerRole, signerEmail, signerPhone, expiresInHours, documentHtml }),
    });
    const data = await r.json();
    if (!data.ok) {
      showToast(data.error || 'Chyba pri vytváraní odkazu', 'error');
      return null;
    }
    _emailComposerCtx.signUrl = data.signUrl;
    _emailComposerCtx.expiresAt = data.expiresAt;
    _emailComposerCtx.realLinkCreated = true;
    _emailComposerCtx.token = data.token || data.signUrl.split('/').pop();
    _remoteSignCache = null;
    refreshRemoteSignatures();
    // Persist back-link onto the property's nabor record (for status tracking).
    // This lets the deal chip turn orange (= "sent, waiting for signature").
    if (_emailComposerCtx.propertyId && _emailComposerCtx.docType === 'nabor') {
      _attachRemoteRequestToProperty(_emailComposerCtx.propertyId, {
        token: _emailComposerCtx.token,
        signUrl: data.signUrl,
        expiresAt: data.expiresAt,
        createdAt: new Date().toISOString(),
        signerName: document.getElementById('ec-client-name').value.trim(),
        signerEmail: document.getElementById('ec-client-email').value.trim(),
      });
    }
    return data.signUrl;
  } catch (e) {
    showToast('Chyba pripojenia k serveru', 'error');
    return null;
  } finally {
    document.getElementById('ec-loading').style.display = 'none';
  }
}

// Replace the placeholder URL in body with the real one. If the user removed
// the placeholder while editing, append the real URL at the end.
function _emailComposerBodyWithRealLink(realUrl) {
  let body = document.getElementById('email-composer-body').value;
  if (body.includes(_EC_PLACEHOLDER_URL)) {
    body = body.split(_EC_PLACEHOLDER_URL).join(realUrl);
  } else if (!body.includes(realUrl)) {
    body += '\n\n📎 Odkaz na podpis: ' + realUrl;
  }
  return body;
}

// Returns { to, subj, body, phone } with real URL substituted, or null on validation fail
async function _emailComposerPrepareForSend() {
  const realUrl = await _emailComposerEnsureLink();
  if (!realUrl) return null;
  return {
    to: document.getElementById('ec-client-email').value.trim(),
    subj: document.getElementById('email-composer-subject').value,
    body: _emailComposerBodyWithRealLink(realUrl),
    phone: document.getElementById('ec-client-phone').value.trim(),
    realUrl,
  };
}

// Persist a remote-sign request on the property's nabor record.
// Used to drive the deal-chip status (turns orange — "email sent, waiting").
// Caller must ensure p.nabor exists (we don't create an empty stub here, as
// that would wipe a future "Uložiť" snapshot — the user would re-open the
// modal to find an empty form).
function _attachRemoteRequestToProperty(propertyId, request) {
  const props = getProperties();
  const idx = props.findIndex(p => p.id === propertyId);
  if (idx === -1) return;
  if (!props[idx].nabor) {
    // Náborový list not saved yet — defer attaching; user will see the chip
    // stay 'pending' until they save.
    console.warn('[SecPro] Cannot attach remoteRequest — nabor not saved for', propertyId);
    return;
  }
  props[idx].nabor.remoteRequest = request;
  saveProperties(props);
}

// Mark a sent channel on the remoteRequest after the user clicks Gmail/Outlook/etc.
function _markRemoteRequestSent(channel) {
  if (!_emailComposerCtx || !_emailComposerCtx.propertyId) return;
  if (_emailComposerCtx.docType !== 'nabor') return;
  const props = getProperties();
  const idx = props.findIndex(p => p.id === _emailComposerCtx.propertyId);
  if (idx === -1 || !props[idx].nabor || !props[idx].nabor.remoteRequest) return;
  props[idx].nabor.remoteRequest.sentAt = new Date().toISOString();
  props[idx].nabor.remoteRequest.channel = channel;
  saveProperties(props);
  if (typeof renderProperties === 'function') renderProperties();
}

// After a successful send, close the composer AND the underlying náborový
// list modal — the agent's job is done; the document is sent and locked
// pending client signature. Tiny delay so the browser has time to actually
// open Gmail / Outlook / mailto target before our modal teardown runs.
function _emailComposerCloseAfterSend() {
  setTimeout(() => {
    try { closeEmailComposer(); } catch (e) {}
    try {
      const naborModal = document.getElementById('naborModal');
      if (naborModal && naborModal.style.display !== 'none') {
        closeNaborModal();
      }
    } catch (e) {}
  }, 250);
}

async function emailComposerOpenInGmail() {
  const data = await _emailComposerPrepareForSend(); if (!data) return;
  const url = 'https://mail.google.com/mail/?view=cm&fs=1'
    + '&to=' + encodeURIComponent(data.to)
    + '&su=' + encodeURIComponent(data.subj)
    + '&body=' + encodeURIComponent(data.body);
  window.open(url, '_blank');
  _rememberEmailSendChannel('gmail');
  _markRemoteRequestSent('gmail');
  _emailComposerCloseAfterSend();
}
async function emailComposerOpenInOutlook() {
  const data = await _emailComposerPrepareForSend(); if (!data) return;
  const url = 'https://outlook.live.com/mail/0/deeplink/compose?'
    + 'to=' + encodeURIComponent(data.to)
    + '&subject=' + encodeURIComponent(data.subj)
    + '&body=' + encodeURIComponent(data.body);
  window.open(url, '_blank');
  _rememberEmailSendChannel('outlook');
  _markRemoteRequestSent('outlook');
  _emailComposerCloseAfterSend();
}
async function emailComposerOpenInMailto() {
  const data = await _emailComposerPrepareForSend(); if (!data) return;
  const url = 'mailto:' + encodeURIComponent(data.to)
    + '?subject=' + encodeURIComponent(data.subj)
    + '&body=' + encodeURIComponent(data.body);
  window.location.href = url;
  _rememberEmailSendChannel('mailto');
  _markRemoteRequestSent('mailto');
  _emailComposerCloseAfterSend();
}
async function emailComposerOpenInWhatsApp() {
  const data = await _emailComposerPrepareForSend(); if (!data) return;
  const text = data.subj + '\n\n' + data.body;
  const url = data.phone
    ? 'https://wa.me/' + encodeURIComponent(data.phone.replace(/\s/g, '')) + '?text=' + encodeURIComponent(text)
    : 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
  _rememberEmailSendChannel('whatsapp');
  _markRemoteRequestSent('whatsapp');
  _emailComposerCloseAfterSend();
}
async function emailComposerCopy() {
  const data = await _emailComposerPrepareForSend(); if (!data) return;
  const text = (data.to ? 'Komu: ' + data.to + '\n' : '') + 'Predmet: ' + data.subj + '\n\n' + data.body;
  const html = _buildBrandedEmailHtml(data.subj, data.body, data.realUrl);

  // Try writing both text/plain and text/html to the clipboard so the user
  // can paste branded HTML into Gmail/Outlook compose, or fall back to plain
  // text in apps like Slack / Notes.
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html':  new Blob([html], { type: 'text/html' }),
        })
      ]);
      showToast('Skopírované — vložte do Gmail/Outlook compose ✓', 'success');
    } else {
      // Older browser fallback
      if (typeof copyText === 'function') copyText(text);
    }
  } catch (e) {
    // Fall back to plain text on permissions failure
    if (typeof copyText === 'function') copyText(text);
  }
  _rememberEmailSendChannel('copy');
  _markRemoteRequestSent('copy');
  _emailComposerCloseAfterSend();
}

// Build a lightweight, Gmail-paste-friendly HTML email.
// Uses inline styles only — Gmail strips <style> tags but keeps inline CSS.
// The CTA button is a fat coloured anchor that survives most sanitizers.
function _buildBrandedEmailHtml(subject, plainBody, signUrl) {
  const profile = (typeof getProfile === 'function') ? getProfile() : {};
  // Convert plaintext body into safe HTML paragraphs, but replace the CTA
  // block (link surrounded by separators) with a real branded button.
  const bodyHtml = _plainBodyToBrandedHtml(plainBody, signUrl, profile);
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F5F7FA;">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1A2235;max-width:600px;margin:0 auto;padding:24px;background:#fff;">'
    + bodyHtml
    + '</div></body></html>';
}

function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _plainBodyToBrandedHtml(plain, signUrl, profile) {
  // Strip the plaintext separators + CTA block; we'll re-emit a styled button.
  // Pattern: "<sep>\n\n   PODPÍSAŤ ...\n\n   <url>\n\n   Platnosť ...\n\n<sep>"
  const ctaRegex = new RegExp(
    _EMAIL_SEP + '\\n\\n\\s*([A-ZÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽa-záäčďéíľĺňóôŕšťúýž ]+)\\n\\n\\s*' + _escapeRegex(signUrl)
    + '\\n\\n\\s*(Platnosť[^\\n]*|Odkaz expiruje[^\\n]*)\\n\\n' + _EMAIL_SEP,
    'm'
  );
  const ctaButton = (label, expiry) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
  <tr><td align="center" bgcolor="#0B2A3C" style="border-radius:8px;">
    <a href="${_escHtml(signUrl)}" target="_blank"
       style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;
              color:#ffffff;text-decoration:none;border-radius:8px;
              background:linear-gradient(135deg,#1A7A8A,#0B2A3C);">
      ${_escHtml(label)}
    </a>
  </td></tr>
  <tr><td align="center" style="padding-top:8px;font-size:12px;color:#64748B;">
    ${_escHtml(expiry)}
  </td></tr>
</table>`;

  let html = plain.replace(ctaRegex, (_m, label, expiry) => ctaButton(label.trim(), expiry.trim()));

  // Convert remaining plain text into HTML — preserve paragraphs + line breaks.
  // Split on double-newlines for paragraphs, escape remaining lines, join with <br>.
  // Keep the CTA HTML we already injected as-is.
  const ctaSentinel = '\u0001CTA\u0001';
  const ctaParts = [];
  html = html.replace(/<table[^]*?<\/table>/g, (m) => { ctaParts.push(m); return ctaSentinel + (ctaParts.length-1) + ctaSentinel; });
  html = html.split(/\n{2,}/).map(par => {
    if (par.includes(ctaSentinel)) return par;     // preserve CTA blocks
    const safe = _escHtml(par).replace(/\n/g, '<br>');
    return '<p style="margin:0 0 14px;line-height:1.55;font-size:15px;color:#1A2235;">' + safe + '</p>';
  }).join('\n');
  html = html.replace(new RegExp(ctaSentinel + '(\\d+)' + ctaSentinel, 'g'), (_, i) => ctaParts[+i]);

  // Add a subtle SecPro footer brand strip
  html += `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E9F0;font-size:11px;color:#94A3B8;line-height:1.5;">
  Tento email obsahuje odkaz na elektronický podpis dokumentu.<br>
  Odkaz Vás zavedie na zabezpečenú stránku <b style="color:#0B2A3C;">SecPro</b>.
</div>`;

  return html;
}

function _escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Fallback — skopírovať iba samotný odkaz (bez celého emailu)
async function emailComposerCopySigningLinkOnly() {
  const url = await _emailComposerEnsureLink();
  if (!url) return;
  if (typeof copyText === 'function') copyText(url);
  showToast('Odkaz skopírovaný do schránky ✓', 'success');
}

function _rememberEmailSendChannel(ch) {
  try { localStorage.setItem('secpro_pref_email_channel', ch); } catch (e) {}
}
function _getPreferredEmailChannel() {
  try { return localStorage.getItem('secpro_pref_email_channel'); } catch (e) { return null; }
}

// Bridge — when user finished creating a sign request, click "📧 Pripraviť email"
// in the link modal to open the composer using the freshly-prepared link.
function openEmailComposerFromLinkModal() {
  const signUrl = document.getElementById('rs-link-url').value;
  if (!signUrl) return;

  // Pull the data we just submitted so we know the doc type, signer name etc.
  // The form values are still in the (now-hidden) creation modal.
  const docType = document.getElementById('rs-doc-type')?.value || 'nabor';
  const docDetail = (document.getElementById('rs-doc-detail')?.value || '').trim();
  const signerName = (document.getElementById('rs-signer-name')?.value || '').trim();
  const signerEmail = (document.getElementById('rs-signer-email')?.value || '').trim();
  // Try to pull email from the property if linked (e.g. nabor → owner email)
  let resolvedEmail = signerEmail;
  if (!resolvedEmail) {
    resolvedEmail = (document.getElementById('nb-email-vlastnik')?.value
                  || document.getElementById('nd-email-vlastnik')?.value || '').trim();
  }
  // Parse expiry from the rendered "Platnosť do: ..." string
  const expiresRaw = document.getElementById('rs-link-expires')?.textContent || '';
  // Compute expires ISO from select if available
  const hours = parseInt(document.getElementById('rs-expires-select')?.value || '48');
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

  // Build doc reference for email subject (auto from defaults)
  const docDef = (typeof RS_DOC_DEFAULTS !== 'undefined' && RS_DOC_DEFAULTS[docType])
    ? RS_DOC_DEFAULTS[docType] : { prefix: 'Dokument' };
  const documentRef = docDetail ? docDef.prefix + ' – ' + docDetail : docDef.prefix;

  // Close the link modal and open the email composer
  closeRemoteSignLinkModal();
  openEmailComposer({
    documentType: docType,
    documentRef,
    signerName,
    signerEmail: resolvedEmail,
    signUrl,
    expiresAt,
  });
}

