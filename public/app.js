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
  // Reset status filter so the card doesn't vanish
  const sfEl = document.getElementById('leads-status-filter');
  if (sfEl && sfEl.value) sfEl.value = '';
  reRenderLeadCards();
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
      if (!duplicateMap.has(lead.url)) duplicateMap.set(lead.url, new Set());
      group.forEach(other => {
        if (other.url !== lead.url) duplicateMap.get(lead.url).add(other.url);
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

function renderLeadCards(leads) {
  const grid = document.getElementById('leads-cards-grid');
  if (!grid) return;

  const showHidden = document.getElementById('leads-show-hidden')?.checked || false;
  const statusFilter = document.getElementById('leads-status-filter')?.value || '';
  const allMeta = getLeadStatuses();
  const savedLeads = getSavedLeads();
  const dupMap = detectDuplicates(leads);

  // ── Compute market stats for price intelligence ──
  const validPrices = leads.filter(l => l.price > 0 && l.size > 0);
  const ppmValues = validPrices.map(l => l.price / l.size);
  const avgPPM = ppmValues.length > 0 ? ppmValues.reduce((a, b) => a + b, 0) / ppmValues.length : 0;
  const medianPPM = ppmValues.length > 0 ? ppmValues.sort((a, b) => a - b)[Math.floor(ppmValues.length / 2)] : 0;

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
    const ppm = (lead.price > 0 && lead.size > 0) ? Math.round(lead.price / lead.size) : 0;
    var ppmHtml = '';
    var marketBadge = '';
    if (ppm > 0) {
      ppmHtml = '<span class="lc-ppm">' + ppm.toLocaleString('sk-SK') + ' \u20AC/m\u00B2</span>';
      if (medianPPM > 0) {
        var diff = ((ppm - medianPPM) / medianPPM) * 100;
        if (diff < -12) marketBadge = '<span class="lc-market lc-market-hot" title="V\u00FDrazne pod medi\u00E1nom trhu">Pod cenou</span>';
        else if (diff < -5) marketBadge = '<span class="lc-market lc-market-good" title="Mierne pod medi\u00E1nom trhu">Dobr\u00E1 cena</span>';
        else if (diff > 15) marketBadge = '<span class="lc-market lc-market-over" title="V\u00FDrazne nad medi\u00E1nom trhu">Nadcenen\u00E9</span>';
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
    var dupBadge = dupMap.has(lead.url) ? '<span class="lc-dup-badge" onclick="toggleDupPanel(\'' + hash + '\')">Podobn\u00E9 ' + dupMap.get(lead.url).length + 'x</span>' : '';

    // ── Card HTML v2 ──
    html += '<div class="lc2' + (isHidden ? ' lc-hidden' : '') + (alreadySaved ? ' lc2-saved' : '') + '" id="lcard-' + hash + '">'
      // ── Top bar: source + badges + dismiss ──
      + '<div class="lc2-topbar">'
        + '<div class="lc2-badges">'
          + '<span class="lc2-source">' + esc(lead.source) + '</span>'
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
        // Left: info
        + '<div class="lc2-info">'
          + '<div class="lc2-title" title="' + esc(lead.title) + '">' + esc(lead.title || 'Bez n\u00E1zvu') + '</div>'
          + '<div class="lc2-meta">'
            + (lead.location ? '<span class="lc2-loc">\uD83D\uDCCD ' + esc(lead.location) + '</span>' : '')
            + (lead.size ? '<span class="lc2-size">' + lead.size + ' m\u00B2</span>' : '')
          + '</div>'
        + '</div>'
        // Right: price block
        + '<div class="lc2-price-block">'
          + '<div class="lc2-price">' + esc(lead.priceText || 'Dohodou') + '</div>'
          + ppmHtml
        + '</div>'
      + '</div>'
      // ── Action bar ──
      + '<div class="lc2-actions">'
        + phoneBtn
        + '<a href="' + esc(lead.url) + '" target="_blank" rel="noopener" class="lc2-open" title="Otvori\u0165 inzer\u00E1t">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
          + 'Inzer\u00E1t</a>'
        + '<select class="lc2-status-select" onchange="setSearchLeadStatus(\'' + escUrl + '\', this.value)">'
          + '<option value="">Status...</option>' + statusOpts + '</select>'
        + (alreadySaved
          ? '<span class="lc2-saved-tag">\u2713</span>'
          : '<button class="lc2-save" onclick="saveLead(leadsData.find(l=>l.url===\'' + escUrl + '\'));this.outerHTML=\'<span class=lc2-saved-tag>\u2713</span>\';updateNavLeadCount();" title="Ulo\u017Ei\u0165 do leadov">+</button>')
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
const PROP_WIZ_TOTAL_STEPS = 5;
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
  // Also collect photo data URLs from preview
  const photoEls = document.querySelectorAll('#prop-photo-preview img');
  v.photos = Array.from(photoEls).map(img => img.src).slice(0, 10);
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
    v.photos.forEach(src => {
      const div = document.createElement('div');
      div.style.cssText = 'position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #e0e0e0;';
      div.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;" />
        <button onclick="this.parentElement.remove()" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:20px;text-align:center;">&times;</button>`;
      preview.appendChild(div);
    });
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
  document.getElementById('wiz-btn-save-final').style.display = isLast ? '' : 'none';
  // Save draft button visible on all steps
  document.getElementById('wiz-btn-save-draft').style.display = prop_wiz_is_edit ? 'none' : '';
  // Render listing preview when entering step 5
  if (step === 5) renderListingPreview();
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
      // Show existing photos
      if (p.photos && p.photos.length > 0) {
        const preview = document.getElementById('prop-photo-preview');
        p.photos.forEach((src, i) => {
          preview.innerHTML += `<div style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #e0e0e0;">
            <img src="${src}" style="width:100%;height:100%;object-fit:cover;" />
            <button onclick="this.parentElement.remove()" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:20px;text-align:center;">&times;</button>`;
        });
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
}

function closePropertyForm() {
  document.getElementById('prop-modal').style.display = 'none';
  if (prop_wiz_draft_timer) { clearTimeout(prop_wiz_draft_timer); prop_wiz_draft_timer = null; }
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

function previewPropertyPhotos() {
  const input = document.getElementById('prop-photos');
  const preview = document.getElementById('prop-photo-preview');
  const files = Array.from(input.files).slice(0, 10);
  files.forEach(async (file) => {
    const compressed = await compressImage(file, 800, 0.7);
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:2px solid #e0e0e0;';
    div.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover;" />
      <button onclick="this.parentElement.remove()" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:20px;text-align:center;">&times;</button>`;
    preview.appendChild(div);
  });
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
  if (!name) { alert('Vyplňte meno záujemcu.'); return; }
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
  if (!dateVal) { alert('Vyplňte dátum prehliadky.'); return; }
  if (personIdx === '') { alert('Vyberte záujemcu.'); return; }
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
  if (!name) { alert('Vyplňte meno záujemcu.'); return; }

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
  if (!dateVal) { alert('Vyplňte dátum prehliadky.'); return; }
  if (personIdx === '') { alert('Vyberte záujemcu.'); return; }

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

function openNaborModal(propId) {
  const props = getProperties();
  const p = props.find(x => x.id === propId);
  if (!p) return;

  const type = p.type; // 'byt' or 'dom'
  document.getElementById('nabor-prop-id').value = propId;
  document.getElementById('nabor-type').value = type;

  // Show correct form
  document.getElementById('nabor-form-byt').style.display = type === 'byt' ? 'block' : 'none';
  document.getElementById('nabor-form-dom').style.display = type === 'dom' ? 'block' : 'none';
  document.getElementById('nabor-title').textContent = type === 'byt' ? 'Náborový list - Byt' : 'Náborový list - Rodinný dom';

  // Clear forms
  clearNaborForm('nb');
  clearNaborForm('nd');

  // Pre-fill from property data
  if (type === 'byt') {
    if (p.address) document.getElementById('nb-adresa').value = (p.address || '') + (p.city ? ', ' + p.city : '');
    if (p.rooms) document.getElementById('nb-izby').value = p.rooms;
    if (p.area) document.getElementById('nb-obytna-plocha').value = p.area;
    if (p.floor) document.getElementById('nb-poschodie').value = p.floor;
    if (p.ownerName) document.getElementById('nb-vlastnik').value = p.ownerName;
    if (p.ownerPhone) document.getElementById('nb-tel-vlastnik').value = p.ownerPhone;
    if (p.ownerEmail) document.getElementById('nb-email-vlastnik').value = p.ownerEmail;
    if (p.price) document.getElementById('nb-cena-inzercia-byt').value = p.price + ' €';
    document.getElementById('nb-datum-byt').value = new Date().toISOString().split('T')[0];
    const session = getStoredUser();
    if (session) document.getElementById('nb-makler-byt').value = session.name;
  } else {
    if (p.address) document.getElementById('nd-adresa').value = (p.address || '') + (p.city ? ', ' + p.city : '');
    if (p.rooms) document.getElementById('nd-izby').value = p.rooms;
    if (p.area) document.getElementById('nd-uzitkova').value = p.area;
    if (p.ownerName) document.getElementById('nd-vlastnik1').value = p.ownerName;
    if (p.price) document.getElementById('nd-cena-inzercia').value = p.price + ' €';
    document.getElementById('nd-datum').value = new Date().toISOString().split('T')[0];
    const session = getStoredUser();
    if (session) document.getElementById('nd-makler').value = session.name;
  }

  document.getElementById('naborModal').style.display = 'block';
  setTimeout(updateNaborPreview, 50);
}

function closeNaborModal() {
  document.getElementById('naborModal').style.display = 'none';
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

function generateNaborPDF() {
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

  function sectionTitle(title) {
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

  function fieldRow(label, value) {
    if (!value) return;
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
  if (viewIdx === '') { alert('Vyberte prehliadku.'); return; }
  const v = (p.viewings || [])[parseInt(viewIdx)];
  if (!v) return;

  const brokerName = document.getElementById('proto-broker-name').value.trim();
  const clientName = document.getElementById('proto-client-name').value.trim();
  const notes = document.getElementById('proto-notes').value.trim();

  if (!brokerName) { alert('Vyplňte meno makléra.'); return; }
  if (!clientName) { alert('Vyplňte meno záujemcu.'); return; }

  const brokerPad = sigPads['sig-broker'];
  const clientPad = sigPads['sig-client'];
  if (!brokerPad || brokerPad.isEmpty()) { alert('Chýba podpis makléra.'); return; }
  if (!clientPad || clientPad.isEmpty()) { alert('Chýba podpis záujemcu.'); return; }

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
  if (viewings.length === 0) { alert('Táto nehnuteľnosť nemá žiadne prehliadky.'); return; }

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

  if (!title) { alert('Vyplňte názov nehnuteľnosti'); return; }
  if (!city) { alert('Vyplňte mesto / obec'); return; }
  if (!phone) { alert('Vyplňte telefónne číslo'); return; }
  if (!priceVal) { alert('Vyplňte cenu'); return; }

  // Collect photos from preview (data URLs)
  const photoEls = document.querySelectorAll('#prop-photo-preview img');
  const photos = Array.from(photoEls).map(img => img.src).slice(0, 10);

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
    interested: tempInterested,
    viewings: tempViewings,
    updatedAt: new Date().toISOString(),
  };

  const props = getProperties();
  const existingIdx = props.findIndex(x => x.id === prop.id);
  if (existingIdx >= 0) {
    prop.createdAt = props[existingIdx].createdAt;
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
  closePropertyForm();
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
          ${(p.type === 'byt' || p.type === 'dom') ? `<button onclick="openNaborModal('${p.id}')" class="pca-btn" style="color:#0B2A3C;" title="Náborový list"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>` : ''}
          ${viewCount ? `<button onclick="openProtocolModal('${p.id}')" class="pca-btn" style="color:#1A7A8A;" title="Protokol s podpisom"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>` : ''}
          ${viewCount ? `<button onclick="generateViewingDocument('${p.id}')" class="pca-btn pca-doc" title="Zápisnica PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>` : ''}
          ${p.url ? `<a href="${p.url}" target="_blank" class="pca-btn pca-link" title="Inzerát"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
          <button onclick="openPropertyForm('${p.id}')" class="pca-btn pca-edit" title="Upraviť"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${!isTerminal && !isCompleted ? `<button onclick="advanceProperty('${p.id}', 'stiahnuta')" class="pca-btn pca-cancel" title="Stiahnuť"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          <button onclick="deleteProperty('${p.id}')" class="pca-btn pca-delete" title="Zmazať"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
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
  if (!props.length) { alert('Žiadne nehnuteľnosti na export'); return; }
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
  if (!text) { alert('Vložte text inzerátu'); return; }
  if (text.length < 50) { alert('Text je príliš krátky (min. 50 znakov).'); return; }
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
  if (!text) { alert('Vložte text inzerátu'); return; }
  if (text.length < 50) { alert('Text je príliš krátky. Vložte celý text inzerátu (aspoň 50 znakov).'); return; }

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

// AI Generate Description
async function aiGenerateDescription() {
  const settings = getAiSettings();
  if (!settings.apiKey) {
    alert('Najprv nastavte API kľúč v sekcii AI Nastavenia.');
    showPage('ai');
    return;
  }

  const property = getPropertyFormData();
  if (!property.city && !property.type) {
    document.getElementById('ai-gen-error').textContent = 'Vyplňte aspoň typ a mesto pred generovaním.';
    document.getElementById('ai-gen-error').style.display = 'block';
    return;
  }

  // Show spinner
  document.getElementById('ai-gen-text').style.display = 'none';
  document.getElementById('ai-gen-spinner').style.display = 'inline';
  document.getElementById('ai-gen-error').style.display = 'none';

  try {
    const sampleAds = getSampleAds();
    const images = (settings.usePhotos !== false) ? getPropertyPhotosBase64(5) : [];
    const resp = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Chyba pri generovaní');

    document.getElementById('prop-description').value = data.text;
  } catch (err) {
    document.getElementById('ai-gen-error').textContent = err.message;
    document.getElementById('ai-gen-error').style.display = 'block';
  } finally {
    document.getElementById('ai-gen-text').style.display = 'inline';
    document.getElementById('ai-gen-spinner').style.display = 'none';
  }
}

// AI Generate Headline
async function aiGenerateHeadline() {
  const settings = getAiSettings();
  if (!settings.apiKey) {
    alert('Najprv nastavte API kľúč v sekcii AI Nastavenia.');
    showPage('ai');
    return;
  }

  const property = getPropertyFormData();
  if (!property.city && !property.type) {
    alert('Vyplňte aspoň typ a mesto pred generovaním.');
    return;
  }

  try {
    const sampleAds = getSampleAds();
    const images = (settings.usePhotos !== false) ? getPropertyPhotosBase64(3) : [];
    const resp = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Chyba pri generovaní');

    document.getElementById('prop-ai-headline').value = data.text;
    // Also update main title if empty
    if (!document.getElementById('prop-title').value.trim()) {
      document.getElementById('prop-title').value = data.text;
    }
  } catch (err) {
    alert('Chyba: ' + err.message);
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

const CONTACT_CATEGORY_LABELS = {
  klient: 'Klient',
  potencialny: 'Potenciálny klient',
  makler: 'Makléř / Partner',
  developer: 'Developer',
  pravnik: 'Právnik / Notár',
  banka: 'Banka / Hypotéky',
  iny: 'Iný'
};
const CONTACT_STATUS_LABELS = {
  aktivny: { label: 'Aktívny', color: '#7ED4C8', bg: '#E5F5F1' },
  neaktivny: { label: 'Neaktívny', color: '#999', bg: '#f0f0f0' },
  vip: { label: 'VIP', color: '#F5A623', bg: '#FFF8EC' }
};

function openContactForm(id) {
  document.getElementById('contact-edit-id').value = id || '';
  document.getElementById('contact-modal-title').textContent = id ? 'Upraviť kontakt' : 'Pridať kontakt';
  if (id) {
    const c = getContacts().find(x => x.id === id);
    if (c) {
      document.getElementById('contact-name').value = c.name || '';
      document.getElementById('contact-phone').value = c.phone || '';
      document.getElementById('contact-email').value = c.email || '';
      document.getElementById('contact-company').value = c.company || '';
      document.getElementById('contact-category').value = c.category || 'klient';
      document.getElementById('contact-status').value = c.status || 'aktivny';
      document.getElementById('contact-address').value = c.address || '';
      document.getElementById('contact-note').value = c.note || '';
    }
  } else {
    document.getElementById('contact-name').value = '';
    document.getElementById('contact-phone').value = '';
    document.getElementById('contact-email').value = '';
    document.getElementById('contact-company').value = '';
    document.getElementById('contact-category').value = 'klient';
    document.getElementById('contact-status').value = 'aktivny';
    document.getElementById('contact-address').value = '';
    document.getElementById('contact-note').value = '';
  }
  document.getElementById('contact-modal').style.display = 'block';
}

function closeContactForm() {
  document.getElementById('contact-modal').style.display = 'none';
}

function saveContact() {
  const name = document.getElementById('contact-name').value.trim();
  if (!name) { alert('Vyplňte meno kontaktu.'); return; }

  const editId = document.getElementById('contact-edit-id').value;
  const contacts = getContacts();
  const data = {
    id: editId || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    phone: document.getElementById('contact-phone').value.trim(),
    email: document.getElementById('contact-email').value.trim(),
    company: document.getElementById('contact-company').value.trim(),
    category: document.getElementById('contact-category').value,
    status: document.getElementById('contact-status').value,
    address: document.getElementById('contact-address').value.trim(),
    note: document.getElementById('contact-note').value.trim(),
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
  const contacts = getContacts();
  const search = (document.getElementById('contact-filter-search').value || '').toLowerCase();
  const catFilters = msGetValues('ms-contact-category');
  const statusFilters = msGetValues('ms-contact-status');

  const filtered = contacts.filter(c => {
    if (catFilters.length && !catFilters.includes(c.category)) return false;
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
    const cat = CONTACT_CATEGORY_LABELS[c.category] || c.category;
    const st = CONTACT_STATUS_LABELS[c.status] || { label: c.status, color: '#999', bg: '#f0f0f0' };
    const note = c.note ? (c.note.length > 40 ? c.note.slice(0, 40) + '...' : c.note) : '-';
    const amlRec = amlAll.find(a => a.contactId === c.id);
    const amlBadge = amlRec
      ? (amlRec.status === 'approved' ? '<span class="aml-badge approved" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Overený</span>'
        : amlRec.status === 'rejected' ? '<span class="aml-badge rejected" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Zamietnutý</span>'
        : amlRec.status === 'flagged' ? '<span class="aml-badge flagged" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Flagged</span>'
        : '<span class="aml-badge pending" style="font-size:0.7rem;padding:0.15rem 0.45rem;">Čaká</span>')
      : '<span style="font-size:0.7rem;color:var(--text-light);">-</span>';
    return `<tr>
      <td style="text-align:left;padding-left:1rem;font-weight:600;color:#0B2A3C;">
        ${esc(c.name)}${c.company ? '<br><span style="font-weight:400;font-size:0.75rem;color:var(--text-light);">' + esc(c.company) + '</span>' : ''}
      </td>
      <td style="text-align:left;">${c.phone ? '<a href="tel:' + esc(c.phone) + '" style="color:#1A7A8A;text-decoration:none;">' + esc(c.phone) + '</a>' : '-'}</td>
      <td style="text-align:left;">${c.email ? '<a href="mailto:' + esc(c.email) + '" style="color:#1A7A8A;text-decoration:none;">' + esc(c.email) + '</a>' : '-'}</td>
      <td style="text-align:left;"><span style="font-size:0.78rem;">${esc(cat)}</span></td>
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
  if (contacts.length === 0) { alert('Žiadne kontakty na export.'); return; }
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
    migrateLocalData().then(() => loadAllData()).then(() => _reRenderAll());
  }
}

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
    }
  } else {
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
  document.getElementById('aml-modal').style.display = 'block';
}
function closeAmlForm() { document.getElementById('aml-modal').style.display = 'none'; }

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
    alert('Najprv vyplňte meno klienta.');
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
      alert('Meno a priezvisko sú povinné.'); return;
    }
  } else {
    if (!document.getElementById('aml-po-name').value.trim()) {
      alert('Obchodné meno je povinné.'); return;
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
  if (!records.length) { alert('Žiadne záznamy na export.'); return; }
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
          '<div style="font-size:0.78rem;color:var(--text-light);margin-top:0.2rem;">' + esc(lead.location || '') + (lead.source ? ' \u00B7 ' + esc(lead.source) : '') + (savedDupCount > 0 ? ' <span class="lc-dup-badge" style="cursor:default;" title="' + savedDupCount + ' \u010Falš\u00EDch leadov s rovnak\u00FDm telef\u00F3nom">Dup ' + savedDupCount + 'x</span>' : '') + '</div>' +
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
    alert('Tento formát (.doc) nepodporuje automatické vyplnenie. Stiahne sa šablóna.');
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
    alert('Chyba pri generovaní: ' + err.message);
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
  const e = (val) => val || '<span class="np-empty">—</span>';

  let html = '';
  const titleText = type === 'byt' ? 'PRACOVNÝ LIST - BYT' : 'PRACOVNÝ LIST - RODINNÝ DOM';
  html += `<div class="np-title-bar">${titleText}</div>`;

  if (type === 'byt') {
    html += _npSection('Základné údaje');
    html += _npRow('Adresa', e(v('nb-adresa')));
    html += _npRow2('Vlastníctvo', e(c('nb-vlastnictvo')), 'Vlastník', e(v('nb-vlastnik')));
    html += _npRow2('Podiel', v('nb-podiel'), 'Správca bytovky', v('nb-spravca-bytovky'));
    html += _npRow('Ťarcha', c('nb-tarcha'));

    html += _npSection('Bytový dom');
    html += _npRow2('Vek BD', v('nb-vek-bd'), 'Výťah', c('nb-vytah'));
    html += _npRow2('Materiál', c('nb-material-bd'), 'Vstup do BD', c('nb-vstup-bd'));
    html += _npRow('Stav BD', c('nb-stav-bd'));
    html += _npRow('Rekonštrukcia BD', v('nb-rekon-bd'));
    html += _npRow('Parkovanie', c('nb-parkovanie-byt'));

    html += _npSection('Byt');
    html += _npRow2('Počet izieb', e(v('nb-izby')), 'Poschodie', e(v('nb-poschodie')));
    html += _npRow('Obytná plocha', v('nb-obytna-plocha') ? v('nb-obytna-plocha') + ' m²' : '');
    html += _npMulti('Dispozícia', v('nb-dispozicia'));
    html += _npRow('Vykurovanie', c('nb-vykurovanie-byt'));
    html += _npRow('Ohrev vody', v('nb-ohrev-byt'));
    html += _npRow2('Okná', c('nb-okna-byt'), 'Komory/Sklá', v('nb-komory-byt'));
    html += _npRow2('Dvere', c('nb-dvere-byt'), 'Stav bytu', c('nb-stav-bytu'));

    html += _npSection('Príslušenstvo');
    html += _npRow2('Pivnica', v('nb-pivnica-byt'), 'Terasa', v('nb-terasa-byt'));
    html += _npRow2('Balkón', v('nb-balkon-byt'), 'Šatník', v('nb-satnik-byt'));
    html += _npRow2('Špajza', v('nb-spajza-byt'), 'Park. miesto', v('nb-park-miesto'));

    html += _npSection('Rekonštrukcia bytu');
    html += _npRow2('Rekonštrukcia', c('nb-rekon-byt'), 'Rok', v('nb-rekon-rok-byt'));
    html += _npMulti('Rozpis', v('nb-rekon-rozpis-byt'));

    html += _npSection('Zariadenie');
    html += _npRow('Zariadenie', c('nb-zariadenie-byt'));
    html += _npMulti('Rozpis zariadenia', v('nb-zariadenie-rozpis-byt'));

    html += _npSection('Mesačné náklady');
    html += _npRow2('Celkom', v('nb-naklady-celkom') ? v('nb-naklady-celkom') + ' €' : '', 'Správca', v('nb-naklady-spravca') ? v('nb-naklady-spravca') + ' €' : '');
    html += _npRow2('Elektrika', v('nb-naklady-elektrika-byt') ? v('nb-naklady-elektrika-byt') + ' €' : '', 'Plyn', v('nb-naklady-plyn-byt') ? v('nb-naklady-plyn-byt') + ' €' : '');
    html += _npRow2('Zateplenie', v('nb-zateplenie-byt'), 'Stupačky', v('nb-stupacky'));
    html += _npRow2('Energ. certifikát', v('nb-ecert-byt'), 'Podlahy', v('nb-podlahy'));
    html += _npRow('Ostatné', v('nb-naklady-ostatne-byt'));

    html += _npSection('Ostatné');
    html += _npRow2('Internet', c('nb-internet-byt'), 'Poskytovateľ', v('nb-internet-provider-byt'));
    html += _npRow('Vysťahovanie', v('nb-vystahovanie'));
    html += _npMulti('Vady / poškodenia', v('nb-vady-byt'));
    html += _npMulti('Poznámky', v('nb-poznamky-byt'));
    html += _npRow('Podmienený prevod', v('nb-podmieneny-byt'));
    html += _npRow('Kúpa novej - predstava', v('nb-nova-predstava-byt'));
    html += _npRow('Financovanie', v('nb-financovanie-byt'));

    html += _npSection('Ceny a záver');
    html += _npRow2('Odporúč. cena', v('nb-cena-odporucana-byt'), 'Cena do inzercie', v('nb-cena-inzercia-byt'));
    html += _npRow('Provízia pre RK', v('nb-provizia-byt'));
    html += _npRow('Nadobúdací doklad', v('nb-nadobudaci-byt'));
    html += _npRow2('Telefón vlastníka', v('nb-tel-vlastnik'), 'Email vlastníka', v('nb-email-vlastnik'));
    html += _npRow2('Fotenie', v('nb-fotenie-byt'), 'Inzercia', v('nb-inzercia-byt'));
    html += _npRow2('Maklér', v('nb-makler-byt'), 'Dátum', v('nb-datum-byt'));

  } else {
    html += _npSection('Základné údaje');
    html += _npRow('Adresa', e(v('nd-adresa')));
    html += _npRow2('Počet podlaží', v('nd-podlazia'), 'Počet izieb', v('nd-izby'));
    html += _npRow('Typ RD', c('nd-typ-rd'));
    html += _npRow('Stav RD', c('nd-stav-rd'));

    html += _npSection('Rodinný dom');
    html += _npRow2('Vek RD', v('nd-vek-rd'), 'Energ. certifikát', v('nd-ecert'));
    html += _npRow2('Zastavaná plocha', v('nd-zastavana') ? v('nd-zastavana') + ' m²' : '', 'Úžitková plocha', v('nd-uzitkova') ? v('nd-uzitkova') + ' m²' : '');
    html += _npRow('Pozemok celkom', v('nd-pozemok') ? v('nd-pozemok') + ' m²' : '');

    html += _npSection('Inžinierske siete');
    html += _npRow2('Elektrika', c('nd-elektrika'), 'Voda', c('nd-voda'));
    html += _npRow2('Odpad', c('nd-odpad'), 'Žumpa (m³)', v('nd-zumpa-m3'));
    html += _npRow('Plyn', c('nd-plyn'));

    html += _npSection('Konštrukcia');
    html += _npRow('Materiál', c('nd-material'));
    html += _npRow2('Obvodové murivo', v('nd-murivo'), 'Deliace priečky', v('nd-priecky'));
    html += _npRow2('Zateplenie', c('nd-zateplenie'), 'Hrúbka', v('nd-zateplenie-hrubka'));
    html += _npRow('Fasáda', v('nd-fasada'));

    html += _npSection('Strecha');
    html += _npRow('Typ strechy', c('nd-strecha-typ'));
    html += _npRow('Materiál strechy', c('nd-strecha-mat'));
    html += _npRow('Izolácia', v('nd-strecha-izolacia'));

    html += _npSection('Okná, dvere, zabezpečenie');
    html += _npRow2('Okná', c('nd-okna'), 'Komory/Sklá', v('nd-komory'));
    html += _npRow('Žalúzie', c('nd-zaluzie'));
    html += _npRow2('Vstupné dvere', c('nd-dvere'), 'Zabezpečenie', c('nd-zabezpecenie'));

    html += _npSection('Vykurovanie a vybavenie');
    html += _npRow2('Krb', c('nd-krb'), 'Klimatizácia', c('nd-klima'));
    html += _npRow('Vykurovanie', c('nd-vykurovanie'));
    html += _npRow('Ohrev vody', v('nd-ohrev'));
    html += _npMulti('Dispozícia RD', v('nd-dispozicia'));

    html += _npSection('Príslušenstvo');
    html += _npRow2('Pivnica', v('nd-pivnica'), 'Terasa', v('nd-terasa'));
    html += _npRow2('Balkón', v('nd-balkon'), 'Povala', v('nd-povala'));

    html += _npSection('Rekonštrukcia');
    html += _npRow2('Rekonštrukcia', c('nd-rekon'), 'Rok', v('nd-rekon-rok'));
    html += _npMulti('Rozpis', v('nd-rekon-rozpis'));

    html += _npSection('Zariadenie');
    html += _npRow('Zariadenie', c('nd-zariadenie'));
    html += _npMulti('Rozpis zariadenia', v('nd-zariadenie-rozpis'));

    html += _npSection('Exteriér');
    html += _npRow('Parkovanie', c('nd-parkovanie'));
    html += _npRow2('Garáž', v('nd-garaz'), 'Altánok', v('nd-altanok'));
    html += _npRow2('Bazén', v('nd-bazen'), 'Studňa', v('nd-studna'));
    html += _npRow('Iná stavba', v('nd-ina-stavba'));
    html += _npMulti('Rozpis exteriéru', v('nd-ext-rozpis'));

    html += _npSection('Mesačné náklady');
    html += _npRow2('Elektrika', v('nd-naklady-elektrika') ? v('nd-naklady-elektrika') + ' €' : '', 'Voda', v('nd-naklady-voda') ? v('nd-naklady-voda') + ' €' : '');
    html += _npRow2('Plyn', v('nd-naklady-plyn') ? v('nd-naklady-plyn') + ' €' : '', 'Žumpa', v('nd-naklady-zumpa') ? v('nd-naklady-zumpa') + ' €' : '');
    html += _npRow2('Odpad', v('nd-naklady-odpad') ? v('nd-naklady-odpad') + ' €' : '', 'TV', v('nd-naklady-tv') ? v('nd-naklady-tv') + ' €' : '');
    html += _npRow('Internet', v('nd-naklady-internet') ? v('nd-naklady-internet') + ' €' : '');
    html += _npRow2('Poskytovateľ', v('nd-internet-provider'), 'Typ pripojenia', c('nd-internet-typ'));

    html += _npSection('Ostatné');
    html += _npMulti('Vady / poškodenia', v('nd-vady'));
    html += _npMulti('Poznámky', v('nd-poznamky'));
    html += _npRow('Podmienený prevod', v('nd-podmieneny'));

    html += _npSection('Vlastníctvo');
    html += _npRow('Vlastníctvo', c('nd-vlastnictvo'));
    html += _npRow2('Vlastník 1', v('nd-vlastnik1'), 'Podiel 1', v('nd-podiel1'));
    html += _npRow2('Vlastník 2', v('nd-vlastnik2'), 'Podiel 2', v('nd-podiel2'));
    html += _npRow('Ťarcha', c('nd-tarcha'));
    html += _npRow('Nadobúdací doklad', v('nd-nadobudaci'));
    html += _npRow('Dokumenty', v('nd-dokumenty'));

    html += _npSection('Ceny a záver');
    html += _npRow2('Odporúč. cena', v('nd-cena-odporucana'), 'Cena do inzercie', v('nd-cena-inzercia'));
    html += _npRow('Provízia pre RK', v('nd-provizia'));
    html += _npRow2('Fotenie', v('nd-fotenie'), 'Inzercia', v('nd-inzercia'));
    html += _npRow2('Maklér', v('nd-makler'), 'Dátum', v('nd-datum'));
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

