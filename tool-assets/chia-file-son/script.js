const STORAGE_KEYS = {
    customers: 'viettel_customers',
    settingPrefix: 'viettel_setting_'
};

const defaultCustomers = [
    {
        account: 'l063_gftth_honglt85',
        name: 'LÊ THỊ HỒNG',
        phone: '0396268846',
        address: '20 Thôn Liên Châu, Liên Đầm, Di Linh, Lâm Đồng',
        amount: 165000
    },
    {
        account: 'l063_gftth_loitq5',
        name: 'TRẦN QUỐC LỢI',
        phone: '0355764532',
        address: '80 Quốc lộ 20, Thôn 10, Liên Đầm, Di Linh',
        amount: 210000
    }
];

let customers = loadCustomers();

const dom = {
    tableBody: document.querySelector('#customerTable tbody'),
    btnAdd: document.getElementById('btnAddRow'),
    btnPrint: document.getElementById('btnPrint'),
    btnExport: document.getElementById('btnExport'),
    btnImport: document.getElementById('btnImport'),
    btnDownloadSample: document.getElementById('btnDownloadSample'),
    fileInput: document.getElementById('fileInput'),
    printArea: document.getElementById('printArea'),
    navReceipt: document.getElementById('nav-receipt'),
    navExcel: document.getElementById('nav-excel'),
    navPhoto: document.getElementById('nav-photo'),
    viewReceipt: document.getElementById('view-receipt'),
    viewExcel: document.getElementById('view-excel'),
    viewPhoto: document.getElementById('view-photo'),
    sidebarReceiptSettings: document.getElementById('sidebar-receipt-settings'),
    sidebarReceiptActions: document.getElementById('sidebar-receipt-actions'),
    btnToggleReceiptSettings: document.getElementById('btnToggleReceiptSettings'),
    workspace: document.getElementById('workspace'),
    summary: {
        collectorName: document.getElementById('summaryCollectorName'),
        collectorPhone: document.getElementById('summaryCollectorPhone'),
        unitName: document.getElementById('summaryUnitName'),
        billingMonth: document.getElementById('summaryBillingMonth'),
        customerCount: document.getElementById('receiptCustomerCount'),
        totalAmount: document.getElementById('receiptTotalAmount')
    },
    inputs: {
        collectorName: document.getElementById('collectorName'),
        collectorPhone: document.getElementById('collectorPhone'),
        unitName: document.getElementById('unitName'),
        billingMonth: document.getElementById('billingMonth')
    }
};

function getRuntimeMode() {
    const params = new URLSearchParams(window.location.search);
    const requestedView = String(params.get('view') || '').trim().toLowerCase();
    const validViews = new Set(['receipt', 'excel', 'photo']);
    const initialView = validViews.has(requestedView) ? requestedView : 'receipt';
    return {
        initialView,
        embedded: params.get('embedded') === '1',
        singleView: params.get('single') === '1'
    };
}

const runtimeMode = getRuntimeMode();

function init() {
    if (window.self !== window.top || runtimeMode.embedded) {
        document.body.classList.add('is-embedded');
    }
    if (runtimeMode.singleView) {
        document.body.classList.add('single-view', `single-view-${runtimeMode.initialView}`);
    }

    loadSettings();
    initReceiptRail();
    bindNavigation();
    bindReceiptActions();
    refreshReceiptSummary();
    renderTable();
    setView(runtimeMode.initialView);

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            handlePrint();
        }
    });
}

function loadCustomers() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.customers);
        if (!saved) {
            return [...defaultCustomers];
        }
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            return [...defaultCustomers];
        }
        return parsed.map((item) => ({
            account: String(item.account || ''),
            name: String(item.name || ''),
            phone: String(item.phone || ''),
            address: String(item.address || ''),
            amount: Number(item.amount || 0)
        }));
    } catch (error) {
        console.error('Không đọc được dữ liệu đã lưu:', error);
        return [...defaultCustomers];
    }
}

