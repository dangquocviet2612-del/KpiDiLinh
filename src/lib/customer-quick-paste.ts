type CnkdUser = { username: string };

/** Optional fields are omitted so existing form values can be preserved. */
export function parseCustomerQuickPaste(text: string, users: readonly CnkdUser[]) {
    const labeledAccounts = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^account\s*:/i.test(line)).map((line) => line.replace(/^account\s*:\s*/i, ""));
    if (labeledAccounts.length > 1) throw new Error("Chỉ được có một account.");
    const lines = text.split(/\r?\n/).map((line) => line.trim().replace(/^account\s*:\s*/i, "")).filter(Boolean);
    if (lines.length < 2 || lines.length > 5) throw new Error("Cần tên khách hàng và account; có thể thêm CNKD, số điện thoại và tọa độ, mỗi mục một dòng.");
    const result: { name: string; account: string; ctvCode?: string; phone?: string; latitude?: string; longitude?: string } = { name: "", account: "" };
    const coordinatePattern = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/;
    const coordinateLines = lines.filter((line) => coordinatePattern.test(line));
    if (coordinateLines.length > 1) throw new Error("Chỉ được có một dòng tọa độ dạng vĩ độ, kinh độ.");
    const coordinateLine = coordinateLines[0];
    if (coordinateLine) {
        const match = coordinateLine.match(coordinatePattern)!;
        let latitude = Number(match[1]);
        let longitude = Number(match[2]);
        if (Math.abs(latitude) > 90 && Math.abs(latitude) <= 180 && Math.abs(longitude) <= 90) {
            [latitude, longitude] = [longitude, latitude];
        }
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            throw new Error("Tọa độ ngoài phạm vi: vĩ độ ±90, kinh độ ±180.");
        }
        result.latitude = String(latitude);
        result.longitude = String(longitude);
    }
    const remaining = lines.filter((line) => line !== coordinateLine);
    const candidates = remaining.map((line) => ({
        line,
        matches: users.filter(({ username }) => {
            const normalized = username.toLowerCase();
            return normalized === line.toLowerCase() || normalized.replace(/_ldg_cnkd$/, "") === line.toLowerCase();
        }),
    }));
    if (candidates.some(({ matches }) => matches.length > 1)) throw new Error("CNKD khớp nhiều người dùng; hãy kiểm tra mã đầy đủ.");
    const cnkd = candidates.filter(({ matches }) => matches.length === 1);
    if (cnkd.length > 1) throw new Error("Cần một CNKD duy nhất trong danh sách người dùng hiện có.");
    if (cnkd[0]) result.ctvCode = cnkd[0].matches[0].username;
    const details = remaining.filter((line) => line !== cnkd[0]?.line);
    const phones = details.filter((line) => !labeledAccounts.includes(line) && /^[+\d][\d\s().-]*$/.test(line));
    if (phones.length > 1) throw new Error("Có nhiều số điện thoại; chỉ dán một số.");
    if (phones[0]) {
        const digits = phones[0].replace(/[^\d+]/g, "");
        const phone = digits.replace(/^(?:\+84|84)/, "0");
        if (!/^0[35789]\d{8}$/.test(phone)) throw new Error("Số điện thoại di động không hợp lệ.");
        result.phone = phone;
    }
    const identity = details.filter((line) => line !== phones[0]);
    const accounts = identity.filter((line) => /^[\p{L}\p{N}_.-]+$/u.test(line) && (labeledAccounts.includes(line) || /[_\d]/.test(line)));
    if (accounts.length !== 1) throw new Error("Cần một account rõ ràng (một dòng có chữ số hoặc dấu gạch dưới) và một tên khách hàng.");
    const names = identity.filter((line) => line !== accounts[0]);
    const name = names[0];
    if (names.length !== 1 || !name || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) {
        throw new Error("Tên khách hàng hoặc CNKD không rõ ràng; vui lòng kiểm tra các dòng đã dán.");
    }
    return { ...result, name, account: accounts[0] };
}
