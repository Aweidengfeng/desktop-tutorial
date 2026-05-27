export function registerWeatherModule(app) {
  Object.assign(app, {
    weatherQuery: app.weatherQuery || '',
    showWeatherSearchResult: !!app.showWeatherSearchResult,
    weatherSearchCamps: Array.isArray(app.weatherSearchCamps) ? app.weatherSearchCamps : [],

    showWeatherResult() {
      this.showWeatherSearchResult = true;
    },

    markSameCampWeathers(camps) {
      for (let i = 1; i < camps.length; i++) {
        const prev = camps[i - 1];
        const curr = camps[i];
        if (prev.weather && curr.weather &&
            prev.weather.temp === curr.weather.temp &&
            prev.weather.wind === curr.weather.wind &&
            prev.weather.humidity === curr.weather.humidity) {
          curr.sameWeatherAsPrev = true;
        }
      }
      return camps;
    },

    async geocodeByOSM(name) {
      if (!name || !name.trim()) return null;
      const key = 'osm_geo_' + name.trim().toLowerCase().replace(/\s+/g, '_');
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const obj = JSON.parse(cached);
          if (Date.now() - obj.ts < 7 * 24 * 3600 * 1000) return obj;
        }
      } catch(e) {}
      const now = Date.now();
      if (now - this.osmLastRequestTime < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.osmLastRequestTime)));
      }
      this.osmLastRequestTime = Date.now();
      try {
        const q = encodeURIComponent(name.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1&email=gaoshanyindi%40github.example.com`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const first = data[0];
        const result = { lat: parseFloat(first.lat), lon: parseFloat(first.lon), displayName: first.display_name, raw: first, ts: Date.now() };
        try { localStorage.setItem(key, JSON.stringify(result)); } catch(e) {}
        return result;
      } catch(e) { return null; }
    },

    async fetchOsmSuggestions(name) {
      if (!name || name.trim().length < 2) { this.osmSuggestions = []; this.showOsmSuggestions = false; return; }
      const now = Date.now();
      if (now - this.osmLastRequestTime < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.osmLastRequestTime)));
      }
      this.osmLastRequestTime = Date.now();
      this.osmSuggestionsLoading = true;
      try {
        const q = encodeURIComponent(name.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1&email=gaoshanyindi%40github.example.com`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) { this.osmSuggestions = []; this.osmSuggestionsLoading = false; return; }
        const data = await res.json();
        this.osmSuggestions = data.map(item => ({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          displayName: item.display_name,
          raw: item,
        }));
        this.showOsmSuggestions = this.osmSuggestions.length > 0;
      } catch(e) {
        this.osmSuggestions = [];
      }
      this.osmSuggestionsLoading = false;
    },

    selectOsmSuggestion(suggestion) {
      this.weatherSearch = suggestion.displayName.split(',')[0].trim();
      this.showOsmSuggestions = false;
      this.osmSuggestions = [];
      this._searchWeatherByCoords(suggestion.lat, suggestion.lon, suggestion.displayName);
    },

    async _searchWeatherByCoords(lat, lon, displayName) {
      this.weatherSearchLoading = true;
      this.weatherSearchResult = null;
      this.weatherSearchForecast = [];
      this.weatherSearchCamps = [];
      this.showWeatherSearchResult = true;
      try {
        const [wres, fres] = await Promise.all([
          fetch(`/api/weather?lat=${lat}&lon=${lon}&location=${encodeURIComponent(displayName)}`),
          fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`)
        ]);
        if (wres.ok) {
          this.weatherSearchResult = await wres.json();
        } else {
          this.weatherSearchResult = { error: '无法获取该地点天气', location: displayName };
        }
        if (fres.ok) {
          const fd = await fres.json();
          this.weatherSearchForecast = fd.forecast || [];
        }
      } catch(e) {
        this.weatherSearchResult = { error: '网络错误，请稍后重试' };
      }
      this.weatherSearchLoading = false;
    },

    async searchWeather() {
      if (!this.weatherSearch.trim()) return;
      this.weatherSearchLoading = true;
      this.weatherSearchResult = null;
      this.weatherSearchForecast = [];
      this.weatherSearchCamps = [];
      this.showWeatherSearchResult = true;
      const loc = this.weatherSearch.trim();
      const locEnc = encodeURIComponent(loc);
      try {
        const campsRes = await fetch(`/api/weather/camps?peak=${locEnc}`);
        if (campsRes.ok) {
          const campsData = await campsRes.json();
          if (campsData.camps && campsData.camps.length > 0) {
            this.weatherSearchCamps = this.markSameCampWeathers(campsData.camps);
            try {
              const wres = await fetch(`/api/weather?location=${locEnc}`);
              if (wres.ok) this.weatherSearchResult = await wres.json();
              else this.weatherSearchResult = { location: loc, temp: '-', wind: '-', humidity: '-', visibility: '-' };
            } catch(e) {
              this.weatherSearchResult = { location: loc, temp: '-', wind: '-', humidity: '-', visibility: '-' };
            }
            this.weatherSearchLoading = false;
            return;
          }
        }
      } catch(e) {}
      try {
        const [wres, fres] = await Promise.all([
          fetch(`/api/weather?location=${locEnc}`),
          fetch(`/api/weather/forecast?location=${locEnc}`)
        ]);
        if (wres.ok) {
          this.weatherSearchResult = await wres.json();
        } else {
          const errData = await wres.json().catch(() => ({}));
          this.weatherSearchResult = { error: errData.error || '未找到该地点天气，请检查地名是否正确' };
        }
        if (fres.ok) {
          const fd = await fres.json();
          this.weatherSearchForecast = fd.forecast || [];
        }
      } catch(e) {
        this.weatherSearchResult = { error: '网络错误，请稍后重试' };
      }
      if (this.weatherSearchResult && this.weatherSearchResult.error) {
        const geo = await this.geocodeByOSM(loc);
        if (geo) {
          try {
            const [wres2, fres2] = await Promise.all([
              fetch(`/api/weather?lat=${geo.lat}&lon=${geo.lon}&location=${encodeURIComponent(geo.displayName)}`),
              fetch(`/api/weather/forecast?lat=${geo.lat}&lon=${geo.lon}`)
            ]);
            if (wres2.ok) this.weatherSearchResult = await wres2.json();
            if (fres2.ok) { const fd2 = await fres2.json(); this.weatherSearchForecast = fd2.forecast || []; }
          } catch(e) {}
        } else {
          this.weatherSearchResult = { error: '未找到该地点，请尝试使用英文名或更具体的名称（例如 "Mount Everest Base Camp, Nepal"）' };
        }
      }
      this.weatherSearchLoading = false;
    },
  });
}
