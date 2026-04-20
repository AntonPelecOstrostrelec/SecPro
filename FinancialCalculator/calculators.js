// ============================================================
// All 13 Calculator Implementations
// ============================================================

// ---- 1. BÝVANIE (Mortgage Calculator) ----

function calcMortgage() {
    const loanAmount = getInputValue('mort-amount');
    const annualRate = getInputValue('mort-rate') / 100;
    const years = getInputValue('mort-years');
    const paymentsPerYear = 12;
    const monthlyRate = annualRate / paymentsPerYear;
    const totalPayments = paymentsPerYear * years;

    if (loanAmount <= 0 || years <= 0) return;

    const monthlyPayment = Math.abs(PMT(monthlyRate, totalPayments, loanAmount));

    // Build amortization schedule
    const schedule = [];
    let balance = loanAmount;
    let totalInterest = 0;
    let totalPrincipal = 0;
    let totalPaid = 0;

    for (let month = 1; month <= totalPayments; month++) {
        if (balance < 0.1) break;
        const interestPortion = balance * monthlyRate;
        const principalPortion = Math.min(monthlyPayment - interestPortion, balance);
        balance = balance - principalPortion;
        totalInterest += interestPortion;
        totalPrincipal += principalPortion;
        totalPaid += monthlyPayment;

        if (month % 12 === 0 || month === 1 || month === totalPayments) {
            schedule.push({
                month,
                year: Math.ceil(month / 12),
                payment: monthlyPayment,
                interest: interestPortion,
                principal: principalPortion,
                balance: Math.max(balance, 0),
                totalInterest,
                totalPrincipal
            });
        }
    }

    setOutput('mort-monthly', formatCurrency(monthlyPayment));
    setOutput('mort-total-paid', formatCurrency(totalPaid));
    setOutput('mort-total-interest', formatCurrency(totalInterest));
    setOutput('mort-overpayment', formatCurrency(totalPaid - loanAmount));

    // Build schedule table
    const tbody = document.getElementById('mort-schedule');
    tbody.innerHTML = '';
    schedule.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.month % 12 === 0 ? row.year : row.month + '. mes.'}</td>
            <td>${formatCurrency(row.payment)}</td>
            <td>${formatCurrency(row.interest)}</td>
            <td>${formatCurrency(row.principal)}</td>
            <td>${formatCurrency(row.balance)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Chart
    renderMortgageChart(schedule);
}

