from flask import Flask, render_template, jsonify, request
import requests
from datetime import datetime

app = Flask(__name__)

# Configurazione API Open-Meteo
BASE_URL = "https://api.open-meteo.com/v1"
GEO_URL = "https://geocoding-api.open-meteo.com/v1"

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/api/search')
def search_city():
    """Cerca una città e restituisce lat/lon"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Nome città richiesto'}), 400
    
    try:
        response = requests.get(f"{GEO_URL}/search", params={
            'name': query,
            'count': 5,
            'language': 'it',
            'format': 'json'
        })
        data = response.json()
        results = []
        if 'results' in data:
            for r in data['results']:
                results.append({
                    'name': f"{r['name']}, {r.get('country_code', '')}",
                    'latitude': r['latitude'],
                    'longitude': r['longitude'],
                    'country': r.get('country', '')
                })
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather')
def get_weather():
    """Ottiene dati meteo attuali e previsioni"""
    lat = request.args.get('lat', 41.9028) # Default Roma
    lon = request.args.get('lon', 12.4964)
    
    try:
        # Richiesta completa: attuale, orario (48h), giornaliero (7gg)
        response = requests.get(f"{BASE_URL}/forecast", params={
            'latitude': lat,
            'longitude': lon,
            'current': ['temperature_2m', 'relative_humidity_2m', 'weather_code', 
                        'wind_speed_10m', 'wind_direction_10m', 'pressure_msl'],
            'hourly': ['temperature_2m', 'weather_code', 'precipitation_probability'],
            'daily': ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 
                      'sunrise', 'sunset', 'precipitation_sum'],
            'timezone': 'auto',
            'forecast_days': 7
        })
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/alerts')
def get_alerts():
    """Simula allerte meteo (Open-Meteo free non ha allerte dirette, usiamo logica simulata basata sui codici)"""
    lat = request.args.get('lat', 41.9028)
    lon = request.args.get('lon', 12.4964)
    
    # Recupera il codice meteo attuale per generare un'allerta simulata se necessario
    try:
        response = requests.get(f"{BASE_URL}/forecast", params={
            'latitude': lat,
            'longitude': lon,
            'current': ['weather_code'],
            'timezone': 'auto'
        })
        data = response.json()
        code = data['current']['weather_code']
        
        alerts = []
        # Codici WMO per maltempo: 61-67 (pioggia), 71-77 (neve), 95-99 (temporale)
        if code >= 61:
            severity = "Gialla" if code < 80 else "Arancione" if code < 95 else "Rossa"
            alerts.append({
                'level': severity,
                'title': 'Allerta Meteo',
                'description': f'Previste precipitazioni intense (Codice WMO: {code}). Prestare attenzione.',
                'time': datetime.now().strftime("%H:%M")
            })
        
        return jsonify(alerts)
    except Exception as e:
        return jsonify([])

if __name__ == '__main__':
    app.run(debug=True, port=5000)