function loadSettings() {
    Object.values(dom.inputs).forEach((input) => {
        const saved = localStorage.getItem(STORAGE_KEYS.settingPrefix + input.id);
        if (saved) {
            input.value = saved;
        }
    });

    if (!dom.inputs.billingMonth.value) {
        const now = new Date();
        dom.inputs.billingMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
}

function bindNavigation() {
    dom.navReceipt?.addEventListener('click', () => setView('receipt'));
    dom.navExcel?.addEventListener('click', () => setView('excel'));
    dom.navPhoto?.addEventListener('click', () => setView('photo'));
}

function bindReceiptActions() {
    dom.btnAdd?.addEventListener('click', addRow);
    dom.btnPrint?.addEventListener('click', handlePrint);
    dom.btnExport?.addEventListener('click', saveToLocalStorage);
    dom.btnImport?.addEventListener('click', () => dom.fileInput?.click());
    dom.fileInput?.addEventListener('change', handleExcelUpload);
    dom.btnDownloadSample?.addEventListener('click', downloadSampleExcel);

    Object.values(dom.inputs).forEach((input) => {
        input.addEventListener('input', handleReceiptSettingsChange);
        input.addEventListener('change', handleReceiptSettingsChange);
    });
}

function initReceiptRail() {
    const saved = localStorage.getItem(STORAGE_KEYS.settingPrefix + 'receiptRailCollapsed');
    const isMobileSingleReceipt = runtimeMode.singleView && window.matchMedia('(max-width: 768px)').matches;
    const shouldCollapse = isMobileSingleReceipt ? true : (saved === null ? runtimeMode.singleView : saved === '1');
    setReceiptRailCollapsed(shouldCollapse, false);

    dom.btnToggleReceiptSettings?.addEventListener('click', () => {
        const isCollapsed = document.body.classList.contains('receipt-settings-collapsed');
        setReceiptRailCollapsed(!isCollapsed);
    });
}

function setReceiptRailCollapsed(collapsed, persist = true) {
    document.body.classList.toggle('receipt-settings-collapsed', collapsed);
    const isMobileSingleReceipt = runtimeMode.singleView && window.matchMedia('(max-width: 768px)').matches;

    if (dom.btnToggleReceiptSettings) {
        dom.btnToggleReceiptSettings.setAttribute('aria-expanded', String(!collapsed));
        dom.btnToggleReceiptSettings.textContent = collapsed
            ? (isMobileSingleReceipt ? 'Mở cấu hình' : 'Sửa cấu hình')
            : (isMobileSingleReceipt ? 'Ẩn cấu hình' : 'Thu gọn');
    }

    if (persist) {
        localStorage.setItem(STORAGE_KEYS.settingPrefix + 'receiptRailCollapsed', collapsed ? '1' : '0');
    }
}

function handleReceiptSettingsChange() {
    saveToLocalStorage();
    refreshReceiptSummary();
}

function refreshReceiptSummary() {
    if (dom.summary.collectorName) {
        dom.summary.collectorName.textContent = dom.inputs.collectorName.value.trim() || 'Chưa có tên';
    }
    if (dom.summary.collectorPhone) {
        dom.summary.collectorPhone.textContent = dom.inputs.collectorPhone.value.trim() || 'Chưa có số';
    }
    if (dom.summary.unitName) {
        dom.summary.unitName.textContent = dom.inputs.unitName.value.trim() || 'Chưa có đơn vị';
    }
    if (dom.summary.billingMonth) {
        dom.summary.billingMonth.textContent = formatBillingMonth(dom.inputs.billingMonth.value);
    }
}

function formatBillingMonth(value) {
    const normalized = String(value || '').trim();
    if (!normalized || !normalized.includes('-')) {
        return 'Tháng hiện tại';
    }

    const [year, month] = normalized.split('-');
    return `${month}/${year}`;
}

function updateReceiptPageMeta() {
    const customerCount = customers.length;
    const totalAmount = customers.reduce((sum, customer) => sum + Number(customer.amount || 0), 0);

    if (dom.summary.customerCount) {
        dom.summary.customerCount.textContent = `${customerCount} khách hàng`;
    }
    if (dom.summary.totalAmount) {
        dom.summary.totalAmount.textContent = `${totalAmount.toLocaleString('vi-VN')} đ`;
    }
}

function setView(mode) {
    const nextMode = ['receipt', 'excel', 'photo'].includes(mode) ? mode : 'receipt';
    [dom.viewReceipt, dom.viewExcel, dom.viewPhoto].forEach((view) => view?.classList.remove('active'));
    [dom.navReceipt, dom.navExcel, dom.navPhoto].forEach((button) => button?.classList.remove('active'));
    document.body.classList.remove('view-receipt', 'view-excel', 'view-photo');

    const isReceipt = nextMode === 'receipt';
    dom.sidebarReceiptSettings.style.display = isReceipt ? 'flex' : 'none';
    dom.sidebarReceiptActions.style.display = isReceipt ? 'flex' : 'none';
    dom.workspace.classList.toggle('receipt-mode', isReceipt);

    if (nextMode === 'receipt') {
        document.body.classList.add('view-receipt');
        dom.viewReceipt?.classList.add('active');
        dom.navReceipt?.classList.add('active');
        return;
    }

    if (nextMode === 'excel') {
        document.body.classList.add('view-excel');
        dom.viewExcel?.classList.add('active');
        dom.navExcel?.classList.add('active');
        return;
    }

    document.body.classList.add('view-photo');
    dom.viewPhoto?.classList.add('active');
    dom.navPhoto?.classList.add('active');
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
    Object.values(dom.inputs).forEach((input) => {
        localStorage.setItem(STORAGE_KEYS.settingPrefix + input.id, input.value);
    });
}

function handleExcelUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const data = new Uint8Array(loadEvent.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!rawData.length) {
                alert('File Excel trống.');
                return;
            }

            const headerRowIndex = detectHeaderRow(rawData);
            const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
            const newCustomers = [];

            for (let index = startRow; index < rawData.length; index += 1) {
                const row = rawData[index];
                if (!row || row.every((cell) => String(cell || '').trim() === '')) {
                    continue;
                }

                const mapped = mapCustomerRow(row);
                if (!mapped || !mapped.account) {
                    continue;
                }

                newCustomers.push(mapped);
            }

            if (!newCustomers.length) {
                alert('Không tìm thấy dữ liệu hợp lệ.');
                return;
            }

            const shouldReplace = window.confirm(
                `Tìm thấy ${newCustomers.length} khách hàng. Bạn có muốn thay thế danh sách hiện tại không?\n` +
                '(Chọn Hủy để thêm vào danh sách hiện có.)'
            );

            customers = shouldReplace ? newCustomers : [...customers, ...newCustomers];
            renderTable();
            saveToLocalStorage();
            alert('Nhập dữ liệu thành công.');
        } catch (error) {
            console.error(error);
            alert(`Lỗi khi đọc file Excel: ${error.message}`);
        } finally {
            dom.fileInput.value = '';
        }
    };

    reader.readAsArrayBuffer(file);
}

