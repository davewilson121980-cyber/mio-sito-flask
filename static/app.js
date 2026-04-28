// Stato dell'applicazione
let currentLat = 41.9028; // Roma
let currentLon = 12.4964;
let map = null;
let weatherLayer = null;

// Elementi DOM
const dom = {
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    geoBtn: document.getElementById('geoBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    alertToggle: document.getElementById('alertToggle'),
    locationName: document.getElementById('locationName'),
    lastUpdate: document.getElementById('lastUpdate'),
    currentTemp: document.getElementById('currentTemp'),
    weatherText: document.getElementById('weatherText'),
    weatherIcon: document.getElementById('weatherIcon'),
    windSpeed: document.getElementById('windSpeed'),
    humidity: document.getElementById('humidity'),
    pressure: document.getElementById('pressure'),
    dailyForecast: document.getElementById('dailyForecast'),
    hourlyForecast: document.getElementById('hourlyForecast'),
    alertsList: document.getElementById('alertsList'),
    badge: document.querySelector('.badge'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    layerBtns: document.querySelectorAll('.layer-btn')
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadWeather();
    setupEventListeners();
});

function setupEventListeners() {
    // Ricerca
    dom.searchBtn.addEventListener('click', searchCity);
    dom.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCity();
    });

    // Geolocalizzazione
    dom.geoBtn.addEventListener('click', getUserLocation);

    // Aggiorna
    dom.refreshBtn.addEventListener('click', () => {
        const icon = dom.refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        loadWeather().finally(() => icon.classList.remove('fa-spin'));
    });

    // Navigazione
    dom.navItems.forEach(item => {
        item.addEventListener('click', () => {
            dom.navItems.forEach(n => n.classList.remove('active'));
            dom.views.forEach(v => v.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`view-${item.dataset.view}`).classList.add('active');

            if (item.dataset.view === 'map' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });

    // Allerte
    dom.alertToggle.addEventListener('click', () => {
        dom.navItems.forEach(n => n.classList.remove('active'));
        dom.views.forEach(v => v.classList.remove('active'));
        document.querySelector('[data-view="alerts"]').classList.add('active');
        document.querySelector('[data-view="alerts"]').parentElement.querySelector('.nav-item').classList.add('active');
        loadAlerts();
    });

    // Layer Mappa
    dom.layerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dom.layerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateMapLayer(btn.dataset.layer);
        });
    });
}

// Funzioni API
async function searchCity() {
    const query = dom.cityInput.value;
    if (!query) return;

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.length > 0) {
            selectCity(data[0]);
        } else {
            alert('Città non trovata');
        }
    } catch (err) {
        console.error(err);
        alert('Errore nella ricerca');
    }
}

function selectCity(city) {
    currentLat = city.latitude;
    currentLon = city.longitude;
    dom.locationName.textContent = `${city.name}`;
    dom.cityInput.value = '';
    loadWeather();

    if (map) {
        map.setView([currentLat, currentLon], 10);
        updateMapMarkers();
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                currentLat = pos.coords.latitude;
                currentLon = pos.coords.longitude;
                dom.locationName.textContent = "La tua posizione";
                loadWeather();
                if (map) {
                    map.setView([currentLat, currentLon], 12);
                    updateMapMarkers();
                }
            },
            () => alert('Impossibile ottenere la posizione')
        );
    }
}

