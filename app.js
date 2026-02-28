const APP_VERSION = '2026-02-28.6';

const INITIAL_ASIN_DATA = [
  {
    asin: 'B09ABC1234',
    partNumber: 'PN-7742-A',
    supplier: 'Northstar Brands',
    seniorDirector: 'Priya Patel',
    channel: 'Amazon.com',
    overrideLock: false,
    minRoas: 2.8,
    tacosCeiling: 18.5,
    budgetApplicable: true,
    dailyBudget: 120,
  },
];

const API_BASE_URL = '';

const supplierFilter = document.querySelector('#supplierFilter');
const directorFilter = document.querySelector('#directorFilter');
const channelFilter = document.querySelector('#channelFilter');
const asinSearch = document.querySelector('#asinSearch');
const asinTableBody = document.querySelector('#asinTableBody');
const saveAllButton = document.querySelector('#saveAll');
const reloadDataButton = document.querySelector('#reloadData');
const addAsinButton = document.querySelector('#addAsin');
const seedDefaultsButton = document.querySelector('#seedDefaults');
const status = document.querySelector('#status');
const buildInfo = document.querySelector('#buildInfo');
const rowTemplate = document.querySelector('#asinRowTemplate');

let asinData = structuredClone(INITIAL_ASIN_DATA);
let supplierOptions = [];

init();

async function init() {
  if (buildInfo) {
    buildInfo.textContent = `UI build ${APP_VERSION}`;
  }

  await refreshData({ preserveFilters: false, silent: true });

  if (!asinData.length) {
    await seedDefaults(false);
    await refreshData({ preserveFilters: false, silent: true });
  }

  wireEvents();
}

function wireEvents() {
  supplierFilter.addEventListener('change', renderTable);
  directorFilter.addEventListener('change', renderTable);
  channelFilter.addEventListener('change', renderTable);
  asinSearch.addEventListener('input', renderTable);

  if (reloadDataButton) {
    reloadDataButton.addEventListener('click', async () => {
      await withBusy(reloadDataButton, async () => {
        await refreshData();
        setStatus('Reloaded ASIN data from backend database.');
      });
    });
  }

  if (!addAsinButton || !seedDefaultsButton || !saveAllButton) {
    setStatus('UI is missing required buttons due to a merge conflict. Replace with latest files.');
    return;
  }

  addAsinButton.addEventListener('click', () => {
    const newAsin = {
      asin: `NEW-${Date.now().toString().slice(-6)}`,
      partNumber: 'NEW-PART',
      supplier: supplierOptions[0] || 'Unassigned Supplier',
      seniorDirector: 'Unassigned Director',
      channel: 'Amazon.com',
      overrideLock: false,
      minRoas: 0,
      tacosCeiling: 0,
      budgetApplicable: false,
      dailyBudget: 0,
    };

    asinData.unshift(newAsin);
    supplierOptions = [...new Set([...supplierOptions, newAsin.supplier])].sort();
    resetFilters();
    hydrateFilters();
    renderTable();
    setStatus(`Created ${newAsin.asin}. Click Save Changes to persist.`);
  });

  seedDefaultsButton.addEventListener('click', async () => {
    await withBusy(seedDefaultsButton, async () => {
      await seedDefaults(true);
      await refreshData({ preserveFilters: false, silent: true });
      setStatus('Loaded default ASIN data from backend.');
    });
  });

  saveAllButton.addEventListener('click', async () => {
    await withBusy(saveAllButton, async () => {
      await saveAsinOverrides(asinData);
      setStatus(`Saved ${asinData.length} ASIN record(s) to the database.`);
    });
  });
}

async function withBusy(button, action) {
  button.disabled = true;
  try {
    await action();
  } catch (error) {
    setStatus(error.message || 'Unexpected error while processing request.');
  } finally {
    button.disabled = false;
  }
}

function setStatus(message) {
  status.textContent = message;
}

async function refreshData({ preserveFilters = false, silent = false } = {}) {
  if (!preserveFilters) {
    resetFilters();
  }

  asinData = await loadAsinOverrides();
  supplierOptions = await loadSupplierOptions();
  hydrateFilters();
  renderTable();

  if (!silent && !asinData.length) {
    setStatus('No ASIN rows found in database. Click Load Default Data to seed starter rows.');
  }
}

function resetFilters() {
  supplierFilter.value = 'all';
  directorFilter.value = 'all';
  channelFilter.value = 'all';
  asinSearch.value = '';
}

