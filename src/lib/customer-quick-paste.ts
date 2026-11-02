type CnkdUser = { username: string };

/** Four nonempty lines in any order. Ambiguous coordinate pairs retain latitude, longitude order. */
export function parseCustomerQuickPaste(text: string, users: readonly CnkdUser[]) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length !== 4) throw new Error("Cần đúng 4 dòng: tọa độ, CNKD, tên khách hàng và account.");
    const coordinatePattern = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/;
    const coordinateLines = lines.filter((line) => coordinatePattern.test(line));
    if (coordinateLines.length !== 1) throw new Error("Cần một dòng tọa độ hợp lệ dạng vĩ độ, kinh độ.");
    const coordinateLine = coordinateLines[0];
    const match = coordinateLine.match(coordinatePattern)!;
    let latitude = Number(match[1]);
    let longitude = Number(match[2]);
    if (Math.abs(latitude) > 90 && Math.abs(latitude) <= 180 && Math.abs(longitude) <= 90) {
        [latitude, longitude] = [longitude, latitude];
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error("Tọa độ ngoài phạm vi: vĩ độ ±90, kinh độ ±180.");
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
    if (cnkd.length !== 1) throw new Error("Không nhận diện được một CNKD duy nhất trong danh sách người dùng hiện có.");
    const details = remaining.filter((line) => line !== cnkd[0].line);
    const accounts = details.filter((line) => /^[\p{L}\p{N}.-]+(?:_[\p{L}\p{N}.-]+)+$/u.test(line));
    if (accounts.length !== 1) throw new Error("Cần một account có dấu gạch dưới và một tên khách hàng rõ ràng.");
    const name = details.find((line) => line !== accounts[0]);
    if (!name || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)) {
        throw new Error("Tên khách hàng không rõ ràng; vui lòng kiểm tra 4 dòng đã dán.");
    }
    return { name, account: accounts[0], ctvCode: cnkd[0].matches[0].username, latitude: String(latitude), longitude: String(longitude) };
}