function renderMortgageChart(schedule) {
    const canvas = document.getElementById('mort-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 280;
    ctx.clearRect(0, 0, W, H);

    const yearRows = schedule.filter(r => r.month % 12 === 0);
    if (yearRows.length === 0) return;

    const maxVal = yearRows[0].balance || 1;
    const barW = Math.max(8, (W - 80) / yearRows.length - 4);
    const chartH = H - 50;

    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    yearRows.forEach((row, i) => {
        const x = 50 + i * (barW + 4);
        const balH = (row.balance / maxVal) * chartH;
        const intH = (row.totalInterest / maxVal) * chartH;

        // Balance bar
        ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
        ctx.fillRect(x, chartH - balH + 10, barW / 2, balH);

        // Cumulative interest bar
        ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
        ctx.fillRect(x + barW / 2, chartH - intH + 10, barW / 2, intH);

        // Year label
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(row.year, x + barW / 2, H - 5);
    });

    // Legend
    ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
    ctx.fillRect(10, 5, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Zostatok', 55, 15);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
    ctx.fillRect(100, 5, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Úroky', 140, 15);
}

// ---- 2. BUDOVANIE MAJETKU (Wealth Building) ----

function calcWealth() {
    const fields = [
        { prefix: 'wlt-short', count: 4 },
        { prefix: 'wlt-mid', count: 4 },
        { prefix: 'wlt-long', count: 4 }
    ];

    let totalShort = 0, totalMid = 0, totalLong = 0;
    let totalFixne = 0, totalVariable = 0, totalJednorazovo = 0;

    fields.forEach((group, gi) => {
        let groupTotal = 0;
        for (let i = 1; i <= group.count; i++) {
            const val = getInputValue(`${group.prefix}-val-${i}`);
            const type = document.getElementById(`${group.prefix}-type-${i}`)?.value || 'fixne';
            groupTotal += val;
            if (type === 'fixne') totalFixne += val;
            else if (type === 'variabilne') totalVariable += val;
            else totalJednorazovo += val;
        }
        if (gi === 0) totalShort = groupTotal;
        else if (gi === 1) totalMid = groupTotal;
        else totalLong = groupTotal;
    });

    const monthlyExpenses = getInputValue('wlt-expenses');
    const idealReserve = monthlyExpenses * 6;
    const totalPortfolio = totalShort + totalMid + totalLong;
    const realEstate = getInputValue('wlt-realestate');

    setOutput('wlt-total-short', formatCurrency(totalShort));
    setOutput('wlt-total-mid', formatCurrency(totalMid));
    setOutput('wlt-total-long', formatCurrency(totalLong));
    setOutput('wlt-total-portfolio', formatCurrency(totalPortfolio));
    setOutput('wlt-ideal-reserve', formatCurrency(idealReserve));
    setOutput('wlt-total-fixne', formatCurrency(totalFixne));
    setOutput('wlt-total-variable', formatCurrency(totalVariable));
    setOutput('wlt-total-jednorazovo', formatCurrency(totalJednorazovo));
    setOutput('wlt-net-worth', formatCurrency(totalPortfolio + realEstate));

    // Pie chart
    renderWealthChart(totalShort, totalMid, totalLong);
}

function renderWealthChart(short, mid, long) {
    const canvas = document.getElementById('wlt-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 300;
    const H = canvas.height = 300;
    ctx.clearRect(0, 0, W, H);

    const total = short + mid + long;
    if (total === 0) return;

    const data = [
        { value: short, color: '#6366f1', label: 'Krátkodobé' },
        { value: mid, color: '#f59e0b', label: 'Strednodobé' },
        { value: long, color: '#10b981', label: 'Dlhodobé' }
    ];

    let startAngle = -Math.PI / 2;
    const cx = W / 2, cy = H / 2 - 10, r = 100;

    data.forEach(d => {
        if (d.value <= 0) return;
        const sliceAngle = (d.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
        ctx.fillStyle = d.color;
        ctx.fill();

        const midAngle = startAngle + sliceAngle / 2;
        const lx = cx + Math.cos(midAngle) * (r + 20);
        const ly = cy + Math.sin(midAngle) * (r + 20);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.label} ${((d.value / total) * 100).toFixed(0)}%`, lx, ly);
        startAngle += sliceAngle;
    });
}

// ---- 3. INVESTOVANIE (Investment Growth) ----

function calcInvesting() {
    const initial = getInputValue('inv-initial');
    const monthly = getInputValue('inv-monthly');
    const rate = getInputValue('inv-rate') / 100;
    const years = getInputValue('inv-years');
    const annualContrib = monthly * 12;

    if (years <= 0) return;

    const data = [];
    const pessRate = rate - 0.015;
    const optRate = rate + 0.015;

    let valMain = initial, valPess = initial, valOpt = initial;
    let contrib = initial;

    for (let y = 1; y <= years; y++) {
        valMain = (valMain + annualContrib) * (1 + rate);
        valPess = (valPess + annualContrib) * (1 + pessRate);
        valOpt = (valOpt + annualContrib) * (1 + optRate);
        contrib += annualContrib;
        data.push({ year: y, main: valMain, pess: valPess, opt: valOpt, contrib });
    }

    const final = data[data.length - 1];
    setOutput('inv-result-main', formatCurrency(final.main));
    setOutput('inv-result-pess', formatCurrency(final.pess));
    setOutput('inv-result-opt', formatCurrency(final.opt));
    setOutput('inv-total-contrib', formatCurrency(final.contrib));
    setOutput('inv-profit', formatCurrency(final.main - final.contrib));

    // Table
    const tbody = document.getElementById('inv-table');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${formatCurrency(row.contrib)}</td>
            <td>${formatCurrency(row.pess)}</td>
            <td>${formatCurrency(row.main)}</td>
            <td>${formatCurrency(row.opt)}</td>
        `;
        tbody.appendChild(tr);
    });

    renderInvestingChart(data);
}

function renderInvestingChart(data) {
    const canvas = document.getElementById('inv-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 280;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.opt));
    const padL = 70, padR = 20, padT = 30, padB = 30;
    const chartW = W - padL - padR, chartH = H - padT - padB;

    function toX(i) { return padL + (i / (data.length - 1)) * chartW; }
    function toY(v) { return padT + chartH - (v / maxVal) * chartH; }

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (i / 4) * chartH;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
        ctx.fillText(formatCurrency(maxVal * (1 - i / 4), 0), padL - 5, y + 4);
    }

    const lines = [
        { key: 'contrib', color: '#94a3b8', label: 'Vklady' },
        { key: 'pess', color: '#f43f5e', label: 'Pesimistický' },
        { key: 'main', color: '#6366f1', label: 'Očakávaný' },
        { key: 'opt', color: '#10b981', label: 'Optimistický' }
    ];

    lines.forEach(line => {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 2;
        data.forEach((d, i) => {
            const x = toX(i), y = toY(d[line.key]);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    });

    // Legend
    lines.forEach((line, i) => {
        const x = padL + i * 120;
        ctx.fillStyle = line.color;
        ctx.fillRect(x, 5, 10, 10);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '11px Inter'; ctx.textAlign = 'left';
        ctx.fillText(line.label, x + 14, 14);
    });

    // X axis labels
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '10px Inter';
    data.forEach((d, i) => {
        if (data.length <= 20 || i % 5 === 0 || i === data.length - 1) {
            ctx.fillText(d.year + ' r.', toX(i), H - 5);
        }
    });
}

// ---- 4. ROZLOŽENIE INVESTÍCIE (Investment Allocation) ----

const ALLOCATION_TABLE = [
    // [riskLevel, bonds%, mixedBonds%, balanced%, mixedEquity%, equity%]
    [1, 100, 0, 0, 0, 0],
    [2, 80, 20, 0, 0, 0],
    [3, 60, 40, 0, 0, 0],
    [4, 40, 40, 20, 0, 0],
    [5, 20, 30, 30, 20, 0],
    [6, 0, 20, 30, 30, 20],
    [7, 0, 0, 20, 40, 40],
    [8, 0, 0, 0, 30, 70],
    [9, 0, 0, 0, 10, 90],
    [10, 0, 0, 0, 0, 100]
];

const FUND_RETURNS = [0.03, 0.04, 0.055, 0.065, 0.08]; // expected annual returns per asset class
const FUND_VOLATILITY = [0.02, 0.04, 0.08, 0.12, 0.18];
const FUND_NAMES = ['Dlhopisový', 'Zmiešaný konzerv.', 'Vyvážený', 'Zmiešaný dynamický', 'Akciový'];

function calcAllocation() {
    const horizon = getInputValue('alloc-horizon');
    const riskTolerance = getInputValue('alloc-risk');
    const investType = document.getElementById('alloc-type')?.value || 'regular';
    const amount = getInputValue('alloc-amount');
    const fee = getInputValue('alloc-fee') / 100;

    // Calculate risk score (1-10)
    let riskScore = Math.round(horizon / 3 + (riskTolerance - 2) * 0.5);
    riskScore = Math.max(1, Math.min(10, riskScore));

    const netAmount = amount - (amount * fee);
    const alloc = ALLOCATION_TABLE[riskScore - 1];
    const weights = [alloc[1] / 100, alloc[2] / 100, alloc[3] / 100, alloc[4] / 100, alloc[5] / 100];

    // Weighted return and volatility
    const weightedReturn = SUMPRODUCT(weights, FUND_RETURNS);
    const weightedVol = SUMPRODUCT(weights, FUND_VOLATILITY);

    // Projected values
    let projectedValue;
    if (investType === 'lump') {
        projectedValue = netAmount * Math.pow(1 + weightedReturn, horizon);
    } else {
        const monthlyRate = weightedReturn / 12;
        const months = horizon * 12;
        projectedValue = netAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    }

    setOutput('alloc-risk-score', riskScore);
    setOutput('alloc-net-amount', formatCurrency(netAmount));
    setOutput('alloc-weighted-return', formatPercent(weightedReturn));
    setOutput('alloc-weighted-vol', formatPercent(weightedVol));
    setOutput('alloc-projected', formatCurrency(projectedValue));

    // Allocation table
    const tbody = document.getElementById('alloc-table');
    tbody.innerHTML = '';
    FUND_NAMES.forEach((name, i) => {
        if (weights[i] <= 0) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${name}</td>
            <td>${(weights[i] * 100).toFixed(0)} %</td>
            <td>${formatCurrency(netAmount * weights[i])}</td>
            <td>${formatPercent(FUND_RETURNS[i])}</td>
            <td>${formatPercent(FUND_VOLATILITY[i])}</td>
        `;
        tbody.appendChild(tr);
    });

    renderAllocationChart(weights);
}

function renderAllocationChart(weights) {
    const canvas = document.getElementById('alloc-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 300; const H = canvas.height = 300;
    ctx.clearRect(0, 0, W, H);

    const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#10b981'];
    const total = weights.reduce((s, w) => s + w, 0);
    if (total === 0) return;

    let startAngle = -Math.PI / 2;
    const cx = W / 2, cy = H / 2, r = 100;

    weights.forEach((w, i) => {
        if (w <= 0) return;
        const slice = (w / total) * 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + slice);
        ctx.fillStyle = colors[i]; ctx.fill();

        const mid = startAngle + slice / 2;
        const lx = cx + Math.cos(mid) * (r + 25);
        const ly = cy + Math.sin(mid) * (r + 25);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
        ctx.fillText(`${FUND_NAMES[i]} ${(w * 100).toFixed(0)}%`, lx, ly);
        startAngle += slice;
    });
}

// ---- 5. MILIÓNOVÁ KALKULAČKA (Million Calculator) ----

function calcMillion() {
    const target = getInputValue('mil-target');
    const years = getInputValue('mil-years');
    const rate = getInputValue('mil-rate') / 100;

    if (target <= 0 || years <= 0) return;

    const monthlyPayment = Math.abs(PMT(rate / 12, years * 12, 0, target));
    const totalContrib = monthlyPayment * years * 12;
    const profit = target - totalContrib;

    setOutput('mil-monthly', formatCurrency(monthlyPayment));
    setOutput('mil-total-contrib', formatCurrency(totalContrib));
    setOutput('mil-profit', formatCurrency(profit));
}

// ---- 6. RENTA MESAČNÁ (Monthly Annuity/Drawdown) ----

function calcMonthlyAnnuity() {
    const capital = getInputValue('annuity-capital');
    const years = getInputValue('annuity-years');
    const rate = getInputValue('annuity-rate') / 100;
    const exhaust = document.getElementById('annuity-exhaust')?.value === 'ano';
    const keepAmount = exhaust ? 0 : getInputValue('annuity-keep');

    if (capital <= 0 || years <= 0) return;

    const monthlyPayout = Math.abs(PMT(rate / 12, years * 12, capital, -keepAmount));
    const totalReceived = monthlyPayout * 12 * years + keepAmount;
    const totalReturn = totalReceived - capital;

    setOutput('annuity-monthly', formatCurrency(monthlyPayout));
    setOutput('annuity-total', formatCurrency(totalReceived));
    setOutput('annuity-return', formatCurrency(totalReturn));

    if (monthlyPayout < 0 || totalReturn < 0) {
        setOutput('annuity-warning', 'Upozornenie: Zvolený úrok nestačí na požadovanú rentu!');
    } else {
        setOutput('annuity-warning', '');
    }
}

// ---- 7. RENTA Z VÝNOSOV (Yield-Based Annuity) ----

function calcYieldAnnuity() {
    const capital = getInputValue('yield-capital');
    const rate = getInputValue('yield-rate') / 100;
    const payoutPct = getInputValue('yield-payout') / 100;
    const years = getInputValue('yield-years');

    if (capital <= 0 || years <= 0) return;

    const data = [];
    let balance = capital;
    let cumPayout = 0;

    for (let y = 1; y <= Math.min(years, 40); y++) {
        const grossReturn = balance * rate;
        const payout = grossReturn * payoutPct;
        const monthlyPayout = payout / 12;
        const retained = grossReturn - payout;
        balance = balance + retained;
        cumPayout += payout;
        data.push({ year: y, balance, grossReturn, payout, monthlyPayout, cumPayout });
    }

    const final = data[data.length - 1];
    setOutput('yield-monthly-payout', formatCurrency(final.monthlyPayout));
    setOutput('yield-annual-payout', formatCurrency(final.payout));
    setOutput('yield-total-payout', formatCurrency(final.cumPayout));
    setOutput('yield-final-capital', formatCurrency(final.balance));

    const tbody = document.getElementById('yield-table');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${formatCurrency(row.balance)}</td>
            <td>${formatCurrency(row.grossReturn)}</td>
            <td>${formatCurrency(row.payout)}</td>
            <td>${formatCurrency(row.monthlyPayout)}</td>
            <td>${formatCurrency(row.cumPayout)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- 8. II. PILIER (2nd Pension Pillar) ----

function calcPillar() {
    const contribution = getInputValue('pillar-contrib');
    const years = getInputValue('pillar-years');
    const salaryGrowth = getInputValue('pillar-salary-growth') / 100;

    if (contribution <= 0 || years <= 0) return;

    const bondRate = 0.03;
    const stockRate = 0.06;
    const indexRate = 0.07;

    function calcFundValue(rate) {
        let value = 0;
        let annualContrib = contribution * 12;
        for (let y = 1; y <= years; y++) {
            value = (value + annualContrib) * (1 + rate);
            annualContrib *= (1 + salaryGrowth);
        }
        return value;
    }

    const bondValue = calcFundValue(bondRate);
    const stockValue = calcFundValue(stockRate);
    const indexValue = calcFundValue(indexRate);
    const totalContrib = (() => {
        let total = 0, annual = contribution * 12;
        for (let y = 0; y < years; y++) {
            total += annual;
            annual *= (1 + salaryGrowth);
        }
        return total;
    })();

    setOutput('pillar-bond', formatCurrency(bondValue));
    setOutput('pillar-stock', formatCurrency(stockValue));
    setOutput('pillar-index', formatCurrency(indexValue));
    setOutput('pillar-contrib-total', formatCurrency(totalContrib));
    setOutput('pillar-diff', formatCurrency(indexValue - bondValue));

    renderPillarChart(bondValue, stockValue, indexValue, totalContrib);
}

function renderPillarChart(bond, stock, index, contrib) {
    const canvas = document.getElementById('pillar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 250;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(bond, stock, index, contrib);
    const bars = [
        { label: 'Vklady', value: contrib, color: '#94a3b8' },
        { label: 'Dlhopisy 3%', value: bond, color: '#6366f1' },
        { label: 'Akcie 6%', value: stock, color: '#f59e0b' },
        { label: 'Index 7%', value: index, color: '#10b981' }
    ];
    const barW = 60, gap = 30;
    const startX = (W - bars.length * (barW + gap)) / 2;

    bars.forEach((b, i) => {
        const x = startX + i * (barW + gap);
        const h = (b.value / maxVal) * (H - 60);
        ctx.fillStyle = b.color;
        ctx.fillRect(x, H - 30 - h, barW, h);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
        ctx.fillText(b.label, x + barW / 2, H - 10);
        ctx.fillText(formatCurrency(b.value, 0), x + barW / 2, H - 35 - h);
    });
}

// ---- 9. FINANČNÁ MATEMATIKA (Financial Mathematics) ----

function calcFinMath() {
    const pvVal = document.getElementById('fm-pv').value;
    const pmtVal = document.getElementById('fm-pmt').value;
    const fvVal = document.getElementById('fm-fv').value;
    const nVal = document.getElementById('fm-n').value;
    const rateVal = document.getElementById('fm-rate').value;
    const compounding = document.getElementById('fm-compounding')?.value || 'ročne';

    const compMap = { 'ročne': 1, 'štvrťročne': 4, 'mesačne': 12, 'denne': 365 };
    const periodsPerYear = compMap[compounding] || 1;

    // Count filled fields
    const fields = [
        { id: 'pv', val: pvVal, parsed: parseInputNumber(pvVal) },
        { id: 'pmt', val: pmtVal, parsed: parseInputNumber(pmtVal) },
        { id: 'fv', val: fvVal, parsed: parseInputNumber(fvVal) },
        { id: 'n', val: nVal, parsed: parseInputNumber(nVal) },
        { id: 'rate', val: rateVal, parsed: parseInputNumber(rateVal) / 100 }
    ];

    const filled = fields.filter(f => f.val !== '');
    const empty = fields.filter(f => f.val === '');

    if (filled.length !== 4 || empty.length !== 1) {
        setOutput('fm-result', 'Vyplňte presne 4 z 5 polí. Piate sa vypočíta.');
        return;
    }

    const pv = fields[0].parsed;
    const pmt = fields[1].parsed;
    const fv = fields[2].parsed;
    const n = fields[3].parsed;
    const rate = fields[4].parsed;
    const missing = empty[0].id;

    let result, label;

    try {
        switch (missing) {
            case 'pv':
                result = -PV(rate / periodsPerYear, periodsPerYear * n, pmt * 12 / periodsPerYear, fv);
                label = 'Súčasná hodnota (PV)';
                document.getElementById('fm-pv').value = result.toFixed(2);
                break;
            case 'pmt':
                result = PMT(rate / periodsPerYear, periodsPerYear * n, pv, fv) * periodsPerYear / 12;
                label = 'Mesačná splátka (PMT)';
                document.getElementById('fm-pmt').value = result.toFixed(2);
                break;
            case 'fv':
                result = FV(rate / periodsPerYear, periodsPerYear * n, pmt * 12 / periodsPerYear, pv);
                label = 'Budúca hodnota (FV)';
                document.getElementById('fm-fv').value = result.toFixed(2);
                break;
            case 'n':
                result = NPER(rate / periodsPerYear, pmt * 12 / periodsPerYear, pv, fv) / periodsPerYear;
                label = 'Počet rokov (N)';
                document.getElementById('fm-n').value = result.toFixed(2);
                break;
            case 'rate':
                result = periodsPerYear * RATE(n * periodsPerYear, pmt * 12 / periodsPerYear, pv, fv);
                label = 'Úroková sadzba (Rate)';
                document.getElementById('fm-rate').value = (result * 100).toFixed(4);
                break;
        }
        setOutput('fm-result', `${label}: ${missing === 'rate' ? formatPercent(result) : formatCurrency(result)}`);
    } catch (e) {
        setOutput('fm-result', 'Chyba výpočtu. Skontrolujte vstupné hodnoty.');
    }

    renderFinMathChart(pv, pmt, fv, n, rate, periodsPerYear, missing);
}

function renderFinMathChart(pv, pmt, fv, n, rate, ppyr, missing) {
    const canvas = document.getElementById('fm-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 250;
    ctx.clearRect(0, 0, W, H);

    // Recalculate resolved values
    if (missing === 'pv') pv = -PV(rate / ppyr, ppyr * n, pmt * 12 / ppyr, fv);
    if (missing === 'fv') fv = FV(rate / ppyr, ppyr * n, pmt * 12 / ppyr, pv);
    if (missing === 'pmt') pmt = PMT(rate / ppyr, ppyr * n, pv, fv) * ppyr / 12;
    if (missing === 'n') n = NPER(rate / ppyr, pmt * 12 / ppyr, pv, fv) / ppyr;
    if (missing === 'rate') rate = ppyr * RATE(n * ppyr, pmt * 12 / ppyr, pv, fv);

    if (isNaN(n) || n <= 0 || n > 100) return;

    const years = Math.ceil(n);
    const data = [];
    for (let y = 0; y <= years; y++) {
        const investmentVal = FV(rate / 12, y * 12, -Math.abs(pmt), -Math.abs(pv));
        const totalContrib = Math.abs(pv) + Math.abs(pmt) * 12 * y;
        data.push({ year: y, value: Math.abs(investmentVal), contrib: totalContrib });
    }

    const maxVal = Math.max(...data.map(d => Math.max(d.value, d.contrib))) || 1;
    const padL = 70, padT = 20, padB = 30, padR = 20;
    const chartW = W - padL - padR, chartH = H - padT - padB;

    function toX(i) { return padL + (i / years) * chartW; }
    function toY(v) { return padT + chartH - (v / maxVal) * chartH; }

    // Contribution area
    ctx.beginPath();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    data.forEach((d, i) => { i === 0 ? ctx.moveTo(toX(d.year), toY(d.contrib)) : ctx.lineTo(toX(d.year), toY(d.contrib)); });
    ctx.lineTo(toX(years), toY(0)); ctx.lineTo(toX(0), toY(0)); ctx.fill();

    // Value line
    ctx.beginPath(); ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
    data.forEach((d, i) => { i === 0 ? ctx.moveTo(toX(d.year), toY(d.value)) : ctx.lineTo(toX(d.year), toY(d.value)); });
    ctx.stroke();

    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '10px Inter';
    data.forEach(d => {
        if (years <= 20 || d.year % 5 === 0) ctx.fillText(d.year, toX(d.year), H - 5);
    });
}

// ---- 10. DIVIDENDA (Dividend Calculator) ----

function calcDividend() {
    const initial = getInputValue('div-initial');
    const yieldRate = getInputValue('div-yield') / 100;
    const frequency = document.getElementById('div-frequency')?.value || 'quarterly';
    const reinvest = document.getElementById('div-reinvest')?.value === 'yes';

    if (initial <= 0) return;

    const periods = frequency === 'quarterly' ? 4 : 2;
    const periodRate = yieldRate / periods;
    const years = 10;
    const data = [];

    let balance = initial;
    let totalDividends = 0;

    for (let y = 1; y <= years; y++) {
        let yearDividend = 0;
        for (let p = 0; p < periods; p++) {
            const dividend = balance * periodRate;
            yearDividend += dividend;
            if (reinvest) {
                balance += dividend;
            }
        }
        if (!reinvest) {
            // Balance stays the same
        }
        totalDividends += yearDividend;
        data.push({
            year: y,
            balance: reinvest ? balance : initial,
            dividend: yearDividend,
            monthlyDiv: yearDividend / 12,
            totalDividends
        });
    }

    const final = data[data.length - 1];
    setOutput('div-balance', formatCurrency(final.balance));
    setOutput('div-annual-div', formatCurrency(final.dividend));
    setOutput('div-monthly-div', formatCurrency(final.monthlyDiv));
    setOutput('div-total-div', formatCurrency(totalDividends));

    const tbody = document.getElementById('div-table');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${formatCurrency(row.balance)}</td>
            <td>${formatCurrency(row.dividend)}</td>
            <td>${formatCurrency(row.monthlyDiv)}</td>
            <td>${formatCurrency(row.totalDividends)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- 11. VYPOČTY P. MATOVIČ (Pension Calculator) ----

function calcPension() {
    const birthYear = getInputValue('pen-birth-year');
    const grossSalary = getInputValue('pen-salary');
    const retireAge = getInputValue('pen-retire-age');
    const has2ndPillar = document.getElementById('pen-2nd-pillar')?.value === 'yes';
    const pillarEntryYear = getInputValue('pen-pillar-entry');
    const desiredPension = getInputValue('pen-desired');
    const currentAge = new Date().getFullYear() - birthYear;
    const yearsToRetire = retireAge - currentAge;

    if (grossSalary <= 0 || retireAge <= currentAge) return;

    // Slovak pension value 2024 (approximately)
    const pensionValuePerYear = 17.0399;
    const contributionYears = retireAge - 18;

    // POMB coefficient (personal assessment base / general assessment base)
    // Simplified: ratio of personal salary to average salary (capped at 3)
    const avgSalary = 1430; // approximate Slovak average gross salary 2024
    let pomb = grossSalary / avgSalary;
    pomb = Math.min(pomb, 3);

    // 1st pillar pension
    let pension1stPillar = contributionYears * pomb * pensionValuePerYear;

    // Early retirement penalty (0.5% per month before 62)
    let earlyPenaltyPct = 0;
    if (retireAge < 62) {
        earlyPenaltyPct = (62 - retireAge) * 12 * 0.5;
        pension1stPillar = pension1stPillar * (100 - earlyPenaltyPct) / 100;
    }

    // If has 2nd pillar, reduce 1st pillar by ~25%
    if (has2ndPillar) {
        pension1stPillar *= 0.75;
    }

    // 2nd pillar accumulation (simplified 3-phase)
    let pension2ndPillar = 0;
    let pillar2Value = 0;
    if (has2ndPillar) {
        const monthlyContrib = grossSalary * 0.04;
        const phase1Rate = 0.02;  // first 7 years conservative
        const phase2Rate = 0.04;  // years 7-15 balanced
        const phase3Rate = 0.06;  // after 15 years growth

        const yearsInPillar = retireAge - (pillarEntryYear - birthYear);
        let accum = 0;
        for (let y = 1; y <= yearsInPillar; y++) {
            let rate;
            if (y <= 7) rate = phase1Rate;
            else if (y <= 15) rate = phase2Rate;
            else rate = phase3Rate;
            accum = (accum + monthlyContrib * 12) * (1 + rate);
        }
        pillar2Value = accum;

        // Annuity from 2nd pillar (20 year drawdown)
        const drawdownRate = 0.02;
        const drawdownYears = 20;
        pension2ndPillar = Math.abs(PMT(drawdownRate / 12, drawdownYears * 12, pillar2Value)) * 0.95;
    }

    const totalPension = pension1stPillar + pension2ndPillar;
    const shortfall = Math.max(0, desiredPension - totalPension);

    // Social insurance deductions from gross salary
    const healthIns = grossSalary * 0.04;
    const socialIns = grossSalary * 0.094;
    const retirementIns = grossSalary * 0.04;
    const totalDeductions = healthIns + socialIns + retirementIns;
    const taxBase = grossSalary - totalDeductions;
    const incomeTax = Math.max(0, taxBase - 410.24) * 0.19; // simplified
    const netSalary = grossSalary - totalDeductions - incomeTax;

    setOutput('pen-current-age', currentAge);
    setOutput('pen-years-to-retire', yearsToRetire);
    setOutput('pen-net-salary', formatCurrency(netSalary));
    setOutput('pen-1st-pillar', formatCurrency(pension1stPillar));
    setOutput('pen-2nd-pillar-value', formatCurrency(pillar2Value));
    setOutput('pen-2nd-pillar-annuity', formatCurrency(pension2ndPillar));
    setOutput('pen-total-pension', formatCurrency(totalPension));
    setOutput('pen-shortfall', formatCurrency(shortfall));
    setOutput('pen-early-penalty', earlyPenaltyPct > 0 ? `-${earlyPenaltyPct.toFixed(1)} %` : 'Žiadna');
    setOutput('pen-replacement-ratio', `${((totalPension / netSalary) * 100).toFixed(1)} %`);

    if (shortfall > 0) {
        // How much to save monthly to cover the gap
        const monthsInRetirement = (85 - retireAge) * 12;
        const capitalNeeded = Math.abs(PV(0.03 / 12, monthsInRetirement, shortfall));
        const monthlySaving = Math.abs(PMT(0.05 / 12, yearsToRetire * 12, 0, capitalNeeded));
        setOutput('pen-capital-needed', formatCurrency(capitalNeeded));
        setOutput('pen-monthly-saving', formatCurrency(monthlySaving));
    } else {
        setOutput('pen-capital-needed', '-');
        setOutput('pen-monthly-saving', '-');
    }
}

// ---- 12. REZERVY (Reserves/Emergency Fund) ----

function calcReserves() {
    const initial = getInputValue('res-initial');
    const monthly = getInputValue('res-monthly');
    const rate = getInputValue('res-rate') / 100;
    const extraAnnual = getInputValue('res-extra');
    const years = getInputValue('res-years');

    if (years <= 0) return;

    const monthlyRate = rate / 12;
    const data = [];
    let balance = initial;
    let totalContrib = initial;

    for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= 12; m++) {
            balance = (balance + monthly) * (1 + monthlyRate);
            totalContrib += monthly;
        }
        balance += extraAnnual;
        totalContrib += extraAnnual;

        data.push({
            year: y,
            balance,
            totalContrib,
            interest: balance - totalContrib
        });
    }

    const final = data[data.length - 1];
    setOutput('res-final-balance', formatCurrency(final.balance));
    setOutput('res-total-contrib', formatCurrency(final.totalContrib));
    setOutput('res-total-interest', formatCurrency(final.interest));

    const tbody = document.getElementById('res-table');
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${formatCurrency(row.balance)}</td>
            <td>${formatCurrency(row.totalContrib)}</td>
            <td>${formatCurrency(row.interest)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- 13. AOF (Financial Analysis) ----

function calcAOF() {
    const grossSalary = getInputValue('aof-salary');
    const partnerSalary = getInputValue('aof-partner-salary');
    const age = getInputValue('aof-age');
    const monthlyExpenses = getInputValue('aof-expenses');

    if (grossSalary <= 0) return;

    // Employee deductions
    function calcNet(gross) {
        if (gross <= 0) return { net: 0, health: 0, social: 0, tax: 0, total: 0 };
        const health = gross * 0.04;
        const social = gross * 0.094;
        const retirement = gross * 0.04;
        const disability = gross * 0.03;
        const unemployment = gross * 0.01;
        const totalSocial = social + retirement + disability + unemployment;
        const totalDeductions = health + totalSocial;
        const taxBase = gross - totalDeductions;
        const nontaxable = 410.24;
        const tax = Math.max(0, (taxBase - nontaxable) * 0.19);
        const net = gross - totalDeductions - tax;
        return { net, health, social: totalSocial, tax, total: totalDeductions + tax };
    }

    const main = calcNet(grossSalary);
    const partner = calcNet(partnerSalary);
    const householdNet = main.net + partner.net;
    const idealReserve = householdNet * 6;

    // Sick leave (PN) - simplified
    let sickLeave;
    if (age < 25) sickLeave = grossSalary * 0.55;
    else if (age < 30) sickLeave = grossSalary * 0.55;
    else sickLeave = grossSalary * 0.55;

    // Disability pension (simplified)
    const disabilityPartial = grossSalary * 0.3; // 40-70%
    const disabilityFull = grossSalary * 0.45; // >70%

    // Capital needed for 20 years
    const capitalNeeded20 = Math.abs(PV(0.03 / 12, 20 * 12, monthlyExpenses));
    // Capital needed for lifetime (to age 100)
    const yearsToHundred = Math.max(1, 100 - age);
    const capitalNeededLifetime = Math.abs(PV(0.03 / 12, yearsToHundred * 12, monthlyExpenses));

    setOutput('aof-net-salary', formatCurrency(main.net));
    setOutput('aof-health-ins', formatCurrency(main.health));
    setOutput('aof-social-ins', formatCurrency(main.social));
    setOutput('aof-tax', formatCurrency(main.tax));
    setOutput('aof-partner-net', formatCurrency(partner.net));
    setOutput('aof-household-net', formatCurrency(householdNet));
    setOutput('aof-ideal-reserve', formatCurrency(idealReserve));
    setOutput('aof-sick-leave', formatCurrency(sickLeave));
    setOutput('aof-disability-partial', formatCurrency(disabilityPartial));
    setOutput('aof-disability-full', formatCurrency(disabilityFull));
    setOutput('aof-capital-20', formatCurrency(capitalNeeded20));
    setOutput('aof-capital-lifetime', formatCurrency(capitalNeededLifetime));
}

// ============================================================
// Tab Navigation
// ============================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
}

// Initialize first tab on load
document.addEventListener('DOMContentLoaded', () => {
    switchTab('tab-mortgage');
});