function detectHeaderRow(rawData) {
    const keywords = ['ma', 'account', 'ten', 'khach', 'sdt', 'dia chi', 'cuoc'];

    for (let index = 0; index < Math.min(rawData.length, 10); index += 1) {
        const row = rawData[index].map((cell) => normalizeText(cell));
        const score = keywords.filter((keyword) => row.some((cell) => cell.includes(keyword))).length;
        if (score >= 2) {
            return index;
        }
    }

    return -1;
}

function mapCustomerRow(row) {
    let account = '';
    let name = '';
    let phone = '';
    let address = '';
    let amount = 0;

    if (row.length >= 6) {
        account = row[1];
        name = row[2];
        phone = row[3];
        address = row[4];
        amount = row[5];
    } else if (row.length === 5) {
        account = row[0];
        name = row[1];
        phone = row[2];
        address = row[3];
        amount = row[4];
    } else {
        account = row[0];
        name = row[1] || '';
        phone = row[2] || '';
        address = row[3] || '';
        amount = row[4] || 0;
    }

    const parsedAmount = typeof amount === 'string'
        ? parseInt(amount.replace(/[^\d-]/g, ''), 10) || 0
        : Number(amount || 0);

    return {
        account: String(account || '').trim(),
        name: String(name || '').trim(),
        phone: String(phone || '').trim(),
        address: String(address || '').trim(),
        amount: parsedAmount
    };
}

