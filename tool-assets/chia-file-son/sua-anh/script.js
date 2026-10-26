document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (window.self !== window.top || params.get('embedded') === '1') {
        document.body.classList.add('is-embedded');
    }
    if (params.get('single') === '1') {
        document.body.classList.add('single-view');
    }

    const dom = {
        imageInput: document.getElementById('imageInput'),
        logoInput: document.getElementById('logoInput'),
        previewImage: document.getElementById('previewImage'),
        logoImage: document.getElementById('logoImage'),
        overlay: document.getElementById('overlay'),
        placeholderText: document.getElementById('placeholderText'),
        captureTarget: document.getElementById('captureTarget'),
        nameInput: document.getElementById('nameInput'),
        dateInput: document.getElementById('dateInput'),
        timeInput: document.getElementById('timeInput'),
        useCurrentTime: document.getElementById('useCurrentTime'),
        coordsInput: document.getElementById('coordsInput'),
        getLocationBtn: document.getElementById('getLocationBtn'),
        openMapBtn: document.getElementById('openMapBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        displayName: document.getElementById('displayName'),
        displayTime: document.getElementById('displayTime'),
        displayDate: document.getElementById('displayDate'),
        displayDay: document.getElementById('displayDay'),
        displayCoords: document.getElementById('displayCoords'),
        mapModal: document.getElementById('mapModal'),
        closeBtn: document.querySelector('.close-btn'),
        confirmCoordsBtn: document.getElementById('confirmCoordsBtn'),
        zoomSlider: document.getElementById('zoomSlider'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomValue: document.getElementById('zoomValue')
    };

    let timeInterval = null;
    let map = null;
    let marker = null;
    let selectedCoords = null;
    let stampScale = 1;

    init();

    function init() {
        syncTimeInputsState();
        updateTimeDisplay();
        timeInterval = window.setInterval(updateTimeDisplay, 1000);

        dom.nameInput.addEventListener('input', () => {
            dom.displayName.textContent = dom.nameInput.value || '';
        });

        dom.coordsInput.addEventListener('input', () => {
            dom.displayCoords.textContent = `T?a d?: ${dom.coordsInput.value}`;
        });

        dom.useCurrentTime.addEventListener('change', handleTimeModeChange);
        dom.dateInput.addEventListener('input', handleManualTimeInput);
        dom.timeInput.addEventListener('input', handleManualTimeInput);
        dom.imageInput.addEventListener('change', handleImageUpload);
        dom.logoInput.addEventListener('change', handleLogoUpload);
        dom.getLocationBtn.addEventListener('click', handleGetLocation);
        dom.openMapBtn.addEventListener('click', openMapModal);
        dom.closeBtn.addEventListener('click', closeMapModal);
        dom.confirmCoordsBtn.addEventListener('click', applySelectedCoords);
        dom.downloadBtn.addEventListener('click', handleDownload);

        function onZoomSliderChange() {
            stampScale = Number(dom.zoomSlider.value) / 100;
            applyStampScale();
        }
        dom.zoomSlider.addEventListener('input', onZoomSliderChange);
        dom.zoomSlider.addEventListener('change', onZoomSliderChange);
        dom.zoomInBtn.addEventListener('click', () => {
            stampScale = Math.min(2, Math.round((stampScale + 0.1) * 10) / 10);
            applyStampScale();
        });
        dom.zoomOutBtn.addEventListener('click', () => {
            stampScale = Math.max(0.3, Math.round((stampScale - 0.1) * 10) / 10);
            applyStampScale();
        });

        window.addEventListener('click', (event) => {
            if (event.target === dom.mapModal) {
                closeMapModal();
            }
        });
    }

    function handleTimeModeChange() {
        if (dom.useCurrentTime.checked) {
            updateTimeDisplay();
            clearInterval(timeInterval);
            timeInterval = window.setInterval(updateTimeDisplay, 1000);
        } else {
            clearInterval(timeInterval);
        }
        syncTimeInputsState();
    }

    function syncTimeInputsState() {
        const disabled = dom.useCurrentTime.checked;
        dom.dateInput.disabled = disabled;
        dom.timeInput.disabled = disabled;
    }

    function handleManualTimeInput() {
        if (!dom.useCurrentTime.checked) {
            updateTimeDisplay();
        }
    }

    function updateTimeDisplay() {
        const now = new Date();

        if (dom.useCurrentTime.checked) {
            dom.dateInput.value = toInputDate(now);
            dom.timeInput.value = formatTime(now);
            dom.displayTime.textContent = formatTime(now);
            dom.displayDate.textContent = formatDate(now);
            dom.displayDay.textContent = getDayOfWeek(now);
            return;
        }

        const selectedDate = dom.dateInput.value ? new Date(dom.dateInput.value) : now;
        const displayTime = dom.timeInput.value || formatTime(now);

        dom.displayTime.textContent = displayTime;
        dom.displayDate.textContent = dom.dateInput.value ? formatDate(selectedDate) : formatDate(now);
        dom.displayDay.textContent = getDayOfWeek(selectedDate);
    }

    function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            dom.previewImage.src = loadEvent.target.result;
            dom.previewImage.style.display = 'block';
            dom.overlay.style.display = 'flex';
            dom.placeholderText.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function handleLogoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            dom.logoImage.src = loadEvent.target.result;
        };
        reader.readAsDataURL(file);
    }

    function handleGetLocation() {
        if (!navigator.geolocation) {
            alert('Tr�nh duy?t kh�ng h? tr? Geolocation.');
            return;
        }

        dom.getLocationBtn.textContent = '?';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                const coords = `${lat}, ${lng}`;
                dom.coordsInput.value = coords;
                dom.displayCoords.textContent = `T?a d?: ${coords}`;
                dom.getLocationBtn.textContent = '??';
            },
            (error) => {
                dom.getLocationBtn.textContent = '??';
                alert(`Kh�ng l?y du?c t?a d? hi?n t?i: ${error.message}`);
            }
        );
    }

    function openMapModal() {
        dom.mapModal.style.display = 'flex';

        let initialLat = 11.539336;
        let initialLng = 107.944720;
        const currentCoords = dom.coordsInput.value.split(',').map((value) => Number(value.trim()));
        if (currentCoords.length === 2 && !Number.isNaN(currentCoords[0]) && !Number.isNaN(currentCoords[1])) {
            [initialLat, initialLng] = currentCoords;
        }

        if (!map) {
            map = L.map('map').setView([initialLat, initialLng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            marker = L.marker([initialLat, initialLng]).addTo(map);

            map.on('click', (event) => {
                const lat = event.latlng.lat;
                const lng = event.latlng.lng;
                marker.setLatLng([lat, lng]);
                selectedCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                marker.bindPopup(`T?a d? d� ch?n: ${selectedCoords}`).openPopup();
            });
        } else {
            map.setView([initialLat, initialLng], map.getZoom() || 13);
            marker.setLatLng([initialLat, initialLng]);
        }

        selectedCoords = `${initialLat.toFixed(6)}, ${initialLng.toFixed(6)}`;
        setTimeout(() => map.invalidateSize(), 120);
    }

    function closeMapModal() {
        dom.mapModal.style.display = 'none';
    }

    function applySelectedCoords() {
        if (!selectedCoords && marker) {
            const position = marker.getLatLng();
            selectedCoords = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        }

        if (!selectedCoords) {
            alert('Vui l�ng ch?n m?t di?m tr�n b?n d?.');
            return;
        }

        dom.coordsInput.value = selectedCoords;
        dom.displayCoords.textContent = `T?a d?: ${selectedCoords}`;
        closeMapModal();
    }

    function handleDownload() {
        if (!dom.previewImage.src || dom.previewImage.style.display === 'none') {
            alert('Vui l�ng ch?n ?nh tru?c.');
            return;
        }

        html2canvas(dom.captureTarget, {
            useCORS: true,
            scale: 2,
            allowTaint: true,
            logging: false
        }).then((canvas) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    alert('Không thể tạo ảnh tải xuống.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `viettel_stamp_${Date.now()}.png`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        }).catch((error) => {
            console.error(error);
            alert('Kh�ng th? t?o ?nh t?i xu?ng.');
        });
    }

    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function toInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getDayOfWeek(date) {
        const day = date.getDay();
        if (day === 0) {
            return 'CN';
        }
        return `th${day + 1}`;
    }

    function applyStampScale() {
        dom.overlay.style.transform = `scale(${stampScale})`;
        dom.zoomSlider.value = Math.round(stampScale * 100);
        dom.zoomValue.textContent = `${Math.round(stampScale * 100)}%`;
    }
});

