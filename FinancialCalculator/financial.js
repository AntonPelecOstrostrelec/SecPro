// ============================================================
// Core Financial Functions Library
// Excel-compatible implementations of TVM functions
// ============================================================

/**
 * PMT - Calculate periodic payment for a loan/annuity
 * @param {number} rate - Interest rate per period
 * @param {number} nper - Total number of periods
 * @param {number} pv - Present value (loan amount)
 * @param {number} fv - Future value (default 0)
 * @param {number} type - 0=end of period (default), 1=beginning
 * @returns {number} Payment amount (negative = outflow)
 */
function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) {
        return -(pv + fv) / nper;
    }
    const pvif = Math.pow(1 + rate, nper);
    let pmt = (rate * (pv * pvif + fv)) / (pvif - 1);
    if (type === 1) {
        pmt = pmt / (1 + rate);
    }
    return -pmt;
}

/**
 * PV - Calculate present value
 * @param {number} rate - Interest rate per period
 * @param {number} nper - Total number of periods
 * @param {number} pmt - Payment per period
 * @param {number} fv - Future value (default 0)
 * @param {number} type - 0=end of period (default), 1=beginning
 * @returns {number} Present value
 */
function PV(rate, nper, pmt, fv = 0, type = 0) {
    if (rate === 0) {
        return -pmt * nper - fv;
    }
    const pvif = Math.pow(1 + rate, nper);
    const pv = (-pmt * (1 + rate * type) * ((pvif - 1) / rate) - fv) / pvif;
    return pv;
}

/**
 * FV - Calculate future value
 * @param {number} rate - Interest rate per period
 * @param {number} nper - Total number of periods
 * @param {number} pmt - Payment per period
 * @param {number} pv - Present value (default 0)
 * @param {number} type - 0=end of period (default), 1=beginning
 * @returns {number} Future value
 */
function FV(rate, nper, pmt, pv = 0, type = 0) {
    if (rate === 0) {
        return -pv - pmt * nper;
    }
    const pvif = Math.pow(1 + rate, nper);
    const fv = -pv * pvif - pmt * (1 + rate * type) * ((pvif - 1) / rate);
    return fv;
}

/**
 * NPER - Calculate number of periods
 * @param {number} rate - Interest rate per period
 * @param {number} pmt - Payment per period
 * @param {number} pv - Present value
 * @param {number} fv - Future value (default 0)
 * @param {number} type - 0=end of period (default), 1=beginning
 * @returns {number} Number of periods
 */
function NPER(rate, pmt, pv, fv = 0, type = 0) {
    if (rate === 0) {
        return -(pv + fv) / pmt;
    }
    const z = pmt * (1 + rate * type) / rate;
    const nper = Math.log((-fv + z) / (pv + z)) / Math.log(1 + rate);
    return nper;
}

/**
 * RATE - Calculate interest rate per period using Newton-Raphson
 * @param {number} nper - Total number of periods
 * @param {number} pmt - Payment per period
 * @param {number} pv - Present value
 * @param {number} fv - Future value (default 0)
 * @param {number} type - 0=end of period (default), 1=beginning
 * @param {number} guess - Initial guess (default 0.1)
 * @returns {number} Interest rate per period
 */
function RATE(nper, pmt, pv, fv = 0, type = 0, guess = 0.1) {
    const maxIter = 100;
    const tol = 1e-10;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        const pvif = Math.pow(1 + rate, nper);
        const y = pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv;
        const dy = nper * pv * Math.pow(1 + rate, nper - 1) +
            pmt * (1 + rate * type) * (nper * Math.pow(1 + rate, nper - 1) / rate - (pvif - 1) / (rate * rate)) +
            pmt * type * ((pvif - 1) / rate);

        const newRate = rate - y / dy;
        if (Math.abs(newRate - rate) < tol) {
            return newRate;
        }
        rate = newRate;
    }
    return NaN;
}

/**
 * VLOOKUP equivalent
 * @param {*} lookupValue - Value to search for
 * @param {Array} table - 2D array to search in
 * @param {number} colIndex - Column index (1-based) to return
 * @param {boolean} rangeLookup - true=approximate match, false=exact match
 * @returns {*} Matched value
 */
function VLOOKUP(lookupValue, table, colIndex, rangeLookup = true) {
    if (rangeLookup) {
        let lastMatch = null;
        for (let i = 0; i < table.length; i++) {
            if (table[i][0] <= lookupValue) {
                lastMatch = table[i][colIndex - 1];
            } else {
                break;
            }
        }
        return lastMatch;
    } else {
        for (let i = 0; i < table.length; i++) {
            if (table[i][0] === lookupValue) {
                return table[i][colIndex - 1];
            }
        }
        return null;
    }
}

/**
 * SUMPRODUCT - Sum of element-wise products of arrays
 */
function SUMPRODUCT(arr1, arr2) {
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
        sum += (arr1[i] || 0) * (arr2[i] || 0);
    }
    return sum;
}

// ============================================================
// Formatting utilities
// ============================================================

function formatCurrency(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('sk-SK', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value) + ' €';
}

function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return (value * 100).toFixed(decimals) + ' %';
}

function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('sk-SK', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function parseInputNumber(value) {
    if (typeof value === 'string') {
        value = value.replace(/\s/g, '').replace(',', '.');
    }
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function getInputValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseInputNumber(el.value);
}

function setOutput(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