async function loadWeather() {
    try {
        const res = await fetch(`/api/weather?lat=${currentLat}&lon=${currentLon}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        updateCurrentWeather(data.current);
        updateDailyForecast(data.daily);
        updateHourlyForecast(data.hourly);

        const now = new Date();
        dom.lastUpdate.textContent = `Aggiornato: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Controlla allerte in background
        checkAlertsCount();

    } catch (err) {
        console.error(err);
        dom.weatherText.textContent = "Errore caricamento";
    }
}

function updateCurrentWeather(current) {
    dom.currentTemp.textContent = Math.round(current.temperature_2m);
    dom.windSpeed.textContent = `${current.wind_speed_10m} km/h`;
    dom.humidity.textContent = `${current.relative_humidity_2m}%`;
    dom.pressure.textContent = `${current.pressure_msl} hPa`;

    const info = getWeatherInfo(current.weather_code);
    dom.weatherText.textContent = info.desc;
    dom.weatherIcon.className = `fa-solid ${info.icon}`;
}

function updateDailyForecast(daily) {
    dom.dailyForecast.innerHTML = '';
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    for (let i = 1; i < 6; i++) { // Prossimi 5 giorni
        const date = new Date(daily.time[i]);
        const dayName = days[date.getDay()];
        const info = getWeatherInfo(daily.weather_code[i]);

        const html = `
            <div class="forecast-item">
                <span>${dayName}</span>
                <i class="fa-solid ${info.icon}" style="color: var(--warning)"></i>
                <span>${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</span>
            </div>
        `;
        dom.dailyForecast.innerHTML += html;
    }
}

function updateHourlyForecast(hourly) {
    dom.hourlyForecast.innerHTML = '';
    const now = new Date().getHours();

    for (let i = 0; i < 24; i++) {
        const hourIndex = now + i;
        if (hourIndex >= hourly.time.length) break;

        const time = new Date(hourly.time[hourIndex]).getHours();
        const info = getWeatherInfo(hourly.weather_code[hourIndex]);

        const html = `
            <div class="hourly-item">
                <span>${time}:00</span>
                <i class="fa-solid ${info.icon}"></i>
                <span>${Math.round(hourly.temperature_2m[hourIndex])}°</span>
            </div>
        `;
        dom.hourlyForecast.innerHTML += html;
    }
}

async function loadAlerts() {
    try {
        const res = await fetch(`/api/alerts?lat=${currentLat}&lon=${currentLon}`);
        const alerts = await res.json();

        dom.alertsList.innerHTML = '';
        if (alerts.length === 0) {
            dom.alertsList.innerHTML = '<p>Nessuna allerta attiva al momento.</p>';
            return;
        }

        alerts.forEach(alert => {
            const cls = alert.level === 'Rossa' || alert.level === 'Arancione' ? 'alert-item' : 'alert-item warning';
            dom.alertsList.innerHTML += `
                <div class="${cls}">
                    <h4>${alert.title} (${alert.level})</h4>
                    <p>${alert.description}</p>
                    <small>Ora: ${alert.time}</small>
                </div>
            `;
        });
    } catch (err) {
        dom.alertsList.innerHTML = '<p>Errore nel recupero allerte.</p>';
    }
}

async function checkAlertsCount() {
    try {
        const res = await fetch(`/api/alerts?lat=${currentLat}&lon=${currentLon}`);
        const alerts = await res.json();
        if (alerts.length > 0) {
            dom.badge.textContent = alerts.length;
            dom.badge.classList.remove('hidden');
        } else {
            dom.badge.classList.add('hidden');
        }
    } catch (e) { }
}

// Mappa
function initMap() {
    map = L.map('mapContainer').setView([currentLat, currentLon], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    updateMapMarkers();
}

function updateMapMarkers() {
    if (weatherLayer) map.removeLayer(weatherLayer);

    weatherLayer = L.marker([currentLat, currentLon]).addTo(map)
        .bindPopup(`<b>${dom.locationName.textContent}</b><br>${dom.currentTemp.textContent}°C`)
        .openPopup();
}

function updateMapLayer(layerType) {
    // Simulazione cambio layer (in un'app reale si userebbero tile layer diversi o heatmap)
    let color = '#3b82f6'; // temp
    if (layerType === 'wind') color = '#10b981';
    if (layerType === 'rain') color = '#ef4444';

    if (weatherLayer) {
        weatherLayer.setIcon(L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${color}; width:15px; height:15px; border-radius:50%; border:2px solid white;"></div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7]
        }));
    }
    alert(`Layer cambiato a: ${layerType.toUpperCase()}. (Nota: I dati reali richiederebbero tile server specifici)`);
}

// Utility WMO Codes
function getWeatherInfo(code) {
    const codes = {
        0: { desc: 'Cielo sereno', icon: 'fa-sun' },
        1: { desc: 'Prevalentemente sereno', icon: 'fa-cloud-sun' },
        2: { desc: 'Parzialmente nuvoloso', icon: 'fa-cloud' },
        3: { desc: 'Nuvoloso', icon: 'fa-cloud' },
        45: { desc: 'Nebbia', icon: 'fa-smog' },
        48: { desc: 'Nebbia con brina', icon: 'fa-smog' },
        51: { desc: 'Pioggia leggera', icon: 'fa-cloud-rain' },
        61: { desc: 'Pioggia moderata', icon: 'fa-cloud-showers-heavy' },
        71: { desc: 'Neve', icon: 'fa-snowflake' },
        80: { desc: 'Rovesci', icon: 'fa-cloud-showers-water' },
        95: { desc: 'Temporale', icon: 'fa-bolt' },
        96: { desc: 'Temporale con grandine', icon: 'fa-bolt' }
    };
    return codes[code] || { desc: 'Sconosciuto', icon: 'fa-question' };
}