async function loadAsinOverrides() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/asin-overrides`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load ASIN data (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid ASIN response shape from backend.');
    }

    return data;
  } catch (error) {
    setStatus(`Using local sample data because backend load failed: ${error.message}`);
    return structuredClone(INITIAL_ASIN_DATA);
  }
}

async function saveAsinOverrides(records) {
  const response = await fetch(`${API_BASE_URL}/api/asin-overrides`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });

  if (!response.ok) {
    let message = `Save failed (HTTP ${response.status}).`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // ignore parse issues
    }

    throw new Error(message);
  }
}

async function seedDefaults(force = false) {
  const response = await fetch(`${API_BASE_URL}/api/seed-defaults`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force }),
  });

  if (!response.ok) {
    throw new Error(`Default data load failed (HTTP ${response.status}).`);
  }
}

async function loadSupplierOptions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load suppliers (HTTP ${response.status}).`);
    }

    const suppliers = await response.json();
    if (!Array.isArray(suppliers)) {
      throw new Error('Invalid suppliers response shape.');
    }

    return suppliers.filter(Boolean).sort();
  } catch {
    return [...new Set(asinData.map((row) => row.supplier))].sort();
  }
}

function hydrateFilters() {
  const directors = [...new Set(asinData.map((row) => row.seniorDirector))].sort();
  const channels = [...new Set(asinData.map((row) => row.channel))].sort();

  supplierFilter.length = 1;
  directorFilter.length = 1;
  channelFilter.length = 1;

  supplierOptions.forEach((supplier) => supplierFilter.add(new Option(supplier, supplier)));
  directors.forEach((director) => directorFilter.add(new Option(director, director)));
  channels.forEach((channel) => channelFilter.add(new Option(channel, channel)));
}

function renderTable() {
  const supplier = supplierFilter.value;
  const director = directorFilter.value;
  const channel = channelFilter.value;
  const search = asinSearch.value.trim().toLowerCase();

  const filtered = asinData.filter((row) => {
    const supplierMatches = supplier === 'all' || row.supplier === supplier;
    const directorMatches = director === 'all' || row.seniorDirector === director;
    const channelMatches = channel === 'all' || row.channel === channel;
    const asinMatches = !search || row.asin.toLowerCase().includes(search);
    return supplierMatches && directorMatches && channelMatches && asinMatches;
  });

  asinTableBody.replaceChildren();

  filtered.forEach((row) => {
    const fragment = rowTemplate.content.cloneNode(true);
    const tr = fragment.querySelector('tr');

    fragment.querySelector('.asin').textContent = row.asin;
    fragment.querySelector('.part-number').textContent = row.partNumber;
    fragment.querySelector('.director').textContent = row.seniorDirector;

    const supplierSelect = fragment.querySelector('.supplier-select');
    const channelSelect = fragment.querySelector('.channel-select');
    const overrideLockInput = fragment.querySelector('.override-lock');
    const minRoasInput = fragment.querySelector('.min-roas');
    const tacosCeilingInput = fragment.querySelector('.tacos-ceiling');
    const budgetApplicableInput = fragment.querySelector('.budget-applicable');
    const dailyBudgetInput = fragment.querySelector('.daily-budget');

    hydrateSupplierSelect(supplierSelect, row.supplier);

    channelSelect.value = row.channel;
    overrideLockInput.checked = row.overrideLock;
    minRoasInput.value = row.minRoas;
    tacosCeilingInput.value = row.tacosCeiling;
    budgetApplicableInput.checked = row.budgetApplicable;
    dailyBudgetInput.value = row.dailyBudget;
    dailyBudgetInput.disabled = !row.budgetApplicable;

    supplierSelect.addEventListener('change', () => (row.supplier = supplierSelect.value));
    channelSelect.addEventListener('change', () => (row.channel = channelSelect.value));
    overrideLockInput.addEventListener('change', () => (row.overrideLock = overrideLockInput.checked));
    minRoasInput.addEventListener('change', () => (row.minRoas = Number(minRoasInput.value) || 0));
    tacosCeilingInput.addEventListener('change', () => (row.tacosCeiling = Number(tacosCeilingInput.value) || 0));

    budgetApplicableInput.addEventListener('change', () => {
      row.budgetApplicable = budgetApplicableInput.checked;
      dailyBudgetInput.disabled = !row.budgetApplicable;
      tr.classList.toggle('dimmed', !row.budgetApplicable);
      if (!row.budgetApplicable) {
        row.dailyBudget = 0;
        dailyBudgetInput.value = 0;
      }
    });

    dailyBudgetInput.addEventListener('change', () => (row.dailyBudget = Number(dailyBudgetInput.value) || 0));

    tr.classList.toggle('dimmed', !row.budgetApplicable);
    asinTableBody.append(tr);
  });

  if (!filtered.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10">No ASINs found for selected filters.</td>';
    asinTableBody.append(emptyRow);
  }
}

function hydrateSupplierSelect(selectElement, selectedSupplier) {
  const options = [...new Set([...supplierOptions, selectedSupplier])].sort();
  selectElement.replaceChildren();
  options.forEach((supplier) => selectElement.add(new Option(supplier, supplier, false, supplier === selectedSupplier)));
}