function renderTable() {
    if (!dom.tableBody) {
        return;
    }

    dom.tableBody.innerHTML = '';

    if (!customers.length) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="7" class="table-empty-cell">
                <div class="table-empty-state">
                    <strong>Danh sách đang trống</strong>
                    <span>Đổ file Excel để đi nhanh, hoặc thêm tay từng khách nếu bạn chỉ cần in vài phiếu.</span>
                    <div class="table-empty-actions">
                        <button class="btn-secondary btn-inline empty-state-btn" type="button" onclick="openReceiptImportPicker()">Nhập danh sách</button>
                        <button class="btn-primary empty-state-btn" type="button" onclick="addReceiptRow()">Thêm khách đầu tiên</button>
                    </div>
                </div>
            </td>
        `;
        dom.tableBody.appendChild(emptyRow);
        updateReceiptPageMeta();
        return;
    }

    customers.forEach((customer, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="STT" class="receipt-index-cell">${index + 1}</td>
            <td data-label="Mã khách hàng" class="receipt-cell receipt-cell-account"><input class="cell-input input-account" value="${escapeAttr(customer.account)}" onchange="updateCustomer(${index}, 'account', this.value)"></td>
            <td data-label="Tên khách hàng" class="receipt-cell receipt-cell-name"><input class="cell-input input-name" value="${escapeAttr(customer.name)}" onchange="updateCustomer(${index}, 'name', this.value)"></td>
            <td data-label="SĐT liên hệ" class="receipt-cell receipt-cell-phone"><input class="cell-input input-phone" value="${escapeAttr(customer.phone)}" onchange="updateCustomer(${index}, 'phone', this.value)"></td>
            <td data-label="Địa chỉ" class="receipt-cell receipt-cell-address"><input class="cell-input input-address" value="${escapeAttr(customer.address)}" onchange="updateCustomer(${index}, 'address', this.value)"></td>
            <td data-label="Tổng cước" class="receipt-cell receipt-cell-amount"><input class="cell-input input-amount" type="number" value="${Number(customer.amount || 0)}" onchange="updateCustomer(${index}, 'amount', this.value)"></td>
            <td data-label="Hành động" class="receipt-action-cell">
                <button class="btn-delete" type="button" onclick="deleteRow(${index})" aria-label="Xóa khách hàng">🗑️</button>
            </td>
        `;
        dom.tableBody.appendChild(row);
    });

    updateReceiptPageMeta();
}

function addRow() {
    customers.push({ account: '', name: '', phone: '', address: '', amount: 0 });
    renderTable();
    saveToLocalStorage();
}

window.addReceiptRow = () => {
    addRow();
};

window.openReceiptImportPicker = () => {
    dom.fileInput?.click();
};

window.updateCustomer = (index, field, value) => {
    if (!customers[index]) {
        return;
    }
    customers[index][field] = field === 'amount' ? Number(value || 0) : value;
    saveToLocalStorage();
};

window.deleteRow = (index) => {
    if (!customers[index]) {
        return;
    }

    const confirmed = window.confirm('Bạn có chắc muốn xóa khách hàng này?');
    if (!confirmed) {
        return;
    }

    customers.splice(index, 1);
    renderTable();
    saveToLocalStorage();
};

