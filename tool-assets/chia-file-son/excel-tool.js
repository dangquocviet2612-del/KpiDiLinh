document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        inputFile: document.getElementById('et-inputFile'),
        fileDrop: document.getElementById('et-fileDrop'),
        fileStatus: document.getElementById('et-fileStatus'),
        filterRows: document.getElementById('et-filterRows'),
        addFilterRow: document.getElementById('et-addFilterRow'),
        staffPickerPanel: document.getElementById('et-staffPickerPanel'),
        targetFilterRow: document.getElementById('et-targetFilterRow'),
        globalManagerSelect: document.getElementById('et-globalManagerSelect'),
        globalEmployeeSelect: document.getElementById('et-globalEmployeeSelect'),
        addAllEmployees: document.getElementById('et-addAllEmployees'),
        staffPickerNote: document.getElementById('et-staffPickerNote'),
        outputModeRadios: Array.from(document.getElementsByName('et-outputMode')),
        splitSettings: document.getElementById('et-splitSettings'),
        splitColumn: document.getElementById('et-splitColumn'),
        btnRun: document.getElementById('et-btnRun'),
        statusMessage: document.getElementById('et-statusMessage'),
        loadingSpinner: document.getElementById('et-loadingSpinner')
    };

    const staffPickerState = {
        ready: false,
        me: null,
        managers: [],
        ctvs: [],
        error: null
    };

    let fileBuffer = null;
    let originalFileName = '';

    init();

    function init() {
        if (!dom.filterRows) {
            return;
        }

        if (!dom.filterRows.children.length) {
            createFilterRow('Mã CTV', 'SANGLT_LDG_CNKD,TAMDT_LDG_CNKD,LINHPM_LDG_CNKD,LONGNT_LDG_CNKD,NHUANVD_LDG_CNKD,ANLT_LDG_CNKD');
            createFilterRow();
            createFilterRow();
        }

        dom.inputFile?.addEventListener('change', handleFileSelect);
        dom.addFilterRow?.addEventListener('click', () => createFilterRow());
        dom.globalManagerSelect?.addEventListener('change', () => {
            populateGlobalEmployeeSelect();
            syncStaffPickerState();
        });
        dom.globalEmployeeSelect?.addEventListener('change', appendSelectedEmployeeToTargetRow);
        dom.targetFilterRow?.addEventListener('change', syncStaffPickerState);
        dom.addAllEmployees?.addEventListener('click', appendAllEmployeesToTargetRow);
        dom.outputModeRadios.forEach((radio) => radio.addEventListener('change', syncOutputMode));
        dom.btnRun?.addEventListener('click', handleRun);
        bindDragAndDrop();
        loadStaffPickerData();

        syncOutputMode();
        syncModeCards();
    }

    async function loadStaffPickerData() {
        try {
            const meResponse = await fetch('/api/me', { credentials: 'same-origin' });
            if (!meResponse.ok) {
                throw new Error('Không tải được thông tin người dùng hiện tại.');
            }

            const me = await meResponse.json();
            staffPickerState.me = me;

            if (me.role === 'ADMIN') {
                const [managerResponse, ctvResponse] = await Promise.all([
                    fetch('/api/users?role=MANAGER', { credentials: 'same-origin' }),
                    fetch('/api/users?role=CTV', { credentials: 'same-origin' }),
                ]);

                const managers = managerResponse.ok ? await managerResponse.json() : [];
                const ctvs = ctvResponse.ok ? await ctvResponse.json() : [];

                staffPickerState.managers = Array.isArray(managers)
                    ? managers.filter((user) => user.role === 'MANAGER').sort(compareByUsername)
                    : [];
                staffPickerState.ctvs = Array.isArray(ctvs)
                    ? ctvs.filter((user) => user.role === 'CTV').sort(compareByUsername)
                    : [];
            } else if (me.role === 'MANAGER') {
                const ctvResponse = await fetch('/api/users?role=CTV', { credentials: 'same-origin' });
                const ctvs = ctvResponse.ok ? await ctvResponse.json() : [];

                staffPickerState.managers = [{ id: me.id || me.username, username: me.username }];
                staffPickerState.ctvs = Array.isArray(ctvs)
                    ? ctvs.filter((user) => user.role === 'CTV').sort(compareByUsername)
                    : [];
            }

            staffPickerState.ready = true;
        } catch (error) {
            console.error(error);
            staffPickerState.error = error;
        } finally {
            refreshStaffPickerPanel();
        }
    }

    function bindDragAndDrop() {
        if (!dom.fileDrop) {
            return;
        }

        ['dragenter', 'dragover'].forEach((eventName) => {
            dom.fileDrop.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                dom.fileDrop.classList.add('is-dragover');
            });
        });

        ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
            dom.fileDrop.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                dom.fileDrop.classList.remove('is-dragover');
            });
        });

        dom.fileDrop.addEventListener('drop', async (event) => {
            const file = event.dataTransfer?.files?.[0];
            if (!file) {
                return;
            }
            await processSelectedFile(file);
        });
    }

    async function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        await processSelectedFile(file);
    }

    async function processSelectedFile(file) {
        setStatus(`Đang đọc file ${file.name}...`);
        setFileStatus('Đang đọc file...');

        try {
            fileBuffer = await file.arrayBuffer();
            originalFileName = file.name.replace(/\.[^/.]+$/, '');
            setFileStatus(file.name);
            setStatus('Đã đọc xong file. Thiết lập bộ lọc rồi chạy xử lý.', 'success');
        } catch (error) {
            console.error(error);
            fileBuffer = null;
            setFileStatus('Lỗi đọc file');
            setStatus(`Không đọc được file Excel: ${error.message}`, 'error');
            alert(`Lỗi đọc file Excel: ${error.message}`);
        }
    }

    function createFilterRow(column = '', value = '') {
        const row = document.createElement('div');
        row.className = 'filter-row';
        row.innerHTML = `
            <input type="text" class="filter-input filter-col" placeholder="Ví dụ: Mã CTV" value="${escapeAttr(column)}">
            <input type="text" class="filter-input filter-val" placeholder="Ví dụ: CTV01, CTV02" value="${escapeAttr(value)}">
            <button type="button" class="filter-remove" aria-label="Xóa dòng lọc">✕</button>
        `;

        const columnInput = row.querySelector('.filter-col');
        const valueInput = row.querySelector('.filter-val');

        columnInput.addEventListener('input', refreshStaffPickerPanel);
        valueInput.addEventListener('input', syncStaffPickerState);

        row.querySelector('.filter-remove').addEventListener('click', () => {
            if (dom.filterRows.children.length <= 1) {
                row.querySelectorAll('input').forEach((input) => {
                    input.value = '';
                });
                refreshStaffPickerPanel();
                return;
            }
            row.remove();
            refreshStaffPickerPanel();
        });

        dom.filterRows.appendChild(row);
        refreshStaffPickerPanel();
    }

    function refreshStaffPickerPanel() {
        populateTargetFilterRowSelect();
        populateGlobalManagerSelect();
        populateGlobalEmployeeSelect();
        syncStaffPickerState();
    }

    function populateTargetFilterRowSelect() {
        if (!dom.targetFilterRow) {
            return;
        }

        const rows = getFilterRows();
        const currentValue = dom.targetFilterRow.value;
        dom.targetFilterRow.innerHTML = '';

        if (!rows.length) {
            dom.targetFilterRow.appendChild(new Option('Chưa có dòng lọc', ''));
            dom.targetFilterRow.disabled = true;
            return;
        }

        rows.forEach((row, index) => {
            const columnName = row.querySelector('.filter-col')?.value.trim() || 'Chưa đặt tên cột';
            const optionLabel = `Dòng ${index + 1} • ${columnName}`;
            dom.targetFilterRow.appendChild(new Option(optionLabel, String(index)));
        });

        dom.targetFilterRow.disabled = false;

        const preferredIndex = rows.findIndex((row) => {
            const columnName = row.querySelector('.filter-col')?.value.trim() || '';
            return isCtvFilterColumn(columnName) || !columnName;
        });

        const nextValue = Array.from(dom.targetFilterRow.options).some((option) => option.value === currentValue)
            ? currentValue
            : String(preferredIndex >= 0 ? preferredIndex : 0);

        dom.targetFilterRow.value = nextValue;
    }

    function populateGlobalManagerSelect() {
        if (!dom.globalManagerSelect) {
            return;
        }

        const currentValue = dom.globalManagerSelect.value;
        dom.globalManagerSelect.innerHTML = '';

        if (!staffPickerState.ready) {
            dom.globalManagerSelect.appendChild(new Option('Đang tải danh sách quản lý', ''));
            dom.globalManagerSelect.disabled = true;
            return;
        }

        if (staffPickerState.me?.role === 'MANAGER') {
            dom.globalManagerSelect.appendChild(new Option(staffPickerState.me.username, staffPickerState.me.username));
            dom.globalManagerSelect.value = staffPickerState.me.username;
            dom.globalManagerSelect.disabled = true;
            return;
        }

        dom.globalManagerSelect.appendChild(new Option('Chọn quản lý', ''));
        staffPickerState.managers.forEach((manager) => {
            dom.globalManagerSelect.appendChild(new Option(manager.username, manager.username));
        });

        dom.globalManagerSelect.disabled = staffPickerState.managers.length === 0;
        dom.globalManagerSelect.value = Array.from(dom.globalManagerSelect.options).some((option) => option.value === currentValue)
            ? currentValue
            : '';
    }

    function populateGlobalEmployeeSelect() {
        if (!dom.globalEmployeeSelect) {
            return;
        }

        const currentValue = dom.globalEmployeeSelect.value;
        const employees = getEmployeesForSelectedManager();

        dom.globalEmployeeSelect.innerHTML = '';

        if (!staffPickerState.ready) {
            dom.globalEmployeeSelect.appendChild(new Option('Đang tải danh sách nhân viên', ''));
            dom.globalEmployeeSelect.disabled = true;
            return;
        }

        dom.globalEmployeeSelect.appendChild(new Option('Chọn mã NV để thêm', ''));

        employees.forEach((user) => {
            const label = user.secondaryCode
                ? `${user.username} • ${user.secondaryCode}`
                : user.username;
            dom.globalEmployeeSelect.appendChild(new Option(label, user.username));
        });

        dom.globalEmployeeSelect.disabled = employees.length === 0;
        dom.globalEmployeeSelect.value = Array.from(dom.globalEmployeeSelect.options).some((option) => option.value === currentValue)
            ? currentValue
            : '';
    }

    function syncStaffPickerState() {
        if (!dom.staffPickerPanel) {
            return;
        }

        const rows = getFilterRows();
        const employees = getEmployeesForSelectedManager();
        const hasReadyData = staffPickerState.ready && staffPickerState.ctvs.length > 0;
        const targetRow = getTargetFilterRow();
        const targetColumn = targetRow?.querySelector('.filter-col')?.value.trim() || '';

        dom.staffPickerPanel.classList.toggle('is-disabled', !hasReadyData);
        dom.targetFilterRow.disabled = !rows.length;
        dom.addAllEmployees.disabled = !employees.length;

        if (!hasReadyData) {
            setStaffPickerNote(staffPickerState.error
                ? 'Không tải được danh sách nhân viên từ CRM.'
                : 'Đang tải danh sách quản lý và nhân viên từ CRM.');
            return;
        }

        if (!rows.length) {
            setStaffPickerNote('Hãy thêm ít nhất một dòng lọc để chọn nơi đổ mã nhân viên.');
            return;
        }

        if (staffPickerState.me?.role === 'ADMIN' && !dom.globalManagerSelect.value) {
            setStaffPickerNote('Chọn NV quản lý để hiển thị danh sách nhân viên.');
            return;
        }

        if (!employees.length) {
            setStaffPickerNote('Quản lý này hiện chưa có nhân viên để thêm.');
            return;
        }

        if (targetColumn && !isCtvFilterColumn(targetColumn)) {
            setStaffPickerNote(`Dòng đích hiện là "${targetColumn}". Mã NV vẫn sẽ được thêm vào ô giá trị của dòng này.`);
            return;
        }

        setStaffPickerNote('Chọn mã NV để thêm nhanh, hoặc dùng nút thêm toàn bộ nhân viên của quản lý này.');
    }

    function appendSelectedEmployeeToTargetRow() {
        const selectedValue = dom.globalEmployeeSelect?.value || '';
        if (!selectedValue) {
            return;
        }

        appendValuesToTargetRow([selectedValue]);
        dom.globalEmployeeSelect.value = '';
    }

    function appendAllEmployeesToTargetRow() {
        const employees = getEmployeesForSelectedManager();
        if (!employees.length) {
            setStaffPickerNote('Quản lý này chưa có nhân viên để thêm.');
            return;
        }

        appendValuesToTargetRow(employees.map((user) => user.username));
    }

    function appendValuesToTargetRow(values) {
        const targetRow = getTargetFilterRow();
        const valueInput = targetRow?.querySelector('.filter-val');
        const columnInput = targetRow?.querySelector('.filter-col');

        if (!targetRow || !valueInput) {
            setStaffPickerNote('Không tìm thấy dòng lọc đích để thêm dữ liệu.');
            return;
        }

        const existingValues = valueInput.value
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        const normalizedSet = new Set(existingValues.map((value) => normalizeText(value)));

        let addedCount = 0;
        values.forEach((value) => {
            const normalizedValue = normalizeText(value);
            if (!normalizedValue || normalizedSet.has(normalizedValue)) {
                return;
            }
            existingValues.push(value);
            normalizedSet.add(normalizedValue);
            addedCount += 1;
        });

        if (!columnInput.value.trim()) {
            columnInput.value = 'Mã CTV';
        }

        valueInput.value = existingValues.join(',');
        refreshStaffPickerPanel();

        if (!addedCount) {
            setStaffPickerNote('Các mã NV đã có sẵn trong dòng lọc được chọn.');
            return;
        }

        const targetLabel = dom.targetFilterRow?.selectedOptions?.[0]?.textContent || 'dòng đã chọn';
        setStaffPickerNote(`Đã thêm ${addedCount} mã NV vào ${targetLabel}.`);
    }

    function getFilterRows() {
        return Array.from(dom.filterRows?.querySelectorAll('.filter-row') || []);
    }

    function getTargetFilterRow() {
        const rows = getFilterRows();
        const targetIndex = Number.parseInt(dom.targetFilterRow?.value || '0', 10);
        if (Number.isNaN(targetIndex)) {
            return rows[0] || null;
        }
        return rows[targetIndex] || rows[0] || null;
    }

    function getEmployeesForSelectedManager() {
        if (!staffPickerState.ready) {
            return [];
        }

        const selectedManager = staffPickerState.me?.role === 'MANAGER'
            ? staffPickerState.me.username
            : dom.globalManagerSelect?.value || '';

        if (!selectedManager) {
            return [];
        }

        return staffPickerState.ctvs
            .filter((user) => String(user.managerCode || '') === selectedManager)
            .sort(compareByUsername);
    }

    function setStaffPickerNote(message) {
        if (!dom.staffPickerNote) {
            return;
        }
        dom.staffPickerNote.textContent = message;
    }

    function syncOutputMode() {
        const isSplitMode = getSelectedMode() === 'auto';
        dom.splitSettings?.classList.toggle('is-hidden', !isSplitMode);
        syncModeCards();
    }

    function syncModeCards() {
        dom.outputModeRadios.forEach((radio) => {
            const card = radio.closest('.mode-card');
            if (card) {
                card.classList.toggle('is-selected', radio.checked);
                card.classList.toggle('active-mode', radio.checked);
            }
        });
    }

    async function handleRun() {
        if (!fileBuffer) {
            alert('Vui lòng chọn file Excel trước.');
            return;
        }

        if (getSelectedMode() === 'auto' && !dom.splitColumn.value.trim()) {
            alert('Vui lòng nhập tên cột dùng để tách file.');
            return;
        }

        setLoading(true);
        setStatus('Đang xử lý dữ liệu...');

        try {
            if (getSelectedMode() === 'merge') {
                await processMergeMode(getFilters());
            } else {
                await processAutoSplitMode(getFilters(), dom.splitColumn.value.trim());
            }
        } catch (error) {
            console.error(error);
            setStatus(`Xử lý thất bại: ${error.message}`, 'error');
            alert(`Đã xảy ra lỗi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function processMergeMode(filters) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);

        let totalRowsKept = 0;
        workbook.worksheets.forEach((worksheet) => {
            totalRowsKept += filterWorksheet(worksheet, filters);
        });

        if (totalRowsKept === 0) {
            setStatus('Không tìm thấy dữ liệu phù hợp.', 'error');
            alert('Không tìm thấy dữ liệu phù hợp.');
            return;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `${originalFileName}_filtered.xlsx`;
        saveAs(new Blob([buffer]), fileName);
        setStatus(`Đã tải xuống: ${fileName}`, 'success');
    }

    async function processAutoSplitMode(filters, splitColumn) {
        const scanWorkbook = new ExcelJS.Workbook();
        await scanWorkbook.xlsx.load(fileBuffer);

        const groups = new Set();

        for (const worksheet of scanWorkbook.worksheets) {
            const headers = getHeaders(worksheet);
            const splitColumnIndex = findHeaderIndex(headers, splitColumn);
            if (splitColumnIndex === -1) {
                continue;
            }

            const filterIndices = mapFiltersToIndices(headers, filters);
            if (filterIndices === null) {
                continue;
            }

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    return;
                }

                if (checkRowPasses(row, filterIndices)) {
                    const value = readCellValue(row.getCell(splitColumnIndex)) || 'Khong_xac_dinh';
                    groups.add(value);
                }
            });
        }

        const values = Array.from(groups);
        if (!values.length) {
            setStatus('Không có dữ liệu phù hợp để tách file.', 'error');
            alert('Không có dữ liệu phù hợp để tách file.');
            return;
        }

        const zip = new JSZip();
        let handled = 0;

        for (const groupValue of values) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);
            let hasData = false;

            for (const worksheet of workbook.worksheets) {
                const headers = getHeaders(worksheet);
                const splitColumnIndex = findHeaderIndex(headers, splitColumn);

                if (splitColumnIndex === -1) {
                    if (worksheet.rowCount > 1) {
                        worksheet.spliceRows(2, worksheet.rowCount - 1);
                    }
                    continue;
                }

                const filterIndices = mapFiltersToIndices(headers, filters);
                if (filterIndices === null) {
                    if (worksheet.rowCount > 1) {
                        worksheet.spliceRows(2, worksheet.rowCount - 1);
                    }
                    continue;
                }

                for (let rowIndex = worksheet.rowCount; rowIndex >= 2; rowIndex -= 1) {
                    const row = worksheet.getRow(rowIndex);
                    const passesFilters = checkRowPasses(row, filterIndices);
                    const value = readCellValue(row.getCell(splitColumnIndex)) || 'Khong_xac_dinh';

                    if (!passesFilters || value !== groupValue) {
                        worksheet.spliceRows(rowIndex, 1);
                    } else {
                        hasData = true;
                    }
                }
            }

            if (hasData) {
                const buffer = await workbook.xlsx.writeBuffer();
                const fileName = `${originalFileName}_${sanitizeFilePart(groupValue)}.xlsx`;

                if (values.length === 1) {
                    saveAs(new Blob([buffer]), fileName);
                    setStatus(`Đã tải xuống: ${fileName}`, 'success');
                    return;
                }

                zip.file(fileName, buffer);
            }

            handled += 1;
            setStatus(`Đang xử lý ${handled}/${values.length} nhóm dữ liệu...`);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const zipName = `${originalFileName}_split-files.zip`;
        saveAs(content, zipName);
        setStatus(`Đã tải xuống: ${zipName}`, 'success');
    }

    function getSelectedMode() {
        return dom.outputModeRadios.find((radio) => radio.checked)?.value || 'merge';
    }

    function isCtvFilterColumn(value) {
        const normalized = normalizeHeaderKey(value);
        return normalized === 'ma ctv' || normalized === 'ctv' || normalized === 'ma nhan vien';
    }

    function getHeaders(worksheet) {
        const headers = [];
        worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            headers[columnNumber] = readCellValue(cell);
        });
        return headers;
    }

    function mapFiltersToIndices(headers, filters) {
        const mapped = [];

        for (const filter of filters) {
            const columnIndex = findHeaderIndex(headers, filter.column);
            if (columnIndex === -1) {
                return null;
            }
            mapped.push({ columnIndex, values: filter.values });
        }

        return mapped;
    }

    function checkRowPasses(row, filterIndices) {
        if (!filterIndices) {
            return false;
        }

        return filterIndices.every((filter) => {
            const rawValue = readCellValue(row.getCell(filter.columnIndex));
            return filter.values.some((value) => rawValue.toLowerCase().includes(value.toLowerCase()));
        });
    }

    function filterWorksheet(worksheet, filters) {
        const headers = getHeaders(worksheet);
        const filterIndices = mapFiltersToIndices(headers, filters);

        if (filterIndices === null) {
            if (worksheet.rowCount > 1) {
                worksheet.spliceRows(2, worksheet.rowCount - 1);
            }
            return 0;
        }

        let kept = 0;
        for (let rowIndex = worksheet.rowCount; rowIndex >= 2; rowIndex -= 1) {
            const row = worksheet.getRow(rowIndex);
            if (!checkRowPasses(row, filterIndices)) {
                worksheet.spliceRows(rowIndex, 1);
            } else {
                kept += 1;
            }
        }

        return kept;
    }

    function getFilters() {
        return Array.from(dom.filterRows.querySelectorAll('.filter-row'))
            .map((row) => {
                const column = row.querySelector('.filter-col')?.value.trim() || '';
                const rawValues = row.querySelector('.filter-val')?.value.trim() || '';
                const values = rawValues.split(',').map((value) => value.trim()).filter(Boolean);
                if (!column || !values.length) {
                    return null;
                }
                return { column, values };
            })
            .filter(Boolean);
    }

    function readCellValue(cell) {
        if (!cell || cell.value === null || cell.value === undefined) {
            return '';
        }
        if (typeof cell.value === 'object' && cell.value.text) {
            return String(cell.value.text).trim();
        }
        return String(cell.value).trim();
    }

    function sanitizeFilePart(value) {
        return String(value || 'data').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    }

    function findHeaderIndex(headers, targetHeader) {
        const normalizedTarget = normalizeHeaderKey(targetHeader);
        if (!normalizedTarget) {
            return -1;
        }

        for (let index = 1; index < headers.length; index += 1) {
            if (normalizeHeaderKey(headers[index]) === normalizedTarget) {
                return index;
            }
        }

        return -1;
    }

    function normalizeHeaderKey(value) {
        return normalizeText(
            String(value || '')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
        );
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

    function compareByUsername(left, right) {
        return String(left?.username || '').localeCompare(String(right?.username || ''), 'vi');
    }

    function setLoading(isLoading) {
        dom.loadingSpinner?.classList.toggle('is-hidden', !isLoading);
        dom.btnRun.disabled = isLoading;
    }

    function setStatus(message, state = 'neutral') {
        if (!dom.statusMessage) {
            return;
        }
        dom.statusMessage.textContent = message;
        dom.statusMessage.dataset.state = state;
    }

    function setFileStatus(message) {
        if (!dom.fileStatus) {
            return;
        }
        dom.fileStatus.textContent = message;
    }

    function escapeAttr(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});