function handlePrint() {
    const collector = {
        name: dom.inputs.collectorName.value.trim(),
        phone: dom.inputs.collectorPhone.value.trim(),
        unit: dom.inputs.unitName.value.trim()
    };

    if (!customers.length) {
        alert('Danh sách khách hàng đang trống.');
        return;
    }

    const billingValue = dom.inputs.billingMonth.value;
    const billingDate = billingValue ? new Date(`${billingValue}-01`) : new Date();
    const billingMonth = String(billingDate.getMonth() + 1).padStart(2, '0');
    const billingYear = billingDate.getFullYear();

    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

    let html = '';

    for (let start = 0; start < customers.length; start += 2) {
        const batch = customers.slice(start, start + 2);
        html += '<div class="print-page">';

        batch.forEach((customer, batchIndex) => {
            const receiptNumber = start + batchIndex + 1;
            const moneyFormatted = Number(customer.amount || 0).toLocaleString('vi-VN');
            const moneyText = docTienBangChu(Number(customer.amount || 0));

            html += `
                <div class="receipt">
                    <div class="header-row">
                        <div class="logo-section">
                            <img src="./viettel-logo-new.png" class="img-logo" alt="Viettel">
                            <div style="font-weight:bold; font-size:11pt;">TẬP ĐOÀN VIỄN THÔNG QUÂN ĐỘI</div>
                            <div>${escapeHtml(collector.unit)}</div>
                            <div style="font-size:9pt; font-style:italic;">Báo sự cố xin gọi: 1800.8119 hoặc ${escapeHtml(collector.phone)}</div>
                        </div>
                        <div class="receipt-title">PHIẾU THU THÁNG ${currentMonth === '01' ? '12' : String(Number(currentMonth) - 1).padStart(2, '0')}</div>
                        <div class="meta-section">
                            <div style="font-weight:bold;">Mẫu số 01 - TT</div>
                            <div>QĐ số: 15/2006/QĐ-BTC</div>
                            <div>Ngày 20 tháng 03 năm 2006</div>
                            <div>của Bộ trưởng Bộ Tài chính</div>
                            <div style="margin-top:5px; font-weight:bold;">Số: ${receiptNumber}</div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="label">Họ tên người nộp tiền:</div>
                        <div class="value highlight-red">${escapeHtml(customer.name)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Điện thoại KH:</div>
                        <div class="value">${escapeHtml(customer.phone)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Số thuê bao đại diện:</div>
                        <div class="value" style="font-style:italic">${escapeHtml(customer.account)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Địa chỉ:</div>
                        <div class="value">${escapeHtml(customer.address)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Lý do nộp:</div>
                        <div class="value">Cước tháng ${billingMonth}/${billingYear}</div>
                    </div>
                    <div class="row">
                        <div class="label">Số tiền:</div>
                        <div class="value" style="font-weight:bold;">${moneyFormatted}</div>
                    </div>
                    <div class="row">
                        <div class="label">Bằng chữ:</div>
                        <div class="value money-text" style="font-style:italic;">${escapeHtml(moneyText)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Kèm theo:</div>
                        <div class="value">.................................................................................................</div>
                    </div>
                    <div class="row">
                        <div class="label">Đã nhận đủ số tiền (Bằng chữ):</div>
                        <div class="value">.................................................................................................</div>
                    </div>

                    <div class="signature-section">
                        <div class="sig-block" style="text-align:left;">
                            <div class="promo-section">
                                <div style="text-decoration:underline;">ƯU ĐÃI:</div>
                                <div>- Đóng cước trước để tặng 1-3 tháng</div>
                                <div>- Nhận lắp đặt camera, bán sim mạng ô tô</div>
                                <div>- Bán sim số đẹp, sim phong thủy giá rẻ</div>
                            </div>
                        </div>
                        <div class="sig-block">
                            <div style="font-style:italic;">Ngày ...... tháng ...... năm 20....</div>
                            <div class="sig-title">NGƯỜI NHẬN TIỀN</div>
                            <div style="margin-top:60px; font-weight:bold;">${escapeHtml(collector.name)}</div>
                            <div style="font-weight:bold;">${escapeHtml(collector.phone)}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    dom.printArea.innerHTML = html;
    window.print();
}

function downloadSampleExcel() {
    try {
        const wsData = [
            ['Mã khách hàng (Account)', 'Tên khách hàng', 'SĐT liên hệ', 'Địa chỉ', 'Tổng cước'],
            ['T001_EXAMPLE', 'NGUYỄN VĂN A', '0987654321', '123 Đường ABC, Hà Nội', 200000],
            ['T002_EXAMPLE', 'TRẦN THỊ B', '0912345678', '456 Đường XYZ, TP.HCM', 150000]
        ];
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Lieu');
        XLSX.writeFile(workbook, 'Mau_Nhap_Lieu_Viettel.xlsx');
    } catch (error) {
        alert(`Lỗi khi tải file mẫu: ${error.message}`);
        console.error(error);
    }
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

const chuSo = [' không ', ' một ', ' hai ', ' ba ', ' bốn ', ' năm ', ' sáu ', ' bảy ', ' tám ', ' chín '];
const tien = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];

function docSo3ChuSo(soBaChuSo) {
    let ketQua = '';
    const tram = parseInt(soBaChuSo / 100, 10);
    const chuc = parseInt((soBaChuSo % 100) / 10, 10);
    const donVi = soBaChuSo % 10;

    if (tram === 0 && chuc === 0 && donVi === 0) {
        return '';
    }

    if (tram !== 0) {
        ketQua += chuSo[tram] + ' trăm ';
        if (chuc === 0 && donVi !== 0) {
            ketQua += ' linh ';
        }
    }

    if (chuc !== 0 && chuc !== 1) {
        ketQua += chuSo[chuc] + ' mươi';
        if (donVi !== 0) {
            ketQua += ' ';
        }
    }

    if (chuc === 1) {
        ketQua += ' mười ';
    }

    switch (donVi) {
        case 1:
            ketQua += chuc !== 0 && chuc !== 1 ? 'mốt ' : chuSo[donVi];
            break;
        case 5:
            ketQua += chuc === 0 ? chuSo[donVi] : 'lăm ';
            break;
        default:
            if (donVi !== 0) {
                ketQua += chuSo[donVi];
            }
            break;
    }

    return ketQua;
}

function docTienBangChu(soTien) {
    if (Number.isNaN(soTien)) {
        return 'Số tiền không hợp lệ.';
    }
    if (soTien < 0) {
        return 'Số tiền âm.';
    }
    if (soTien === 0) {
        return 'Không đồng';
    }
    if (soTien > 8999999999999999) {
        return 'Số quá lớn';
    }

    const viTri = [];
    let so = soTien;
    viTri[5] = Math.floor(so / 1000000000000000);
    so -= viTri[5] * 1000000000000000;
    viTri[4] = Math.floor(so / 1000000000000);
    so -= viTri[4] * 1000000000000;
    viTri[3] = Math.floor(so / 1000000000);
    so -= viTri[3] * 1000000000;
    viTri[2] = Math.floor(so / 1000000);
    so -= viTri[2] * 1000000;
    viTri[1] = Math.floor(so / 1000);
    so -= viTri[1] * 1000;
    viTri[0] = Math.floor(so);

    let lan = 0;
    for (let i = 5; i >= 0; i -= 1) {
        if (viTri[i] > 0) {
            lan = i;
            break;
        }
    }

    let ketQua = '';
    for (let i = lan; i >= 0; i -= 1) {
        const tmp = docSo3ChuSo(viTri[i]);
        ketQua += tmp;
        if (viTri[i] > 0) {
            ketQua += tien[i];
        }
        if (i > 0 && tmp.length > 0) {
            ketQua += ', ';
        }
    }

    ketQua = ketQua.replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
    ketQua = ketQua.charAt(0).toUpperCase() + ketQua.slice(1);
    return `${ketQua} đồng`;
}

init();
